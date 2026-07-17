import { NextResponse, type NextRequest } from "next/server";
import { runDueTemplates } from "@/app/(app)/boards/[id]/actions";
import { createServiceClient } from "@/lib/supabase/server";

// Materialize due recurring task templates (weekly/monthly). Scheduled daily by
// Vercel Cron (see vercel.json). Protected by CRON_SECRET.
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
    const svc = createServiceClient();
    const created = await runDueTemplates(svc);
    return NextResponse.json({ ok: true, created });
  } catch (err) {
    console.error("cron/templates failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
