/**
 * 用户友好的错误消息映射
 * 统一所有 Tab 的错误处理策略
 */

export function mapUserError(err: unknown, fallback = "生成失败，请重试"): string {
  const msg = String(err ?? "");

  if (err instanceof Error || (err as any)?.name === "AbortError") {
    return "请求超时，请稍后重试";
  }
  if (
    msg.includes("network") ||
    msg.includes("Failed to fetch") ||
    msg.includes("fetch failed") ||
    msg.includes("NetworkError") ||
    msg.includes("net::")
  ) {
    return "网络连接异常，请检查网络后重试";
  }
  if (msg.includes("HTTP") || /\b[45]\d{2}\b/.test(msg)) {
    return `服务异常（${msg.match(/\b[45]\d{2}\b/)?.[0]}），请稍后重试`;
  }
  return fallback;
}
