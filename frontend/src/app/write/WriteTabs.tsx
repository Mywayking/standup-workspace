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
  const { addCard, appendRewriteVersion, initSession, setNavigateCallback } = useWorkflow();

  // Pending data from cross-tab navigation
  const [pendingPremise, setPendingPremise] = useState<{ text: string; sourceStep?: string } | null>(null);
  const [pendingAngle, setPendingAngle] = useState<{ text: string; sourceStep?: string } | null>(null);
  const [pendingRewrite, setPendingRewrite] = useState<{ text: string; sourceStep?: string } | null>(null);

  // Init session when user first types something in any tab
  const ensureSession = (sourceInput: string) => {
    // We'll init lazily when the first result comes in
  };

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
      // joke_to_premise tab
      setActiveTab("joke_to_premise");
    }
  };

  // Called by each tab when a result is done — registers a card in the session
  const handleResultDone = (type: "premise" | "angles" | "rewrite" | "joke_to_premise", content: string, rawData: unknown, sourceStep?: string) => {
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
                    handleResultDone("premise", content, rawData, sourceStep)
                  }
                />
              )}
              {activeTab === "joke_to_premise" && (
                <JokeToPremiseTab
                  onAction={handleAction}
                  onResultDone={(content, rawData) =>
                    handleResultDone("joke_to_premise", content, rawData)
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
                    handleResultDone("angles", content, rawData)
                  }
                />
              )}
              {activeTab === "rewrite" && (
                <WriteClient
                  initialText={pendingRewrite?.text}
                  sourceStep={pendingRewrite?.sourceStep}
                  onClearPending={() => setPendingRewrite(null)}
                  onResultDone={(content, rawData) =>
                    handleResultDone("rewrite", content, rawData)
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
