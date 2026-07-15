import { NextResponse, type NextRequest } from "next/server";
import { runReminders } from "@/lib/automations";

// Deadline / overdue / stale reminders + auto-archive. Scheduled hourly by
// Vercel Cron (see vercel.json). Protected by CRON_SECRET: Vercel sends it as a
// Bearer token, so unauthenticated callers get 401.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // must be configured to run
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("cron/reminders failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
