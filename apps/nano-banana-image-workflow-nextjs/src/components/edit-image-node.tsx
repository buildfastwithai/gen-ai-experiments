"use client";

import type React from "react";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Loader2, X, Trash2 } from "lucide-react";
import { useWorkflowStore } from "@/stores/workflow-store";
import { getApiKey } from "@/lib/api-utils";

interface EditImageNodeData {
  label: string;
  prompt: string;
  result: string | null;
  isProcessing?: boolean;
  error?: string;
  generatedImage?: string;
  output?: string;
  enhancedPrompt?: string;
  styleAnalysis?: string;
}

export default function EditImageNode({
  id,
  data,
}: {
  id: string;
  data: unknown;
}) {
  const nodeData = data as EditImageNodeData;
  const [prompt, setPrompt] = useState(nodeData?.prompt || "");
  const [inputImages, setInputImages] = useState<string[]>([]);
  const [removedImages, setRemovedImages] = useState<Set<number>>(new Set());
  const { updateNode, nodes, edges, addNode, removeNode } = useWorkflowStore();

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

  // Only update input images if the connected inputs actually changed
  useEffect(() => {
    const hasChanged =
      JSON.stringify(connectedInputs) !== JSON.stringify(inputImages);
    if (hasChanged) {
      setInputImages(connectedInputs);
      setRemovedImages(new Set()); // Reset removed images when inputs change
    }
  }, [connectedInputs, inputImages]);

  const handlePromptChange = useCallback(
    (value: string) => {
      setPrompt(value);
      updateNode(id, { prompt: value });
    },
    [id, updateNode]
  );

  const handleRemoveImage = useCallback((index: number) => {
    setRemovedImages((prev) => new Set([...prev, index]));
  }, []);

  const handleRestoreImage = useCallback((index: number) => {
    setRemovedImages((prev) => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  }, []);

  // Filter out removed images for processing
  const activeImages = useMemo(() => {
    return inputImages.filter((_, index) => !removedImages.has(index));
  }, [inputImages, removedImages]);

  const handleEdit = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (!prompt.trim() || activeImages.length === 0) return;

      updateNode(id, { isProcessing: true, error: null });

      try {
        const requestBody: {
          images: string[];
          prompt: string;
          apiKey?: string;
        } = {
          images: activeImages,
          prompt: prompt,
        };

        // Get API key from localStorage if available
        const apiKey = getApiKey();
        if (apiKey) {
          requestBody.apiKey = apiKey;
        }

        const response = await fetch("/api/edit", {
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
            enhancedPrompt: result.enhancedPrompt,
            styleAnalysis: result.styleAnalysis,
          });

          // Find current node position
          const currentNode = nodes.find((n) => n.id === id);
          const baseX = currentNode?.position?.x || 0;
          const baseY = currentNode?.position?.y || 0;

          // Create a new result node
          const resultNodeId = `edited-result-${Date.now()}`;
          const newResultNode = {
            id: resultNodeId,
            type: "imageResult",
            position: {
              x: baseX + 400, // Position to the right of the edit node
              y: baseY,
            },
            data: {
              label: "Edited Image",
              imageUrl: result.imageUrl,
              prompt: prompt,
              description: result.description || `Edited: ${prompt}`,
              enhancedPrompt: result.enhancedPrompt,
              styleAnalysis: result.styleAnalysis,
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
    [id, prompt, activeImages, updateNode, nodes, addNode]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      removeNode(id);
    },
    [id, removeNode]
  );

  return (
    <Card className="w-80 md:w-80 sm:w-72 p-3 md:p-4 bg-card border-2 border-border relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute -top-2 -right-2 w-6 h-6 p-0 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground border-2 border-background shadow-sm z-10"
        type="button"
      >
        <X className="w-3 h-3" />
      </Button>
      <div className="flex items-center gap-2 mb-3">
        <Edit className="w-4 h-4 text-secondary" />
        <span className="font-medium text-sm">Edit Image</span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Editing Prompt
          </label>
          <Textarea
            value={prompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            placeholder="Enter editing prompt..."
            className="text-sm resize-none touch-manipulation"
            rows={3}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          />
        </div>

        {inputImages.length > 0 ? (
          <div>
            <div className="grid grid-cols-1 gap-2 overflow-y-auto">
              {inputImages.slice(0, 4).map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image || "/placeholder.svg"}
                    alt={`Input ${index + 1}`}
                    className={`w-full aspect-video object-cover rounded border transition-opacity ${
                      removedImages.has(index) ? "opacity-30" : "opacity-100"
                    }`}
                    onError={(e) => {
                      e.currentTarget.src =
                        "/placeholder.svg?height=80&width=80&text=Error";
                    }}
                  />
                  {removedImages.has(index) ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRestoreImage(index)}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="text-xs px-2 py-1 h-auto"
                        type="button"
                      >
                        Restore
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveImage(index)}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute top-1 right-1 w-6 h-6 p-0 rounded-full bg-destructive/80 hover:bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      type="button"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
              {inputImages.length > 4 && (
                <div className="w-full h-20 bg-muted rounded border flex items-center justify-center text-xs text-muted-foreground">
                  +{inputImages.length - 4} more
                </div>
              )}
            </div>
            {activeImages.length < inputImages.length && (
              <div className="text-xs text-muted-foreground mt-2">
                Using {activeImages.length} of {inputImages.length} images
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            Connect image nodes to edit
          </div>
        )}

        {nodeData?.error && (
          <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
            Error: {nodeData.error}
          </div>
        )}

        <Button
          onClick={handleEdit}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={
            !prompt.trim() ||
            activeImages.length === 0 ||
            nodeData?.isProcessing
          }
          size="sm"
          className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground touch-manipulation"
          type="button"
        >
          {nodeData?.isProcessing ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              <span className="hidden sm:inline">Editing...</span>
              <span className="sm:hidden">Edit...</span>
            </>
          ) : (
            "Edit"
          )}
        </Button>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 bg-secondary border-2 border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 bg-secondary border-2 border-background"
      />
    </Card>
  );
}
