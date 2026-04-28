// ============================================================
// ChatCanvas.tsx — 中间消息流
// Standup Workspace v3.0
// ============================================================

import React, { useRef, useEffect } from "react";
import type { WorkCard, CardAction } from "../types";
import { ChatMessage } from "./ChatMessage";
import { CreationCard } from "./CreationCard";
import { ThinkingCard } from "./ThinkingCard";
import { ErrorCard } from "./ErrorCard";

interface Props {
  cards: WorkCard[];
  isThinking: boolean;
  draftTokens: string;
  activeCardId?: string;
  onAction?: (action: CardAction, card: WorkCard) => void;
  onSourceClick?: (cardId: string) => void;
  onRetry?: () => void;
}

const STEP_LABELS: Record<string, string> = {
  premise: "正在提炼前提…",
  joke_to_premise: "正在反推前提…",
  angles: "正在找角度…",
  rewrite: "正在改稿…",
  draft: "正在写草稿…",
  feedback: "正在分析演出…",
};

export function ChatCanvas({
  cards,
  isThinking,
  draftTokens,
  activeCardId,
  onAction,
  onSourceClick,
  onRetry,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [cards.length, draftTokens]);

  if (cards.length === 0 && !isThinking && !draftTokens) {
    return null; // EmptyState is rendered by parent
  }

  // Find last assistant card to determine thinking step
  const lastAssistantCard = [...cards].reverse().find((c) => c.role === "assistant");
  const thinkingStep = lastAssistantCard ? STEP_LABELS[lastAssistantCard.type] : "正在生成…";

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5 flex flex-col gap-4">
      {cards.map((card) => {
        if (card.role === "user") {
          return (
            <ChatMessage
              key={card.id}
              role="user"
              content={card.content}
              timestamp={card.createdAt}
            />
          );
        }

        if (card.type === "error") {
          return (
            <ErrorCard
              key={card.id}
              message={card.content}
              onRetry={onRetry}
            />
          );
        }

        return (
          <CreationCard
            key={card.id}
            card={card}
            onAction={onAction}
            onSourceClick={onSourceClick}
          />
        );
      })}

      {/* Thinking skeleton */}
      {isThinking && <ThinkingCard step={thinkingStep} />}

      {/* Streaming tokens */}
      {draftTokens && !isThinking && (
        <div className="max-w-[800px] border border-black/16 rounded-3xl bg-[#FBF8F0]/96 px-4 py-4">
          <p className="text-[14px] leading-relaxed text-[#25231F] whitespace-pre-wrap">
            {draftTokens}
            <span className="inline-block w-2 h-4 bg-[#A94737]/60 ml-0.5 align-middle animate-pulse rounded-sm" />
          </p>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
