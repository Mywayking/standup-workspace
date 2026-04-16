"use client";

import { useState } from "react";
import type { SegmentDetail } from "@/types";
import { SegmentCard } from "@/components/analysis/SegmentCard";
import { useWorkspaceStore } from "@/stores/workspaceStore";

// 真实标签体系 — 来源：知识库 8328 段落统计分析
const ALL_STRUCTURES = [
  "开场", "铺垫", "举例", "递进", "callback", "收尾", "过渡",
  "自我介绍", "情绪铺垫", "冲突建立", "解构", "反转"
];
const ALL_TECHNIQUES = [
  "故事段子", "自嘲", "细节深挖", "对比反差", "夸张", "类比",
  "观察", "callback", "谐音梗", "双关", "修辞梗", "反转",
  "画面感", "场景化", "结果假设", "三段式", "层层递进",
  "观察式喜剧", "现挂", "连接型洞察", "陌生化", "荒诞真相",
  "语言发明", "场景置换", "逻辑悖论", "人物置换"
];
const ALL_PROBLEMS = [
  "前提缺失", "共鸣不足", "只有趣事", "依赖表演",
  "结构散乱", "节奏拖沓", "技巧堆砌", "主题模糊"
];
const ALL_EMOTIONS = [
  "荒诞", "紧张", "害怕", "生气", "尴尬", "难受", "可怕",
  "焦虑", "复杂", "无奈", "羞耻", "后悔", "愤怒", "委屈",
  "恐惧", "绝望", "压抑", "悲伤", "别扭", "孤独", "窝囊"
];
const ALL_THEMES = [
  "年龄", "行业观察", "朋友关系", "职场", "金钱", "居住",
  "婚恋", "家庭", "儿童", "比赛节目", "医疗", "教育",
  "贫穷", "娱乐", "身体困境", "生活服务", "社交", "消费",
  "身材", "互联网", "身体身份", "投资", "穿搭审美", "宠物"
];

export function CenterPanel({
  segments,
  selectedSegmentId,
  onSelectSegment,
  onToggleStar,
}: {
  segments: SegmentDetail[];
  selectedSegmentId: number | null;
  onSelectSegment: (id: number) => void;
  onToggleStar: (segmentId: number, starred: boolean) => void;
}) {
  const [listView, setListView] = useState<"cards" | "list">("cards");
  const { filterKeyword, setFilterKeyword, filterMode, setFilterMode } = useWorkspaceStore();
  const [showFilters, setShowFilters] = useState(false);

  // Active tag filters
  const [structFilters, setStructFilters] = useState<string[]>([]);
  const [techFilters, setTechFilters] = useState<string[]>([]);
  const [probFilters, setProbFilters] = useState<string[]>([]);

  const toggleStruct = (s: string) =>
    setStructFilters((f) => (f.includes(s) ? f.filter((x) => x !== s) : [...f, s]));
  const toggleTech = (t: string) =>
    setTechFilters((f) => (f.includes(t) ? f.filter((x) => x !== t) : [...f, t]));
  const toggleProb = (p: string) =>
    setProbFilters((f) => (f.includes(p) ? f.filter((x) => x !== p) : [...f, p]));

  const visible = segments.filter((seg) => {
    // keyword
    if (filterKeyword) {
      const kw = filterKeyword.toLowerCase();
      const raw = seg.raw_text.toLowerCase();
      const analysis = (seg.analysis?.analysis_text || "").toLowerCase();
      if (!raw.includes(kw) && !analysis.includes(kw)) return false;
    }
    // structure
    if (structFilters.length > 0) {
      if (!seg.analysis?.structure || !structFilters.includes(seg.analysis.structure)) return false;
    }
    // technique
    if (techFilters.length > 0) {
      const segTechs = (seg.analysis?.techniques || "").split(",").map((t) => t.trim());
      if (!structFilters.some((t) => segTechs.includes(t))) return false;
    }
    // problem
    if (probFilters.length > 0) {
      const segProbs = (seg.analysis?.problems || "").split(",").map((p) => p.trim());
      if (!probFilters.some((p) => segProbs.includes(p))) return false;
    }
    return true;
  });

  const hasActiveFilters = structFilters.length > 0 || techFilters.length > 0 || probFilters.length > 0 || !!filterKeyword;

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 p-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.target.value)}
            placeholder="搜索段落..."
            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
              hasActiveFilters
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            筛选 {hasActiveFilters && `(${structFilters.length + techFilters.length + probFilters.length})`}
          </button>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setFilterKeyword("");
                setStructFilters([]);
                setTechFilters([]);
                setProbFilters([]);
              }}
              className="text-xs text-gray-400 hover:text-gray-700"
            >
              清除
            </button>
          )}
          <span className="text-xs text-gray-400">
            {visible.length}/{segments.length}
          </span>
          <div className="ml-auto flex gap-1">
            <button
              onClick={() => setListView("cards")}
              className={`text-xs px-2 py-1 rounded ${listView === "cards" ? "bg-white shadow-sm border" : "text-gray-400"}`}
            >
              卡片
            </button>
            <button
              onClick={() => setListView("list")}
              className={`text-xs px-2 py-1 rounded ${listView === "list" ? "bg-white shadow-sm border" : "text-gray-400"}`}
            >
              列表
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
            {/* Structure tags */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">结构</p>
              <div className="flex flex-wrap gap-1">
                {ALL_STRUCTURES.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleStruct(s)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      structFilters.includes(s)
                        ? "bg-blue-100 border-blue-300 text-blue-700"
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Technique tags */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">技巧</p>
              <div className="flex flex-wrap gap-1">
                {ALL_TECHNIQUES.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleTech(t)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      techFilters.includes(t)
                        ? "bg-green-100 border-green-300 text-green-700"
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Problem tags */}
            <div>
              <p className="text-xs font-semibold text-orange-500 mb-1.5">问题</p>
              <div className="flex flex-wrap gap-1">
                {ALL_PROBLEMS.map((p) => (
                  <button
                    key={p}
                    onClick={() => toggleProb(p)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      probFilters.includes(p)
                        ? "bg-orange-100 border-orange-300 text-orange-700"
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {visible.length === 0 && (
        <div className="text-center text-gray-400 text-sm py-12">
          {hasActiveFilters ? "没有匹配结果" : "暂无分析段落，请先上传并分析文稿"}
        </div>
      )}

      {/* Card/List view */}
      {listView === "cards" ? (
        <div className="space-y-3">
          {visible.map((seg) => (
            <SegmentCard
              key={seg.id}
              segment={seg}
              isSelected={selectedSegmentId === seg.id}
              onSelect={() => onSelectSegment(seg.id)}
              onToggleStar={(starred) => onToggleStar(seg.id, starred)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {visible.map((seg) => (
            <div
              key={seg.id}
              onClick={() => onSelectSegment(seg.id)}
              className={[
                "px-4 py-2 rounded cursor-pointer text-sm",
                selectedSegmentId === seg.id
                  ? "bg-blue-50 border border-blue-200"
                  : "hover:bg-white border border-transparent",
              ].join(" ")}
            >
              <span className="font-mono text-gray-400 mr-2">#{seg.index + 1}</span>
              {seg.raw_text.slice(0, 120)}
              {seg.raw_text.length > 120 ? "…" : ""}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
