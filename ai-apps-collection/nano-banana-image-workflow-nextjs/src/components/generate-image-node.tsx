"use client";

import type React from "react";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Palette, Loader2, X } from "lucide-react";
import { useWorkflowStore } from "@/stores/workflow-store";
import { getApiKey } from "@/lib/api-utils";

interface GenerateImageNodeData {
  label: string;
  prompt: string;
  result: string | null;
  isProcessing?: boolean;
  error?: string;
  generatedImage?: string;
  output?: string;
}

export default function GenerateImageNode({
  id,
  data,
}: {
  id: string;
  data: unknown;
}) {
  const nodeData = data as GenerateImageNodeData;
  const [prompt, setPrompt] = useState(nodeData?.prompt || "");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const {
    updateNode,
    nodes,
    edges,
    addNode,
    removeEdgesToNode,
    removeEdge,
    removeNode,
  } = useWorkflowStore();

  // Memoize the connected inputs calculation to prevent unnecessary recalculations
  const connectedInputs = useMemo(() => {
    return edges
      .filter((edge) => edge.target === id)
      .map((edge) => {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        return sourceNode?.data?.output as string;
      })
      .filter(Boolean) as string[];
  }, [edges, nodes, id]);

  // Only update reference images if the connected inputs actually changed
  useEffect(() => {
    const hasChanged =
      JSON.stringify(connectedInputs) !== JSON.stringify(referenceImages);
    if (hasChanged) {
      setReferenceImages(connectedInputs);
    }
  }, [connectedInputs, referenceImages]);

  const handlePromptChange = useCallback(
    (value: string) => {
      setPrompt(value);
      updateNode(id, { prompt: value });
    },
    [id, updateNode]
  );

  const handleGenerate = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (!prompt.trim()) {
        return;
      }

      updateNode(id, { isProcessing: true, error: null });

      try {
        const requestBody: {
          prompt: string;
          inputImage?: string;
          inputImages?: string[];
          apiKey?: string;
        } = { prompt: prompt };

        // Add reference images as input if available
        if (referenceImages.length > 0) {
          if (referenceImages.length === 1) {
            requestBody.inputImage = referenceImages[0];
          } else {
            requestBody.inputImages = referenceImages;
          }
        }

        // Get API key from localStorage if available
        const apiKey = getApiKey();
        if (apiKey) {
          requestBody.apiKey = apiKey;
        }

        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        const result = await response.json();

        if (result.success) {
          // Clear the processing state
          updateNode(id, {
            isProcessing: false,
            output: result.imageUrl,
          });

          // Find current node position
          const currentNode = nodes.find((n) => n.id === id);
          const baseX = currentNode?.position?.x || 0;
          const baseY = currentNode?.position?.y || 0;

          // Create a new result node
          const resultNodeId = `result-${Date.now()}`;
          const newResultNode = {
            id: resultNodeId,
            type: "imageResult",
            position: {
              x: baseX + 400, // Position to the right of the generate node
              y: baseY,
            },
            data: {
              label: "Generated Image",
              imageUrl: result.imageUrl,
              prompt: prompt,
              description: result.description,
              generatedAt: new Date().toLocaleTimeString(),
              output: result.imageUrl, // This allows connecting to other nodes
            },
          };

          addNode(newResultNode);
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        updateNode(id, {
          isProcessing: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
    [id, prompt, updateNode, nodes, addNode]
  );

  const handleDeleteNode = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      removeNode(id);
    },
    [id, removeNode]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      updateNode(id, {
        result: null,
        output: null,
        generatedImage: null,
        error: null,
        isProcessing: false,
        prompt: "",
      });
      setPrompt("");
      setReferenceImages([]);
    },
    [id, updateNode]
  );

  const handleRemoveReferenceImages = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      // Remove all incoming edges to this node
      removeEdgesToNode(id);
      // Clear local reference images state
      setReferenceImages([]);
    },
    [id, removeEdgesToNode]
  );

  const handleRemoveIndividualImage = useCallback(
    (imageIndex: number) => (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      // Find the edge corresponding to this image index
      const targetEdges = edges.filter((edge) => edge.target === id);
      if (targetEdges[imageIndex]) {
        const edgeToRemove = targetEdges[imageIndex];
        // Remove the specific edge
        removeEdge(edgeToRemove.id);
      }
    },
    [id, edges, removeEdge]
  );

  return (
    <Card className="w-80 md:w-80 sm:w-72 p-3 md:p-4 bg-card border-2 border-border relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDeleteNode}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute -top-2 -right-2 w-6 h-6 p-0 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground border-2 border-background shadow-sm z-10"
        type="button"
      >
        <X className="w-3 h-3" />
      </Button>
      <div className="flex items-center gap-2 mb-3">
        <Palette className="w-4 h-4 text-accent" />
        <span className="font-medium text-sm">Generate Image</span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Generation Prompt
          </label>
          <Textarea
            value={prompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            placeholder="Describe the image you want to generate..."
            className="text-sm resize-none touch-manipulation"
            rows={3}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          />
        </div>

        {referenceImages.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground">
                {referenceImages.length} reference image
                {referenceImages.length > 1 ? "s" : ""}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveReferenceImages}
                onMouseDown={(e) => e.stopPropagation()}
                className="h-6 px-2 text-xs text-destructive hover:text-destructive/80 hover:bg-destructive/10 touch-manipulation"
                type="button"
              >
                Remove All
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {referenceImages.slice(0, 4).map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image || "/placeholder.svg"}
                    alt={`Reference ${index + 1}`}
                    className="w-full h-20 object-cover rounded border"
                    onError={(e) => {
                      e.currentTarget.src =
                        "/placeholder.svg?height=80&width=80&text=Error";
                    }}
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleRemoveIndividualImage(index)}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="absolute top-1 right-1 h-6 w-6 md:h-5 md:w-5 p-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity touch-manipulation"
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {referenceImages.length > 4 && (
                <div className="w-full h-20 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">
                  +{referenceImages.length - 4} more
                </div>
              )}
            </div>
          </div>
        )}

        {nodeData?.error && (
          <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
            {nodeData.error}
          </div>
        )}

        {nodeData?.isProcessing && (
          <div className="text-xs text-primary bg-primary/10 p-2 rounded">
            Generating...
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={!prompt.trim() || nodeData?.isProcessing}
            size="sm"
            className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground touch-manipulation"
            type="button"
          >
            {nodeData?.isProcessing ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                <span className="hidden sm:inline">Generating...</span>
                <span className="sm:hidden">Gen...</span>
              </>
            ) : (
              "Generate"
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={nodeData?.isProcessing}
            className="touch-manipulation"
            type="button"
          >
            Clear
          </Button>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 bg-accent border-2 border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 bg-accent border-2 border-background"
      />
    </Card>
  );
}
