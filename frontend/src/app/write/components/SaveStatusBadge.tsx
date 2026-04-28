"use client";

import React from "react";
import type { SaveStatus } from "../types";

interface Props {
  status: SaveStatus;
  compact?: boolean;
}

const STATUS_CONFIG: Record<SaveStatus, { label: string; color: string; icon: string }> = {
  idle:       { label: "未保存",  color: "text-gray-400",   icon: "○" },
  saving:     { label: "保存中",  color: "text-yellow-500", icon: "◐" },
  saved_local:{ label: "已存本地", color: "text-green-600",  icon: "✓" },
  saved_cloud:{ label: "已存云",  color: "text-blue-600",   icon: "☁" },
  failed:     { label: "保存失败", color: "text-red-500",    icon: "✗" },
};

export default function SaveStatusBadge({ status, compact = false }: Props) {
  const cfg = STATUS_CONFIG[status];

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs ${cfg.color}`}>
        <span className={status === "saving" ? "animate-pulse" : ""}>{cfg.icon}</span>
        {!compact && <span>{cfg.label}</span>}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}
      style={{ background: "currentColor", opacity: 0.1 }}
    >
      <span className={status === "saving" ? "animate-pulse" : ""}>{cfg.icon}</span>
      <span style={{ opacity: 1, background: "none" }}>{cfg.label}</span>
    </span>
  );
}
