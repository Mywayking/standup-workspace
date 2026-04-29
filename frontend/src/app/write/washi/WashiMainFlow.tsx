// ============================================================
// WashiMainFlow.tsx — 卡片流工作台视图
// Standup Workspace v3.0
// ============================================================

"use client";

import React, { useRef, useEffect } from "react";
import { Composer } from "./components/Composer";
import { CreationCard } from "./components/CreationCard";
import { EmptyState } from "./components/EmptyState";
import type { WorkCard } from "./types";

interface Props {
  cards: WorkCard[];
  isGenerating: boolean;
  draftTokens: string;
  onSubmit: (text: string) => void;
  onAction?: (action: import("./types").CardAction, card: WorkCard) => void;
}

function StreamingArea({ text }: { text: string }) {
  return (
    <div className="max-w-[800px] border border-[#A94737]/30 rounded-3xl bg-[#FBF8F0]/80 px-5 py-4 shadow-sm">
      <p className="text-[14px] leading-relaxed text-[#25231F] whitespace-pre-wrap">
        {text}
        <span
          className="inline-block w-2 h-4 bg-[#A94737]/70 ml-0.5 align-middle rounded-sm animate-pulse"
          aria-hidden="true"
        />
      </p>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="max-w-[800px] border border-black/10 rounded-3xl bg-[#FBF8F0]/60 px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-[#A94737] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 bg-[#A94737] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 bg-[#A94737] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <span className="text-[13px] text-[#8A8174]">生成中…</span>
      </div>
    </div>
  );
}

export function WashiMainFlow({ cards, isGenerating, draftTokens, onSubmit, onAction }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when cards or draft tokens change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [cards.length, draftTokens, isGenerating]);

  // Separate user cards from assistant cards
  const userCards = cards.filter((c) => c.role === "user");
  const assistantCards = cards.filter((c) => c.role === "assistant");
  const isEmpty = cards.length === 0 && !isGenerating && !draftTokens;

  return (
    <div className="flex flex-col h-full">
      {/* Card stream — scrollable middle */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyState onTryExample={undefined} />
        ) : (
          <div className="max-w-[860px] mx-auto px-4 py-6 flex flex-col gap-4">
            {/* User input cards */}
            {userCards.map((card) => (
              <div
                key={card.id}
                data-testid={`card-${card.type}`}
                className="max-w-[680px] ml-auto mr-0 rounded-2xl bg-[#25231F]/5 border border-black/10 px-4 py-3"
              >
                <p className="text-[13px] text-[#8A8174] leading-relaxed">{card.content}</p>
              </div>
            ))}

            {/* Assistant response cards */}
            {assistantCards.map((card) => (
              <CreationCard key={card.id} card={card} onAction={onAction} />
            ))}

            {/* Streaming output */}
            {draftTokens && <StreamingArea text={draftTokens} />}

            {/* Thinking indicator */}
            {isGenerating && !draftTokens && <ThinkingIndicator />}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Composer — fixed at bottom of main area */}
      <div className="flex-shrink-0 border-t border-black/8 bg-[#F5EFE3]">
        <div className="max-w-[860px] mx-auto px-4 py-4">
          <Composer onSubmit={onSubmit} disabled={isGenerating} />
        </div>
      </div>
    </div>
  );
}
