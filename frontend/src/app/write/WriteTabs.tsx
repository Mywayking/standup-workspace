"use client";
import { useState, useEffect } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { WorkflowProvider, useWorkflow, type CardType } from "@/contexts/WorkflowContext";
import WorkflowSessionPanel from "@/contexts/WorkflowSessionPanel";
import WriteClient from "./WriteClient";
import PremiseTab from "./PremiseTab";
import JokeToPremiseTab from "./JokeToPremiseTab";
import AnglesTab from "./AnglesTab";

type Tab = "premise" | "joke_to_premise" | "angles" | "rewrite";

const TAB_LABELS: Record<Tab, string> = {
  premise: "提炼前提",
  joke_to_premise: "梗写前提",
  angles: "找角度",
  rewrite: "改稿",
};

function WriteTabsInner() {
  const [activeTab, setActiveTab] = useState<Tab>("premise");
  const { session, addCard, appendRewriteVersion, initSession, setHandoffCallback } = useWorkflow();

  // Pending data from cross-tab navigation
  const [pendingPremise, setPendingPremise] = useState<{ text: string; sourceStep?: string } | null>(null);
  const [pendingAngle, setPendingAngle] = useState<{ text: string; sourceStep?: string } | null>(null);
  const [pendingRewrite, setPendingRewrite] = useState<{ text: string; sourceStep?: string } | null>(null);

  // Centralized handoff: set pending state + navigate to target tab
  const handleHandoff = (targetType: CardType, content: string, sourceStep?: string) => {
    if (targetType === "premise") {
      setPendingPremise({ text: content, sourceStep });
      setActiveTab("premise");
    } else if (targetType === "angles") {
      setPendingAngle({ text: content, sourceStep });
      setActiveTab("angles");
    } else if (targetType === "rewrite") {
      setPendingRewrite({ text: content, sourceStep });
      setActiveTab("rewrite");
    } else if (targetType === "joke_to_premise") {
      setActiveTab("joke_to_premise");
    }
  };

  // Register handoff callback with WorkflowContext (used by SessionPanel)
  useEffect(() => {
    setHandoffCallback(handleHandoff);
  }, [setHandoffCallback]);

  // Also handle internal tab action buttons
  const handleAction = (action: string, data?: string, sourceStep?: string) => {
    if (action === "go-angles" && data !== undefined) {
      setPendingAngle({ text: data, sourceStep });
      setActiveTab("angles");
    } else if (action === "go-rewrite" && data !== undefined) {
      setPendingRewrite({ text: data, sourceStep });
      setActiveTab("rewrite");
    } else if (action === "go-premise" && data !== undefined) {
      setPendingPremise({ text: data, sourceStep });
      setActiveTab("premise");
    } else if (action === "go-joke_to_premise" && data !== undefined) {
      setActiveTab("joke_to_premise");
    }
  };

  // Ensure session exists before saving; update sourceInput to actual user input
  const safeHandleResultDone = (
    type: "premise" | "angles" | "rewrite" | "joke_to_premise",
    content: string,
    rawData: unknown,
    sourceStep?: string,
    sourceInput?: string,
  ) => {
    if (!session) {
      initSession(sourceInput || content.slice(0, 100));
    }
    if (type === "rewrite") {
      appendRewriteVersion(content, rawData, sourceStep);
    } else {
      const title = content.slice(0, 40) + (content.length > 40 ? "…" : "");
      addCard({ type, title, content, rawData, status: "success", sourceStep });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tab Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {([
              { key: "premise", label: "提炼前提", desc: "素材 → 前提" },
              { key: "joke_to_premise", label: "梗写前提", desc: "梗 → 前提" },
              { key: "angles", label: "找角度", desc: "前提 → 角度" },
              { key: "rewrite", label: "改稿", desc: "草稿 → 成品" },
            ] as const).map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => {
                  setActiveTab(key);
                  if (key !== "premise") setPendingPremise(null);
                  if (key !== "angles") setPendingAngle(null);
                  if (key !== "rewrite") setPendingRewrite(null);
                }}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex flex-col items-start gap-0.5 ${
                  activeTab === key
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <span>{label}</span>
                <span className="text-xs text-gray-400 font-normal">{desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content: [Session Panel | Tab Content] */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Left: Session Panel */}
          <div className="w-72 shrink-0">
            <WorkflowSessionPanel />
          </div>

          {/* Center: Tab Content */}
          <div className="flex-1 min-w-0">
            <ErrorBoundary>
              {activeTab === "premise" && (
                <PremiseTab
                  onAction={handleAction}
                  initialData={pendingPremise?.text}
                  sourceStep={pendingPremise?.sourceStep}
                  onClearPending={() => setPendingPremise(null)}
                  onResultDone={(content, rawData, sourceStep) =>
                    safeHandleResultDone("premise", content, rawData, sourceStep)
                  }
                />
              )}
              {activeTab === "joke_to_premise" && (
                <JokeToPremiseTab
                  onAction={handleAction}
                  onResultDone={(content, rawData) =>
                    safeHandleResultDone("joke_to_premise", content, rawData)
                  }
                />
              )}
              {activeTab === "angles" && (
                <AnglesTab
                  onAction={handleAction}
                  initialData={pendingAngle?.text}
                  sourceStep={pendingAngle?.sourceStep}
                  onClearPending={() => setPendingAngle(null)}
                  onResultDone={(content, rawData) =>
                    safeHandleResultDone("angles", content, rawData)
                  }
                />
              )}
              {activeTab === "rewrite" && (
                <WriteClient
                  initialText={pendingRewrite?.text}
                  sourceStep={pendingRewrite?.sourceStep}
                  onClearPending={() => setPendingRewrite(null)}
                  onResultDone={(content, rawData) =>
                    safeHandleResultDone("rewrite", content, rawData)
                  }
                />
              )}
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WriteTabs() {
  return (
    <WorkflowProvider>
      <WriteTabsInner />
    </WorkflowProvider>
  );
}
