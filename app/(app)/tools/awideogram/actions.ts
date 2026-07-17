"use server";

import { requireSession } from "@/lib/auth";
import { generateIdeogram, type StudioInput } from "@/lib/ideogram";
import { createServiceClient } from "@/lib/supabase/server";

const BUCKET = "awideogram";
const SIGNED_TTL = 60 * 60 * 24 * 7; // 7 days

export type GenerationView = {
  id: string;
  url: string; // signed URL for display
  highLevelDescription: string | null;
  createdAt: string;
};

/**
 * Generate an image with Ideogram, persist it to storage, and record it.
 * Employee-only.
 *
 * Errors are returned as data (not thrown): Next.js sanitizes thrown Server
 * Action errors in production into an opaque "digest" message, which would hide
 * the actual Ideogram API detail we need. Returning them keeps the real message.
 */
export async function generateImage(
  input: StudioInput,
): Promise<{ images: GenerationView[]; error: string | null }> {
  try {
    const ctx = await requireSession();
    if (ctx.profile.role !== "employee")
      return { images: [], error: "Nur für Mitarbeiter." };
    if (!input.highLevelDescription?.trim())
      return { images: [], error: "Bitte eine Bildbeschreibung angeben." };

    const { results, body } = await generateIdeogram(input);
    const svc = createServiceClient();

    const images: GenerationView[] = [];
    for (const r of results) {
      // Ideogram's URLs expire — download and store the bytes ourselves.
      const imgRes = await fetch(r.url);
      if (!imgRes.ok)
        return {
          images: [],
          error: `Bild-Download von Ideogram fehlgeschlagen (${imgRes.status}).`,
        };
      const bytes = new Uint8Array(await imgRes.arrayBuffer());
      const path = `${ctx.userId}/${crypto.randomUUID()}.png`;
      const { error: upErr } = await svc.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: "image/png", upsert: false });
      if (upErr) {
        console.error("awideogram: upload failed", upErr);
        return {
          images: [],
          error: `Storage-Upload fehlgeschlagen: ${upErr.message} (Bucket 'awideogram' angelegt?)`,
        };
      }
      const { data: row, error: insErr } = await svc
        .from("awideogram_generations")
        .insert({
          user_id: ctx.userId,
          storage_path: path,
          high_level_description: input.highLevelDescription,
          request: body,
          aspect_ratio: input.aspectRatio,
          rendering_speed: input.renderingSpeed,
        })
        .select("id, created_at")
        .single<{ id: string; created_at: string }>();
      if (insErr || !row)
        return {
          images: [],
          error: `DB-Eintrag fehlgeschlagen: ${insErr?.message ?? "unbekannt"}`,
        };

      const { data: signed, error: signErr } = await svc.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_TTL);
      if (signErr || !signed?.signedUrl)
        return {
          images: [],
          error: `Signed-URL fehlgeschlagen: ${signErr?.message ?? "unbekannt"}`,
        };

      images.push({
        id: row.id,
        url: signed.signedUrl,
        highLevelDescription: input.highLevelDescription,
        createdAt: row.created_at,
      });
    }

    if (!images.length)
      return {
        images: [],
        error: "Ideogram lieferte keine Bilder zurück.",
      };
    return { images, error: null };
  } catch (e) {
    console.error("awideogram: generateImage failed", e);
    return {
      images: [],
      error: e instanceof Error ? e.message : "Generierung fehlgeschlagen.",
    };
  }
}

/** Recent generations for the gallery, with fresh signed URLs. */
export async function listGenerations(limit = 24): Promise<GenerationView[]> {
  await requireSession();
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("awideogram_generations")
    .select("id, storage_path, high_level_description, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<
      {
        id: string;
        storage_path: string;
        high_level_description: string | null;
        created_at: string;
      }[]
    >();
  if (error) {
    // Most likely migration 0028 hasn't been applied yet — don't crash the page.
    console.error("awideogram: listGenerations query error", error);
    return [];
  }
  const rows = data ?? [];
  const out: GenerationView[] = [];
  for (const r of rows) {
    const { data: signed } = await svc.storage
      .from(BUCKET)
      .createSignedUrl(r.storage_path, SIGNED_TTL);
    if (signed?.signedUrl)
      out.push({
        id: r.id,
        url: signed.signedUrl,
        highLevelDescription: r.high_level_description,
        createdAt: r.created_at,
      });
  }
  return out;
}

export async function deleteGeneration(id: string): Promise<void> {
  const ctx = await requireSession();
  if (ctx.profile.role !== "employee") throw new Error("Nur für Mitarbeiter.");
  const svc = createServiceClient();
  const { data: row } = await svc
    .from("awideogram_generations")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle<{ storage_path: string }>();
  if (row) await svc.storage.from(BUCKET).remove([row.storage_path]);
  await svc.from("awideogram_generations").delete().eq("id", id);
}
