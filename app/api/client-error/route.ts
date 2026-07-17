import { NextResponse } from "next/server";
import { reportError } from "@/lib/report-error";

export const dynamic = "force-dynamic";

// Receives client-side render errors (from the error boundaries) so they land in
// the server logs / monitoring webhook instead of only the user's console.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      context?: string;
      message?: string;
      digest?: string;
      url?: string;
    };
    await reportError(
      `client:${String(body.context ?? "unknown").slice(0, 60)}`,
      new Error(String(body.message ?? "client error").slice(0, 500)),
      { digest: body.digest, url: body.url },
    );
  } catch {
    // ignore
  }
  return NextResponse.json({ ok: true });
}
