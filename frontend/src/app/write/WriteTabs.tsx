"use client";
import { useState } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import WriteClient from "./WriteClient";
import PremiseTab from "./PremiseTab";
import AnglesTab from "./AnglesTab";

type Tab = "premise" | "angles" | "rewrite";

export default function WriteTabs() {
  const [activeTab, setActiveTab] = useState<Tab>("premise");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tab Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1">
            {[
              { key: "premise", label: "提炼前提", desc: "素材 → 前提" },
              { key: "angles", label: "找角度", desc: "前提 → 角度" },
              { key: "rewrite", label: "改稿", desc: "分析整段" },
            ].map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as Tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex flex-col items-start gap-0.5 ${
                  activeTab === key
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <span>{label}</span>
                <span className="text-xs text-gray-400 font-normal">{desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <ErrorBoundary>
          {activeTab === "premise" && <PremiseTab />}
          {activeTab === "angles" && <AnglesTab />}
          {activeTab === "rewrite" && <WriteClient />}
        </ErrorBoundary>
      </div>
    </div>
  );
}
