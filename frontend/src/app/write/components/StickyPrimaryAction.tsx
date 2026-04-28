"use client";

import React from "react";
import type { ActionState } from "../types";

interface Props {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  status?: ActionState;
  statusMessage?: string;
  className?: string;
}

export default function StickyPrimaryAction({
  label,
  onClick,
  disabled = false,
  variant = "primary",
  status = "idle",
  statusMessage,
  className = "",
}: Props) {
  const isDisabled = disabled || status === "pending";

  const base =
    "w-full py-4 px-6 rounded-2xl text-base font-bold transition-all flex items-center justify-center gap-2";

  const variants = {
    primary:
      "bg-blue-600 text-white shadow-lg shadow-blue-200 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none",
    secondary:
      "bg-white text-gray-700 border border-gray-200 shadow-sm active:scale-[0.98] disabled:bg-gray-50 disabled:text-gray-300",
    ghost:
      "text-gray-500 hover:text-gray-700 disabled:text-gray-300",
  };

  // Status-based border overrides
  const statusBorder = {
    error: "border-red-400",
    success: "border-green-400",
    pending: "",
    idle: "",
  };

  return (
    <div className={`mobile-primary-action ${className}`}>
      <button
        onClick={onClick}
        disabled={isDisabled}
        className={`
          ${base} ${variants[variant]}
          ${status === "error" ? "border-2 " + statusBorder.error : ""}
          ${status === "success" ? "border-2 " + statusBorder.success : ""}
        `}
      >
        {status === "pending" && (
          <span className="animate-spin">⟳</span>
        )}
        {status === "error" && (
          <span className="text-red-500">✕</span>
        )}
        {status === "success" && (
          <span className="text-green-500">✓</span>
        )}
        <span className={status === "error" ? "text-red-500" : status === "success" ? "text-green-500" : ""}>
          {label}
        </span>
      </button>
      {status === "error" && statusMessage && (
        <p className="text-xs text-red-500 text-center mt-1">{statusMessage}</p>
      )}
    </div>
  );
}
