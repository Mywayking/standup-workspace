"use client";
import { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";

const MODEL_PROVIDERS = [
  { value: "zhipu", label: "智谱 GLM", defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4", models: ["glm-5", "glm-4.5"] },
  { value: "moonshot", label: "Moonshot", defaultBaseUrl: "https://api.moonshot.cn/v1", models: ["moonshot-v1-8k", "moonshot-v1-32k"] },
  { value: "minimax", label: "MiniMax", defaultBaseUrl: "https://api.minimax.chat/v1", models: ["minimax-m2.7"] },
  { value: "deepseek", label: "DeepSeek", defaultBaseUrl: "https://api.deepseek.com/v1", models: ["deepseek-chat"] },
  { value: "openai_compatible", label: "自定义 OpenAI Compatible", defaultBaseUrl: "", models: [] },
];

export default function ModelSettings() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"system" | "custom">("system");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState<string | undefined>();
  const [fallbackToSystem, setFallbackToSystem] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastTestStatus, setLastTestStatus] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [customModelName, setCustomModelName] = useState("");

  useEffect(() => {
    fetch("/api/users/me/model-config")
      .then(r => r.json())
      .then(data => {
        setLoading(false);
        if (data.mode === "custom" && data.config) {
          setMode("custom");
          setProvider(data.config.provider || "");
          setModel(data.config.model || "");
          setApiKeyMasked(data.config.apiKeyMasked);
          setFallbackToSystem(data.config.fallbackToSystem !== false);
          setLastTestStatus(data.config.lastTestStatus);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  const selectedProvider = MODEL_PROVIDERS.find(p => p.value === provider);
  const effectiveModel = provider === "openai_compatible" && model === "custom" ? customModelName : model;

  async function handleTest() {
    if (!apiKeyInput && !apiKeyMasked) {
      toast("请先填写 API Key", "warning");
      return;
    }
    if (!effectiveModel) {
      toast("请选择或输入模型名", "warning");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/users/me/model-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model: effectiveModel,
          base_url: provider === "openai_compatible" ? baseUrl : null,
          api_key: apiKeyInput,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast(`连接成功：${provider} / ${effectiveModel} / ${result.latencyMs}ms`, "success");
        setLastTestStatus("success");
      } else {
        toast(result.message || "连接失败", "error");
        setLastTestStatus("failed");
      }
    } catch {
      toast("连接失败，请检查网络", "error");
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (mode === "system") {
      setSaving(true);
      try {
        await fetch("/api/users/me/model-config/use-system", { method: "POST" });
        toast("已切换为系统默认模型", "success");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!provider) {
      toast("请选择模型供应商", "warning");
      return;
    }
    if (!effectiveModel) {
      toast("请选择或输入模型名", "warning");
      return;
    }
    if (!apiKeyInput && !apiKeyMasked) {
      toast("请输入 API Key", "warning");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/users/me/model-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model: effectiveModel,
          base_url: provider === "openai_compatible" ? baseUrl : null,
          api_key: apiKeyInput || undefined,
          enabled: true,
          fallback_to_system: fallbackToSystem,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast("模型配置已保存", "success");
        setApiKeyInput("");
        if (result.config?.apiKeyMasked) {
          setApiKeyMasked(result.config.apiKeyMasked);
        }
      } else {
        toast(result.message || "保存失败", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-400">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">AI 模型设置</h3>
        <p className="text-sm text-gray-500">管理你的模型供应商和 API Key</p>
      </div>

      {/* 当前状态 */}
      <div className="text-sm">
        {mode === "system" ? (
          <span className="text-green-600">✅ 正在使用：系统模型（智谱 GLM-5）</span>
        ) : lastTestStatus === "success" ? (
          <span className="text-green-600">✅ 正在使用：我的 {selectedProvider?.label} Key</span>
        ) : (
          <span className="text-yellow-600">⚠️ 我的 Key 未测试或测试失败</span>
        )}
      </div>

      {/* 使用方式 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">使用方式</label>
        <div className="space-y-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={mode === "system"} onChange={() => setMode("system")} />
            <span className="text-sm">使用系统默认模型</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={mode === "custom"} onChange={() => setMode("custom")} />
            <span className="text-sm">使用我的 API Key</span>
          </label>
        </div>
      </div>

      {mode === "custom" && (
        <>
          {/* 供应商 */}
          <div className="space-y-1">
            <label className="text-sm font-medium">模型供应商</label>
            <select
              value={provider}
              onChange={e => { setProvider(e.target.value); setModel(""); setCustomModelName(""); }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">选择供应商</option>
              {MODEL_PROVIDERS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* 模型 */}
          <div className="space-y-1">
            <label className="text-sm font-medium">模型</label>
            {provider && provider !== "openai_compatible" ? (
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                disabled={!provider}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">选择模型</option>
                {selectedProvider?.models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : provider === "openai_compatible" ? (
              <input
                value={customModelName}
                onChange={e => { setCustomModelName(e.target.value); setModel("custom"); }}
                placeholder="输入模型名，如 gpt-4o、deepseek-chat"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <div className="text-sm text-gray-400">请先选择供应商</div>
            )}
          </div>

          {/* Base URL - 仅自定义供应商显示 */}
          {provider === "openai_compatible" && (
            <div className="space-y-1">
              <label className="text-sm font-medium">API Base URL</label>
              <input
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* API Key */}
          <div className="space-y-1">
            <label className="text-sm font-medium">API Key</label>
            <input
              type="password"
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              placeholder={apiKeyMasked ? `已保存：${apiKeyMasked}（输入新值可更新）` : "sk-..."}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {apiKeyMasked && !apiKeyInput && (
              <p className="text-xs text-gray-400">当前已保存：{apiKeyMasked}</p>
            )}
          </div>

          {/* 回退开关 */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="fallback"
              checked={fallbackToSystem}
              onChange={e => setFallbackToSystem(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="fallback" className="text-sm">Key 失败时自动回退系统模型</label>
          </div>
        </>
      )}

      {/* 按钮 */}
      <div className="flex gap-3">
        {mode === "custom" && (
          <button
            onClick={handleTest}
            disabled={testing || !effectiveModel || (!apiKeyInput && !apiKeyMasked)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? "测试中..." : "测试连接"}
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "保存中..." : "保存配置"}
        </button>
      </div>

      {/* 说明 */}
      <div className="text-xs text-gray-400 border-t pt-4">
        <p>• 你的 API Key 仅用于调用你自己的模型余额，不会经由我们的服务器</p>
        <p>• Key 加密存储，我们无法解密查看</p>
        <p>• 系统默认使用智谱 GLM-5 模型</p>
      </div>
    </div>
  );
}
