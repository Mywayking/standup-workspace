"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";
import Link from "next/link";
import ModelSettings from "@/components/settings/ModelSettings";

export default function ProfileSettingsPage() {
  const { user, loggedIn, loading: authLoading, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [activeTab, setActiveTab] = useState<"profile" | "model">("profile");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (user?.profile) {
      setDisplayName(user.profile.displayName || "");
      setUsername(user.profile.username || "");
      setAvatarUrl(user.profile.avatarUrl || "");
      setBio(user.profile.bio || "");
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || displayName.trim().length < 2 || displayName.trim().length > 20) {
      setMessage({ type: "error", text: "昵称需要 2-20 字" });
      return;
    }
    if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setMessage({ type: "error", text: "用户名只能包含字母、数字、下划线，3-20 字" });
      return;
    }
    if (bio.length > 200) {
      setMessage({ type: "error", text: "简介最多 200 字" });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await authApi.updateProfile({
        displayName: displayName.trim(),
        username: username.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
        bio: bio.trim() || undefined,
      });
      if (res.success) {
        setMessage({ type: "success", text: "保存成功" });
        await refreshUser();
        if (user) {
          user.nickname = displayName.trim();
          if (user.profile) {
            user.profile.displayName = displayName.trim();
            user.profile.username = username.trim();
            user.profile.avatarUrl = avatarUrl.trim();
            user.profile.bio = bio.trim();
          }
        }
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "保存失败" });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5EFE3] flex items-center justify-center">
        <div className="text-[#8A8174]">加载中...</div>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-[#F5EFE3] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#8A8174] mb-4">请先登录</p>
          <Link href="/" className="text-[#A94737] hover:text-[#8f3a2c]">返回首页</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5EFE3] py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-[#8A8174] hover:text-[#25231F] mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </Link>

        <div className="bg-[#FBF8F0] rounded-3xl shadow-sm border border-black/10 overflow-hidden">
          {/* Tabs */}
          <div className="px-6 pt-4">
            <div className="flex gap-1 border-b border-black/8">
              <button
                onClick={() => setActiveTab("profile")}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors rounded-t-xl ${
                  activeTab === "profile"
                    ? "border-[#A94737] text-[#A94737]"
                    : "border-transparent text-[#8A8174] hover:text-[#25231F]"
                }`}
              >
                个人资料
              </button>
              <button
                onClick={() => setActiveTab("model")}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors rounded-t-xl ${
                  activeTab === "model"
                    ? "border-[#A94737] text-[#A94737]"
                    : "border-transparent text-[#8A8174] hover:text-[#25231F]"
                }`}
              >
                AI 模型
              </button>
            </div>
          </div>

          {/* Header */}
          <div className="px-6 py-5 border-b border-black/8">
            <h1 className="text-xl font-semibold text-[#25231F]">
              {activeTab === "profile" ? "个人资料" : "AI 模型设置"}
            </h1>
            <p className="text-sm text-[#8A8174] mt-1">
              {activeTab === "profile" ? "管理你的个人资料" : "管理你的模型供应商和 API Key"}
            </p>
          </div>

          {activeTab === "profile" && (
            <form onSubmit={handleSave} className="px-6 py-5 space-y-5">
              {/* Avatar preview */}
              <div className="flex justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} className="w-20 h-20 rounded-full object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-[#A94737]/15 flex items-center justify-center text-[#A94737] text-2xl font-semibold">
                    {displayName?.[0] || user?.nickname?.[0] || "U"}
                  </div>
                )}
              </div>

              {/* 昵称 */}
              <div>
                <label className="block text-sm font-medium text-[#25231F] mb-1">
                  昵称 <span className="text-[#A94737]">*</span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={20}
                  placeholder="2-20 字"
                  className="w-full px-3 py-2.5 border border-black/15 bg-white/50 rounded-xl text-sm text-[#25231F] placeholder:text-[#C5BAAA] focus:outline-none focus:ring-2 focus:ring-[#A94737]/30 focus:border-[#A94737] transition-colors"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-[#8A8174]">必填，2-20 字</span>
                  <span className="text-xs text-[#8A8174]">{displayName.length}/20</span>
                </div>
              </div>

              {/* 用户名 */}
              <div>
                <label className="block text-sm font-medium text-[#25231F] mb-1">
                  用户名
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8174] text-sm">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                    maxLength={20}
                    placeholder="选填，唯一标识"
                    className="w-full pl-7 pr-3 py-2.5 border border-black/15 bg-white/50 rounded-xl text-sm text-[#25231F] placeholder:text-[#C5BAAA] focus:outline-none focus:ring-2 focus:ring-[#A94737]/30 focus:border-[#A94737] transition-colors"
                  />
                </div>
                <span className="text-xs text-[#8A8174] mt-1 block">选填，3-20 字，只能用字母、数字、下划线</span>
              </div>

              {/* 头像 URL */}
              <div>
                <label className="block text-sm font-medium text-[#25231F] mb-1">
                  头像 URL
                </label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 border border-black/15 bg-white/50 rounded-xl text-sm text-[#25231F] placeholder:text-[#C5BAAA] focus:outline-none focus:ring-2 focus:ring-[#A94737]/30 focus:border-[#A94737] transition-colors"
                />
                <span className="text-xs text-[#8A8174] mt-1 block">选填，直接填图片链接</span>
              </div>

              {/* 简介 */}
              <div>
                <label className="block text-sm font-medium text-[#25231F] mb-1">
                  简介
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={200}
                  rows={3}
                  placeholder="介绍一下你自己..."
                  className="w-full px-3 py-2.5 border border-black/15 bg-white/50 rounded-xl text-sm text-[#25231F] placeholder:text-[#C5BAAA] focus:outline-none focus:ring-2 focus:ring-[#A94737]/30 focus:border-[#A94737] resize-none transition-colors"
                />
                <div className="flex justify-end mt-1">
                  <span className="text-xs text-[#8A8174]">{bio.length}/200</span>
                </div>
              </div>

              {/* Message */}
              {message && (
                <div
                  className={`text-sm px-3 py-2 rounded-xl ${
                    message.type === "success"
                      ? "bg-[#7C8B6A]/12 text-[#5a6649]"
                      : "bg-[#A94737]/8 text-[#A94737]"
                  }`}
                >
                  {message.text}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-[#A94737] hover:bg-[#8f3a2c] disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </form>
          )}

          {activeTab === "model" && (
            <div className="px-6 py-5">
              <ModelSettings />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}