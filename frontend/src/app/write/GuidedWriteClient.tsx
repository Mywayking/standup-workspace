"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type {
  WorkflowSession,
  WorkflowCard,
  WorkflowStep,
  InputType,
  SaveStatus,
} from "./types";
import {
  TASK_ENTRY_CARDS,
  newSession,
  generateSessionTitle,
  getNextStep,
  isAIGeneratingStep,
  WORKFLOW_STEP_LABELS,
  WORKFLOW_STEP_ICONS,
} from "./types";
import {
  STEP_API_MAP,
  INPUT_TYPE_TO_INITIAL_STEP,
  mapDetectResultToInputType,
} from "./lib/stepMap";
import { buildCardTree } from "./lib/cardTree";
import { useUserStyle } from "./lib/useUserStyle";
import StepHeader from "./components/StepHeader";
import StickyPrimaryAction from "./components/StickyPrimaryAction";
import WorkflowCardComponent, { WorkflowCardSkeleton } from "./components/WorkflowCard";
import SaveStatusBadge from "./components/SaveStatusBadge";
import { StepProgressBar } from "./components/StepProgressBar";
import type { ActionState } from "./types";
import JokeLibraryDrawer from "./components/JokeLibraryDrawer";
import VersionCompareDrawer from "./components/VersionCompareDrawer";
import MobileBottomNav, { type Tab } from "./components/MobileBottomNav";
import DesktopLeftPanel from "./components/DesktopLeftPanel";
import DesktopRightPanel from "./components/DesktopRightPanel";

// ─── LocalStorage ─────────────────────────────────────────────────────────────

const SESSIONS_KEY = "standup_v3_sessions";
const ACTIVE_KEY   = "standup_v3_active";

function loadSessions(): WorkflowSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSessions(list: WorkflowSession[]) {
  try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(list)); } catch {}
}

function loadActive(): WorkflowSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveActive(session: WorkflowSession | null) {
  try {
    if (session) localStorage.setItem(ACTIVE_KEY, JSON.stringify(session));
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {}
}

function saveSession(session: WorkflowSession) {
  const all = loadSessions();
  const idx = all.findIndex((s) => s.id === session.id);
  if (idx >= 0) all[idx] = session;
  else all.unshift(session);
  saveSessions(all.slice(0, 100));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function streamText(
  endpoint: string,
  body: Record<string, unknown>,
  callbacks: {
    onToken: (t: string) => void;
    onMeta?: (meta: { model?: string; provider?: string }) => void;
    onDone?: (raw: string) => void;
    onError?: (err: string) => void;
    signal?: AbortSignal;
  }
) {
  const { onToken, onMeta, onDone, onError, signal } = callbacks;
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!resp.ok) {
    onError?.(`HTTP ${resp.status}`);
    return;
  }
  const reader = resp.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    while (buf.includes("\n\n")) {
      const end = buf.indexOf("\n\n");
      const block = buf.slice(0, end);
      buf = buf.slice(end + 2);
      const lines = block.split("\n");
      let evType = "message", evData = "";
      for (const l of lines) {
        if (l.startsWith("event:")) evType = l.slice(6).trim();
        else if (l.startsWith("data:")) evData = l.slice(5);
      }
      if (evType === "token" && evData) {
        let txt = evData;
        try { txt = JSON.parse(evData).content ?? evData; } catch {}
        onToken?.(txt);
      } else if (evType === "meta" && evData) {
        try { onMeta?.(JSON.parse(evData)); } catch {}
      } else if (evType === "done" && evData) {
        onDone?.(evData);
      } else if (evType === "error" && evData) {
        try { onError?.(JSON.parse(evData).error ?? evData); } catch { onError?.(evData); }
      }
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function buildStepBody(
  step: WorkflowStep,
  sourceInput: string,
  selectedCardContent?: string,
  extraFields?: Record<string, string>
): Record<string, unknown> {
  switch (step) {
    case "detect":
      return { text: sourceInput };
    case "material":
    case "premise":
      return { text: sourceInput };
    case "joke_to_premise":
      return { text: sourceInput };
    case "angles":
      // angles expects 'premise' field = the premise text from selected premise card
      return { premise: selectedCardContent || sourceInput };
    case "draft":
      // draft expects 'premise' (from selected card) + 'angle' (from angles card)
      return { premise: selectedCardContent || sourceInput, angle: sourceInput };
    case "rewrite":
      // rewrite expects 'text' field with the draft/script content
      return { text: selectedCardContent || sourceInput };
    case "performance_review":
      // performance_review expects laugh_parts, flop_parts, forgot_parts, original_script
      return {
        laugh_parts: extraFields?.laughParts ?? "",
        flop_parts: extraFields?.flopParts ?? "",
        forgot_parts: extraFields?.forgotParts ?? "",
        original_script: selectedCardContent || sourceInput,
      };
    default:
      return { text: sourceInput };
  }
}

export default function GuidedWriteClient({
  onSwitchToQuick,
}: {
  onSwitchToQuick?: () => void;
}) {
  const [mode, setMode] = useState<"guided" | "quick">("guided");
  const [session, setSession] = useState<WorkflowSession | null>(null);
  const [sessions, setSessions] = useState<WorkflowSession[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("create");

  // Version compare drawer state
  const [compareCard, setCompareCard] = useState<WorkflowCard | null>(null);

  // AI output state
  const [generating, setGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState<WorkflowStep | null>(null);
  const [tokens, setTokens] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [modelName, setModelName] = useState<string | null>(null);

  // Input state
  const [sourceInput, setSourceInput] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const drawerOpen = useState(false);

  // User style profile (Phase 9)
  const { profile: userStyle } = useUserStyle();

  // Performance review input fields (Phase 10)
  const [prLaughParts, setPrLaughParts] = useState("");
  const [prFlopParts, setPrFlopParts] = useState("");
  const [prForgotParts, setPrForgotParts] = useState("");

  // Action state for button feedback
  const [primaryAction, setPrimaryAction] = useState<ActionState>("idle");
  const [primaryActionMsg, setPrimaryActionMsg] = useState("");

  // Load sessions on mount
  useEffect(() => {
    setSessions(loadSessions());
    const active = loadActive();
    if (active) setSession(active);
  }, []);

  // Persist active session
  useEffect(() => {
    saveActive(session);
  }, [session]);

  // ── Start new session ─────────────────────────────────────────────────────

  const startSession = useCallback((input: string, entryKey?: string) => {
    const entry = TASK_ENTRY_CARDS.find((c) => c.key === entryKey);
    const inputType: InputType | null = entry?.inputType ?? null;
    const now = new Date().toISOString();
    const s: WorkflowSession = {
      ...newSession("guided"),
      sourceInput: input,
      title: generateSessionTitle(input),
      inputType,
      currentStep: inputType
        ? INPUT_TYPE_TO_INITIAL_STEP[inputType]
        : "detect",
    };
    setSession(s);
    setSourceInput(input);
    setSelectedEntry(entryKey ?? null);
    setTokens("");
    setError(null);
    return s;
  }, []);

  // ── Auto-save session ─────────────────────────────────────────────────────

  const saveCurrentSession = useCallback((s: WorkflowSession) => {
    setSession((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...s, updatedAt: new Date().toISOString(), saveStatus: "saving" as SaveStatus };
      saveSession(updated);
      return updated;
    });
  }, []);

  // ── Determine parent card ID based on current step ──────────────────────

  const getParentCardId = useCallback((s: WorkflowSession, step: WorkflowStep): string | undefined => {
    // Build a temporary cardMap to find correct parent
    const cardMap = buildCardTree([s]);
    const cards = s.cards;

    switch (step) {
      case "material":
      case "premise":
        // First step — no parent (root card)
        return undefined;
      case "joke_to_premise":
        return undefined;
      case "angles": {
        // Parent = last premise card (if exists)
        const premises = cards.filter((c) => c.type === "premise" || c.type === "material");
        return premises[premises.length - 1]?.id;
      }
      case "draft": {
        // Parent = last angle card
        const angles = cards.filter((c) => c.type === "angles");
        return angles[angles.length - 1]?.id;
      }
      case "rewrite": {
        // Parent = last draft card
        const drafts = cards.filter((c) => c.type === "draft");
        return drafts[drafts.length - 1]?.id;
      }
      case "performance_review": {
        // Parent = last relevant card (could be draft or rewrite)
        const relevant = cards.filter((c) => ["draft", "rewrite"].includes(c.type));
        return relevant[relevant.length - 1]?.id;
      }
      default:
        return undefined;
    }
  }, []);

  // ── Add card to session ───────────────────────────────────────────────────

  const addCard = useCallback((
    step: WorkflowStep,
    content: string,
    title?: string,
    meta?: { model?: string; provider?: string; latencyMs?: number },
    parentIdOverride?: string
  ) => {
    setSession((prev) => {
      if (!prev) return prev;
      const now = new Date().toISOString();

      // Determine parent card ID
      const parentId = parentIdOverride ?? getParentCardId(prev, step);

      // Calculate version number (how many siblings does this parent have?)
      let version = 1;
      if (parentId) {
        const siblings = prev.cards.filter((c) => c.parentId === parentId);
        version = siblings.length + 1;
      }

      const card: WorkflowCard = {
        id: genId("card"),
        sessionId: prev.id,
        parentId,
        childrenIds: [],
        type: step,
        title: title ?? WORKFLOW_STEP_LABELS[step],
        content,
        sourcePath: prev.cards.map((c) => c.type),
        isSelected: false,
        isMainline: true,
        version,
        model: meta?.model,
        provider: meta?.provider,
        latencyMs: meta?.latencyMs,
        createdAt: now,
        updatedAt: now,
      };

      const updated = {
        ...prev,
        cards: [...prev.cards, card],
        currentStep: step,
        saveStatus: "saved_local" as SaveStatus,
        updatedAt: now,
      };
      saveSession(updated);
      return updated;
    });
  }, [getParentCardId]);

  // ── Main flow: run step ───────────────────────────────────────────────────

  const runStep = useCallback(
    async (
      s: WorkflowSession,
      step: WorkflowStep,
      prLaugh?: string,
      prFlop?: string,
      prForgot?: string
    ) => {
      const endpoint = STEP_API_MAP[step];
      if (!endpoint) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setGenerating(true);
      setGeneratingStep(step);
      setTokens("");
      setError(null);
      setLatencyMs(null);
      setModelName(null);
      setPrimaryAction("pending");
      const start = Date.now();

      let fullContent = "";

      let selectedCardContent: string | undefined;
      if (step === "angles" || step === "rewrite" || step === "draft") {
        const selected = s.cards[s.cards.length - 1];
        selectedCardContent = selected?.content;
      }
      // Build extra fields for performance_review (Phase 10)
      const extraFields: Record<string, string> | undefined = step === "performance_review"
        ? {
            laughParts: prLaugh ?? prLaughParts,
            flopParts: prFlop ?? prFlopParts,
            forgotParts: prForgot ?? prForgotParts,
          }
        : undefined;
      const body = buildStepBody(step, s.sourceInput, selectedCardContent, extraFields);
      // Pass userStyle in request if set (Phase 9)
      if (userStyle && Object.keys(userStyle).length > 1) {
        (body as Record<string, unknown>).userStyle = userStyle;
      }
      await streamText(endpoint, body as Record<string, unknown>, {
        signal: controller.signal,
        onToken: (t) => {
          fullContent += t;
          setTokens((prev) => prev + t);
        },
        onMeta: (meta) => {
          setModelName(meta.model ?? null);
        },
        onDone: (raw) => {
          const ms = Date.now() - start;
          setLatencyMs(ms);
          addCard(step, fullContent || raw, undefined, { model: modelName ?? undefined, latencyMs: ms });
          setPrimaryAction("success");
          setPrimaryActionMsg("");
          setTimeout(() => setPrimaryAction("idle"), 2000);
        },
        onError: (err) => {
          setError(err);
          setSession((prev) =>
            prev
              ? { ...prev, saveStatus: "failed", updatedAt: new Date().toISOString() }
              : prev
          );
          setPrimaryAction("error");
          setPrimaryActionMsg(err);
        },
      });

      setGenerating(false);
      setGeneratingStep(null);
    },
    [addCard, modelName]
  );

  // ── Detect input type ──────────────────────────────────────────────────────

  const runDetect = useCallback(
    async (input: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setGenerating(true);
      setGeneratingStep("detect");
      setTokens("");
      setError(null);
      setPrimaryAction("pending");
      const start = Date.now();

      let rawData = "";
      await streamText("/api/detect-input", { text: input }, {
        signal: controller.signal,
        onToken: (t) => { rawData += t; setTokens((p) => p + t); },
        onDone: () => {
          const detected = mapDetectResultToInputType(rawData);
          const nextStep = INPUT_TYPE_TO_INITIAL_STEP[detected];
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  inputType: detected,
                  currentStep: nextStep,
                  updatedAt: new Date().toISOString(),
                }
              : prev
          );
          setGeneratingStep(nextStep);
          // auto-run the next step
          const fakeSession = { sourceInput: input, inputType: detected, cards: [] as WorkflowCard[], id: "", title: "", scriptStatus: "idea" as const, mode: "guided" as const, saveStatus: "idle" as const, syncStatus: "local_only" as const, rootCardIds: [], currentStep: nextStep, createdAt: "", updatedAt: "" };
          runStep(fakeSession as WorkflowSession, nextStep);
        },
        onError: (err) => { setError(err); setGenerating(false); setGeneratingStep(null); setPrimaryAction("error"); setPrimaryActionMsg(err); },
      });
    },
    [runStep]
  );

  // ── Handle entry card click ────────────────────────────────────────────────

  const handleEntryClick = useCallback(
    (key: string) => {
      setSelectedEntry(key);
      const entry = TASK_ENTRY_CARDS.find((c) => c.key === key);
      if (!entry) return;
      const s = startSession(sourceInput || entry.desc, key);
      if (entry.inputType === "material" || entry.inputType === "joke" || entry.inputType === "premise" || entry.inputType === "draft") {
        runStep(s, entry.step);
      }
    },
    [sourceInput, startSession, runStep]
  );

  // ── Handle submit ──────────────────────────────────────────────────────────

  const handleSubmit = useCallback(() => {
    if (!sourceInput.trim()) return;
    const s = startSession(sourceInput);
    if (session?.inputType) {
      // skip detect, go directly to first step
      const firstStep = INPUT_TYPE_TO_INITIAL_STEP[session.inputType];
      setSession((prev) => prev ? { ...prev, currentStep: firstStep } : prev);
      runStep(s, firstStep);
    } else {
      runDetect(sourceInput);
    }
  }, [sourceInput, session?.inputType, startSession, runStep, runDetect]);

  // ── Advance to next step ──────────────────────────────────────────────────

  const handleNextStep = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = getNextStep(prev.currentStep, prev.inputType);
      const updated = { ...prev, currentStep: next, updatedAt: new Date().toISOString() };
      saveSession(updated);
      // Pass performance_review fields explicitly to avoid stale closure
      if (next === "performance_review") {
        runStep(updated, next, prLaughParts, prFlopParts, prForgotParts);
      } else {
        runStep(updated, next);
      }
      return updated;
    });
  }, [runStep, prLaughParts, prFlopParts, prForgotParts]);

  // ── Reset session ─────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setSession((prev) => {
      if (prev) saveSession({ ...prev, updatedAt: new Date().toISOString() });
      return null;
    });
    setSourceInput("");
    setSelectedEntry(null);
    setTokens("");
    setError(null);
    setGenerating(false);
    setGeneratingStep(null);
    setPrimaryAction("idle");
    setPrimaryActionMsg("");
  }, []);

  // ── Restore session ────────────────────────────────────────────────────────

  const handleRestore = useCallback((s: WorkflowSession) => {
    setSession(s);
    setSourceInput(s.sourceInput);
    setActiveTab("create");
  }, []);

  // ── Delete session ────────────────────────────────────────────────────────

  const handleDelete = useCallback((id: string) => {
    const all = loadSessions().filter((s) => s.id !== id);
    saveSessions(all);
    setSessions(all);
    if (session?.id === id) handleReset();
  }, [session?.id, handleReset]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const lastCard = session?.cards[session.cards.length - 1] ?? null;
  const nextStepLabel = session
    ? WORKFLOW_STEP_LABELS[getNextStep(session.currentStep, session.inputType)]
    : null;
  const canAdvance = session != null && !generating && !error;

  const nextButtonLabel = (() => {
    if (primaryAction === "error") return "重试";
    if (primaryAction === "pending") return "生成中…";
    if (primaryAction === "success") return "✓ 已完成";
    if (session?.currentStep === "save") return "已完成";
    if (nextStepLabel) return `继续 → ${nextStepLabel}`;
    return "下一步";
  })();

  // ─── Render: No session (entry screen) ───────────────────────────────────

  if (!session) {
    return (
      <div className="write-shell flex flex-col min-h-screen bg-gray-50 lg:flex-row">
        {/* Desktop: Left panel (段子库) */}
        <div className="hidden lg:flex lg:flex-col lg:shrink-0">
          <DesktopLeftPanel sessions={sessions} onRestore={handleRestore} onDelete={handleDelete} />
        </div>

        {/* Main content - always shown */}
        <div className="flex-1 min-w-0 flex flex-col">
          <StepHeader
            currentStep="input"
            saveStatus="idle"
            currentMode={mode}
            onModeSwitch={() => onSwitchToQuick?.()}
          />

          <div className="flex-1 px-4 pt-4 max-w-2xl mx-auto w-full pb-20 lg:pb-4">
            {/* Entry cards */}
            <div className="mb-5">
              <p className="text-sm text-gray-500 mb-3">选择创作入口</p>
              <div className="entry-cards-grid">
                {TASK_ENTRY_CARDS.map((card) => (
                  <button
                    key={card.key}
                    onClick={() => handleEntryClick(card.key)}
                    className={`bg-white rounded-2xl border p-4 text-left transition-all hover:shadow-md ${
                      selectedEntry === card.key
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

            {/* Divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">或直接输入</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Textarea */}
            <div className="mb-4">
              <textarea
                value={sourceInput}
                onChange={(e) => setSourceInput(e.target.value)}
                placeholder="把你的一段素材、一句灵感、一个前提或一段草稿写下来…"
                className="w-full min-h-32 p-4 bg-white border border-gray-200 rounded-2xl text-sm text-gray-800 placeholder-gray-300 resize-none outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                style={{ fontFamily: "inherit" }}
              />
            </div>

            {/* Submit button */}
            <StickyPrimaryAction
              label={primaryAction === "pending" ? "创作中…" : primaryAction === "success" ? "✓ 已完成" : "开始创作"}
              status={primaryAction}
              statusMessage={primaryActionMsg}
              onClick={handleSubmit}
              disabled={!sourceInput.trim() || primaryAction === "pending"}
            />
          </div>

          <MobileBottomNav active={activeTab} onChange={setActiveTab} />
        </div>

        {/* Desktop: Right panel */}
        <div className="hidden lg:flex lg:flex-col lg:shrink-0">
          <div className="desktop-right-panel flex flex-col bg-white">
            <div className="px-4 py-4 border-b border-gray-100">
              <p className="text-sm font-bold text-gray-700">创作状态</p>
              <p className="text-xs text-gray-400 mt-0.5">选择入口开始创作</p>
            </div>
            <div className="px-4 py-4">
              <p className="text-xs text-gray-400 mb-1.5">快速入口</p>
              <div className="space-y-1.5">
                {TASK_ENTRY_CARDS.map((card) => (
                  <button
                    key={card.key}
                    onClick={() => handleEntryClick(card.key)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                  >
                    <span className="text-sm">{card.icon}</span>
                    <span className="text-xs text-gray-700">{card.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile drawer (bottom sheet) */}
        <JokeLibraryDrawer
          open={activeTab === "library"}
          onClose={() => setActiveTab("create")}
          sessions={sessions}
          onRestore={handleRestore}
          onDelete={handleDelete}
        />
      </div>
    );
  }

  // ─── Render: Active session ────────────────────────────────────────────────

  return (
    <div className="write-shell flex flex-col min-h-screen bg-gray-50 lg:flex-row">
      {/* Desktop: Left panel (段子库) */}
      <div className="hidden lg:flex lg:flex-col lg:shrink-0">
        <DesktopLeftPanel sessions={sessions} onRestore={handleRestore} onDelete={handleDelete} />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <StepHeader
          currentStep={session.currentStep}
          saveStatus={session.saveStatus}
          currentMode={mode}
          onModeSwitch={() => onSwitchToQuick?.()}
        />

        <div className="flex-1 px-4 pt-4 max-w-2xl mx-auto w-full space-y-4 pb-24 lg:pb-6">

          {/* Source input summary */}
          <div className="bg-white rounded-2xl border border-gray-100 p-3">
            <p className="text-xs text-gray-400 mb-1">素材</p>
            <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">
              {session.sourceInput}
            </p>
          </div>

          {/* Current step indicator */}
          <div className="flex items-center gap-2">
            <span className="text-sm">{WORKFLOW_STEP_ICONS[session.currentStep]}</span>
            <span className="text-sm font-medium text-gray-700">
              {WORKFLOW_STEP_LABELS[session.currentStep]}
            </span>
            {session.inputType && (
              <span className="text-xs text-gray-400 ml-1">
                · {session.inputType}
              </span>
            )}
          </div>

          {/* Performance review input form (Phase 10) */}
          {session.currentStep === "performance_review" && !generating && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <p className="text-sm text-gray-600 leading-relaxed">
                填写你的演出反馈，AI会帮你分析并给出下一版修改建议。
              </p>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  🎉 观众笑了的部分（哪里笑了？）
                </label>
                <textarea
                  value={prLaughParts}
                  onChange={(e) => setPrLaughParts(e.target.value)}
                  placeholder="比如：开场自我介绍那里笑得很炸，第三分钟讲加班那个笑点很爆…"
                  className="w-full min-h-16 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-300 resize-none outline-none focus:border-blue-400 transition-colors"
                  style={{ fontFamily: "inherit" }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  😅 冷场的部分（哪里没响？）
                </label>
                <textarea
                  value={prFlopParts}
                  onChange={(e) => setPrFlopParts(e.target.value)}
                  placeholder="比如：中间讲同事那个铺得太长，后面收尾有点突然…"
                  className="w-full min-h-16 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-300 resize-none outline-none focus:border-blue-400 transition-colors"
                  style={{ fontFamily: "inherit" }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  🤔 忘记/卡壳的部分
                </label>
                <textarea
                  value={prForgotParts}
                  onChange={(e) => setPrForgotParts(e.target.value)}
                  placeholder="比如：第二个笑点忘记说了，收尾那句话卡了一下…"
                  className="w-full min-h-16 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-300 resize-none outline-none focus:border-blue-400 transition-colors"
                  style={{ fontFamily: "inherit" }}
                />
              </div>
            </div>
          )}

          {/* AI Output area */}
          {generating || tokens || error ? (
            <div className="space-y-3">
              {/* Loading skeleton */}
              {generating && generatingStep === session.currentStep && (
                <WorkflowCardSkeleton step={session.currentStep} />
              )}

              {/* Token stream */}
              {tokens && (
                <div className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {tokens}
                    <span className="inline-block w-2 h-4 bg-blue-400 ml-0.5 align-middle animate-pulse rounded-sm" />
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                  <p className="text-sm text-red-600">⚠️ {error}</p>
                </div>
              )}

              {/* Meta info */}
              {(latencyMs || modelName) && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {modelName && <span>{modelName}</span>}
                  {latencyMs && <span>{latencyMs}ms</span>}
                </div>
              )}
            </div>
          ) : null}

          {/* Cards from session (with tree structure) */}
          {session.cards.map((card) => (
            <WorkflowCardComponent
              key={card.id}
              card={card}
              onSelect={(c) => {
                // Open version compare drawer if there are siblings
                const cardMap = buildCardTree([session]);
                const siblings = Array.from(cardMap.values()).filter(
                  (x) => x.parentId === c.parentId && x.id !== c.id
                );
                if (siblings.length > 0 || session.cards.filter((x) => x.parentId === c.parentId).length > 0) {
                  setCompareCard(c);
                }
              }}
            />
          ))}

          {/* Last card summary */}
          {lastCard && (
            <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-2xl p-3">
              <p className="text-xs text-blue-600 font-medium mb-1">
                {WORKFLOW_STEP_LABELS[lastCard.type]} 完成
              </p>
              <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
                {lastCard.content.slice(0, 200)}
                {lastCard.content.length > 200 && "…"}
              </p>
            </div>
          )}
        </div>

        {/* Sticky bottom action */}
        <div className="sticky bottom-0 left-0 right-0 bg-gray-50 border-t border-gray-100 px-4 pt-3 pb-4 safe-area-bottom">
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="px-4 py-4 rounded-2xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                新建
              </button>
              <StickyPrimaryAction
                label={nextButtonLabel}
                status={primaryAction}
                statusMessage={primaryActionMsg}
                onClick={() => {
                  if (primaryAction === "error") {
                    setError(null);
                    setPrimaryAction("idle");
                    if (session) runStep(session, session.currentStep);
                    return;
                  }
                  if (primaryAction === "pending") return;
                  handleNextStep();
                }}
                disabled={generating || (session.currentStep !== "input" && !lastCard && !tokens)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: Right panel (Status/Context) */}
      <div className="hidden lg:flex lg:flex-col lg:shrink-0">
        <DesktopRightPanel session={session} cards={session?.cards ?? []} />
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav active={activeTab} onChange={setActiveTab} />

      {/* Mobile drawer */}
      <JokeLibraryDrawer
        open={activeTab === "library"}
        onClose={() => setActiveTab("create")}
        sessions={sessions}
        onRestore={handleRestore}
        onDelete={handleDelete}
      />

      {/* Version compare drawer (Phase 8) */}
      {compareCard && session && (
        <VersionCompareDrawer
          card={compareCard}
          cardMap={buildCardTree([session])}
          session={session}
          onClose={() => setCompareCard(null)}
          onSetMainline={(updated) => {
            setSession(updated);
            saveSession(updated);
          }}
        />
      )}
    </div>
  );
}
