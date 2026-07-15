import { NextResponse, type NextRequest } from "next/server";
import { runDigest } from "@/lib/automations";

// Per-employee daily digest. Scheduled once a day by Vercel Cron.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runDigest();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("cron/digest failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
