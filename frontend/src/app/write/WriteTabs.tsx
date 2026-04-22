"use client";
import { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";
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
  const [pendingPremise, setPendingPremise] = useState<{ text: string; sourcePath: string[] } | null>(null);
  const [pendingAngle, setPendingAngle] = useState<{ text: string; sourcePath: string[] } | null>(null);
  const [pendingRewrite, setPendingRewrite] = useState<{ text: string; sourcePath: string[] } | null>(null);

  const { toast } = useToast();

  // Centralized handoff: set pending state + navigate to target tab
  const handleHandoff = (targetType: CardType, content: string, sourcePath: string[]) => {
    const label: Record<CardType, string> = {
      source: "素材",
      premise: "提炼前提",
      angles: "找角度",
      rewrite: "改稿",
      joke_to_premise: "梗写前提",
    };
    if (targetType === "premise") {
      setPendingPremise({ text: content, sourcePath });
      setActiveTab("premise");
      toast(`已带入「${label[targetType]}」`);
    } else if (targetType === "angles") {
      setPendingAngle({ text: content, sourcePath });
      setActiveTab("angles");
      toast(`已带入「${label[targetType]}」`);
    } else if (targetType === "rewrite") {
      setPendingRewrite({ text: content, sourcePath });
      setActiveTab("rewrite");
      toast(`已带入「${label[targetType]}」`);
    } else if (targetType === "joke_to_premise") {
      setActiveTab("joke_to_premise");
      toast(`已带入「梗写前提」`);
    }
  };

  // Register handoff callback with WorkflowContext (used by SessionPanel)
  useEffect(() => {
    setHandoffCallback(handleHandoff);
  }, [setHandoffCallback]);

  // Also handle internal tab action buttons
  const handleAction = (action: string, data?: string, sourcePathArg?: string[]) => {
    if (action === "go-angles" && data !== undefined) {
      setPendingAngle({ text: data, sourcePath: [...(sourcePathArg || []), "找角度"] });
      setActiveTab("angles");
    } else if (action === "go-rewrite" && data !== undefined) {
      setPendingRewrite({ text: data, sourcePath: [...(sourcePathArg || []), "改稿"] });
      setActiveTab("rewrite");
    } else if (action === "go-premise" && data !== undefined) {
      setPendingPremise({ text: data, sourcePath: [...(sourcePathArg || []), "前提提炼"] });
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
    sourcePath: string[],
    sourceInput?: string,
  ) => {
    if (!session) {
      initSession(sourceInput || content.slice(0, 100));
    }
    if (type === "rewrite") {
      appendRewriteVersion(content, rawData, sourcePath);
    } else {
      const title = content.slice(0, 40) + (content.length > 40 ? "…" : "");
      addCard({ type, title, content, rawData, status: "success", sourcePath });
    }
  };

  const STEPS = ["素材", "前提", "角度", "改稿"] as const;
  const TAB_TO_STEP: Record<string, number> = {
    premise: 1,
    angles: 2,
    rewrite: 3,
    joke_to_premise: -1, // side entry
  };
  const activeStep = TAB_TO_STEP[activeTab] ?? -1;

  const handleStepClick = (stepIdx: number) => {
    const tabMap: (string | null)[] = [null, "premise", "angles", "rewrite"];
    const target = tabMap[stepIdx];
    if (target) {
      setActiveTab(target as typeof activeTab);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Flow Guidance */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 shrink-0">推荐流程：</span>
            <div className="flex items-center gap-1">
              {STEPS.map((step, idx) => {
                const isActive = idx === activeStep;
                const isPast = idx < activeStep;
                return (
                  <button
                    key={step}
                    onClick={() => handleStepClick(idx)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : isPast
                        ? "bg-blue-50 text-blue-600"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {step}
                  </button>
                );
              })}
            </div>
            {activeTab !== "joke_to_premise" && (
              <span className="text-xs text-gray-400">| 已有一句梗？试试「梗写前提」</span>
            )}
          </div>
        </div>
      </div>

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
                  sourcePath={pendingPremise?.sourcePath}
                  onClearPending={() => setPendingPremise(null)}
                  onResultDone={(content, rawData, sp) =>
                    safeHandleResultDone("premise", content, rawData, sp || [])
                  }
                />
              )}
              {activeTab === "joke_to_premise" && (
                <JokeToPremiseTab
                  onAction={handleAction}
                  onResultDone={(content, rawData) =>
                    safeHandleResultDone("joke_to_premise", content, rawData, [])
                  }
                />
              )}
              {activeTab === "angles" && (
                <AnglesTab
                  onAction={handleAction}
                  initialData={pendingAngle?.text}
                  sourcePath={pendingAngle?.sourcePath}
                  onClearPending={() => setPendingAngle(null)}
                  onResultDone={(content, rawData, sp) =>
                    safeHandleResultDone("angles", content, rawData, sp || [])
                  }
                />
              )}
              {activeTab === "rewrite" && (
                <WriteClient
                  initialText={pendingRewrite?.text}
                  sourcePath={pendingRewrite?.sourcePath}
                  onClearPending={() => setPendingRewrite(null)}
                  onResultDone={(content, rawData, sp) =>
                    safeHandleResultDone("rewrite", content, rawData, sp || [])
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
      <ToastProvider>
        <WriteTabsInner />
      </ToastProvider>
    </WorkflowProvider>
  );
}
