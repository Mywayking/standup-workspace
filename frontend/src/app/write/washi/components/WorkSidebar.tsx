// ============================================================
// WorkSidebar.tsx — 左侧作品列表
// Standup Workspace v3.0
// ============================================================

import React from "react";
import type { WorkSession } from "../types";
import { WORKFLOW_STEP_LABELS } from "../types";

interface Props {
  sessions: WorkSession[];
  activeSessionId?: string | null;
  onSelect: (id: string) => void;
  onNew?: () => void;
}

function formatDate(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const dayMs = 86400000;
  const d = new Date(ts);
  if (diff < dayMs) return "今天";
  if (diff < 2 * dayMs) return "昨天";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function groupByDate(sessions: WorkSession[]): Map<string, WorkSession[]> {
  const groups = new Map<string, WorkSession[]>();
  for (const s of sessions) {
    const label = formatDate(s.createdAt);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(s);
  }
  return groups;
}

export function WorkSidebar({ sessions, activeSessionId, onSelect, onNew }: Props) {
  const groups = groupByDate(sessions);

  return (
    <div className="flex flex-col h-full">
      {/* Brand header */}
      <div className="px-5 pt-6 pb-5 border-b border-black/10">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 rounded-full bg-[#A94737] shrink-0" />
          <span className="text-[11px] text-[#8A8174] tracking-widest uppercase">
            余白写作室
          </span>
        </div>
        <h2 className="text-[22px] font-semibold text-[#25231F] leading-tight tracking-wide mb-2"
            style={{ fontFamily: "STSong, Songti SC, serif" }}>
          余白写作室
        </h2>
        <p className="text-[13px] text-[#8A8174] leading-relaxed">
          安静地整理素材，慢慢写成能上台的段子。
        </p>
      </div>

      {/* New button */}
      {onNew && (
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={onNew}
            className="
              w-full flex items-center justify-center gap-2
              py-2.5 px-4 rounded-full
              bg-[#25231F] text-[#FBF8F0]
              text-sm font-semibold
              hover:bg-[#3a3832] transition-colors
            "
          >
            <span className="text-base">+</span>
            <span>新建作品</span>
          </button>
        </div>
      )}

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {sessions.length === 0 ? (
          <div className="px-2 py-6 text-center">
            <p className="text-[13px] text-[#C5BAAA] leading-relaxed">
              还没有创作记录
            </p>
          </div>
        ) : (
          Array.from(groups.entries()).map(([dateLabel, group]) => (
            <div key={dateLabel} className="mb-4">
              <p className="px-2 py-2 text-[11px] text-[#C5BAAA] tracking-widest uppercase">
                {dateLabel}
              </p>
              {group.map((session) => {
                const isActive = session.id === activeSessionId;
                const lastCard = session.cards[session.cards.length - 1];
                const stepLabel = lastCard
                  ? WORKFLOW_STEP_LABELS[lastCard.type] ?? lastCard.type
                  : "待开始";

                return (
                  <button
                    key={session.id}
                    onClick={() => onSelect(session.id)}
                    className={`
                      w-full text-left px-3 py-3 rounded-2xl mb-1
                      transition-all
                      ${isActive
                        ? "bg-white/60 border border-[#A94737]/30 shadow-sm"
                        : "hover:bg-white/30 border border-transparent"
                      }
                    `}
                  >
                    {/* Left accent bar for active */}
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#A94737] rounded-l-2xl" />
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className={`
                          text-sm font-semibold leading-snug truncate
                          ${isActive ? "text-[#25231F]" : "text-[#25231F]"}
                        `}>
                          {session.title || session.sourceInput.slice(0, 20) || "未命名"}
                        </h3>
                        <p className="text-[12px] text-[#8A8174] mt-0.5 truncate">
                          {stepLabel}
                        </p>
                      </div>
                      <span className={`
                        text-[11px] px-2 py-0.5 rounded-full shrink-0 mt-0.5
                        ${isActive
                          ? "bg-[#A94737]/10 text-[#A94737]"
                          : "bg-black/5 text-[#8A8174]"
                        }
                      `}>
                        {session.cards.length} 卡
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Footer stats */}
      <div className="px-5 py-4 border-t border-black/10">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] text-[#8A8174]">作品总数</p>
            <p className="text-[18px] text-[#25231F] font-medium mt-0.5"
               style={{ fontFamily: "STSong, Songti SC, serif" }}>
              {sessions.length}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[#8A8174]">卡片总数</p>
            <p className="text-[18px] text-[#25231F] font-medium mt-0.5"
               style={{ fontFamily: "STSong, Songti SC, serif" }}>
              {sessions.reduce((n, s) => n + s.cards.length, 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
