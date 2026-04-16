"use client";

import { TagBadge } from "./TagBadge";
import type { SegmentDetail, TagCategory } from "@/types";

interface SegmentCardProps {
  segment: SegmentDetail;
  isSelected: boolean;
  onSelect: () => void;
  onToggleStar: (starred: boolean) => void;
}

const CAT_LABELS: Record<string, TagCategory> = {
  // structure
  opening: "structure",
  p_setup: "structure",
  example: "structure",
  escalation: "structure",
  callback: "structure",
  closing: "structure",
  transition: "structure",
  // attitude
  strange: "attitude",
  stupid: "attitude",
  terrible: "attitude",
  sad: "attitude",
  ironic: "attitude",
  self_deprecating: "attitude",
  neutral: "attitude",
  // technique
  analogy: "technique",
  comparison: "technique",
  result假设: "technique",
  cause假设: "technique",
  pun: "technique",
  irony: "technique",
  double_entendre: "technique",
  // problem
  premise_missing: "problem",
  resonance_weak: "problem",
  only_anecdote: "problem",
  performance_dependent: "problem",
  // note
  replaceable: "note",
  optimizable: "note",
  imitable: "note",
};

function guessCategory(tag: string): TagCategory {
  return CAT_LABELS[tag.trim()] ?? "note";
}

export function SegmentCard({ segment, isSelected, onSelect, onToggleStar }: SegmentCardProps) {
  const a = segment.analysis;

  return (
    <div
      onClick={onSelect}
      className={[
        "group relative p-4 rounded-lg border cursor-pointer transition-all",
        isSelected
          ? "border-blue-400 bg-blue-50 shadow-sm"
          : "border-gray-200 bg-white hover:border-blue-200 hover:shadow-sm",
      ].join(" ")}
    >
      {/* Index + star */}
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-mono text-gray-400">#{segment.index + 1}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar(!segment.starred);
          }}
          className="text-xs"
        >
          {segment.starred ? "⭐" : "☆"}
        </button>
      </div>

      {/* Raw text */}
      <p className="text-sm text-gray-800 leading-relaxed line-clamp-4">
        {segment.raw_text}
      </p>

      {/* Tags */}
      {a && (
        <div className="flex flex-wrap gap-1 mt-3">
          {a.structure && (
            <TagBadge tag={a.structure} category="structure" />
          )}
          {a.attitude_type && (
            <TagBadge tag={a.attitude_type} category="attitude" />
          )}
          {a.techniques
            .split(",")
            .filter(Boolean)
            .map((t) => (
              <TagBadge key={t} tag={t.trim()} category={guessCategory(t)} />
            ))}
          {a.problems
            .split(",")
            .filter(Boolean)
            .map((p) => (
              <TagBadge key={p} tag={p.trim()} category="problem" />
            ))}
        </div>
      )}

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-400 rounded-l" />
      )}
    </div>
  );
}
