import { NextRequest } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const resp = await fetch(`${BACKEND}/api/analyze/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    return new Response(
      `event: error\ndata: ${JSON.stringify({ error: `Backend error ${resp.status}: ${err.slice(0, 200)}` })}\n\n`,
      {
        status: resp.status,
        headers: { "Content-Type": "text/event-stream" },
      }
    );
  }

  // Stream the response back as SSE
  return new Response(resp.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
