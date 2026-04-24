"use client";

import { useState } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.includes("@")) {
      setError("目前仅支持邮箱找回密码");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await authApi.forgotPassword({
        identifier: identifier.trim(),
        identifierType: "email",
      });
      if (res.success) {
        setSent(true);
      } else {
        setError(res.detail || "请求失败");
      }
    } catch (err: any) {
      setError(err.message || "请求失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h1 className="text-lg font-semibold text-gray-900">找回密码</h1>
        </div>

        <div className="px-6 py-5">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">邮件已发送</h2>
              <p className="text-sm text-gray-500">
                我们已发送密码重置链接到 <span className="font-medium text-gray-700">{identifier}</span>
                <br />请查收邮件并点击链接重置密码。
              </p>
              <p className="text-xs text-gray-400 mt-2">链接 1 小时后失效。</p>
              <div className="mt-4">
                <Link href="/write" className="text-sm text-indigo-600 hover:text-indigo-500">
                  返回工作台
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">
                输入你的注册邮箱，我们会发送密码重置链接。
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                  <input
                    type="email"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>
                {error && (
                  <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {loading ? "发送中..." : "发送重置链接"}
                </button>
                <div className="text-center">
                  <Link href="/write" className="text-sm text-indigo-600 hover:text-indigo-500">
                    返回登录
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
