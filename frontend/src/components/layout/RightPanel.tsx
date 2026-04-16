"use client";

import type { SegmentDetail, ScriptReport } from "@/types";
import { TagBadge } from "@/components/analysis/TagBadge";

interface RightPanelProps {
  segment: SegmentDetail | null;
  report: ScriptReport | null;
  actorName: string;
  showName: string;
  title: string;
}

function InsightRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="mb-3">
      <div className="text-xs font-semibold text-gray-400 uppercase mb-1">{label}</div>
      <p className="text-sm text-gray-700 leading-relaxed">{value}</p>
    </div>
  );
}

export function RightPanel({ segment, report, actorName, showName, title }: RightPanelProps) {
  const a = segment?.analysis;

  return (
    <aside className="w-72 border-l border-gray-200 bg-white overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800">{title || "文稿分析"}</h2>
        {actorName && <p className="text-xs text-gray-400 mt-0.5">演员：{actorName}</p>}
        {showName && <p className="text-xs text-gray-400">节目：{showName}</p>}
      </div>

      <div className="p-4 space-y-4">
        {/* Segment detail */}
        {segment ? (
          <>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase mb-1">原文</div>
              <blockquote className="text-sm text-gray-700 italic leading-relaxed border-l-2 border-gray-200 pl-3">
                {segment.raw_text}
              </blockquote>
            </div>

            {a ? (
              <>
                {/* Error banner */}
                {a.analysis_text?.startsWith("[Analysis error:") && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">⚠️</span>
                      <span className="text-xs font-semibold text-red-600">分析失败</span>
                    </div>
                    <p className="text-xs text-red-500">{a.analysis_text.replace("[Analysis error:", "").replace("]", "")}</p>
                    <p className="text-xs text-red-400 mt-1">该段将标记为「结构：unknown」，可重试分析。</p>
                  </div>
                )}

                {/* Structure */}
                {a.structure && (
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase mb-1">结构</div>
                    <div className="flex items-center gap-2">
                      <TagBadge tag={a.structure} category="structure" />
                      {a.starred && <span>⭐</span>}
                    </div>
                    {a.structure_note && (
                      <p className="text-xs text-gray-500 mt-1">{a.structure_note}</p>
                    )}
                  </div>
                )}

                {/* Attitude */}
                {a.attitude_type && (
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase mb-1">态度</div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      <TagBadge tag={a.attitude_type} category="attitude" />
                      {a.attitude_object && (
                        <span className="text-xs text-gray-500">对象：{a.attitude_object}</span>
                      )}
                    </div>
                    {a.attitude_insight && (
                      <p className="text-xs text-gray-500">{a.attitude_insight}</p>
                    )}
                  </div>
                )}

                {/* Techniques */}
                {a.techniques && (
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase mb-1">技巧</div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {a.techniques.split(",").filter(Boolean).map((t) => (
                        <TagBadge key={t} tag={t.trim()} category="technique" />
                      ))}
                    </div>
                    {a.technique_notes && (
                      <p className="text-xs text-gray-500">{a.technique_notes}</p>
                    )}
                  </div>
                )}

                {/* Problems */}
                {a.problems && (
                  <div>
                    <div className="text-xs font-semibold text-orange-500 uppercase mb-1">问题</div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {a.problems.split(",").filter(Boolean).map((p) => (
                        <TagBadge key={p} tag={p.trim()} category="problem" />
                      ))}
                    </div>
                    {a.problem_notes && (
                      <p className="text-xs text-gray-500">{a.problem_notes}</p>
                    )}
                  </div>
                )}

                {/* Notes */}
                {a.notes && (
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase mb-1">备注</div>
                    <div className="flex flex-wrap gap-1 mb-1">
                      <TagBadge tag={a.notes} category="note" />
                    </div>
                  </div>
                )}

                {/* Inspiration */}
                {a.inspiration && (
                  <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-3">
                    <div className="text-xs font-semibold text-yellow-600 uppercase mb-1">💡 启发</div>
                    <p className="text-sm text-gray-700">{a.inspiration}</p>
                  </div>
                )}

                {/* Full analysis text */}
                {a.analysis_text && (
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase mb-1">分析</div>
                    <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {a.analysis_text}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-400">暂无分析结果</p>
            )}
          </>
        ) : report ? (
          /* No segment selected — show report summary */
          <>
            {report.summary && <InsightRow label="整篇总结" value={report.summary} />}
            {report.strengths && <InsightRow label="强项" value={report.strengths} />}
            {report.weaknesses && <InsightRow label="弱项" value={report.weaknesses} />}
            {report.methodology && <InsightRow label="方法论" value={report.methodology} />}
            {report.key_insights && <InsightRow label="关键洞察" value={report.key_insights} />}
            {report.overall_score > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">整体评分</span>
                <span className="text-sm font-bold text-blue-600">
                  {report.overall_score.toFixed(2)}
                </span>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-400">选择左侧段落查看分析</p>
        )}
      </div>
    </aside>
  );
}
