// ============================================================
// WashiMainFlow.tsx — 卡片流工作台视图
// Standup Workspace v3.0
// ============================================================

"use client";

import React, { useRef, useEffect } from "react";
import type { WorkCard, CardAction, WorkCardType } from "./types";

// WorkflowStep covers all workflow step keys (includes save, input etc.)
type WorkflowStep = WorkCardType | "input" | "detect" | "premise_check" | "performance_review" | "save";
import { CreationCard } from "./components/CreationCard";
import { ErrorCard } from "./components/ErrorCard";

interface Props {
  cards: WorkCard[];
  isThinking: boolean;
  streamingText: string;
  error: string | null;
  currentStep: WorkflowStep;
  onRetry?: () => void;
  onAction?: (action: CardAction, card: WorkCard) => void;
}

// 步骤链定义
const STEP_CHAIN: Array<{ key: WorkflowStep; label: string }> = [
  { key: "material", label: "素材" },
  { key: "premise", label: "前提" },
  { key: "angles", label: "角度" },
  { key: "draft", label: "初稿" },
  { key: "rewrite", label: "改稿" },
];

function getStepIndex(step: WorkflowStep): number {
  const idx = STEP_CHAIN.findIndex((s) => s.key === step);
  return idx >= 0 ? idx : 0;
}

// 步骤条：显示当前进度
function StepProgress({ currentStep }: { currentStep: WorkflowStep }) {
  const currentIdx = getStepIndex(currentStep);

  return (
    <div className="flex items-center gap-1 px-4 py-2">
      {STEP_CHAIN.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isActive = idx === currentIdx;
        const isFuture = idx > currentIdx;

        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1">
              {/* Step dot */}
              <div
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium
                  transition-all duration-300
                  ${isDone ? "bg-[#A94737] text-white" :
                    isActive ? "bg-[#A94737]/20 border border-[#A94737] text-[#A94737]" :
                    "bg-black/5 text-[#C5BAAA]"}
                `}
              >
                {isDone ? "✓" : idx + 1}
              </div>
              {/* Step label */}
              <span
                className={`
                  text-[10px] transition-colors hidden md:block
                  ${isActive ? "text-[#A94737] font-medium" :
                    isDone ? "text-[#8A8174]" :
                    "text-[#C5BAAA]"}
                `}
              >
                {step.label}
              </span>
            </div>
            {/* Connector line */}
            {idx < STEP_CHAIN.length - 1 && (
              <div
                className={`
                  flex-1 h-px mb-4 transition-colors duration-300
                  ${idx < currentIdx ? "bg-[#A94737]" : "bg-black/10"}
                `}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// 卡片类型 kicker 标签
const CARD_KICKER: Record<string, string> = {
  material: "MATERIAL",
  premise: "PREMISE",
  joke_to_premise: "JOKE → PREMISE",
  angle: "ANGLES",
  angles: "ANGLES",
  draft: "DRAFT",
  rewrite: "REWRITE",
  feedback: "PERFORMANCE REVIEW",
};

// 流式输出区（带光标动画）
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

// 错误卡片（独立展示）
function StandaloneError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="max-w-[800px]">
      <ErrorCard message={message} onRetry={onRetry} />
    </div>
  );
}

// 空状态欢迎页
function WashiEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
      {/* 装饰性 SVG */}
      <div className="mb-6" aria-hidden="true">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mx-auto">
          <rect x="12" y="16" width="56" height="48" rx="8" fill="#F0E7D8" stroke="#C5BAAA" strokeWidth="2"/>
          <line x1="22" y1="30" x2="58" y2="30" stroke="#C5BAAA" strokeWidth="2" strokeLinecap="round"/>
          <line x1="22" y1="40" x2="50" y2="40" stroke="#C5BAAA" strokeWidth="2" strokeLinecap="round"/>
          <line x1="22" y1="50" x2="44" y2="50" stroke="#C5BAAA" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="58" cy="54" r="14" fill="#A94737" opacity="0.9"/>
          <path d="M54 54h8M58 50v8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>

      <h2
        className="text-[22px] font-semibold text-[#25231F] mb-3 leading-snug"
        style={{ fontFamily: "STSong, Songti SC, serif" }}
      >
        创作工作台
      </h2>

      <p className="text-[14px] text-[#8A8174] leading-relaxed max-w-[280px]">
        输入一段素材，AI 会帮你找到前提、角度，生成初稿并支持改稿。
      </p>

      {/* 快捷步骤预览 */}
      <div className="mt-8 flex items-center gap-2">
        {STEP_CHAIN.map((step, idx) => (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1">
              <div className="w-5 h-5 rounded-full bg-black/5 text-[9px] text-[#C5BAAA] flex items-center justify-center">
                {idx + 1}
              </div>
              <span className="text-[10px] text-[#C5BAAA] hidden md:block">{step.label}</span>
            </div>
            {idx < STEP_CHAIN.length - 1 && (
              <div className="w-6 h-px bg-black/10 mb-4" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export function WashiMainFlow({
  cards,
  isThinking,
  streamingText,
  error,
  currentStep,
  onRetry,
  onAction,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [cards.length, streamingText, isThinking]);

  // 过滤掉 error 类型的卡片（独立错误卡片单独处理）
  const regularCards = cards.filter((c) => c.type !== "error" && c.role !== "user");
  const errorCards = cards.filter((c) => c.type === "error");
  const userCards = cards.filter((c) => c.role === "user");

  if (cards.length === 0 && !isThinking && !streamingText && !error) {
    return <WashiEmptyState />;
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* 步骤进度条 */}
      <div className="border-b border-black/10 bg-[#FBF8F0]/50">
        <StepProgress currentStep={currentStep} />
      </div>

      {/* 卡片流区域 */}
      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6 flex flex-col gap-5">
        {/* 用户输入 */}
        {userCards.map((card) => (
          <div
            key={card.id}
            className="max-w-[680px] ml-auto mr-0 rounded-2xl bg-[#25231F]/5 border border-black/10 px-4 py-3"
          >
            <p className="text-[13px] text-[#8A8174] leading-relaxed">{card.content}</p>
          </div>
        ))}

        {/* 创作卡片流 */}
        {regularCards.map((card, idx) => {
          const kicker = CARD_KICKER[card.type] ?? card.type.toUpperCase();
          const isLast = idx === regularCards.length - 1;

          return (
            <div key={card.id} className="flex flex-col gap-1">
              {/* 卡片 */}
              <CreationCard
                card={card}
                onAction={onAction}
              />

              {/* 卡片间的连接箭头（不是最后一张时显示） */}
              {isLast && !isThinking && !streamingText && (
                <div className="flex items-center justify-center py-1">
                  <span className="text-[#C5BAAA] text-[11px]">— 当前 —</span>
                </div>
              )}
            </div>
          );
        })}

        {/* 独立错误卡片 */}
        {errorCards.map((card) => (
          <StandaloneError
            key={card.id}
            message={card.content}
            onRetry={onRetry}
          />
        ))}

        {/* 流式输出 */}
        {streamingText && (
          <StreamingArea text={streamingText} />
        )}

        {/* Thinking 状态 */}
        {isThinking && (
          <div className="max-w-[800px] border border-black/10 rounded-3xl bg-[#FBF8F0]/60 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-[#A94737] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-[#A94737] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-[#A94737] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-[13px] text-[#8A8174]">
                {STEP_CHAIN[getStepIndex(currentStep)]?.label ?? "生成中"}…
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
