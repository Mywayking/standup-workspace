"use client";

import { useRouter } from "next/navigation";

interface ToolbarProps {
  scriptId?: number;
  segmentCount?: number; // 0 = 新上传未分析，显示"开始分析"；>0 = 已分析，显示"重新分析"
  onAnalyze?: () => void;
  onDelete?: () => void;
  onEditMeta?: () => void;
  jobProgress?: number;
  jobMessage?: string;
  jobStatus?: string;
  currentStep?: number; // 1-7
  stepName?: string;
  onPrevScript?: () => void;
  onNextScript?: () => void;
}

export function Toolbar({
  scriptId,
  segmentCount = 0,
  onAnalyze,
  onDelete,
  onEditMeta,
  jobProgress,
  jobMessage,
  jobStatus,
  currentStep,
  stepName,
  onPrevScript,
  onNextScript,
}: ToolbarProps) {
  const router = useRouter();
  const isRunning = jobStatus === "running" || jobStatus === "pending";
  const hasSegments = segmentCount > 0;

  return (
    <header className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white">
      {/* Back */}
      <button
        onClick={() => router.push("/")}
        className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
        title="返回首页"
      >
        ←
      </button>

      <span className="text-sm font-semibold text-gray-700">🎤 喜剧分析工作台</span>

      {/* Prev/Next navigation */}
      {onPrevScript && (
        <button onClick={onPrevScript} className="text-xs text-gray-400 hover:text-gray-700 ml-2">
          ← 上一个
        </button>
      )}
      {onNextScript && (
        <button onClick={onNextScript} className="text-xs text-gray-400 hover:text-gray-700">
          下一个 →
        </button>
      )}

      <div className="flex-1" />

      {/* Step progress */}
      {isRunning && (
        <div className="flex items-center gap-1">
          {([
            { n: 1, label: "预处理" },
            { n: 2, label: "切段" },
            { n: 3, label: "结构" },
            { n: 4, label: "标签" },
            { n: 5, label: "问题" },
            { n: 6, label: "笔记" },
            { n: 7, label: "报告" },
          ] as const).map(({ n, label }) => {
            const done = (currentStep ?? 1) > n;
            const active = (currentStep ?? 1) === n;
            return (
              <div key={n} className="flex items-center gap-px">
                <div
                  title={label}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors ${
                    done
                      ? "bg-green-500 text-white"
                      : active
                      ? "bg-blue-500 text-white animate-pulse"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {done ? "✓" : n}
                </div>
                {n < 7 && (
                  <div className={`w-3 h-px ${done ? "bg-green-400" : "bg-gray-200"}`} />
                )}
              </div>
            );
          })}
          <span className="text-xs text-gray-400 ml-1.5 whitespace-nowrap">
            {stepName ?? jobMessage}
          </span>
        </div>
      )}

      {/* Edit metadata */}
      {scriptId && onEditMeta && (
        <button
          onClick={onEditMeta}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600"
        >
          编辑信息
        </button>
      )}

      {/* Analyze — 新上传(无段落)或重新分析都显示 */}
      {scriptId && onAnalyze && !isRunning && (
        <button
          onClick={onAnalyze}
          className={`px-3 py-1.5 text-sm rounded-md hover:bg-blue-700 transition-colors ${
            hasSegments
              ? "bg-orange-500 text-white hover:bg-orange-600"
              : "bg-blue-600 text-white"
          }`}
        >
          {hasSegments ? "重新分析" : "开始分析"}
        </button>
      )}
      {isRunning && (
        <span className="px-3 py-1.5 text-sm text-blue-600">分析中...</span>
      )}

      {/* Delete */}
      {scriptId && onDelete && (
        <button
          onClick={onDelete}
          className="px-3 py-1.5 text-sm text-red-500 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
        >
          删除
        </button>
      )}

      {/* Export */}
      {scriptId && (
        <div className="relative group">
          <button className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
            导出 ▾
          </button>
          <div className="hidden group-hover:block absolute right-0 top-full mt-1 bg-white border rounded-md shadow-lg z-10 min-w-[120px]">
            {(["json", "md", "docx"] as const).map((fmt) => (
              <a
                key={fmt}
                href={`/api/scripts/${scriptId}/export?format=${fmt}`}
                download
                className="block px-4 py-2 text-sm hover:bg-gray-50"
                onClick={(e) => e.stopPropagation()}
              >
                .{fmt}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
