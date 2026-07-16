"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireEmployee } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import type { Department } from "@/lib/types";

async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

// redirect() throws NEXT_REDIRECT, so these never return.
function fail(message: string): never {
  redirect(`/admin?error=${encodeURIComponent(message)}`);
}

function ok(message: string): never {
  redirect(`/admin?ok=${encodeURIComponent(message)}`);
}

export async function createCustomer(formData: FormData) {
  await requireEmployee();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail("Kundenname fehlt");

  const svc = createServiceClient();
  const { data: customer, error } = await svc
    .from("customers")
    .insert({ name })
    .select("id")
    .single<{ id: string }>();
  if (error || !customer) fail("Kunde konnte nicht angelegt werden");

  // Onboarding: every new customer gets a board straight away (seeded columns
  // + default group), so there's somewhere to work immediately.
  await svc.rpc("create_board", {
    p_name: name,
    p_type: "customer",
    p_customer_id: customer.id,
    p_department: null,
  });

  revalidatePath("/admin");
  ok("Kunde + Board angelegt");
}

/** Rename a board. */
export async function renameBoard(formData: FormData) {
  await requireEmployee();
  const boardId = String(formData.get("board_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!boardId || !name) return;
  const svc = createServiceClient();
  await svc.from("boards").update({ name }).eq("id", boardId);
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}

/** Archive or unarchive a board (soft — data is kept, just hidden). */
export async function setBoardArchived(formData: FormData) {
  await requireEmployee();
  const boardId = String(formData.get("board_id") ?? "");
  const archived = String(formData.get("archived") ?? "") === "1";
  if (!boardId) return;
  const svc = createServiceClient();
  await svc
    .from("boards")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", boardId);
  revalidatePath("/admin");
  revalidatePath("/", "layout");
}

export async function createInternalBoard(formData: FormData) {
  await requireEmployee();
  const name = String(formData.get("name") ?? "").trim();
  const department = String(formData.get("department") ?? "") as Department | "";
  if (!name) fail("Board-Name fehlt");

  const svc = createServiceClient();
  const { error } = await svc.rpc("create_board", {
    p_name: name,
    p_type: "internal",
    p_customer_id: null,
    p_department: department === "" ? null : department,
  });
  if (error) fail("Board konnte nicht angelegt werden");

  revalidatePath("/admin");
  ok("Internes Board angelegt");
}

export async function createCustomerBoard(formData: FormData) {
  await requireEmployee();
  const name = String(formData.get("name") ?? "").trim();
  const customerId = String(formData.get("customer_id") ?? "");
  if (!name) fail("Board-Name fehlt");
  if (!customerId) fail("Kunde fehlt");

  const svc = createServiceClient();
  const { error } = await svc.rpc("create_board", {
    p_name: name,
    p_type: "customer",
    p_customer_id: customerId,
    p_department: null,
  });
  if (error) fail("Board konnte nicht angelegt werden");

  revalidatePath("/admin");
  ok("Kunden-Board angelegt");
}

export async function updateUser(formData: FormData) {
  await requireEmployee();
  const userId = String(formData.get("user_id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const customerId = String(formData.get("customer_id") ?? "");
  const department = String(formData.get("department") ?? "");

  if (!userId) fail("Nutzer fehlt");
  if (role !== "employee" && role !== "customer") fail("Rolle ungültig");
  if (role === "customer" && !customerId) fail("Kunde muss zugeordnet werden");

  const svc = createServiceClient();
  // provision_profile upserts (on conflict do update), so it doubles as an edit.
  const { error } = await svc.rpc("provision_profile", {
    p_user_id: userId,
    p_full_name: fullName,
    p_role: role,
    p_customer_id: role === "customer" ? customerId : null,
    p_department: role === "employee" && department !== "" ? department : null,
  });
  if (error) fail("Nutzer konnte nicht aktualisiert werden");

  revalidatePath("/admin");
  ok("Nutzer aktualisiert");
}

export async function setUserPassword(formData: FormData) {
  await requireEmployee();
  const userId = String(formData.get("user_id") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!userId) fail("Nutzer fehlt");
  if (password.length < 8) fail("Passwort muss mindestens 8 Zeichen haben");

  const svc = createServiceClient();
  // Sets the password directly and marks the email confirmed, so the user can
  // log in immediately — no recovery email round-trip needed.
  const { error } = await svc.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });
  if (error) fail("Passwort konnte nicht gesetzt werden");

  ok("Passwort gesetzt — der Nutzer kann sich jetzt damit anmelden");
}

export async function sendPasswordReset(formData: FormData) {
  await requireEmployee();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) fail("E-Mail fehlt");

  const svc = createServiceClient();
  const origin = await siteOrigin();
  // Routes the recovery link through /auth/confirm (token_hash flow), which
  // establishes a session and lands on the set-password page. Requires the
  // Supabase "Reset Password" email template to use {{ .TokenHash }} — see the
  // note in the admin UI.
  const { error } = await svc.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/auth/update-password`,
  });
  if (error) fail("Reset-Mail konnte nicht gesendet werden (SMTP/Rate-Limit?)");

  ok(`Passwort-Reset-Link an ${email} gesendet`);
}

export async function deleteUser(formData: FormData) {
  const ctx = await requireEmployee();
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) fail("Nutzer fehlt");
  if (userId === ctx.userId) fail("Du kannst dich nicht selbst löschen");

  const svc = createServiceClient();
  // Deleting the auth user cascades to the profile (FK on delete cascade).
  const { error } = await svc.auth.admin.deleteUser(userId);
  if (error) fail("Nutzer konnte nicht gelöscht werden");

  revalidatePath("/admin");
  ok("Nutzer gelöscht");
}

/**
 * Bulk-create internal team members (employees) without sending any e-mail.
 * Accounts are created email-confirmed with a random password; logins can be
 * enabled later per person via a password reset. Deduped by name so a person
 * isn't created twice (keeps PM/Macher matching unambiguous). Idempotent:
 * an already-existing e-mail is skipped.
 */
export async function importTeam(
  rows: { name: string; email: string; department: string }[],
): Promise<{ created: number; skipped: number; errors: string[] }> {
  await requireEmployee();
  const svc = createServiceClient();

  const mapDept = (s: string): "marketing" | "content" | "grafik" | null => {
    const d = (s ?? "").trim().toLowerCase();
    if (d.includes("grafik")) return "grafik";
    if (d.includes("content")) return "content";
    if (d.includes("marketing")) return "marketing";
    return null;
  };

  const seen = new Set<string>();
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const r of rows ?? []) {
    const name = (r.name ?? "").trim();
    const email = (r.email ?? "").trim().toLowerCase();
    if (!name || !email || !email.includes("@")) {
      skipped++;
      continue;
    }
    if (seen.has(name.toLowerCase())) {
      skipped++;
      continue;
    }
    seen.add(name.toLowerCase());

    const { data: acc, error } = await svc.auth.admin.createUser({
      email,
      email_confirm: true,
      password: `${crypto.randomUUID()}Aa1!`,
      user_metadata: { full_name: name },
    });
    if (error || !acc.user) {
      skipped++;
      if (errors.length < 8) errors.push(`${email}: ${error?.message ?? "unbekannt"}`);
      continue;
    }
    const { error: pErr } = await svc.rpc("provision_profile", {
      p_user_id: acc.user.id,
      p_full_name: name,
      p_role: "employee",
      p_customer_id: null,
      p_department: mapDept(r.department),
    });
    if (pErr) {
      await svc.auth.admin.deleteUser(acc.user.id);
      skipped++;
      if (errors.length < 8) errors.push(`${email}: Profil (${pErr.message})`);
      continue;
    }
    created++;
  }

  revalidatePath("/admin");
  return { created, skipped, errors };
}

export async function inviteUser(formData: FormData) {
  await requireEmployee();
  const email = String(formData.get("email") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const customerId = String(formData.get("customer_id") ?? "");
  const department = String(formData.get("department") ?? "");

  if (!email) fail("E-Mail fehlt");
  if (role !== "employee" && role !== "customer") fail("Rolle ungültig");
  if (role === "customer" && !customerId) fail("Kunde muss zugeordnet werden");

  const svc = createServiceClient();
  const origin = await siteOrigin();

  // Sends the Supabase "Invite user" email; creates the auth user (unconfirmed)
  // and returns it so we can provision the profile immediately.
  const { data: created, error } = await svc.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/auth/update-password`,
    data: { full_name: fullName || email },
  });
  if (error || !created.user) {
    fail("Einladung fehlgeschlagen (E-Mail evtl. vergeben oder SMTP nicht konfiguriert)");
  }

  const { error: profileError } = await svc.rpc("provision_profile", {
    p_user_id: created.user.id,
    p_full_name: fullName || email,
    p_role: role,
    p_customer_id: role === "customer" ? customerId : null,
    p_department: role === "employee" && department !== "" ? department : null,
  });
  if (profileError) {
    // Roll back the orphaned auth user so the invite can be retried cleanly.
    await svc.auth.admin.deleteUser(created.user.id);
    fail("Profil konnte nicht angelegt werden");
  }

  revalidatePath("/admin");
  ok(`Einladung an ${email} gesendet`);
}
