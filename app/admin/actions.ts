"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireEmployee } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import type { Department } from "@/lib/types";

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
  const { error } = await svc.from("customers").insert({ name });
  if (error) fail("Kunde konnte nicht angelegt werden");

  revalidatePath("/admin");
  ok("Kunde angelegt");
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

export async function inviteUser(formData: FormData) {
  await requireEmployee();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const customerId = String(formData.get("customer_id") ?? "");
  const department = String(formData.get("department") ?? "");

  if (!email || password.length < 8) fail("E-Mail oder Passwort ungültig (min. 8 Zeichen)");
  if (role !== "employee" && role !== "customer") fail("Rolle ungültig");
  if (role === "customer" && !customerId) fail("Kunde muss zugeordnet werden");

  const svc = createServiceClient();
  const { data: created, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) fail("Nutzer konnte nicht angelegt werden (E-Mail evtl. vergeben)");

  const { error: profileError } = await svc.rpc("provision_profile", {
    p_user_id: created.user.id,
    p_full_name: fullName || email,
    p_role: role,
    p_customer_id: role === "customer" ? customerId : null,
    p_department: role === "employee" && department !== "" ? department : null,
  });
  if (profileError) {
    // Roll back the orphaned auth user so it can be retried cleanly.
    await svc.auth.admin.deleteUser(created.user.id);
    fail("Profil konnte nicht angelegt werden");
  }

  revalidatePath("/admin");
  ok("Nutzer angelegt");
}
