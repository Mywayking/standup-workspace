import type { Metadata } from "next";
import NextDynamic from "next/dynamic";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "喜剧写稿台 | 脱口秀创作工具",
  description:
    "AI驱动的单口喜剧创作工具，从素材到成品，手把手带你完成一段脱口秀",
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "https://standup.alwayshaha.art/write",
    siteName: "喜剧写稿台",
    title: "喜剧写稿台 | 脱口秀创作工具",
    description:
      "AI驱动的单口喜剧创作工具，从素材到成品，手把手带你完成一段脱口秀",
  },
  twitter: {
    card: "summary_large_image",
    title: "喜剧写稿台 | 脱口秀创作工具",
    description:
      "AI驱动的单口喜剧创作工具，从素材到成品，手把手带你完成一段脱口秀",
  },
  alternates: {
    canonical: "https://standup.alwayshaha.art/write",
  },
};

// WashiWriteClient reads localStorage — must render client-side only
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WashiWriteClient = (NextDynamic as any).default(
  () => import("./washi/WashiWriteClient").then((m) => m.WashiWriteClient),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          minHeight: "100dvh",
          backgroundColor: "#F5EFE3",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "STSong, Songti SC, serif",
          color: "#25231F",
          fontSize: "14px",
          letterSpacing: "0.08em",
        }}
      >
        正在打开喜剧写稿台…
      </div>
    ),
  }
);

export default function WritePage() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <WashiWriteClient />
      </ToastProvider>
    </ErrorBoundary>
  );
}
