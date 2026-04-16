import type { TagCategory } from "@/types";

interface TagBadgeProps {
  tag: string;
  category: TagCategory;
  onClick?: () => void;
  active?: boolean;
}

const colorMap: Record<TagCategory, string> = {
  structure: "bg-blue-100 text-blue-700 border-blue-200",
  attitude: "bg-purple-100 text-purple-700 border-purple-200",
  technique: "bg-green-100 text-green-700 border-green-200",
  problem: "bg-orange-100 text-orange-700 border-orange-200",
  note: "bg-gray-100 text-gray-600 border-gray-200",
};

export function TagBadge({ tag, category, onClick, active }: TagBadgeProps) {
  return (
    <span
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
        colorMap[category],
        onClick ? "cursor-pointer hover:opacity-80" : "",
        active ? "ring-2 ring-offset-1 ring-current" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {tag}
    </span>
  );
}

export { colorMap };
export type { TagCategory };
