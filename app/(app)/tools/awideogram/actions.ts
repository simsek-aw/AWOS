"use server";

import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
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
  count = 1,
): Promise<{ images: GenerationView[]; error: string | null }> {
  try {
    const ctx = await requireSession();
    if (ctx.profile.role !== "employee")
      return { images: [], error: "Nur für Mitarbeiter." };
    if (!input.highLevelDescription?.trim())
      return { images: [], error: "Bitte eine Bildbeschreibung angeben." };

    // Validate reference images server-side (never trust the client): only real
    // PNG/JPEG/WebP data URLs, each under 10 MB decoded.
    const MAX_REF_BYTES = 10 * 1024 * 1024;
    for (const du of input.referenceImages ?? []) {
      const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
        du,
      );
      if (!m)
        return {
          images: [],
          error: "Referenzbild: nur PNG, JPEG oder WebP erlaubt.",
        };
      if (Math.floor((m[2].length * 3) / 4) > MAX_REF_BYTES)
        return { images: [], error: "Referenzbild ist zu groß (max 10 MB)." };
    }

    const svc = createServiceClient();
    const rounds = Math.max(1, Math.min(4, Math.round(count)));

    // Per-user daily cap to protect the Ideogram credit budget.
    const DAILY_LIMIT = Number(process.env.AWIDEOGRAM_DAILY_LIMIT ?? 100);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: usedToday } = await svc
      .from("awideogram_generations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId)
      .gte("created_at", since);
    if ((usedToday ?? 0) + rounds > DAILY_LIMIT)
      return {
        images: [],
        error: `Tageslimit erreicht (${DAILY_LIMIT} Bilder/24 h). Bitte später erneut versuchen.`,
      };

    // Persist one Ideogram result to storage + DB, returning a display view or
    // an error string.
    const store = async (
      r: { url: string },
      body: Record<string, unknown>,
    ): Promise<{ view?: GenerationView; error?: string }> => {
      const imgRes = await fetch(r.url);
      if (!imgRes.ok)
        return { error: `Bild-Download fehlgeschlagen (${imgRes.status}).` };
      const bytes = new Uint8Array(await imgRes.arrayBuffer());
      const path = `${ctx.userId}/${crypto.randomUUID()}.png`;
      const { error: upErr } = await svc.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: "image/png", upsert: false });
      if (upErr)
        return {
          error: `Storage-Upload fehlgeschlagen: ${upErr.message} (Bucket 'awideogram' angelegt?)`,
        };
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
        return { error: `DB-Eintrag fehlgeschlagen: ${insErr?.message ?? "?"}` };
      const { data: signed, error: signErr } = await svc.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_TTL);
      if (signErr || !signed?.signedUrl)
        return { error: `Signed-URL fehlgeschlagen: ${signErr?.message ?? "?"}` };
      return {
        view: {
          id: row.id,
          url: signed.signedUrl,
          highLevelDescription: input.highLevelDescription,
          createdAt: row.created_at,
        },
      };
    };

    const images: GenerationView[] = [];
    let lastError: string | null = null;
    // Each round is a fresh call → a distinct variation.
    for (let i = 0; i < rounds; i++) {
      let results: { url: string }[];
      let body: Record<string, unknown>;
      try {
        const g = await generateIdeogram(input);
        results = g.results;
        body = g.body;
      } catch (e) {
        lastError = e instanceof Error ? e.message : "Generierung fehlgeschlagen.";
        break; // stop the batch on an API error (e.g. out of credits)
      }
      for (const r of results) {
        const { view, error } = await store(r, body);
        if (view) images.push(view);
        else if (error) lastError = error;
      }
    }

    if (!images.length)
      return { images: [], error: lastError ?? "Ideogram lieferte keine Bilder zurück." };
    await logAudit({
      actorId: ctx.userId,
      action: "awideogram.generate",
      entity: "awideogram",
      summary: `${images.length} Bild(er) generiert${input.referenceImages?.length ? " (mit Referenz)" : ""}`,
    });
    // Partial success: return what we have, but surface the last issue.
    return { images, error: lastError };
  } catch (e) {
    console.error("awideogram: generateImage failed", e);
    return {
      images: [],
      error: e instanceof Error ? e.message : "Generierung fehlgeschlagen.",
    };
  }
}

type GenRow = {
  id: string;
  storage_path: string;
  high_level_description: string | null;
  created_at: string;
};

// Batch-sign a set of rows into display views.
async function signRows(
  svc: ReturnType<typeof createServiceClient>,
  rows: GenRow[],
): Promise<GenerationView[]> {
  if (!rows.length) return [];
  const { data: signedList } = await svc.storage
    .from(BUCKET)
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      SIGNED_TTL,
    );
  const urlByPath = new Map(
    (signedList ?? [])
      .filter((s) => s.signedUrl && s.path)
      .map((s) => [s.path as string, s.signedUrl]),
  );
  return rows
    .map((r) => {
      const url = urlByPath.get(r.storage_path);
      return url
        ? {
            id: r.id,
            url,
            highLevelDescription: r.high_level_description,
            createdAt: r.created_at,
          }
        : null;
    })
    .filter((x): x is GenerationView => x !== null);
}

/**
 * Gallery query with search, "mine only" filter and offset paging. Returns the
 * page plus whether more exist.
 */
export async function fetchGenerations(opts: {
  q?: string;
  mine?: boolean;
  offset?: number;
  limit?: number;
} = {}): Promise<{ items: GenerationView[]; hasMore: boolean }> {
  const ctx = await requireSession();
  const limit = Math.min(48, Math.max(1, opts.limit ?? 24));
  const offset = Math.max(0, opts.offset ?? 0);
  const svc = createServiceClient();
  let query = svc
    .from("awideogram_generations")
    .select("id, storage_path, high_level_description, created_at")
    .order("created_at", { ascending: false })
    // fetch one extra to detect whether there's another page
    .range(offset, offset + limit);
  if (opts.mine) query = query.eq("user_id", ctx.userId);
  const q = (opts.q ?? "").replace(/[%_(),]/g, " ").trim();
  if (q) query = query.ilike("high_level_description", `%${q}%`);

  const { data, error } = await query.returns<GenRow[]>();
  if (error) {
    console.error("awideogram: fetchGenerations error", error);
    return { items: [], hasMore: false };
  }
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const items = await signRows(svc, rows.slice(0, limit));
  return { items, hasMore };
}

/** Recent generations for the initial gallery load. */
export async function listGenerations(limit = 24): Promise<GenerationView[]> {
  const { items } = await fetchGenerations({ limit });
  return items;
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
