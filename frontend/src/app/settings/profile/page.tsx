"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";
import Link from "next/link";

export default function ProfileSettingsPage() {
  const { user, loggedIn, loading: authLoading, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
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
        // Update user in state manually for immediate feedback
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">请先登录</p>
          <Link href="/" className="text-indigo-600 hover:text-indigo-500">返回首页</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100">
            <h1 className="text-xl font-semibold text-gray-900">账号设置</h1>
            <p className="text-sm text-gray-500 mt-1">管理你的个人资料</p>
          </div>

          <form onSubmit={handleSave} className="px-6 py-5 space-y-5">
            {/* Avatar preview */}
            <div className="flex justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-2xl font-semibold">
                  {displayName?.[0] || user?.nickname?.[0] || "U"}
                </div>
              )}
            </div>

            {/* 昵称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                昵称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={20}
                placeholder="2-20 字"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-400">必填，2-20 字</span>
                <span className="text-xs text-gray-400">{displayName.length}/20</span>
              </div>
            </div>

            {/* 用户名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                用户名
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                  maxLength={20}
                  placeholder="选填，唯一标识"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <span className="text-xs text-gray-400 mt-1 block">选填，3-20 字，只能用字母、数字、下划线</span>
            </div>

            {/* 头像 URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                头像 URL
              </label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <span className="text-xs text-gray-400 mt-1 block">选填，直接填图片链接</span>
            </div>

            {/* 简介 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                简介
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={200}
                rows={3}
                placeholder="介绍一下你自己..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              />
              <div className="flex justify-end mt-1">
                <span className="text-xs text-gray-400">{bio.length}/200</span>
              </div>
            </div>

            {/* Message */}
            {message && (
              <div className={`text-sm px-3 py-2 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                {message.text}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
