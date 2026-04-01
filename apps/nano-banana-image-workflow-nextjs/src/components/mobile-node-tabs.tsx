"use client";

import type React from "react";
import { Upload, Edit, Palette } from "lucide-react";
import { useWorkflowStore } from "@/stores/workflow-store";
import { type Node } from "@xyflow/react";

const nodeTypes = [
  {
    type: "imageUpload",
    label: "Upload",
    icon: Upload,
    color: "text-primary",
    bgColor: "bg-primary/10 hover:bg-primary/20",
    borderColor: "border-primary/20",
  },
  {
    type: "editImage",
    label: "Edit",
    icon: Edit,
    color: "text-secondary",
    bgColor: "bg-secondary/10 hover:bg-secondary/20",
    borderColor: "border-secondary/20",
  },
  {
    type: "generateImage",
    label: "Generate",
    icon: Palette,
    color: "text-accent",
    bgColor: "bg-accent/10 hover:bg-accent/20",
    borderColor: "border-accent/20",
  },
];

export default function MobileNodeTabs() {
  const { addNode } = useWorkflowStore();

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleClick = (nodeType: string) => {
    // Place nodes in center of visible canvas area for mobile
    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight - 180; // Account for header (~100px) + bottom tabs (~80px)
    const x = canvasWidth / 2 - 160; // Center horizontally (node width is ~320px)
    const y = canvasHeight / 2 - 100; // Center vertically

    const newNode: Node = {
      id: `${nodeType}-${Date.now()}`,
      type: nodeType,
      position: { x, y },
      data: {
        label: `${nodeType} node`,
        images: [],
        prompt: "",
        result: null,
      },
    };

    addNode(newNode);
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border p-2 z-30">
      <div className="flex gap-2 justify-center">
        {nodeTypes.map((nodeType) => {
          const Icon = nodeType.icon;
          return (
            <div
              key={nodeType.type}
              className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 cursor-pointer active:scale-95 transition-all touch-manipulation min-w-20 ${nodeType.bgColor} ${nodeType.borderColor}`}
              draggable
              onDragStart={(event) => onDragStart(event, nodeType.type)}
              onClick={() => handleClick(nodeType.type)}
            >
              <Icon className={`w-5 h-5 mb-1 ${nodeType.color}`} />
              <span className="text-xs font-medium text-foreground">
                {nodeType.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}