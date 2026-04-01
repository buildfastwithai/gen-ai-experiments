"use client";

import type React from "react";

import { useState, useCallback } from "react";
import { Handle, Position } from "@xyflow/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { useWorkflowStore } from "@/stores/workflow-store";

interface ImageUploadNodeData {
  label: string;
  images?: string[];
  uploadedImage?: string;
  fileName?: string;
  output?: string;
}

export default function ImageUploadNode({
  id,
  data,
}: {
  id: string;
  data: unknown;
}) {
  const nodeData = data as ImageUploadNodeData;
  const [isDragOver, setIsDragOver] = useState(false);
  const [localImages, setLocalImages] = useState<string[]>([]);
  const { updateNode, removeNode } = useWorkflowStore();

  const handleFileUpload = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) {
        return;
      }

      const file = files[0]; // Just handle one file for now
      const reader = new FileReader();

      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          // Update both local state and node data
          setLocalImages([result]);
          updateNode(id, {
            images: [result],
            uploadedImage: result,
            fileName: file.name,
            output: result,
          });
        }
      };

      reader.onerror = () => {};

      reader.readAsDataURL(file);
    },
    [id, updateNode]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFileUpload(e.dataTransfer.files);
    },
    [handleFileUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDeleteNode = useCallback(
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
        onClick={handleDeleteNode}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute -top-2 -right-2 w-6 h-6 p-0 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground border-2 border-background shadow-sm z-10"
        type="button"
      >
        <X className="w-3 h-3" />
      </Button>
      <div className="flex items-center gap-2 mb-3">
        <Upload className="w-4 h-4 text-primary" />
        <span className="font-medium text-sm">Image Upload</span>
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          isDragOver
            ? "border-primary bg-primary/10"
            : "border-muted-foreground/25"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handleFileUpload(e.target.files)}
          className="hidden"
          id={`file-input-${id}`}
        />
        <div>
          <div className="text-xs md:text-sm text-muted-foreground mb-2">
            Drop image here or tap to browse
          </div>
          <Button
            variant="outline"
            size="sm"
            type="button"
            className="touch-manipulation"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const fileInput = document.getElementById(
                `file-input-${id}`
              ) as HTMLInputElement;
              if (fileInput) {
                fileInput.click();
              }
            }}
          >
            Choose File
          </Button>
        </div>
      </div>

      <div className="mt-3">
        {((nodeData.images && nodeData.images.length > 0) ||
          localImages.length > 0) && (
          <div className="relative">
            <div className="w-full aspect-video bg-background border-2 border-accent/20 rounded overflow-hidden">
              <img
                src={localImages[0] || nodeData.images?.[0]}
                alt="Uploaded image"
                className="w-full h-full object-cover"
                style={{ display: "block" }}
                onLoad={() => {}}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setLocalImages([]);
                updateNode(id, {
                  images: [],
                  uploadedImage: undefined,
                  fileName: undefined,
                  output: undefined,
                });
              }}
              className="absolute -top-2 -right-2 w-7 h-7 md:w-6 md:h-6 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full flex items-center justify-center transition-colors touch-manipulation"
              type="button"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {(!nodeData.images || nodeData.images.length === 0) &&
          localImages.length === 0 && (
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
              No image uploaded yet
            </div>
          )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 bg-primary border-2 border-background"
      />
    </Card>
  );
}
