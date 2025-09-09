"use client";

import type React from "react";

import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  type Connection,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useWorkflowStore } from "@/stores/workflow-store";
import ImageUploadNode from "./image-upload-node";
import EditImageNode from "./edit-image-node";
import GenerateImageNode from "./generate-image-node";
import ImageResultNode from "./image-result-node";

const nodeTypes = {
  imageUpload: ImageUploadNode,
  editImage: EditImageNode,
  generateImage: GenerateImageNode,
  imageResult: ImageResultNode,
};

export default function WorkflowCanvas() {
  const { nodes, edges, addNode, setNodes, setEdges } = useWorkflowStore();

  const onNodesChange = useCallback(
    (changes: unknown[]) => {
      const updatedNodes = changes.reduce((acc: Node[], change: unknown) => {
        const typedChange = change as {
          type: string;
          id: string;
          position?: { x: number; y: number };
        };
        if (typedChange.type === "position") {
          return acc.map((node: Node) =>
            node.id === typedChange.id
              ? { ...node, position: typedChange.position || node.position }
              : node
          );
        }
        return acc;
      }, nodes);

      setNodes(updatedNodes);
    },
    [nodes, setNodes]
  );

  const onEdgesChange = useCallback(() => {
    // Handle edge changes if needed
    // For now, just update the store with current edges
    setEdges(edges);
  }, [edges, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdges = addEdge(params, edges);
      setEdges(newEdges);
    },
    [edges, setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (typeof type === "undefined" || !type) {
        return;
      }

      // Responsive positioning - adjust based on screen size
      const sidebarWidth = window.innerWidth >= 768 ? 250 : 0; // Only desktop has visible sidebar
      const headerHeight = 100;
      const position = {
        x: event.clientX - sidebarWidth,
        y: event.clientY - headerHeight,
      };

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: {
          label: `${type} node`,
          images: [],
          prompt: "",
          result: null,
        },
      };

      addNode(newNode);
    },
    [addNode]
  );

  return (
    <div className="w-full h-full relative pb-20 md:pb-0">
      {/* Empty state instructor overlay */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-background/80 border border-border rounded-xl p-6 max-w-md mx-4 opacity-60">
            <h3 className="text-lg font-semibold text-foreground mb-3 text-center">
              Get Started
            </h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">1.</span>
                <span>
                  Enter your <strong>Gemini API key</strong> in settings
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">2.</span>
                <span>
                  <strong>Drag</strong> components from the sidebar to the
                  canvas
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">3.</span>
                <span>
                  <strong>Connect</strong> nodes by clicking output dots then
                  input dots
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-foreground">4.</span>
                <span>
                  <strong>Process</strong> nodes to generate/edit images
                </span>
              </li>
            </ol>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
        className="bg-muted/20"
        // Better mobile interaction
        panOnScroll={false}
        zoomOnScroll={true}
        zoomOnDoubleClick={false}
        zoomOnPinch
        panOnDrag
        // Handle connections better on mobile
        snapToGrid
      >
        <Controls
          className="react-flow__controls"
          showZoom={true}
          showFitView={true}
          showInteractive={false}
          position="bottom-right"
        />
        <Background gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
