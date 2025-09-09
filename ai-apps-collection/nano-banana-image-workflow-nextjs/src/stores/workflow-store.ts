import { create } from "zustand"
import type { Node, Edge } from "@xyflow/react"
import { getApiKey } from "@/lib/api-utils"

interface WorkflowState {
  nodes: Node[]
  edges: Edge[]
  isRunning: boolean
  results: string[]
  addNode: (node: Node) => void
  updateNode: (nodeId: string, data: Record<string, unknown>) => void
  removeNode: (nodeId: string) => void
  removeEdge: (edgeId: string) => void
  removeEdgesToNode: (nodeId: string) => void
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  setIsRunning: (running: boolean) => void
  addResult: (result: string) => void
  clearWorkflow: () => void
  executeWorkflow: () => Promise<void>
  executeNode: (nodeId: string) => Promise<void>
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: [],
  edges: [],
  isRunning: false,
  results: [],

  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),

  updateNode: (nodeId, data) =>
    set((state) => ({
      nodes: state.nodes.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node)),
    })),

  removeNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    })),

  removeEdge: (edgeId) =>
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== edgeId),
    })),

  removeEdgesToNode: (nodeId) =>
    set((state) => ({
      edges: state.edges.filter((edge) => edge.target !== nodeId),
    })),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setIsRunning: (running) => set({ isRunning: running }),
  addResult: (result) => set((state) => ({ results: [...state.results, result] })),

  clearWorkflow: () =>
    set({
      nodes: [],
      edges: [],
      results: [],
      isRunning: false,
    }),

  executeWorkflow: async () => {
    const { nodes, edges, setIsRunning } = get()

    if (nodes.length === 0) {
      return
    }

    setIsRunning(true)

    try {
      // Find nodes with no incoming edges (start nodes)
      const startNodes = nodes.filter((node) => !edges.some((edge) => edge.target === node.id))

      if (startNodes.length === 0) {
        setIsRunning(false)
        return
      }

      // Execute nodes in topological order
      const visited = new Set<string>()
      const executing = new Set<string>()

      const executeNodeRecursively = async (nodeId: string): Promise<void> => {
        if (visited.has(nodeId) || executing.has(nodeId)) return

        executing.add(nodeId)

        // Wait for all input nodes to complete
        const inputEdges = edges.filter((edge) => edge.target === nodeId)
        for (const edge of inputEdges) {
          if (!visited.has(edge.source)) {
            await executeNodeRecursively(edge.source)
          }
        }

        // Execute current node
        await get().executeNode(nodeId)

        executing.delete(nodeId)
        visited.add(nodeId)

        // Execute dependent nodes
        const outputEdges = edges.filter((edge) => edge.source === nodeId)
        for (const edge of outputEdges) {
          if (!visited.has(edge.target)) {
            await executeNodeRecursively(edge.target)
          }
        }
      }

      // Start execution from all start nodes
      for (const startNode of startNodes) {
        await executeNodeRecursively(startNode.id)
      }
    } catch {
    } finally {
      setIsRunning(false)
    }
  },

  executeNode: async (nodeId: string) => {
    const { nodes, edges, updateNode, addResult } = get()
    const node = nodes.find((n) => n.id === nodeId)

    if (!node) return


    // Set node to processing state
    updateNode(nodeId, { isProcessing: true, error: null })

    try {
      switch (node.type) {
        case "imageUpload":
          // Image upload nodes are already processed when files are selected
          if (node.data.uploadedImage) {
            updateNode(nodeId, {
              isProcessing: false,
              output: node.data.uploadedImage,
            })
            addResult(`Uploaded: ${node.data.fileName || "image"}`)
          }
          break

        case "editImage":
          if (node.data.prompt) {
            // Get input images from connected nodes
            const inputImages = edges
              .filter((edge) => edge.target === nodeId)
              .map((edge) => {
                const sourceNode = nodes.find((n) => n.id === edge.source)
                return sourceNode?.data.output as string
              })
              .filter((output): output is string => Boolean(output))

            if (inputImages.length > 0) {
              const requestBody: { images: string[]; prompt: string; apiKey?: string } = {
                images: inputImages,
                prompt: node.data.prompt as string,
              }

              // Get API key from localStorage if available
              const apiKey = getApiKey()
              if (apiKey) {
                requestBody.apiKey = apiKey
              }

              const response = await fetch("/api/edit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
              })

              const result = await response.json()

              if (result.success) {
                updateNode(nodeId, {
                  isProcessing: false,
                  output: result.imageUrl,
                  generatedImage: result.imageUrl,
                  enhancedPrompt: result.enhancedPrompt,
                  styleAnalysis: result.styleAnalysis,
                })
                addResult(`Edited image: ${node.data.prompt}`)
              } else {
                throw new Error(result.error)
              }
            }
          }
          break

        case "generateImage":
          if (node.data.prompt) {
            const requestBody: { prompt: string; apiKey?: string } = {
              prompt: node.data.prompt as string,
            }

            // Get API key from localStorage if available
            const apiKey = getApiKey()
            if (apiKey) {
              requestBody.apiKey = apiKey
            }

            const response = await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
            })

            const result = await response.json()

            if (result.success) {
              updateNode(nodeId, {
                isProcessing: false,
                output: result.imageUrl,
                generatedImage: result.imageUrl,
              })
              addResult(`Generated: ${node.data.prompt}`)
            } else {
              throw new Error(result.error)
            }
          }
          break
      }
    } catch (error) {
      updateNode(nodeId, {
        isProcessing: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  },
}))
