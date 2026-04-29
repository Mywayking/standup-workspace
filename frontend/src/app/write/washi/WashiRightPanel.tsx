// ============================================================
// WashiRightPanel.tsx — 右侧工具面板
// Standup Workspace v3.0
// ============================================================

"use client";

import React from "react";
import type { WorkSession, WorkCardType } from "./types";

// WorkflowStep covers all workflow step keys (includes save, input etc.)
type WorkflowStep = WorkCardType | "input" | "detect" | "premise_check" | "performance_review" | "save";

interface Props {
  session: WorkSession | null;
  currentStep: WorkflowStep;
  model?: string;
  latencyMs?: number | null;
}

// 步骤链
const STEP_CHAIN: Array<{ key: WorkflowStep; label: string; desc: string }> = [
  { key: "material", label: "素材", desc: "原始输入" },
  { key: "premise", label: "前提", desc: "核心洞察" },
  { key: "angles", label: "角度", desc: "切入点" },
  { key: "draft", label: "初稿", desc: "结构草稿" },
  { key: "rewrite", label: "改稿", desc: "精细打磨" },
  { key: "save", label: "保存", desc: "完成" },
];

function getStepIndex(step: WorkflowStep): number {
  const idx = STEP_CHAIN.findIndex((s) => s.key === step);
  return idx >= 0 ? idx : 0;
}

// 竖向步骤指示器
function VerticalStepper({ currentStep }: { currentStep: WorkflowStep }) {
  const currentIdx = getStepIndex(currentStep);

  return (
    <div className="px-4 py-3 flex flex-col gap-0">
      {STEP_CHAIN.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isActive = idx === currentIdx;
        const isFuture = idx > currentIdx;

        return (
          <div key={step.key} className="flex items-start gap-3">
            {/* 连接线 + 圆点 */}
            <div className="flex flex-col items-center">
              {/* 上方连接线 */}
              {idx > 0 && (
                <div
                  className={`w-px h-3 transition-colors ${
                    idx <= currentIdx ? "bg-[#A94737]" : "bg-black/10"
                  }`}
                />
              )}
              {/* 圆点 */}
              <div
                className={`
                  w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0
                  transition-all duration-200
                  ${isDone ? "bg-[#A94737] text-white" :
                    isActive ? "bg-[#A94737] text-white shadow-sm shadow-[#A94737]/30" :
                    "bg-black/8 text-[#C5BAAA]"}
                `}
              >
                {isDone ? "✓" : idx + 1}
              </div>
              {/* 下方连接线 */}
              {idx < STEP_CHAIN.length - 1 && (
                <div
                  className={`w-px flex-1 min-h-[20px] transition-colors ${
                    idx < currentIdx ? "bg-[#A94737]" : "bg-black/10"
                  }`}
                />
              )}
            </div>

            {/* 步骤文字 */}
            <div className="flex-1 pb-5">
              <p
                className={`
                  text-[13px] font-semibold transition-colors
                  ${isActive ? "text-[#A94737]" :
                    isDone ? "text-[#8A8174]" :
                    "text-[#C5BAAA]"}
                `}
              >
                {step.label}
              </p>
              <p
                className={`
                  text-[11px] mt-0.5 transition-colors
                  ${isActive ? "text-[#A94737]/70" : "text-[#C5BAAA]"}
                `}
              >
                {step.desc}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function WashiRightPanel({ session, currentStep, model, latencyMs }: Props) {
  const currentIdx = getStepIndex(currentStep);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 border-b border-black/10">
        <h2
          className="text-[17px] font-semibold text-[#25231F]"
          style={{ fontFamily: "STSong, Songti SC, serif" }}
        >
          创作进度
        </h2>
        <p className="text-[12px] text-[#8A8174] mt-0.5">
          桌面常驻 · {currentIdx}/{STEP_CHAIN.length} 步
        </p>
      </div>

      {/* 当前步骤指示器 */}
      <div className="border-b border-black/10">
        <VerticalStepper currentStep={currentStep} />
      </div>

      {/* 模型 & 耗时 */}
      <div className="px-5 py-4 border-b border-black/10">
        <h3 className="text-[11px] text-[#8A8174] mb-3 tracking-widest uppercase">
          本次生成
        </h3>
        <div className="space-y-2.5">
          {/* 模型 */}
          <div className="flex items-start gap-2">
            <span className="text-[11px] text-[#C5BAAA] w-10 shrink-0 pt-0.5">模型</span>
            <div className="flex-1 min-w-0">
              {model ? (
                <p className="text-[13px] text-[#25231F] font-medium truncate">
                  {model}
                </p>
              ) : (
                <p className="text-[13px] text-[#C5BAAA] italic">—</p>
              )}
            </div>
          </div>
          {/* 耗时 */}
          <div className="flex items-start gap-2">
            <span className="text-[11px] text-[#C5BAAA] w-10 shrink-0 pt-0.5">耗时</span>
            <div className="flex-1 min-w-0">
              {latencyMs != null ? (
                <p className="text-[13px] text-[#25231F] font-medium">
                  {latencyMs < 1000
                    ? `${latencyMs}ms`
                    : `${(latencyMs / 1000).toFixed(1)}s`}
                </p>
              ) : (
                <p className="text-[13px] text-[#C5BAAA] italic">—</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 快捷工具 */}
      <div className="px-5 py-4 flex-1">
        <h3 className="text-[11px] text-[#8A8174] mb-3 tracking-widest uppercase">
          快捷工具
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="
              flex items-center justify-center gap-1.5
              px-3 py-2.5 rounded-xl
              border border-black/10 bg-[#FBF8F0]
              text-[12px] text-[#8A8174]
              hover:bg-white hover:border-black/20
              active:bg-black/5
              transition-colors cursor-not-allowed opacity-50
            "
            disabled
            title="即将推出"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            保存
          </button>
          <button
            type="button"
            className="
              flex items-center justify-center gap-1.5
              px-3 py-2.5 rounded-xl
              border border-black/10 bg-[#FBF8F0]
              text-[12px] text-[#8A8174]
              hover:bg-white hover:border-black/20
              active:bg-black/5
              transition-colors cursor-not-allowed opacity-50
            "
            disabled
            title="即将推出"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="2" y="2" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M4 4h4M4 6.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            复制
          </button>
          <button
            type="button"
            className="
              flex items-center justify-center gap-1.5
              px-3 py-2.5 rounded-xl
              border border-black/10 bg-[#FBF8F0]
              text-[12px] text-[#8A8174]
              hover:bg-white hover:border-black/20
              active:bg-black/5
              transition-colors cursor-not-allowed opacity-50
            "
            disabled
            title="即将推出"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6a4 4 0 1 0 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M6 2v2.5l1.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            重生成
          </button>
          <button
            type="button"
            className="
              flex items-center justify-center gap-1.5
              px-3 py-2.5 rounded-xl
              border border-black/10 bg-[#FBF8F0]
              text-[12px] text-[#8A8174]
              hover:bg-white hover:border-black/20
              active:bg-black/5
              transition-colors cursor-not-allowed opacity-50
            "
            disabled
            title="即将推出"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4h8M2 8h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            导出
          </button>
        </div>
      </div>

      {/* Footer seal */}
      <div className="px-5 py-4 border-t border-black/10 flex items-center justify-center">
        <div
          className="w-8 h-8 rounded-full border border-[#A94737]/20 flex items-center justify-center text-[#A94737] text-[10px]"
          style={{ fontFamily: "STSong, Songti SC, serif" }}
        >
          W
        </div>
      </div>
    </div>
  );
}
