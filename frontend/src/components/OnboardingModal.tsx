"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";

const ONBOARDING_KEY = "onboarding_completed";

interface OnboardingModalProps {
  onComplete?: () => void;
}

const CREATOR_TYPES = [
  { value: "演员", label: "🎤 脱口秀演员", desc: "有舞台经验的演员" },
  { value: "编剧", label: "✍️ 编剧", desc: "为演员写本子" },
  { value: "新人", label: "🌱 开放麦新人", desc: "刚开始尝试脱口秀" },
  { value: "内容创作者", label: "📱 内容创作者", desc: "做视频/图文内容" },
  { value: "只是来玩", label: "😄 只是来玩", desc: "随便试试" },
];

const TOPICS = [
  "职场", "家庭", "恋爱", "AI科技", "校园", "社会观察", "自嘲",
];

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [creatorType, setCreatorType] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && user) {
      const completed = localStorage.getItem(ONBOARDING_KEY);
      if (!completed) {
        setDisplayName(user.profile?.displayName || user.nickname || "");
        setOpen(true);
      }
    }
  }, [user]);

  const toggleTopic = (t: string) => {
    setTopics((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      if (displayName.trim()) {
        await authApi.updateProfile({ displayName: displayName.trim() });
      }
      if (creatorType || topics.length > 0) {
        await authApi.updateCreatorProfile({
          creator_type: creatorType,
          topics,
        });
      }
      localStorage.setItem(ONBOARDING_KEY, "true");
      setOpen(false);
      onComplete?.();
    } catch (err) {
      console.error("Onboarding save error:", err);
      localStorage.setItem(ONBOARDING_KEY, "true");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setOpen(false);
    onComplete?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">欢迎来到喜剧分析工作台</h2>
          <button onClick={handleSkip} className="text-gray-400 hover:text-gray-600 text-sm">
            跳过
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 px-6 pt-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-indigo-600" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        <div className="px-6 py-5">
          {/* Step 1: 昵称 */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-1">给自己起个昵称</h3>
                <p className="text-sm text-gray-500">这会显示在你的个人资料里</p>
              </div>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={20}
                placeholder="输入昵称"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  disabled={!displayName.trim()}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  下一步
                </button>
                <button
                  onClick={handleSkip}
                  className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  跳过
                </button>
              </div>
            </div>
          )}

          {/* Step 2: 创作者身份 */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-1">你是哪种创作者？</h3>
                <p className="text-sm text-gray-500">选择一个最符合的标签</p>
              </div>
              <div className="space-y-2">
                {CREATOR_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    onClick={() => setCreatorType(ct.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                      creatorType === ct.value
                        ? "border-indigo-600 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      creatorType === ct.value ? "border-indigo-600" : "border-gray-300"
                    }`}>
                      {creatorType === ct.value && (
                        <div className="w-2 h-2 rounded-full bg-indigo-600" />
                      )}
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${creatorType === ct.value ? "text-indigo-700" : "text-gray-700"}`}>
                        {ct.label}
                      </div>
                      <div className="text-xs text-gray-400">{ct.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  下一步
                </button>
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  返回
                </button>
              </div>
            </div>
          )}

          {/* Step 3: 题材 */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-1">你常写哪些题材？</h3>
                <p className="text-sm text-gray-500">多选，这能帮 AI 更好地理解你</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {TOPICS.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleTopic(t)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      topics.includes(t)
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {saving ? "保存中..." : "完成"}
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  返回
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
