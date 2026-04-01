"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, X } from "lucide-react";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const apiProvider = "google";
  const model = "gemini-2.5-flash-image-preview";

  // Load settings from localStorage on component mount
  useEffect(() => {
    const settings = localStorage.getItem("ai-workflow-settings");
    if (settings) {
      const parsedSettings = JSON.parse(settings);
      if (parsedSettings.apiKey) {
        setApiKey(parsedSettings.apiKey);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem(
      "ai-workflow-settings",
      JSON.stringify({
        apiProvider,
        apiKey,
        model,
      })
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-4 md:p-6 bg-card max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Settings</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="touch-manipulation"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">Gemini API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="Enter your Gemini API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="touch-manipulation"
            />
          </div>

          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
            <p className="font-medium mb-1">Model Capabilities:</p>
            <ul className="text-xs space-y-1">
              <li>• Image generation from text prompts</li>
              <li>• Multi-image editing and combining</li>
              <li>• Advanced vision understanding</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} className="flex-1 touch-manipulation">
            Save Settings
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="touch-manipulation"
          >
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
