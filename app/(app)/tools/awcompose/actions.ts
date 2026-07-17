"use server";

import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createServiceClient } from "@/lib/supabase/server";

const BUCKET = "awideogram"; // shared image gallery/storage
const SIGNED_TTL = 60 * 60 * 24 * 7;

const MAX_COMPOSITE_BYTES = 16 * 1024 * 1024;

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  // Only accept a PNG data URL (what the compositor exports), size-capped.
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  if (Math.floor((m[1].length * 3) / 4) > MAX_COMPOSITE_BYTES) return null;
  return new Uint8Array(Buffer.from(m[1], "base64"));
}

/**
 * Persist a composited image (data URL) to the shared gallery. Employee-only.
 * Returns a display-ready signed URL. Errors are returned as data.
 */
export async function saveComposite(
  dataUrl: string,
  description?: string,
): Promise<{ url: string | null; error: string | null }> {
  try {
    const ctx = await requireSession();
    if (ctx.profile.role !== "employee")
      return { url: null, error: "Nur für Mitarbeiter." };

    const bytes = dataUrlToBytes(dataUrl);
    if (!bytes) return { url: null, error: "Ungültiges Bildformat." };

    const svc = createServiceClient();
    const path = `${ctx.userId}/compose-${crypto.randomUUID()}.png`;
    const { error: upErr } = await svc.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr)
      return { url: null, error: `Speichern fehlgeschlagen: ${upErr.message}` };

    await svc.from("awideogram_generations").insert({
      user_id: ctx.userId,
      storage_path: path,
      high_level_description: description?.trim() || "Komposition (AWcompose)",
      request: { mode: "compose" },
    });

    const { data: signed } = await svc.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_TTL);

    await logAudit({
      actorId: ctx.userId,
      action: "awcompose.save",
      entity: "awideogram",
      summary: "Komposition gespeichert",
    });

    return { url: signed?.signedUrl ?? null, error: null };
  } catch (e) {
    console.error("awcompose: saveComposite failed", e);
    return {
      url: null,
      error: e instanceof Error ? e.message : "Speichern fehlgeschlagen.",
    };
  }
}
