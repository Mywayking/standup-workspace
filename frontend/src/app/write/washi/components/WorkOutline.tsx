// ============================================================
// WorkOutline.tsx — 右侧作品脉络
// Standup Workspace v3.0
// ============================================================

import React from "react";
import type { WorkSession, WorkCard } from "../types";

interface Props {
  session?: WorkSession | null;
  cards: WorkCard[];
  activeCardId?: string;
  onCardClick?: (cardId: string) => void;
}

// 步骤链
const STEP_CHAIN = [
  { key: "material", label: "原始素材" },
  { key: "premise", label: "前提" },
  { key: "joke_to_premise", label: "梗前提" },
  { key: "angle", label: "角度" },
  { key: "draft", label: "草稿" },
  { key: "rewrite", label: "改稿" },
  { key: "feedback", label: "演后记" },
];

function getCardForStep(cards: WorkCard[], stepKey: string): WorkCard | null {
  return cards.find((c) => c.type === stepKey) ?? null;
}

function calcReadiness(cards: WorkCard[]): number {
  const filled = STEP_CHAIN.filter((s) => getCardForStep(cards, s.key)).length;
  return Math.round((filled / STEP_CHAIN.length) * 100);
}

export function WorkOutline({ session, cards, activeCardId, onCardClick }: Props) {
  const readiness = calcReadiness(cards);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 border-b border-black/10">
        <h2
          className="text-[17px] font-semibold text-[#25231F] mb-1"
          style={{ fontFamily: "STSong, Songti SC, serif" }}
        >
          作品脉络
        </h2>
        <p className="text-[13px] text-[#8A8174]">
          桌面常驻，移动端为底部面板。
        </p>
      </div>

      {/* Readiness bar */}
      <div className="px-5 py-4 border-b border-black/10">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[12px] text-[#8A8174]">开放麦准备度</span>
          <strong
            className="text-[30px] text-[#25231F] font-normal"
            style={{ fontFamily: "STSong, Songti SC, serif" }}
          >
            {readiness}%
          </strong>
        </div>
        <div className="h-1.5 rounded-full bg-black/[0.07] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#68715F] transition-all"
            style={{ width: `${readiness}%` }}
          />
        </div>
      </div>

      {/* Step chain */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {STEP_CHAIN.map((step, idx) => {
          const card = getCardForStep(cards, step.key);
          const isActive = card?.id === activeCardId;
          const isFilled = !!card;

          return (
            <div key={step.key} className="py-3 border-b border-black/8 last:border-b-0">
              <div className="flex items-start gap-3">
                <span
                  className={`
                    text-[11px] font-medium shrink-0 mt-0.5 w-5
                    ${isFilled ? "text-[#8A8174]" : "text-[#C5BAAA]"}
                  `}
                  style={{ fontFamily: "STSong, Songti SC, serif" }}
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <h4
                    className={`
                      text-[13px] font-semibold text-[#25231F] mb-0.5
                      flex items-center gap-1.5
                    `}
                  >
                    {step.label}
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#A94737] inline-block" />
                    )}
                  </h4>
                  {card ? (
                    <button
                      onClick={() => onCardClick?.(card.id)}
                      className={`
                        text-left text-[12px] leading-snug line-clamp-2
                        ${isActive ? "text-[#A94737]" : "text-[#8A8174]"}
                        hover:underline
                      `}
                    >
                      {card.content.slice(0, 60)}
                      {card.content.length > 60 && "…"}
                    </button>
                  ) : (
                    <p className="text-[12px] text-[#C5BAAA]">
                      {idx === cards.length ? "下一步扩展" : "暂无"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer meta */}
      <div className="px-5 py-4 border-t border-black/10 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] text-[#8A8174]">前提版本</p>
          <p
            className="text-[18px] text-[#25231F] mt-0.5"
            style={{ fontFamily: "STSong, Songti SC, serif" }}
          >
            {cards.filter((c) => c.type === "premise").length || "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[#8A8174]">角度卡</p>
          <p
            className="text-[18px] text-[#25231F] mt-0.5"
            style={{ fontFamily: "STSong, Songti SC, serif" }}
          >
            {cards.filter((c) => c.type === "angle").length || "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[#8A8174]">改稿历史</p>
          <p
            className="text-[18px] text-[#25231F] mt-0.5"
            style={{ fontFamily: "STSong, Songti SC, serif" }}
          >
            {cards.filter((c) => c.type === "rewrite").length || "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[#8A8174]">卡片总数</p>
          <p
            className="text-[18px] text-[#25231F] mt-0.5"
            style={{ fontFamily: "STSong, Songti SC, serif" }}
          >
            {cards.length}
          </p>
        </div>
      </div>
    </div>
  );
}
