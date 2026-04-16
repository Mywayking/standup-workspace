"use client";

import { useState, useCallback, useEffect } from "react";

const BASE = "";

interface KbStats {
  total_segments: number;
  total_docs: number;
  top_themes: [string, number][];
  top_techniques: [string, number][];
  top_emotions: [string, number][];
  top_performers: [string, number][];
  shows: Record<string, number>;
}

interface KbSegment {
  segment_id: string;
  performer_name: string;
  show: string;
  round_code: string;
  text: string;
  analysis: string;
  emotion_tags: string[];
  technique_tags: string[];
  theme_tags: string[];
  summary: string;
}

interface SearchResult {
  total: number;
  page: number;
  page_size: number;
  segments: KbSegment[];
}

async function apiJson<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json() as Promise<T>;
}

const EMOTION_COLORS: Record<string, string> = {
  荒诞: "bg-purple-100 text-purple-700",
  紧张: "bg-yellow-100 text-yellow-700",
  害怕: "bg-red-100 text-red-700",
  生气: "bg-orange-100 text-orange-700",
  尴尬: "bg-pink-100 text-pink-700",
  难受: "bg-gray-100 text-gray-700",
  可怕: "bg-red-50 text-red-600",
  焦虑: "bg-amber-100 text-amber-700",
  无奈: "bg-slate-100 text-slate-600",
  羞耻: "bg-rose-100 text-rose-700",
};

export default function KbPage() {
  const [stats, setStats] = useState<KbStats | null>(null);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Filter state
  const [query, setQuery] = useState("");
  const [selThemes, setSelThemes] = useState<string[]>([]);
  const [selTechs, setSelTechs] = useState<string[]>([]);
  const [selEmotions, setSelEmotions] = useState<string[]>([]);
  const [selPerformer, setSelPerformer] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Expanded segment
  const [expanded, setExpanded] = useState<string | null>(null);

  // Load stats on mount
  useEffect(() => {
    apiJson<KbStats>("/api/kb/stats").then(setStats).catch(console.error);
  }, []);

  // Search
  const doSearch = useCallback(
    async (q: string, themes: string[], techs: string[], emotions: string[], perf: string, p: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q, page: String(p), page_size: String(PAGE_SIZE) });
        if (themes.length) params.set("theme", themes.join(","));
        if (techs.length) params.set("technique", techs.join(","));
        if (emotions.length) params.set("emotion", emotions.join(","));
        if (perf) params.set("performer", perf);
        const data = await apiJson<SearchResult>(`/api/kb/search?${params}`);
        setResults(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Initial load
  useEffect(() => {
    doSearch("", [], [], [], "", 1);
  }, [doSearch]);

  const handleSearch = (q: string) => {
    setQuery(q);
    setPage(1);
    doSearch(q, selThemes, selTechs, selEmotions, selPerformer, 1);
  };

  const toggleTheme = (t: string) => {
    const next = selThemes.includes(t) ? selThemes.filter((x) => x !== t) : [...selThemes, t];
    setSelThemes(next);
    setPage(1);
    doSearch(query, next, selTechs, selEmotions, selPerformer, 1);
  };

  const toggleTech = (t: string) => {
    const next = selTechs.includes(t) ? selTechs.filter((x) => x !== t) : [...selTechs, t];
    setSelTechs(next);
    setPage(1);
    doSearch(query, selThemes, next, selEmotions, selPerformer, 1);
  };

  const toggleEmotion = (t: string) => {
    const next = selEmotions.includes(t) ? selEmotions.filter((x) => x !== t) : [...selEmotions, t];
    setSelEmotions(next);
    setPage(1);
    doSearch(query, selThemes, selTechs, next, selPerformer, 1);
  };

  const totalPages = results ? Math.ceil(results.total / PAGE_SIZE) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <button
            onClick={() => window.location.href = "/"}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            ← 返回
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">📚 喜剧素材库</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {stats
                ? `${stats.total_docs} 篇文稿 · ${stats.total_segments} 个段落`
                : "加载中..."}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-5">
        {/* Search bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
              placeholder="搜索段子内容、分析笔记..."
              className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-blue-400"
            />
            <button
              onClick={() => handleSearch(query)}
              className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              🔍 搜索
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            支持按主题、技巧、情绪、演员筛选
          </p>
        </div>

        <div className="flex gap-5">
          {/* Left: filters */}
          <aside className="w-56 shrink-0 space-y-4">
            {/* Top themes */}
            {stats && (
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">🔥 热门主题</p>
                <div className="flex flex-wrap gap-1">
                  {stats.top_themes.slice(0, 15).map(([theme, count]) => (
                    <button
                      key={theme}
                      onClick={() => toggleTheme(theme)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        selThemes.includes(theme)
                          ? "bg-orange-100 border-orange-300 text-orange-700"
                          : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {theme} {count}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Top techniques */}
            {stats && (
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">🎯 核心技巧</p>
                <div className="flex flex-wrap gap-1">
                  {stats.top_techniques.slice(0, 12).map(([tech, count]) => (
                    <button
                      key={tech}
                      onClick={() => toggleTech(tech)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        selTechs.includes(tech)
                          ? "bg-green-100 border-green-300 text-green-700"
                          : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {tech} {count}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Top emotions */}
            {stats && (
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">💜 情绪标签</p>
                <div className="flex flex-wrap gap-1">
                  {stats.top_emotions.slice(0, 10).map(([emotion, count]) => (
                    <button
                      key={emotion}
                      onClick={() => toggleEmotion(emotion)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        selEmotions.includes(emotion)
                          ? `${EMOTION_COLORS[emotion] ?? "bg-purple-100 text-purple-700"} border-purple-300`
                          : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {emotion} {count}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* Right: results */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Results header */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {loading
                  ? "搜索中..."
                  : results
                  ? `${results.total} 条结果`
                  : ""}
              </p>
              {(selThemes.length > 0 || selTechs.length > 0 || selEmotions.length > 0) && (
                <button
                  onClick={() => {
                    setSelThemes([]);
                    setSelTechs([]);
                    setSelEmotions([]);
                    doSearch(query, [], [], [], selPerformer, 1);
                  }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  清空筛选 ✕
                </button>
              )}
            </div>

            {/* Segment cards */}
            {loading ? (
              <div className="text-center py-16 text-gray-400 text-sm">加载中...</div>
            ) : results?.segments.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">
                没有找到匹配的段子，试试调整筛选条件
              </div>
            ) : (
              results?.segments.map((seg) => (
                <div
                  key={seg.segment_id}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                >
                  {/* Segment header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-800">
                          {seg.performer_name || "未知演员"}
                        </span>
                        {seg.show && (
                          <span className="text-xs text-gray-400">{seg.show}</span>
                        )}
                        {seg.round_code && (
                          <span className="text-xs text-gray-300">第{seg.round_code}轮</span>
                        )}
                      </div>
                      {/* Tags row */}
                      <div className="flex flex-wrap gap-1 items-center">
                        {seg.theme_tags.map((t) => (
                          <span key={t} className="text-xs px-1.5 py-0.5 bg-orange-50 text-orange-500 rounded">
                            {t}
                          </span>
                        ))}
                        {seg.technique_tags.map((t) => (
                          <span key={t} className="text-xs px-1.5 py-0.5 bg-green-50 text-green-600 rounded">
                            {t}
                          </span>
                        ))}
                        {seg.emotion_tags.map((e) => (
                          <span
                            key={e}
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              EMOTION_COLORS[e] ?? "bg-purple-50 text-purple-600"
                            }`}
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => setExpanded(expanded === seg.segment_id ? null : seg.segment_id)}
                      className="text-xs text-gray-400 hover:text-gray-700 shrink-0"
                    >
                      {expanded === seg.segment_id ? "收起 ▲" : "展开 ▼"}
                    </button>
                  </div>

                  {/* Segment text */}
                  <blockquote className="text-sm text-gray-700 leading-relaxed italic">
                    {seg.text.length > 200 && expanded !== seg.segment_id
                      ? seg.text.slice(0, 200) + "..."
                      : seg.text}
                  </blockquote>

                  {/* Expanded content */}
                  {expanded === seg.segment_id && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      {seg.analysis && (
                        <div>
                          <span className="text-xs font-semibold text-gray-400 uppercase">分析</span>
                          <p className="text-sm text-gray-600 mt-0.5">{seg.analysis}</p>
                        </div>
                      )}
                      {seg.summary && (
                        <div>
                          <span className="text-xs font-semibold text-gray-400 uppercase">摘要</span>
                          <p className="text-sm text-gray-600 mt-0.5">{seg.summary}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  onClick={() => {
                    const p = Math.max(1, page - 1);
                    setPage(p);
                    doSearch(query, selThemes, selTechs, selEmotions, selPerformer, p);
                  }}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm border border-gray-200 rounded-md disabled:opacity-40 hover:bg-gray-50"
                >
                  ← 上一页
                </button>
                <span className="text-sm text-gray-500">
                  第 {page} / {totalPages} 页
                </span>
                <button
                  onClick={() => {
                    const p = Math.min(totalPages, page + 1);
                    setPage(p);
                    doSearch(query, selThemes, selTechs, selEmotions, selPerformer, p);
                  }}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-sm border border-gray-200 rounded-md disabled:opacity-40 hover:bg-gray-50"
                >
                  下一页 →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
