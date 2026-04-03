"use client";

import type React from "react";
import { useState, useEffect } from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Edit, Palette, X, Key, ExternalLink } from "lucide-react";
import { getApiKey } from "@/lib/api-utils";

const nodeTypes = [
  {
    type: "imageUpload",
    label: "Image Upload",
    icon: Upload,
    description: "Upload images to start your workflow",
  },
  {
    type: "editImage",
    label: "Edit Image",
    icon: Edit,
    description: "Edit and combine multiple images with AI",
  },
  {
    type: "generateImage",
    label: "Generate Image",
    icon: Palette,
    description: "Generate new images from text prompts",
  },
];

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps = {}) {
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    const checkApiKey = () => {
      const apiKey = getApiKey();
      setHasApiKey(!!apiKey);
    };

    checkApiKey();

    // Listen for localStorage changes
    const handleStorageChange = () => {
      checkApiKey();
    };

    window.addEventListener("storage", handleStorageChange);
    // Also check periodically since localStorage events don't fire in same tab
    const interval = setInterval(checkApiKey, 1000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="w-64 md:w-64 bg-sidebar border-r border-sidebar-border p-4 h-full overflow-y-auto space-y-4">
      {/* Mobile close button */}
      {onClose && (
        <div className="flex justify-end items-center mb-4 md:hidden">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Company Branding */}
      <div className="mb-6">
        <div className="text-center mb-4 pb-4 border-b border-sidebar-border">
          <span className="text-xs text-sidebar-foreground/70 mb-1">
            Powered by
          </span>
          <h1 className="text-xl font-bold text-sidebar-foreground mb-1">
            Build Fast with AI
          </h1>
          <a
            href="https://buildfastwithai.com/genai-course?ref=nano-image-app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-sidebar-primary hover:text-sidebar-primary/80 flex items-center justify-center gap-1 transition-colors"
          >
            Visit Website <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Instructions */}
      <div className="mb-6">
        {!hasApiKey && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <Key className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-destructive text-xs leading-relaxed">
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-destructive hover:text-destructive/80 font-medium underline"
                  >
                    Get your Gemini API key
                  </a>{" "}
                  and enter it in the settings
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 hidden md:block">
        {nodeTypes.map((nodeType) => {
          const Icon = nodeType.icon;
          return (
            <Card
              key={nodeType.type}
              className="p-3 cursor-grab active:cursor-grabbing hover:bg-sidebar-accent transition-colors touch-manipulation"
              draggable
              onDragStart={(event) => onDragStart(event, nodeType.type)}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-sidebar-primary" />
                <div>
                  <div className="font-medium text-sidebar-foreground text-sm">
                    {nodeType.label}
                  </div>
                  <div className="text-xs text-sidebar-foreground/70">
                    {nodeType.description}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="text-sm text-sidebar-foreground/70 bg-background shadow-2xl rounded-xl p-3 border">
        <p className="font-medium mb-2">How to use:</p>
        <ol className="space-y-1 text-xs">
          <li>
            1. Enter <b>API key</b> in settings
          </li>
          <li>
            2. <b>Drag</b> components to canvas
          </li>
          <li className="hidden md:block">
            3. <b>Connect</b> nodes from dots
          </li>
          <li className="md:hidden">
            4. Tap output ports then input ports to connect
          </li>
          <li>4. Process nodes to generate/edit images</li>
        </ol>
      </div>

      {/* Bottom CTA */}
      <div className="mt-4 p-4 bg-primary/10 border-2 border-primary/20 rounded-lg shadow-sm">
        <p className="text-sm font-medium text-center text-foreground leading-relaxed">
          Want to build apps like this? <br />
          <a
            href="https://buildfastwithai.com/genai-course?ref=nano-image-app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2 px-4 rounded-lg transition-colors text-sm shadow-2xs"
          >
            Sign up for Gen AI Launchpad
          </a>
        </p>
      </div>
    </div>
  );
}
