// Helpers for the automation on/off switches (automation_settings table).
import type { createServiceClient } from "@/lib/supabase/server";

type Svc = ReturnType<typeof createServiceClient>;

export type AutomationKey =
  | "mirror"
  | "triage"
  | "reply"
  | "reminders"
  | "digest";

/**
 * Whether an automation is enabled. Fails open (returns true) if the row or
 * table is missing, so automations keep working before the migration is applied.
 */
export async function automationEnabled(
  svc: Svc,
  key: AutomationKey,
): Promise<boolean> {
  try {
    const { data } = await svc
      .from("automation_settings")
      .select("enabled")
      .eq("key", key)
      .maybeSingle<{ enabled: boolean }>();
    return data?.enabled ?? true;
  } catch {
    return true;
  }
}

/** Stamp an automation's last run time (best-effort). */
export async function markAutomationRun(
  svc: Svc,
  key: AutomationKey,
): Promise<void> {
  try {
    await svc
      .from("automation_settings")
      .update({ last_run_at: new Date().toISOString() })
      .eq("key", key);
  } catch {
    /* ignore */
  }
}
