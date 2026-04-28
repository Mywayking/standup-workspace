"use client";

import React from "react";
import type { WorkflowStep, SaveStatus } from "../types";
import { WORKFLOW_STEP_LABELS, WORKFLOW_STEP_ICONS } from "../types";
import SaveStatusBadge from "./SaveStatusBadge";

interface Props {
  currentStep: WorkflowStep;
  saveStatus: SaveStatus;
  onModeSwitch?: (mode: "guided" | "quick") => void;
  currentMode?: "guided" | "quick";
}

export default function StepHeader({ currentStep, saveStatus, onModeSwitch, currentMode = "guided" }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base shrink-0">🎤</span>
        <span className="text-sm font-bold text-gray-800 truncate">喜剧写稿台</span>
        <span className="text-gray-300 shrink-0">·</span>
        <span className="text-xs text-gray-400 shrink-0">
          {WORKFLOW_STEP_ICONS[currentStep]} {WORKFLOW_STEP_LABELS[currentStep]}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <SaveStatusBadge status={saveStatus} />
        {onModeSwitch && (
          <button
            onClick={() => onModeSwitch(currentMode === "guided" ? "quick" : "guided")}
            className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            {currentMode === "guided" ? "专业工具" : "引导模式"}
          </button>
        )}
      </div>
    </div>
  );
}
