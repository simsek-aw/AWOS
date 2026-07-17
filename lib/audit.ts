import { createServiceClient } from "@/lib/supabase/server";

export type AuditEntry = {
  actorId?: string | null;
  action: string;
  summary: string;
  entity?: string;
  entityId?: string;
};

/**
 * Record a platform audit entry (best-effort — never throws, so it can't break
 * the action it accompanies). Written with the service role.
 */
export async function logAudit(e: AuditEntry): Promise<void> {
  try {
    const svc = createServiceClient();
    await svc.from("audit_log").insert({
      actor_id: e.actorId ?? null,
      action: e.action,
      summary: e.summary,
      entity: e.entity ?? null,
      entity_id: e.entityId ?? null,
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
}

export type AuditRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  summary: string;
  created_at: string;
};

/** Recent audit entries (admin only — caller must gate access). */
export async function listAudit(limit = 50): Promise<AuditRow[]> {
  try {
    const svc = createServiceClient();
    const { data } = await svc
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<AuditRow[]>();
    return data ?? [];
  } catch {
    return [];
  }
}
