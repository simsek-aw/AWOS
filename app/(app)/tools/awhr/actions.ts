"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { RECRUIT_STAGES } from "@/lib/hr";
import { createServiceClient } from "@/lib/supabase/server";

const PATH = "/tools/awhr";

type Svc = ReturnType<typeof createServiceClient>;

async function ctxIsAdmin() {
  const ctx = await requireSession();
  return { ctx, isAdmin: ctx.profile.is_admin === true };
}

// ============================ Vacation ====================================

export type VacationView = {
  id: string;
  userId: string;
  userName: string;
  start: string;
  end: string;
  days: number;
  substituteId: string | null;
  substituteName: string | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  warnings: string[];
};

function overlaps(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 <= e2 && s2 <= e1;
}
function inclusiveDays(start: string, end: string): number {
  const a = new Date(start + "T00:00:00Z").getTime();
  const b = new Date(end + "T00:00:00Z").getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

type VacRow = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  substitute_id: string | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
};

// Compute the "conflict agent" warnings for a request against all others.
function conflictsFor(
  r: VacRow,
  all: VacRow[],
  deptOf: Map<string, string | null>,
  nameOf: Map<string, string>,
): string[] {
  const w: string[] = [];
  const myDept = deptOf.get(r.user_id) ?? null;
  for (const o of all) {
    if (o.id === r.id) continue;
    if (o.status === "rejected") continue;
    if (!overlaps(r.start_date, r.end_date, o.start_date, o.end_date)) continue;
    // Same-department overlap.
    if (myDept && deptOf.get(o.user_id) === myDept)
      w.push(
        `Überschneidung mit ${nameOf.get(o.user_id) ?? "?"} (gleiche Abteilung)`,
      );
    // The chosen substitute is themselves away in the window.
    if (r.substitute_id && o.user_id === r.substitute_id)
      w.push(
        `Vertretung ${nameOf.get(r.substitute_id) ?? "?"} ist im selben Zeitraum abwesend`,
      );
  }
  return [...new Set(w)];
}

/** Vacation data for the AWhr page: the caller's own requests, and (admins) all. */
export async function loadVacations(): Promise<{
  isAdmin: boolean;
  mine: VacationView[];
  all: VacationView[];
}> {
  const { ctx, isAdmin } = await ctxIsAdmin();
  const svc = createServiceClient();
  const [{ data: reqs }, { data: profs }] = await Promise.all([
    svc
      .from("vacation_requests")
      .select("id, user_id, start_date, end_date, substitute_id, reason, status")
      .order("start_date", { ascending: false })
      .returns<VacRow[]>(),
    svc
      .from("profiles")
      .select("id, full_name, department")
      .returns<{ id: string; full_name: string | null; department: string | null }[]>(),
  ]);
  const rows = reqs ?? [];
  const nameOf = new Map((profs ?? []).map((p) => [p.id, p.full_name ?? "?"]));
  const deptOf = new Map((profs ?? []).map((p) => [p.id, p.department]));

  const toView = (r: VacRow): VacationView => ({
    id: r.id,
    userId: r.user_id,
    userName: nameOf.get(r.user_id) ?? "?",
    start: r.start_date,
    end: r.end_date,
    days: inclusiveDays(r.start_date, r.end_date),
    substituteId: r.substitute_id,
    substituteName: r.substitute_id ? (nameOf.get(r.substitute_id) ?? "?") : null,
    reason: r.reason,
    status: r.status,
    warnings: conflictsFor(r, rows, deptOf, nameOf),
  });

  const mine = rows.filter((r) => r.user_id === ctx.userId).map(toView);
  const all = isAdmin ? rows.map(toView) : [];
  return { isAdmin, mine, all };
}

export async function createVacation(fd: FormData) {
  const ctx = await requireSession();
  if (ctx.profile.role !== "employee") return;
  const start = String(fd.get("start") ?? "");
  const end = String(fd.get("end") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return;
  if (end < start) return;
  const substitute = String(fd.get("substitute") ?? "") || null;
  const reason = String(fd.get("reason") ?? "").trim() || null;
  const svc = createServiceClient();
  await svc.from("vacation_requests").insert({
    user_id: ctx.userId,
    start_date: start,
    end_date: end,
    substitute_id: substitute,
    reason,
    status: "pending",
  });
  await logAudit({
    actorId: ctx.userId,
    action: "vacation.request",
    entity: "vacation",
    summary: `Urlaub beantragt (${start} – ${end})`,
  });
  revalidatePath(PATH);
}

export async function decideVacation(id: string, status: "approved" | "rejected") {
  const { ctx, isAdmin } = await ctxIsAdmin();
  if (!isAdmin) return;
  const svc = createServiceClient();
  await svc
    .from("vacation_requests")
    .update({ status, decided_by: ctx.userId })
    .eq("id", id);
  await logAudit({
    actorId: ctx.userId,
    action: "vacation.decide",
    entity: "vacation",
    entityId: id,
    summary: status === "approved" ? "Urlaub genehmigt" : "Urlaub abgelehnt",
  });
  revalidatePath(PATH);
}

export async function deleteVacation(id: string) {
  const { ctx, isAdmin } = await ctxIsAdmin();
  const svc = createServiceClient();
  const { data: r } = await svc
    .from("vacation_requests")
    .select("user_id, status")
    .eq("id", id)
    .maybeSingle<{ user_id: string; status: string }>();
  if (!r) return;
  const ownPending = r.user_id === ctx.userId && r.status === "pending";
  if (!isAdmin && !ownPending) return;
  await svc.from("vacation_requests").delete().eq("id", id);
  revalidatePath(PATH);
}

// ============================ Recruiting ==================================

export type ApplicantView = {
  id: string;
  name: string;
  position: string | null;
  stage: string;
  cvUrl: string | null;
  up: number;
  down: number;
  myVote: number; // -1 | 0 | 1
  isReviewer: boolean;
};

async function canSeeApplicant(
  svc: Svc,
  userId: string,
  applicantId: string,
  isAdmin: boolean,
): Promise<boolean> {
  if (isAdmin) return true;
  const { data } = await svc
    .from("hr_applicant_reviewers")
    .select("user_id")
    .eq("applicant_id", applicantId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function loadApplicants(): Promise<{
  isAdmin: boolean;
  applicants: ApplicantView[];
}> {
  const { ctx, isAdmin } = await ctxIsAdmin();
  const svc = createServiceClient();

  const { data: apps } = await svc
    .from("hr_applicants")
    .select("id, name, position, stage, cv_url, created_at")
    .order("created_at", { ascending: false })
    .returns<
      {
        id: string;
        name: string;
        position: string | null;
        stage: string;
        cv_url: string | null;
        created_at: string;
      }[]
    >();
  let list = apps ?? [];

  // Non-admins only see applicants they review.
  let reviewerSet = new Set<string>();
  const { data: myRev } = await svc
    .from("hr_applicant_reviewers")
    .select("applicant_id")
    .eq("user_id", ctx.userId)
    .returns<{ applicant_id: string }[]>();
  reviewerSet = new Set((myRev ?? []).map((r) => r.applicant_id));
  if (!isAdmin) list = list.filter((a) => reviewerSet.has(a.id));

  if (!list.length) return { isAdmin, applicants: [] };

  const ids = list.map((a) => a.id);
  const { data: votes } = await svc
    .from("hr_votes")
    .select("applicant_id, user_id, value")
    .in("applicant_id", ids)
    .returns<{ applicant_id: string; user_id: string; value: number }[]>();
  const up = new Map<string, number>();
  const down = new Map<string, number>();
  const mine = new Map<string, number>();
  for (const v of votes ?? []) {
    if (v.value > 0) up.set(v.applicant_id, (up.get(v.applicant_id) ?? 0) + 1);
    else down.set(v.applicant_id, (down.get(v.applicant_id) ?? 0) + 1);
    if (v.user_id === ctx.userId) mine.set(v.applicant_id, v.value);
  }

  return {
    isAdmin,
    applicants: list.map((a) => ({
      id: a.id,
      name: a.name,
      position: a.position,
      stage: a.stage,
      cvUrl: a.cv_url,
      up: up.get(a.id) ?? 0,
      down: down.get(a.id) ?? 0,
      myVote: mine.get(a.id) ?? 0,
      isReviewer: isAdmin || reviewerSet.has(a.id),
    })),
  };
}

export async function createApplicant(fd: FormData) {
  const { ctx, isAdmin } = await ctxIsAdmin();
  if (!isAdmin) return;
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return;
  const svc = createServiceClient();
  await svc.from("hr_applicants").insert({
    name,
    position: String(fd.get("position") ?? "").trim() || null,
    cv_url: String(fd.get("cv_url") ?? "").trim() || null,
    created_by: ctx.userId,
  });
  await logAudit({
    actorId: ctx.userId,
    action: "recruit.create",
    entity: "applicant",
    summary: `Bewerber angelegt: ${name}`,
  });
  revalidatePath(PATH);
}

export async function setStage(id: string, stage: string) {
  const { isAdmin } = await ctxIsAdmin();
  if (!isAdmin || !RECRUIT_STAGES.includes(stage)) return;
  const svc = createServiceClient();
  await svc.from("hr_applicants").update({ stage }).eq("id", id);
  revalidatePath(PATH);
}

export async function deleteApplicant(id: string) {
  const { isAdmin } = await ctxIsAdmin();
  if (!isAdmin) return;
  const svc = createServiceClient();
  await svc.from("hr_applicants").delete().eq("id", id);
  revalidatePath(PATH);
}

export async function vote(applicantId: string, value: 1 | -1) {
  const { ctx, isAdmin } = await ctxIsAdmin();
  const svc = createServiceClient();
  if (!(await canSeeApplicant(svc, ctx.userId, applicantId, isAdmin))) return;
  await svc
    .from("hr_votes")
    .upsert(
      { applicant_id: applicantId, user_id: ctx.userId, value },
      { onConflict: "applicant_id,user_id" },
    );
  revalidatePath(PATH);
}

export async function addNote(applicantId: string, body: string) {
  const { ctx, isAdmin } = await ctxIsAdmin();
  const text = body.trim();
  if (!text) return;
  const svc = createServiceClient();
  if (!(await canSeeApplicant(svc, ctx.userId, applicantId, isAdmin))) return;
  await svc
    .from("hr_notes")
    .insert({ applicant_id: applicantId, author_id: ctx.userId, body: text });
  revalidatePath(PATH);
}

export async function addReviewer(applicantId: string, userId: string) {
  const { isAdmin } = await ctxIsAdmin();
  if (!isAdmin) return;
  const svc = createServiceClient();
  await svc
    .from("hr_applicant_reviewers")
    .upsert({ applicant_id: applicantId, user_id: userId });
  revalidatePath(PATH);
}

export async function removeReviewer(applicantId: string, userId: string) {
  const { isAdmin } = await ctxIsAdmin();
  if (!isAdmin) return;
  const svc = createServiceClient();
  await svc
    .from("hr_applicant_reviewers")
    .delete()
    .eq("applicant_id", applicantId)
    .eq("user_id", userId);
  revalidatePath(PATH);
}

export type ApplicantDetail = {
  reviewers: { id: string; name: string }[];
  notes: { id: string; author: string; body: string; at: string }[];
};

export async function getApplicantDetail(
  applicantId: string,
): Promise<ApplicantDetail | null> {
  const { ctx, isAdmin } = await ctxIsAdmin();
  const svc = createServiceClient();
  if (!(await canSeeApplicant(svc, ctx.userId, applicantId, isAdmin)))
    return null;
  const [{ data: revs }, { data: notes }, { data: profs }] = await Promise.all([
    svc
      .from("hr_applicant_reviewers")
      .select("user_id")
      .eq("applicant_id", applicantId)
      .returns<{ user_id: string }[]>(),
    svc
      .from("hr_notes")
      .select("id, author_id, body, created_at")
      .eq("applicant_id", applicantId)
      .order("created_at", { ascending: false })
      .returns<
        { id: string; author_id: string | null; body: string; created_at: string }[]
      >(),
    svc.from("profiles").select("id, full_name").returns<
      { id: string; full_name: string | null }[]
    >(),
  ]);
  const nameOf = new Map((profs ?? []).map((p) => [p.id, p.full_name ?? "?"]));
  return {
    reviewers: (revs ?? []).map((r) => ({
      id: r.user_id,
      name: nameOf.get(r.user_id) ?? "?",
    })),
    notes: (notes ?? []).map((n) => ({
      id: n.id,
      author: n.author_id ? (nameOf.get(n.author_id) ?? "?") : "?",
      body: n.body,
      at: n.created_at,
    })),
  };
}

/** Employees for substitute / reviewer pickers. */
export async function loadEmployees(): Promise<{ id: string; name: string }[]> {
  await requireSession();
  const svc = createServiceClient();
  const { data } = await svc
    .from("profiles")
    .select("id, full_name, role")
    .eq("role", "employee")
    .order("full_name", { ascending: true })
    .returns<{ id: string; full_name: string | null; role: string }[]>();
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name ?? "?" }));
}
