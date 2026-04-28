/**
 * /write/settings/style — 用户风格设置页
 * Standup Workspace v3.0 Phase 9
 */

"use client";

import React, { useState } from "react";
import { useUserStyle } from "../../lib/useUserStyle";

const TONE_OPTIONS = [
  "丧、压抑", "燃、热血", "丧到极致反而轻松", "一本正经胡说八道", "自嘲型",
  "观察型", "故事型", "观点输出型", "情绪输出型",
];
const TECHNIQUE_OPTIONS = [
  "反转", "类比", "夸张", "观察", "自嘲", "降维打击", "谐音", "口误",
  "装傻", "call back", "三段式递进", "预期违背",
];

export default function StyleSettingsPage() {
  const { profile, updateProfile, clearProfile, saving } = useUserStyle();

  const [stageName, setStageName] = useState(profile.stageName ?? "");
  const [persona, setPersona] = useState(profile.persona ?? "");
  const [tone, setTone] = useState(profile.tone ?? "");
  const [commonTopics, setCommonTopics] = useState<string[]>(profile.commonTopics ?? []);
  const [forbiddenTopics, setForbiddenTopics] = useState<string[]>(profile.forbiddenTopics ?? []);
  const [preferredTechniques, setPreferredTechniques] = useState<string[]>(profile.preferredTechniques ?? []);
  const [newTopic, setNewTopic] = useState("");
  const [newForbidden, setNewForbidden] = useState("");

  const isDirty =
    stageName !== (profile.stageName ?? "") ||
    persona !== (profile.persona ?? "") ||
    tone !== (profile.tone ?? "") ||
    JSON.stringify(commonTopics) !== JSON.stringify(profile.commonTopics ?? []) ||
    JSON.stringify(forbiddenTopics) !== JSON.stringify(profile.forbiddenTopics ?? []) ||
    JSON.stringify(preferredTechniques) !== JSON.stringify(profile.preferredTechniques ?? []);

  const handleSave = () => {
    updateProfile({
      stageName: stageName || undefined,
      persona: persona || undefined,
      tone: tone || undefined,
      commonTopics,
      forbiddenTopics,
      preferredTechniques,
    });
  };

  const toggleTag = (
    value: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (list.includes(value)) {
      setList(list.filter((t) => t !== value));
    } else {
      setList([...list, value]);
    }
  };

  const addTopic = (
    val: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    setInput: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const trimmed = val.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
    }
    setInput("");
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => history.back()} className="text-gray-500 hover:text-gray-700">
          ← 返回
        </button>
        <h1 className="text-lg font-bold text-gray-800">风格设置</h1>
      </div>

      <div className="space-y-5">
        {/* 艺名 */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">艺名 / 舞台名</label>
          <input
            value={stageName}
            onChange={(e) => setStageName(e.target.value)}
            placeholder="你在台上的名字"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400"
          />
          <p className="text-xs text-gray-400 mt-1.5">AI会根据你的艺名调整段子风格</p>
        </section>

        {/* 人设描述 */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">人设描述</label>
          <textarea
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            placeholder="你是什么样的人？你的背景、性格、标签… AI会据此保持风格一致性"
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 resize-none min-h-20"
            style={{ fontFamily: "inherit" }}
          />
        </section>

        {/* 常用主题 */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">常用主题</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {commonTopics.map((t) => (
              <span
                key={t}
                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full flex items-center gap-1"
              >
                {t}
                <button onClick={() => setCommonTopics(commonTopics.filter((x) => x !== t))} className="ml-0.5">
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              placeholder="加一个主题…"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTopic(newTopic, commonTopics, setCommonTopics, setNewTopic);
                }
              }}
            />
            <button
              onClick={() => addTopic(newTopic, commonTopics, setCommonTopics, setNewTopic)}
              className="text-xs px-3 py-2 bg-blue-600 text-white rounded-xl"
            >
              添加
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">AI会倾向于生成包含这些主题的段子</p>
        </section>

        {/* 禁忌主题 */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4">
          <label className="block text-sm font-medium text-red-600 mb-2">禁忌主题</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {forbiddenTopics.map((t) => (
              <span
                key={t}
                className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-full flex items-center gap-1"
              >
                {t}
                <button onClick={() => setForbiddenTopics(forbiddenTopics.filter((x) => x !== t))} className="ml-0.5">
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newForbidden}
              onChange={(e) => setNewForbidden(e.target.value)}
              placeholder="AI不要生成这些主题…"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTopic(newForbidden, forbiddenTopics, setForbiddenTopics, setNewForbidden);
                }
              }}
            />
            <button
              onClick={() => addTopic(newForbidden, forbiddenTopics, setForbiddenTopics, setNewForbidden)}
              className="text-xs px-3 py-2 bg-red-600 text-white rounded-xl"
            >
              添加
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">AI会避免生成包含这些主题的内容</p>
        </section>

        {/* 风格语气 */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">风格语气</label>
          <div className="flex flex-wrap gap-1.5">
            {TONE_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => setTone(tone === t ? "" : t)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  tone === t
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        {/* 偏好技巧 */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">偏好喜剧技巧</label>
          <div className="flex flex-wrap gap-1.5">
            {TECHNIQUE_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => toggleTag(t, preferredTechniques, setPreferredTechniques)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  preferredTechniques.includes(t)
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={clearProfile}
            className="flex-1 py-3 text-sm text-gray-500 border border-gray-200 rounded-2xl hover:bg-gray-100 transition-colors"
          >
            重置
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className={`flex-1 py-3 text-sm font-medium rounded-2xl transition-colors ${
              isDirty && !saving
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {saving ? "保存中…" : "保存设置"}
          </button>
        </div>
      </div>
    </div>
  );
}
