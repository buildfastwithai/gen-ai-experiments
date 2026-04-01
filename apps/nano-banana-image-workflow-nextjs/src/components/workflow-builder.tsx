"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import WorkflowCanvas from "./workflow-canvas";
import Sidebar from "./sidebar";
import SettingsPanel from "./settings-panel";
import { useWorkflowStore } from "@/stores/workflow-store";
import { Settings, Menu } from "lucide-react";
import MobileNodeTabs from "./mobile-node-tabs";

export default function WorkflowBuilder() {
  const { clearWorkflow } = useWorkflowStore();
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  const handleClearWorkflow = () => {
    clearWorkflow();
  };

  return (
    <div className="flex h-full bg-background">
      {/* Mobile Sidebar Overlay */}
      {showSidebar && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden">
          <Sidebar onClose={() => setShowSidebar(false)} />
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 md:p-4 border-b border-border">
          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="md:hidden"
              onClick={() => setShowSidebar(true)}
            >
              <Menu className="w-4 h-4" />
            </Button>
            <h1 className="text-lg md:text-2xl font-semibold text-foreground">
              <span className="hidden sm:inline">
                Nano Banana Image Workflow 🍌
              </span>
              <span className="sm:hidden">Workflow 🍌</span>
            </h1>
          </div>
          <div className="flex gap-1 md:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(true)}
              className="px-2 md:px-3"
            >
              <Settings className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Settings</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearWorkflow}
              className="px-2 md:px-3"
            >
              <span className="hidden sm:inline">Clear Workflow</span>
              <span className="sm:hidden">Clear</span>
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative">
          <WorkflowCanvas />
        </div>
      </div>

      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Mobile Bottom Tabs */}
      <MobileNodeTabs />
    </div>
  );
}
