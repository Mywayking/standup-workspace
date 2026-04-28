"use client";

import React, { useState } from "react";
import type { WorkflowSession, WorkflowCard } from "../types";
import { WORKFLOW_STEP_LABELS, WORKFLOW_STEP_ICONS, getNextStep } from "../types";

interface Props {
  session: WorkflowSession;
  cards: WorkflowCard[];
}

const STEP_ORDER: (keyof typeof WORKFLOW_STEP_LABELS)[] = [
  "input", "detect", "material", "premise",
  "joke_to_premise", "angles", "draft", "rewrite", "save",
];

const STEP_COLORS: Record<string, string> = {
  input:          "bg-gray-100 text-gray-500",
  detect:         "bg-purple-100 text-purple-700",
  material:       "bg-blue-100 text-blue-700",
  premise:        "bg-indigo-100 text-indigo-700",
  joke_to_premise:"bg-orange-100 text-orange-700",
  angles:         "bg-cyan-100 text-cyan-700",
  draft:          "bg-amber-100 text-amber-700",
  rewrite:        "bg-rose-100 text-rose-700",
  save:           "bg-green-100 text-green-700",
};

export default function DesktopRightPanel({ session, cards }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const nextStep = getNextStep(session.currentStep, session.inputType);

  const nextActionHint = (() => {
    switch (session.scriptStatus) {
      case "idea": return "找到好笑点";
      case "premise": return "换几个讲法";
      case "draft": return "改成上台版";
      case "performable": return "记录演出反馈";
      case "performed": return "演后复盘";
      case "mature": return "加入专场";
      default: return WORKFLOW_STEP_LABELS[nextStep] || "下一步";
    }
  })();

  const currentStepIdx = STEP_ORDER.indexOf(session.currentStep);

  return (
    <div className="desktop-right-panel flex flex-col bg-white">
      {/* Collapse toggle */}
      <div className="px-3 py-2 border-b border-gray-100 shrink-0 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-700">创作状态</span>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {collapsed ? "展开" : "收起"}
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {/* Session title */}
          <div>
            <p className="text-xs text-gray-400 mb-0.5">当前创作</p>
            <p className="text-sm font-semibold text-gray-800 leading-snug">
              {session.title || session.sourceInput.slice(0, 15) || "未命名"}
            </p>
          </div>

          {/* Step progress */}
          <div>
            <p className="text-xs text-gray-400 mb-1.5">创作进度</p>
            <div className="space-y-1">
              {STEP_ORDER.map((step, idx) => {
                const isPast = idx < currentStepIdx;
                const isCurrent = step === session.currentStep;
                const isFuture = idx > currentStepIdx;
                return (
                  <div key={step} className="flex items-center gap-1.5">
                    <div className={`
                      w-1.5 h-1.5 rounded-full shrink-0
                      ${isCurrent ? "bg-blue-500 ring-2 ring-blue-100" : ""}
                      ${isPast ? "bg-green-400" : ""}
                      ${isFuture ? "bg-gray-200" : ""}
                    `} />
                    <span className={`text-xs ${
                      isCurrent ? "font-semibold text-gray-800" :
                      isPast ? "text-gray-400 line-through" :
                      "text-gray-300"
                    }`}>
                      {WORKFLOW_STEP_ICONS[step]} {WORKFLOW_STEP_LABELS[step]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cards count */}
          <div>
            <p className="text-xs text-gray-400 mb-0.5">产出卡片</p>
            <p className="text-2xl font-bold text-gray-800">{cards.length}</p>
          </div>

          {/* Next action hint */}
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-blue-500 font-medium mb-0.5">建议下一步</p>
            <p className="text-sm text-blue-700 font-medium">
              → {nextActionHint}
            </p>
          </div>

          {/* Current step badge */}
          <div className={`rounded-xl p-2.5 ${STEP_COLORS[session.currentStep] ?? "bg-gray-100 text-gray-600"}`}>
            <p className="text-xs font-medium opacity-70 mb-0.5">当前步骤</p>
            <p className="text-sm font-bold">
              {WORKFLOW_STEP_ICONS[session.currentStep]} {WORKFLOW_STEP_LABELS[session.currentStep]}
            </p>
          </div>

          {/* Creation time */}
          <div>
            <p className="text-xs text-gray-400 mb-0.5">创建时间</p>
            <p className="text-xs text-gray-600">
              {new Date(session.createdAt).toLocaleString("zh-CN", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}