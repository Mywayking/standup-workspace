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

// Compact step flow indicators per tab
const TAB_STEP_DESC: Record<Tab, string> = {
  premise: "素材 → 前提",
  joke_to_premise: "梗 → 前提",
  angles: "前提 → 角度",
  rewrite: "草稿 → 成品",
};

function WriteTabsInner() {
  const [activeTab, setActiveTab] = useState<Tab>("premise");
  const { session, appendRewriteVersion, setHandoffCallback, addCardEnsuringSession } = useWorkflow();

  const TASK_CARDS = [
    {
      key: "素材",
      icon: "📝",
      title: "我有一段生活素材",
      desc: "一件事、一个观察、一段情绪",
      tab: "premise" as Tab,
    },
    {
      key: "前提",
      icon: "💡",
      title: "我有一个前提",
      desc: "已经有判断或结论，想找角度",
      tab: "angles" as Tab,
    },
    {
      key: "梗",
      icon: "🔥",
      title: "我有一句梗",
      desc: "一个笑点、一句吐槽、一个灵感",
      tab: "joke_to_premise" as Tab,
    },
    {
      key: "草稿",
      icon: "✍️",
      title: "我有一段草稿",
      desc: "完整段子，想改稿或上台版",
      tab: "rewrite" as Tab,
    },
  ];

  const [pendingPremise, setPendingPremise] = useState<{ text: string; sourcePath: string[] } | null>(null);
  const [pendingAngle, setPendingAngle] = useState<{ text: string; sourcePath: string[] } | null>(null);
  const [pendingRewrite, setPendingRewrite] = useState<{ text: string; sourcePath: string[] } | null>(null);

  const { toast } = useToast();

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

  useEffect(() => {
    setHandoffCallback(handleHandoff);
  }, [setHandoffCallback]);

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

  const safeHandleResultDone = (
    type: "premise" | "angles" | "rewrite" | "joke_to_premise",
    content: string,
    rawData: unknown,
    sourcePath: string[],
    sourceInput?: string,
  ) => {
    if (type === "rewrite") {
      appendRewriteVersion(content, rawData, sourcePath);
    } else {
      const title = content.slice(0, 40) + (content.length > 40 ? "…" : "");
      addCardEnsuringSession(sourceInput || content.slice(0, 100), {
        type,
        title,
        content,
        rawData,
        status: "success",
        sourcePath,
      });
      toast("已保存到当前创作会话", "success");
    }
  };

  // Step mapping for the flow bar
  const STEPS = ["素材", "前提", "角度", "改稿"] as const;
  const TAB_TO_STEP: Record<string, number> = {
    premise: 1,
    joke_to_premise: 0, // side entry, shows inline
    angles: 2,
    rewrite: 3,
  };
  const activeStep = TAB_TO_STEP[activeTab] ?? -1;

  const handleStepClick = (stepIdx: number) => {
    const tabMap: (string | null)[] = [null, "premise", "angles", "rewrite"];
    const target = tabMap[stepIdx];
    if (target) {
      setActiveTab(target as typeof activeTab);
    }
  };

  // Clear pending state when switching tabs
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab !== "premise") setPendingPremise(null);
    if (tab !== "angles") setPendingAngle(null);
    if (tab !== "rewrite") setPendingRewrite(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── UNIFIED HEADER: title + flow bar + tabs ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          {/* Title row */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <h1 className="text-base font-bold text-gray-800">喜剧分析工作台</h1>
            {/* Compact flow bar */}
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
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {([
              { key: "premise", label: "提炼前提", desc: TAB_STEP_DESC.premise },
              { key: "joke_to_premise", label: "梗写前提", desc: TAB_STEP_DESC.joke_to_premise },
              { key: "angles", label: "找角度", desc: TAB_STEP_DESC.angles },
              { key: "rewrite", label: "改稿", desc: TAB_STEP_DESC.rewrite },
            ] as const).map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => handleTabChange(key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex flex-col items-start gap-0.5 shrink-0 ${
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

      {/* ── TASK ENTRY CARDS (only when no active session) ── */}
      {session === null && (
        <div className="max-w-7xl mx-auto px-4 pt-5">
          <div className="entry-cards-grid">
            {TASK_CARDS.map((card) => (
              <button
                key={card.key}
                onClick={() => setActiveTab(card.tab)}
                className={`bg-white rounded-xl border p-4 text-left transition-all hover:shadow-md ${
                  activeTab === card.tab
                    ? "border-blue-400 ring-2 ring-blue-100"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="text-2xl mb-2">{card.icon}</div>
                <div className="font-semibold text-gray-800 text-sm">{card.title}</div>
                <div className="text-xs text-gray-400 mt-1">{card.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT: three-column workspace ── */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="workspace-layout">

          {/* Left: Session Panel */}
          <div className="workspace-left">
            <WorkflowSessionPanel />
          </div>

          {/* Center: Tab Content */}
          <div className="workspace-center">
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

          {/* Right: Collapsible status card */}
          <div className="workspace-right">
            <StatusToggleCard activeTab={activeTab} session={session} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Collapsible Status Card ───────────────────────────────────────────────────

function StatusToggleCard({
  activeTab,
  session,
}: {
  activeTab: Tab;
  session: ReturnType<typeof useWorkflow>["session"];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={expanded ? "status-expanded" : "status-collapsed"} onClick={() => setExpanded(v => !v)}>
      {!expanded ? (
        // Collapsed: just a help icon with current step
        <div className="flex flex-col items-center gap-2">
          <span className="text-2xl">💡</span>
          <span className="text-xs text-gray-500">{TAB_LABELS[activeTab]}</span>
          <span className="text-xs text-gray-300">点击展开</span>
        </div>
      ) : (
        // Expanded: dynamic status
        <div onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-gray-800">状态</p>
            <button
              onClick={() => setExpanded(false)}
              className="text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          </div>

          {/* Current step */}
          <div className="mb-3">
            <p className="text-xs text-gray-400 mb-1">当前工具</p>
            <p className="text-sm font-medium text-gray-700">{TAB_LABELS[activeTab]}</p>
          </div>

          {/* Save status */}
          {session ? (
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1">保存状态</p>
              <p className="text-xs text-green-600 font-medium">
                ✓ 已保存 · {session.cards.length} 个结果
              </p>
            </div>
          ) : (
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-1">保存状态</p>
              <p className="text-xs text-gray-400">未创建会话</p>
            </div>
          )}

          {/* Next step hint */}
          {activeTab !== "rewrite" && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1">下一步</p>
              <p className="text-xs text-blue-600">
                {activeTab === "premise" && "→ 找角度"}
                {activeTab === "joke_to_premise" && "→ 找角度"}
                {activeTab === "angles" && "→ 改稿"}
              </p>
            </div>
          )}

          {/* Help text */}
          <div className="pt-2 border-t border-gray-100 mt-2">
            <p className="text-xs text-gray-400 leading-relaxed">
              输入内容后 AI 自动分析，完成后可保存到左侧会话
            </p>
          </div>
        </div>
      )}
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