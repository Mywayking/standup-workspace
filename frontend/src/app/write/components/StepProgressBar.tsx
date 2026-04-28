"use client";

import React from "react";
import type { WorkflowStep } from "../types";

const STEPS: WorkflowStep[] = ["input", "detect", "premise", "angles", "draft", "rewrite", "save"];

export function StepProgressBar({ step }: { step: WorkflowStep }) {
  const currentIndex = STEPS.indexOf(step);
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={s} className="flex items-center gap-1">
            <div
              className={`w-2 h-2 rounded-full ${
                done ? "bg-green-500" : active ? "bg-blue-500" : "bg-gray-200"
              }`}
            />
            {i < STEPS.length - 1 && (
              <div className={`w-4 h-px ${done ? "bg-green-500" : "bg-gray-100"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
