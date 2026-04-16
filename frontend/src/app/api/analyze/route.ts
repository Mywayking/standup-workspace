import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const resp = await fetch(`${BACKEND}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.text();
      return NextResponse.json({ error: err }, { status: resp.status });
    }
    const data = await resp.json();


    // Compose feedback: laugh_moment + weakest_link + one_fix (comedian-focused)
    const laugh = data.laugh_moment ? `🎯 笑点：${data.laugh_moment}` : null;
    const weak = data.weakest_link ? `⚠️ 弱点：${data.weakest_link}` : null;
    const fix = data.one_fix ? `🔧 一句话改进：${data.one_fix}` : null;
    const parts = [laugh, weak, fix].filter(Boolean);


    // Fallback to summary/strengths/weaknesses
    const fallbackFeedback =
      data.summary ||
      [data.strengths, data.weaknesses].filter(Boolean).join("；") ||
      "分析完成";

    const result = {
      // Backend score is 0-1, frontend expects 0-100
      score: Math.round((data.overall_score ?? data.score ?? 0.5) * 100),
      structure: data.structures ?? "",
      techniques: (data.techniques ?? "")
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean),
      feedback: parts.length > 0 ? parts.join("\n") : fallbackFeedback,
      segments: (data.segments ?? []).map((s: {
        text: string;
        structure: string;
        techniques: string;
      }) => ({
        text: s.text ?? "",
        structure: s.structure ?? "",
        technique: s.techniques
          ? s.techniques.split(",")[0].trim()
          : "",
      })),
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/analyze]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
