import type { Metadata } from "next";
import WriteClient from "./WriteClient";
import ErrorBoundary from "../../components/ErrorBoundary";

export const metadata: Metadata = {
  title: "喜剧分析工作台 | 脱口秀拉片分析",
  description:
    "AI驱动的单口喜剧创作工具，输入脱口秀段子文本，自动分析结构、节奏、技巧，输出专业拉片报告。支持脱口秀写作、单口喜剧编剧、段子诊断等场景。",
  keywords:
    "脱口秀,单口喜剧,脱口秀写作,单口喜剧写作,脱口秀编剧,单口喜剧编剧,脱口秀技巧,喜剧创作,段子诊断,拉片分析,Stand-up Comedy,单口喜剧编程",
  authors: [{ name: "闰土" }],
  creator: "闰土",
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "https://ai.alwayshaha.art/write",
    siteName: "喜剧分析工作台",
    title: "喜剧分析工作台 | 脱口秀拉片分析",
    description:
      "AI驱动的单口喜剧创作工具，输入段子自动分析结构、节奏、技巧，输出专业拉片报告",
  },
  twitter: {
    card: "summary_large_image",
    title: "喜剧分析工作台 | 脱口秀拉片分析",
    description:
      "AI驱动的单口喜剧创作工具，输入段子自动分析结构、节奏、技巧",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://ai.alwayshaha.art/write",
  },
};

export default function WritePage() {
  return (
    <ErrorBoundary>
      <WriteClient />
    </ErrorBoundary>
  );
}
