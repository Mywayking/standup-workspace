"use client";

import React from "react";
import type { WorkflowStep, WorkflowCard as WorkflowCardType } from "../types";
import { WORKFLOW_STEP_LABELS, WORKFLOW_STEP_ICONS } from "../types";

interface Props {
  card: WorkflowCardType;
  onSelect?: (card: WorkflowCardType) => void;
  selected?: boolean;
}

export default function WorkflowCard({ card, onSelect, selected = false }: Props) {
  return (
    <div
      onClick={() => onSelect?.(card)}
      className={`
        workflow-card bg-white rounded-2xl border p-4 transition-all
        ${selected ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-100 hover:border-gray-200"}
        ${onSelect ? "cursor-pointer" : ""}
      `}
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{WORKFLOW_STEP_ICONS[card.type]}</span>
          <span className="text-xs font-medium text-gray-500">{WORKFLOW_STEP_LABELS[card.type]}</span>
        </div>
        {card.model && (
          <span className="text-xs text-gray-400">{card.model}</span>
        )}
      </div>

      {/* Card title */}
      {card.title && (
        <p className="text-sm font-semibold text-gray-800 mb-2 leading-snug">{card.title}</p>
      )}

      {/* Card content */}
      <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
        {card.content.length > 300
          ? card.content.slice(0, 300) + "…"
          : card.content}
      </div>

      {/* Card footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
        {card.latencyMs != null && (
          <span className="text-xs text-gray-400">{card.latencyMs}ms</span>
        )}
        {card.provider && (
          <span className="text-xs text-gray-400">{card.provider}</span>
        )}
        <span className="text-xs text-gray-300">
          {new Date(card.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

export function WorkflowCardSkeleton({ step }: { step: WorkflowStep }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-sm">{WORKFLOW_STEP_ICONS[step]}</span>
        <span className="text-xs font-medium text-gray-400">{WORKFLOW_STEP_LABELS[step]}</span>
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-100 rounded w-5/6" />
        <div className="h-4 bg-gray-100 rounded w-2/3" />
      </div>
    </div>
  );
}
