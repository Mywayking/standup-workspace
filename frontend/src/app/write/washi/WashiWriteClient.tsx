// ============================================================
// WashiWriteClient.tsx — 米纸风创作工作台主入口
// Standup Workspace v3.0
// ============================================================

"use client";

import React, { useState, useCallback } from "react";
import type { WorkCard, CardAction, WriteIntentType } from "./types";
import { useWriteSession } from "./hooks/useWriteSession";
import { useWriteGeneration } from "./hooks/useWriteGeneration";
import { detectWriteIntent } from "./hooks/useWriteIntent";
import { WRITE_ENDPOINT_MAP } from "./lib/endpointMap";
import { ResponsiveWashiShell } from "./components/ResponsiveWashiShell";
import { WorkSidebar } from "./components/WorkSidebar";
import { WashiMainFlow } from "./WashiMainFlow";
import { WashiRightPanel } from "./WashiRightPanel";

const EXAMPLE_MATERIAL = "老板说我们要有主人翁意识，但公司裁员的时候又说我是外包。这个素材怎么写？";

export function WashiWriteClient() {
  const {
    sessions,
    activeSession,
    activeSessionId,
    activeCards,
    createSession,
    addCard,
    setActiveSessionId,
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

      generation.start({ text, sessionId: session.id });
    },
    [activeSession, createSession, addCard, generation]
  );

  // ── Card action handler ──────────────────────────────────

  const handleAction = useCallback(
    (action: CardAction, card: WorkCard) => {
      const text = card.content;

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
        generation.start({ text, sessionId: session.id });
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
        const forcedIntent = {
          type: action.nextIntent ?? "rewrite",
          endpoint: WRITE_ENDPOINT_MAP[action.nextIntent ?? "rewrite"] as string,
          confidence: 1,
          reason: "action forced intent",
        };
        generation.start({ text, sessionId: session.id, forcedIntent });
        return;
      }

      generation.start({ text, sessionId: activeSession?.id ?? activeSessionId ?? "" });
    },
    [activeSession, activeSessionId, createSession, addCard, generation]
  );

  // ── Retry ────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    if (activeSession) generation.retry();
  }, [activeSession, generation]);

  // ── Try example ──────────────────────────────────────────

  const handleTryExample = useCallback(() => {
    handleSubmit(EXAMPLE_MATERIAL);
  }, [handleSubmit]);

  // ── Session select ────────────────────────────────────────

  const handleSelectSession = useCallback(
    (id: string) => setActiveSessionId(id),
    [setActiveSessionId]
  );

  // ── Topbar ───────────────────────────────────────────────

  const topbar = (
    <header className="flex items-center gap-2.5 px-4 py-3.5 border-b border-black/10 md:px-6 bg-[#FBF8F0]">
      {/* Mobile: left hamburger (controlled by MobileDrawer) */}
      <div className="md:hidden w-9 h-9 shrink-0" />

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
    </header>
  );

  // ── Main content (topbar + card flow + composer) ─────────

  const mainContent = (
    <div className="flex flex-col h-full bg-[#FBF8F0]">
      {topbar}
      <WashiMainFlow
        cards={activeCards}
        isGenerating={generation.state.isRunning}
        draftTokens={generation.state.tokens}
        onSubmit={handleSubmit}
      />
    </div>
  );

  // ── Sidebar ─────────────────────────────────────────────

  const sidebarContent = (
    <WorkSidebar
      sessions={sessions}
      activeSessionId={activeSessionId}
      onSelect={handleSelectSession}
      onNew={() => createSession("")}
    />
  );

  // ── Outline ─────────────────────────────────────────────

  const outlineContent = (
    <WashiRightPanel
      session={activeSession}
      currentStep={activeCards[activeCards.length - 1]?.type ?? "material"}
      model={generation.state.meta?.selected_model}
      latencyMs={null}
    />
  );

  // ── Render ───────────────────────────────────────────────

  return (
    <ResponsiveWashiShell
      sidebar={sidebarContent}
      outline={outlineContent}
      main={mainContent}
    />
  );
}