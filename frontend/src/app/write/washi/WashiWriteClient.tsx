// ============================================================
// WashiWriteClient.tsx — 米纸风创作工作台主入口
// Standup Workspace v3.0
// ============================================================

"use client";

import React, { useState, useCallback } from "react";
import type { WorkCard, CardAction, WriteIntentType } from "./types";
import { generateSessionTitle } from "./types";
import { useWriteSession } from "./hooks/useWriteSession";
import { useWriteGeneration } from "./hooks/useWriteGeneration";
import { detectWriteIntent } from "./hooks/useWriteIntent";
import { ResponsiveWashiShell } from "./components/ResponsiveWashiShell";
import { WorkSidebar } from "./components/WorkSidebar";
import { WashiMainFlow } from "./WashiMainFlow";
import { Composer } from "./components/Composer";
import { WashiRightPanel } from "./WashiRightPanel";
import { MobileDrawer } from "./components/MobileDrawer";
import { MobileSheet } from "./components/MobileSheet";
import { EmptyState } from "./components/EmptyState";

const EXAMPLE_MATERIAL = "老板说我们要有主人翁意识，但公司裁员的时候又说我是外包。这个素材怎么写？";

export function WashiWriteClient() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);

  const {
    sessions,
    activeSession,
    activeSessionId,
    activeCards,
    createSession,
    addCard,
    setActiveSessionId,
    removeSession,
  } = useWriteSession();

  // ── Generation ────────────────────────────────────────────

  const generation = useWriteGeneration(
    {
      sessionId: activeSession?.id ?? "",
      onCardCreated: (card: WorkCard) => {
        addCard(card);
      },
    },
    activeSessionId
  );

  // ── Submit ───────────────────────────────────────────────

  const handleSubmit = useCallback(
    (text: string) => {
      const session = activeSession ?? createSession(text);

      // Add user card
      const userCard: WorkCard = {
        id: crypto.randomUUID(),
        sessionId: session.id,
        type: "material",
        role: "user",
        title: "用户输入",
        content: text,
        sourcePath: ["用户输入"],
        createdAt: Date.now(),
      };
      addCard(userCard);

      // Update session title if new
      if (!activeSession?.title && text.trim()) {
        // title will be set on next addCard / createSession
      }

      // Start generation
      generation.start(text, undefined, session.id);
    },
    [activeSession, createSession, addCard, generation]
  );

  // ── Card action handler ──────────────────────────────────

  const handleAction = useCallback(
    (action: CardAction, card: WorkCard) => {
      const text = card.content;
      const intentType: WriteIntentType = action.nextIntent ?? "rewrite";

      // Pre-fill composer with card content + intent
      const prefix =
        intentType === "angles" ? "找角度：" :
        intentType === "rewrite" ? "改稿：" :
        intentType === "premise" ? "提炼前提：" :
        "";

      // For "find_angles" directly from a premise card, start immediately
      if (action.type === "find_angles") {
        const session = activeSession ?? createSession(text);

        const userCard: WorkCard = {
          id: crypto.randomUUID(),
          sessionId: session.id,
          type: card.type,
          role: "user",
          title: "用户输入",
          content: text,
          sourcePath: ["用户输入"],
          createdAt: Date.now(),
        };
        addCard(userCard);
        generation.start(text, undefined, session.id);
        return;
      }

      if (action.type === "expand_to_draft" || action.type === "make_sharper" || action.type === "make_softer") {
        const session = activeSession ?? createSession(text);

        const userCard: WorkCard = {
          id: crypto.randomUUID(),
          sessionId: session.id,
          type: card.type,
          role: "user",
          title: "用户输入",
          content: text,
          sourcePath: ["用户输入"],
          createdAt: Date.now(),
        };
        addCard(userCard);
        generation.start(text, undefined, session.id);
        return;
      }

      // Default: restart with the same content
      generation.start(text, undefined, activeSession?.id ?? activeSessionId ?? undefined);
    },
    [activeSession, createSession, addCard, generation]
  );

  // ── New session ──────────────────────────────────────────

  const handleNew = useCallback(() => {
    const session = createSession("");
    setSidebarOpen(false);
  }, [createSession]);

  // ── Try example ──────────────────────────────────────────

  const handleTryExample = useCallback(() => {
    handleSubmit(EXAMPLE_MATERIAL);
  }, [handleSubmit]);

  // ── Session select ────────────────────────────────────────

  const handleSelectSession = useCallback(
    (id: string) => {
      setActiveSessionId(id);
      setSidebarOpen(false);
    },
    [setActiveSessionId]
  );

  // ── Retry ────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    if (activeSession) {
      generation.retry();
    }
  }, [activeSession, generation]);

  // ── Topbar ───────────────────────────────────────────────

  const topbar = (
    <header className="flex items-center gap-2.5 px-4 py-3.5 border-b border-black/10 md:px-6">
      {/* Mobile: left hamburger */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="
          md:hidden w-9 h-9 rounded-full
          border border-black/10 bg-white/30
          flex items-center justify-center
          text-[#8A8174] text-lg
        "
        aria-label="打开作品列表"
      >
        ☰
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-[15px] md:text-[17px] font-semibold text-[#25231F] truncate">
          {activeSession?.title || activeSession?.sourceInput?.slice(0, 20) || "新的作品"}
        </h1>
        <p className="text-[11px] md:text-[12px] text-[#8A8174] mt-0.5 truncate">
          自动保存 · {activeCards.length} 张卡片
        </p>
      </div>

      {/* Desktop status pills */}
      <div className="hidden md:flex items-center gap-2">
        {generation.state.meta?.selected_model && (
          <span className="px-2.5 py-1 rounded-full border border-black/10 text-[12px] text-[#8A8174] bg-white/30">
            {generation.state.meta.selected_model}
          </span>
        )}
        {generation.state.phase === "done" && (
          <span className="px-2.5 py-1 rounded-full border border-black/10 text-[12px] text-[#68715F] bg-white/30">
            已保存
          </span>
        )}
      </div>

      {/* Mobile: right outline button */}
      <button
        type="button"
        onClick={() => setOutlineOpen(true)}
        className="
          xl:hidden w-9 h-9 rounded-full
          border border-black/10 bg-white/30
          flex items-center justify-center
          text-[#8A8174] text-base
        "
        aria-label="打开作品结构"
      >
        ⌘
      </button>
    </header>
  );

  // ── Main area ────────────────────────────────────────────

  const mainArea = (
    <div className="flex flex-col h-full">
      {topbar}

      {/* Chat area */}
      <div className="flex-1 min-h-0 flex flex-col">
        {activeCards.length === 0 && generation.state.phase !== "thinking" && !generation.draftTokens ? (
          <EmptyState onTryExample={handleTryExample} />
        ) : (
          <WashiMainFlow
            cards={activeCards}
            isThinking={generation.state.phase === "thinking"}
            streamingText={generation.draftTokens}
            error={null}
            currentStep={activeCards[activeCards.length - 1]?.type ?? "material"}
            onRetry={handleRetry}
            onAction={handleAction}
          />
        )}
      </div>

      {/* Composer */}
      <Composer
        disabled={generation.state.phase === "thinking"}
        onSubmit={handleSubmit}
      />
    </div>
  );

  // ── Sidebar content ──────────────────────────────────────

  const sidebarContent = (
    <WorkSidebar
      sessions={sessions}
      activeSessionId={activeSessionId}
      onSelect={handleSelectSession}
      onNew={handleNew}
    />
  );

  // ── Outline content ──────────────────────────────────────

  const outlineContent = (
    <WashiRightPanel
      session={activeSession}
      currentStep={activeCards[activeCards.length - 1]?.type ?? "material"}
      model={generation.state.meta?.selected_model}
      latencyMs={generation.state.meta?.total_latency_ms ?? null}
    />
  );

  // ── Render ───────────────────────────────────────────────

  return (
    <>
      <ResponsiveWashiShell
        sidebar={sidebarContent}
        outline={outlineContent}
        main={mainArea}
      />

      {/* Mobile: sidebar drawer */}
      <MobileDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
        {sidebarContent}
      </MobileDrawer>

      {/* Mobile: outline sheet */}
      <MobileSheet open={outlineOpen} onClose={() => setOutlineOpen(false)}>
        {outlineContent}
      </MobileSheet>
    </>
  );
}
