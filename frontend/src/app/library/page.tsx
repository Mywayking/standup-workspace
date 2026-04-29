// ============================================================
// library/page.tsx — 稿件库（云端同步记录）
// Standup Workspace v3.0
// ============================================================

"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { Metadata } from "next";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

// ─── Types ───────────────────────────────────────────────────

interface CloudSession {
  id: string;
  title: string;
  source_input: string;
  input_type: string | null;
  current_step: string | null;
  script_status: string;
  save_status: string;
  sync_status: string;
  created_at: string;
  updated_at: string;
}

interface CloudCard {
  id: string;
  session_id: string;
  parent_id: string | null;
  type: string;
  title: string;
  content: string;
  structured_data: unknown;
  source_path: unknown[];
  is_selected: number;
  is_mainline: number;
  version: number;
  model: string | null;
  provider: string | null;
  latency_ms: number | null;
  token_usage: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  } catch {
    return iso;
  }
}

const STATUS_LABELS: Record<string, string> = {
  idea: "构思中",
  premise: "前提",
  draft: "初稿",
  performable: "可演",
  performed: "已演",
  mature: "成熟",
  archived: "归档",
};

// ─── Session Card ────────────────────────────────────────────

function SessionCard({
  session,
  expanded,
  onToggle,
}: {
  session: CloudSession;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [cards, setCards] = useState<CloudCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);

  const loadCards = useCallback(async () => {
    if (!API_BASE) return;
    setLoadingCards(true);
    try {
      const res = await fetch(`${API_BASE}/api/write/sessions/${session.id}/cards`);
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingCards(false);
    }
  }, [session.id]);

  useEffect(() => {
    if (expanded && cards.length === 0) {
      loadCards();
    }
  }, [expanded, cards.length, loadCards]);

  return (
    <div className="bg-white/60 border border-black/10 rounded-2xl overflow-hidden transition-all hover:border-[#A94737]/30">
      {/* Header */}
      <button
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-3"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <h3
            className="text-[16px] font-semibold text-[#25231F] leading-snug truncate"
            style={{ fontFamily: "STSong, Songti SC, serif" }}
          >
            {session.title || "无标题"}
          </h3>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[12px] text-[#8A8174]">
              {formatDateTime(session.created_at)}
            </span>
            <span className="text-[12px] text-[#C5BAAA]">·</span>
            <span className="text-[12px] text-[#8A8174]">
              {session.script_status ? STATUS_LABELS[session.script_status] || session.script_status : "构思中"}
            </span>
            <span className="text-[12px] text-[#C5BAAA]">·</span>
            <span className="text-[12px] text-[#8A8174]">
              {session.save_status === "saved_cloud" ? "☁️ 已同步" : "📱 本地"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[12px] text-[#C5BAAA]">{cards.length} 张卡片</span>
          <span
            className="text-[#8A8174] transition-transform"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            ▼
          </span>
        </div>
      </button>

      {/* Expanded cards list */}
      {expanded && (
        <div className="border-t border-black/10 px-5 py-4 space-y-3">
          {loadingCards ? (
            <p className="text-[13px] text-[#C5BAAA] text-center py-3">加载中…</p>
          ) : cards.length === 0 ? (
            <p className="text-[13px] text-[#C5BAAA] text-center py-3">暂无卡片</p>
          ) : (
            cards.map((card) => (
              <div
                key={card.id}
                className="bg-[#F5EFE3]/80 rounded-xl px-4 py-3 border border-black/5"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-[12px] font-medium text-[#A94737] bg-[#A94737]/10 px-2 py-0.5 rounded-full">
                    {card.type}
                  </span>
                  {card.model && (
                    <span className="text-[11px] text-[#C5BAAA]">{card.model}</span>
                  )}
                </div>
                <p
                  className="text-[14px] text-[#25231F] leading-relaxed line-clamp-3"
                  style={{ fontFamily: "STSong, Songti SC, serif" }}
                >
                  {card.title}
                </p>
                {card.content && (
                  <p
                    className="text-[13px] text-[#8A8174] mt-1 leading-relaxed line-clamp-2"
                  >
                    {card.content.slice(0, 100)}
                    {card.content.length > 100 ? "…" : ""}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────

export default function LibraryPage() {
  const [sessions, setSessions] = useState<CloudSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!API_BASE) {
        setLoading(false);
        setError("未配置云端 API（NEXT_PUBLIC_API_BASE 未设置）");
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/write/sessions`);
        if (res.status === 401) {
          setError("请先登录后再访问稿件库");
        } else if (res.ok) {
          const data = await res.json();
          setSessions(data.sessions || []);
        } else {
          setError(`加载失败（${res.status}）`);
        }
      } catch (e) {
        setError("网络错误，请稍后重试");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Group sessions by date
  const groups = sessions.reduce<Record<string, CloudSession[]>>((acc, s) => {
    const label = formatDate(s.created_at);
    if (!acc[label]) acc[label] = [];
    acc[label].push(s);
    return acc;
  }, {});

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "#F5EFE3",
        fontFamily: "STSong, Songti SC, serif",
      }}
    >
      {/* Header */}
      <div className="bg-[#F5EFE3] border-b border-black/10 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-7 h-7 rounded-full bg-[#A94737] shrink-0" />
            <span className="text-[11px] text-[#8A8174] tracking-widest uppercase">
              余白写作室
            </span>
          </div>
          <h1
            className="text-[24px] font-semibold text-[#25231F] tracking-wide"
            style={{ fontFamily: "STSong, Songti SC, serif" }}
          >
            稿件库
          </h1>
          <p className="text-[13px] text-[#8A8174] mt-1">
            你的所有云端创作记录
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-5 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-[14px] text-[#C5BAAA]">正在加载…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-[14px] text-[#A94737]">{error}</p>
            <a
              href="/write"
              className="text-[14px] text-[#25231F] underline underline-offset-2"
            >
              前往创作 →
            </a>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-[14px] text-[#8A8174]">稿件库是空的</p>
            <a
              href="/write"
              className="text-[14px] text-[#25231F] underline underline-offset-2"
            >
              去创作 →
            </a>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groups).map(([dateLabel, group]) => (
              <div key={dateLabel}>
                <p className="text-[11px] text-[#C5BAAA] tracking-widest uppercase mb-3 px-1">
                  {dateLabel}
                </p>
                <div className="space-y-2">
                  {group.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      expanded={expandedId === session.id}
                      onToggle={() =>
                        setExpandedId((prev) =>
                          prev === session.id ? null : session.id
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
