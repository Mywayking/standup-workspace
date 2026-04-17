"use client";
import { useState, useRef, useCallback, useEffect } from "react";

interface StreamingState {
  phase: "idle" | "thinking" | "done" | "error";
  displayText: string;
  result: AnglesResult | null;
  error: string | null;
}

interface Angle {
  name: string;
  premise: string;
  expansion_idea: string;
  scene_direction: string;
  ending_direction: string;
}

interface AnglesResult {
  current_problem: { issues: string[]; summary: string };
  angles: Angle[];
  recommendation: { name: string; reason: string };
}

function esc(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export default function AnglesTab({ onAction, initialData, onClearPending }: { onAction?: (action: string, data?: string) => void; initialData?: string; onClearPending?: () => void }) {
  const [inputText, setInputText] = useState(initialData ?? "");
  const [stream, setStream] = useState<StreamingState>({
    phase: "idle",
    displayText: "",
    result: null,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);
  const streamRef = useRef(stream);
  streamRef.current = stream;

  // Load history
  const [history, setHistory] = useState<{ id: string; premise: string; result: AnglesResult }[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("angles_history");
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  const handleRestore = useCallback((item: { id: string; premise: string; result: AnglesResult }) => {
    setInputText(item.premise);
    setStream({ phase: "done", displayText: "", result: item.result, error: null });
    setShowHistory(false);
    onClearPending?.();
  }, []);

  const canAnalyze = inputText.trim().length >= 3;

  const handleAnalyze = useCallback(async () => {
    if (!canAnalyze || stream.phase === "thinking") return;

    const sid = Math.random().toString(36).slice(2, 10);
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    setStream({ phase: "thinking", displayText: "", result: null, error: null });

    try {
      const resp = await fetch(`/api/find-angles/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ premise: inputText.trim() }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        const body = await resp.text();
        setStream((s) => ({ ...s, phase: "error", error: `HTTP ${resp.status}: ${body}` }));
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        while (buffer.includes("\n")) {
          const nl = buffer.indexOf("\n");
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith("event: ") || line.length < 8) continue;

          const evt = line.slice(7, line.indexOf("\n", 7) === -1 ? line.length : line.indexOf("\n", 7));
          const dataStr = line.slice(line.indexOf("data: ") + 6);

          if (evt === "token") {
            setStream((s) => ({ ...s, displayText: s.displayText + dataStr }));
          } else if (evt === "done") {
            try {
              const data = JSON.parse(dataStr);
              setStream({ phase: "done", displayText: "", result: data, error: null });

              const newItem = { id: sid, premise: inputText.trim(), result: data };
              setHistory((prev) => {
                const filtered = prev.filter((h) => h.id !== sid);
                const next = [newItem, ...filtered].slice(0, 20);
                try { localStorage.setItem("angles_history", JSON.stringify(next)); } catch {}
                return next;
              });
            } catch {
              setStream((s) => ({ ...s, phase: "error", error: "解析返回数据失败" }));
            }
          } else if (evt === "error") {
            try {
              const data = JSON.parse(dataStr);
              setStream((s) => ({ ...s, phase: "error", error: data.error || "未知错误" }));
            } catch {
              setStream((s) => ({ ...s, phase: "error", error: "未知错误" }));
            }
          }
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        setStream((s) => ({ ...s, phase: "error", error: "请求超时（120秒）" }));
      } else {
        setStream((s) => ({ ...s, phase: "error", error: String(err) }));
      }
    } finally {
      abortRef.current = null;
    }
  }, [inputText, canAnalyze, stream.phase]);

  const isStreaming = stream.phase === "thinking";
  const hasResult = stream.phase === "done" && stream.result;

  const raw = stream.displayText ?? "";
  const cleaned = raw.replace(/[{}\[\]"":\\]/g, "").replace(/\n/g, " ").replace(/,{2,}/g, " ").replace(/\s{2,}/g, " ").trim();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Input */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800">找角度</h2>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {showHistory ? "收起历史" : "查看历史"}
            </button>
          </div>

          {showHistory && history.length > 0 && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100 max-h-60 overflow-y-auto">
              <p className="text-xs text-gray-400 mb-2 font-medium">最近角度</p>
              <div className="space-y-1">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleRestore(item)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded transition-colors truncate"
                  >
                    {item.premise}
                  </button>
                ))}
              </div>
            </div>
          )}

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={"输入一个已有的喜剧前提……\n\n例如：成年人的'都行'，其实是不想承担责任。\n或者：相亲像面试。"}
            className="w-full h-40 p-4 text-base border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isStreaming}
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-400">{inputText.length} 字符</span>
            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze || isStreaming}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isStreaming ? "分析中..." : "开始找角度"}
            </button>
          </div>
        </div>

        {/* Streaming */}
        {stream.phase === "thinking" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-gray-700">AI 分析中</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 min-h-[80px]">
              {cleaned ? (
                <div className="text-sm text-gray-500 leading-relaxed animate-pulse">{cleaned}</div>
              ) : (
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-full" />
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-4/5" />
                </div>
              )}
            </div>
          </div>
        )}

        {stream.phase === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-600 text-sm">❌ {stream.error}</p>
            <button onClick={() => setStream((s) => ({ ...s, phase: "idle" }))} className="mt-2 text-sm text-red-500 hover:text-red-700">
              重试
            </button>
          </div>
        )}

        {hasResult && stream.result && <AnglesResultView result={stream.result} onAction={onAction} />}
      </div>

      {/* Right: Intro */}
      <div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-base font-bold text-gray-800 mb-2">这个工具做什么？</p>
          <p className="text-sm text-gray-500 leading-relaxed mb-4">
            针对一个<strong>已有前提</strong>，快速生成<strong>更新鲜、更有喜剧价值</strong>的切入角度。
          </p>
          <div className="space-y-2">
            {[
              "判断当前前提的问题",
              "生成 6 个不同维度角度",
              "反常识 / 人性 / 权力关系",
              "自嘲 / 类比 / 更狠",
              "推荐最优角度并说明理由",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                <p className="text-sm text-gray-600">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AnglesResultView({ result, onAction }: { result: AnglesResult; onAction?: (action: string, data?: string) => void }) {
  return (
    <div className="space-y-4">
      {/* Current problem */}
      {result.current_problem && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-2">当前前提的问题</p>
          <p className="text-sm text-gray-600 leading-relaxed mb-2">{esc(result.current_problem.summary)}</p>
          {(result.current_problem.issues ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.current_problem.issues.map((issue, i) => (
                <span key={i} className="text-xs px-2.5 py-1 bg-red-50 text-red-700 rounded-full font-medium">{esc(issue)}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Angles */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">新角度（6条）</p>
        <div className="space-y-3">
          {(result.angles ?? []).map((angle, i) => (
            <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-blue-600">{i + 1}</span>
                <span className="text-sm font-semibold text-gray-800">{esc(angle.name)}</span>
              </div>
              <p className="text-base font-medium text-gray-900 mb-2">{esc(angle.premise)}</p>
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                <div>
                  <span className="font-medium text-gray-400">展开：</span>
                  <span>{esc(angle.expansion_idea)}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-400">场景：</span>
                  <span>{esc(angle.scene_direction)}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-400">结尾：</span>
                  <span>{esc(angle.ending_direction)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendation */}
      {result.recommendation && result.recommendation.name && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold text-purple-700">⭐ 推荐角度</span>
            <span className="text-xs px-2 py-0.5 bg-purple-200 text-purple-800 rounded font-medium">{esc(result.recommendation.name)}</span>
          </div>
          <p className="text-sm text-gray-600">{esc(result.recommendation.reason)}</p>
        </div>
      )}

      {/* Action buttons */}
      {result.recommendation && result.recommendation.name ? (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onAction?.("go-rewrite", result.recommendation.name)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            ✏️ 用这个角度改稿
          </button>
        </div>
      ) : null}
    </div>
  );
}
