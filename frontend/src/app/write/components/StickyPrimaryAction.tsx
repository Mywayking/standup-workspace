"use client";

import React from "react";

interface Props {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  className?: string;
}

export default function StickyPrimaryAction({
  label,
  onClick,
  disabled = false,
  variant = "primary",
  loading = false,
  className = "",
}: Props) {
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

  return (
    <div className={`mobile-primary-action ${className}`}>
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={`${base} ${variants[variant]}`}
      >
        {loading ? (
          <span className="animate-spin">⟳</span>
        ) : null}
        {label}
      </button>
    </div>
  );
}
