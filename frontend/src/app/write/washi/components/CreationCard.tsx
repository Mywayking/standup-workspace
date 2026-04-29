// ============================================================
// CreationCard.tsx — AI 输出卡片（前提卡 / 角度卡 / 改稿卡）
// Standup Workspace v3.0
// ============================================================

import React from "react";
import type { WorkCard, CardAction } from "../types";
import { WORKFLOW_STEP_LABELS } from "../types";

interface Props {
  card: WorkCard;
  onAction?: (action: CardAction, card: WorkCard) => void;
  onSourceClick?: (cardId: string) => void;
}

// 卡片类型标签映射
const CARD_KICKER: Record<string, string> = {
  premise: "PREMISE",
  joke_to_premise: "JOKE → PREMISE",
  angle: "ANGLES",
  rewrite: "REWRITE",
  draft: "DRAFT",
  feedback: "PERFORMANCE REVIEW",
  material: "MATERIAL",
};

function parseAngles(content: string): Array<{ title: string; desc: string }> {
  const lines = content.split("\n").filter((l) => l.trim());
  return lines.map((line) => {
    // "1. 标题 — 描述" 或 "一、标题" 格式
    const withoutNum = line.replace(/^\d+[.)、]\s*/, "").trim();
    const parts = withoutNum.split(/[—–]/).map((p) => p.trim());
    return {
      title: parts[0] ?? withoutNum,
      desc: parts.slice(1).join(" — ") ?? "",
    };
  });
}

export function CreationCard({ card, onAction, onSourceClick }: Props) {
  const kicker = CARD_KICKER[card.type] ?? card.type.toUpperCase();
  const isAngleCard = card.type === "angle" || card.type === "angles";
  const isPremiseCard = card.type === "premise" || card.type === "joke_to_premise";
  const angles = isAngleCard ? parseAngles(card.content) : [];

  return (
    <article
      data-testid={`card-${card.type}`}
      className="max-w-[800px] border border-black/16 rounded-3xl bg-[#FBF8F0]/96 overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-black/10">
        <div>
          <p className="text-[11px] text-[#C5BAAA] tracking-widest mb-1">{kicker}</p>
          <h3 className="text-[16px] font-semibold text-[#25231F]">{card.title}</h3>
        </div>
        {/* Seal mark */}
        <div
          className="
            w-[34px] h-[34px] rounded-full shrink-0
            flex items-center justify-center
            border border-[#A94737]/30 text-[#A94737]
            text-[12px] hidden md:flex
          "
          style={{ fontFamily: "STSong, Songti SC, serif" }}
        >
          {card.type === "rewrite" ? "改" :
           card.type === "angle" ? "角" :
           card.type === "premise" ? "前" : "卡"}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4">
        {/* Premise text with red left border */}
        {isPremiseCard && (
          <p
            className="pl-4 border-l-2 border-[#A94737] text-[15px] leading-relaxed text-[#25231F] mb-4"
            style={{ fontFamily: "STSong, STSongti SC, serif" }}
          >
            {card.content}
          </p>
        )}

        {/* Angles list */}
        {isAngleCard && angles.length > 0 && (
          <div className="mb-4">
            {angles.map((angle, idx) => (
              <div key={idx} className="py-3 border-t border-black/8 first:border-t-0">
                <div className="flex gap-3">
                  <span
                    className="text-[15px] text-[#C5BAAA] shrink-0 pt-0.5"
                    style={{ fontFamily: "STSong, Songti SC, serif" }}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold text-[#25231F] mb-1">
                      {angle.title}
                    </p>
                    {angle.desc && (
                      <p className="text-[13px] text-[#8A8174] leading-relaxed">
                        {angle.desc}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Generic content (rewrite, feedback, etc.) */}
        {!isPremiseCard && !isAngleCard && (
          <p className="text-[14px] leading-relaxed text-[#25231F] whitespace-pre-wrap mb-4">
            {card.content}
          </p>
        )}

        {/* Source path */}
        {card.sourcePath.length > 0 && (
          <p className="text-[11px] text-[#C5BAAA] mb-3">
            来源：{card.sourcePath.join(" → ")}
          </p>
        )}

        {/* Actions */}
        {card.actions && card.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {card.actions.map((action) => (
              <button
                key={action.id}
                data-testid={`action-${action.type}`}
                onClick={() => onAction?.(action, card)}
                className={`
                  text-[13px] px-4 py-2 rounded-full transition-colors
                  border border-black/16
                  ${action.type === "expand_to_draft" || action.type === "find_angles"
                    ? "bg-[#25231F] text-[#FBF8F0] hover:bg-[#3a3832]"
                    : "bg-transparent text-[#8A8174] hover:bg-black/5"
                  }
                `}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer meta */}
      <div className="px-4 py-2.5 border-t border-black/8 flex items-center gap-3">
        {card.meta?.model && (
          <span className="text-[11px] text-[#8A8174]">
            {card.meta.model}
          </span>
        )}
        {card.meta?.latencyMs && (
          <span className="text-[11px] text-[#8A8174]">
            {card.meta.latencyMs}ms
          </span>
        )}
        <span className="text-[11px] text-[#C5BAAA] ml-auto">
          {new Date(card.createdAt).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </article>
  );
}
