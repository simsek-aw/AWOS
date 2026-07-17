// Server-side client for the Ideogram 4.0 image generation API.
//
// Docs: POST https://api.ideogram.ai/v1/ideogram-v4/generate, auth via the
// "Api-Key" header. Two prompt modes:
//   - text_prompt  → natural language (Magic Prompt on)
//   - json_prompt  → structured contract with explicit layout control
//
// The structured contract (json_prompt) is:
//   {
//     high_level_description: string,
//     style_description: { aesthetics, lighting, medium },
//     compositional_deconstruction: {
//       background: { desc, colors? },
//       elements: [
//         { type: "text", text, desc, bbox?, colors? } |
//         { type: "object", desc, bbox?, colors? }
//       ]
//     }
//   }
// bbox is [y_min, x_min, y_max, x_max] in 0–1000 top-left coordinates.

const API_URL = "https://api.ideogram.ai/v1/ideogram-v4/generate";

export type RenderingSpeed = "TURBO" | "DEFAULT" | "QUALITY";

export type LayoutBox = {
  type: "text" | "object";
  // Fractions of the canvas (0..1): left, top, width, height.
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string; // for text boxes: the literal string to render
  desc?: string; // visual description / styling
  color?: string; // dominant hex for this element
};

export type StudioInput = {
  highLevelDescription: string;
  aesthetics?: string;
  lighting?: string;
  medium?: string;
  backgroundDesc?: string;
  palette?: string[]; // up to 16 image-level hex colors
  aspectRatio: string; // e.g. "1x1", "16x9"
  renderingSpeed: RenderingSpeed;
  boxes: LayoutBox[];
  // Optional style-reference images as data URLs (compressed client-side). When
  // present, Ideogram borrows their look/palette/composition (multipart mode).
  referenceImages?: string[];
};

// Rough position word for a box, so layout intent survives when we fall back to
// a text prompt (multipart / style-reference mode).
function positionWord(b: LayoutBox): string {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const v = cy < 0.34 ? "oben" : cy > 0.66 ? "unten" : "mittig";
  const h = cx < 0.34 ? "links" : cx > 0.66 ? "rechts" : "zentriert";
  return `${v} ${h}`;
}

// Build a natural-language prompt (used in multipart/style-reference mode, where
// the structured json_prompt isn't sent).
function promptFromInput(input: StudioInput): string {
  const parts = [input.highLevelDescription.trim()];
  if (input.boxes.length) {
    const layout = input.boxes
      .map((b) =>
        b.type === "text"
          ? `Text „${b.text ?? ""}" ${positionWord(b)}${b.desc ? ` (${b.desc})` : ""}`
          : `${b.desc || "Objekt"} ${positionWord(b)}`,
      )
      .join("; ");
    parts.push(`Layout: ${layout}.`);
  }
  if (input.backgroundDesc) parts.push(`Hintergrund: ${input.backgroundDesc}.`);
  return parts.join(" ");
}

// Decode a data URL to a Blob for multipart upload.
function dataUrlToBlob(dataUrl: string): Blob | null {
  const m = dataUrl.match(/^data:(.*?);base64,(.*)$/);
  if (!m) return null;
  const [, mime, b64] = m;
  const bytes = Buffer.from(b64, "base64");
  return new Blob([bytes], { type: mime || "image/png" });
}

// Convert a 0..1 box to Ideogram's [y_min, x_min, y_max, x_max] on a 0–1000
// top-left canvas.
function toBbox(b: LayoutBox): [number, number, number, number] {
  const clamp = (n: number) => Math.max(0, Math.min(1000, Math.round(n * 1000)));
  return [clamp(b.y), clamp(b.x), clamp(b.y + b.h), clamp(b.x + b.w)];
}

// Assemble the structured json_prompt from the studio input.
export function buildJsonPrompt(input: StudioInput): Record<string, unknown> {
  const elements = input.boxes.map((b) => {
    if (b.type === "text") {
      const el: Record<string, unknown> = {
        type: "text",
        text: b.text ?? "",
        desc: b.desc || "clean, legible text",
        bbox: toBbox(b),
      };
      if (b.color) el.colors = [b.color];
      return el;
    }
    // Non-text (object/subject): a textual description placed by bbox. Ideogram
    // is text-to-image, so this describes the object in words — it cannot embed
    // an uploaded photo. (Real product photos need a reference-image flow.)
    const el: Record<string, unknown> = {
      desc: b.desc || "object",
      bbox: toBbox(b),
    };
    if (b.color) el.colors = [b.color];
    return el;
  });

  return {
    high_level_description: input.highLevelDescription,
    style_description: {
      aesthetics: input.aesthetics || "clean, modern, professional",
      lighting: input.lighting || "soft, even studio lighting",
      medium: input.medium || "high-quality digital render",
    },
    compositional_deconstruction: {
      // The API expects `background` to be a plain string description.
      background: input.backgroundDesc || "simple, uncluttered background",
      elements,
    },
  };
}

export type IdeogramResult = {
  url: string;
  resolution?: string;
  seed?: number;
};

/**
 * Generate an image with Ideogram 4.0. Throws a friendly error if the API key
 * is missing or the API rejects the request. Returns the hosted image URLs
 * (which the caller should persist, since Ideogram's URLs expire).
 */
export async function generateIdeogram(
  input: StudioInput,
): Promise<{ results: IdeogramResult[]; body: Record<string, unknown> }> {
  const apiKey = process.env.IDEOGRAM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "IDEOGRAM_API_KEY ist nicht gesetzt. Bitte den Ideogram-API-Key als (sensible) Env-Var in Vercel hinterlegen.",
    );
  }

  const hasRef = (input.referenceImages?.length ?? 0) > 0;
  const hasLayout = input.boxes.length > 0;

  let res: Response;
  let body: Record<string, unknown>;

  if (hasRef) {
    // Style-reference mode: multipart form with the reference image(s). The
    // structured json_prompt isn't sent here, so layout intent is folded into
    // the text prompt. Let fetch set the multipart boundary — do NOT set
    // Content-Type manually.
    const prompt = promptFromInput(input);
    const fd = new FormData();
    fd.set("prompt", prompt);
    fd.set("aspect_ratio", input.aspectRatio);
    fd.set("rendering_speed", input.renderingSpeed);
    let n = 0;
    for (const dataUrl of input.referenceImages ?? []) {
      const blob = dataUrlToBlob(dataUrl);
      if (blob) {
        fd.append("style_reference_images", blob, `reference-${n}.png`);
        n++;
      }
    }
    body = {
      mode: "style_reference",
      prompt,
      aspect_ratio: input.aspectRatio,
      rendering_speed: input.renderingSpeed,
      reference_count: n,
    };
    res = await fetch(API_URL, {
      method: "POST",
      headers: { "Api-Key": apiKey },
      body: fd,
    });
  } else {
    body = {
      aspect_ratio: input.aspectRatio,
      rendering_speed: input.renderingSpeed,
    };
    if (hasLayout) {
      // Structured layout control. Magic Prompt MUST stay off or it rewrites
      // the layout into plain text and destroys the bounding boxes.
      body.json_prompt = buildJsonPrompt(input);
      body.expand_prompt = false;
    } else {
      body.text_prompt = input.highLevelDescription;
    }
    res = await fetch(API_URL, {
      method: "POST",
      headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Ideogram-API-Fehler (${res.status}): ${detail.slice(0, 300) || res.statusText}`,
    );
  }

  const raw = await res.text();
  let json: {
    data?: { url?: string; resolution?: string; seed?: number }[];
  };
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`Ideogram-Antwort war kein JSON: ${raw.slice(0, 200)}`);
  }
  const results: IdeogramResult[] = (json.data ?? [])
    .filter((d) => d.url)
    .map((d) => ({ url: d.url!, resolution: d.resolution, seed: d.seed }));
  if (!results.length) {
    // Surface the actual response so we can see the real shape / field names.
    console.error("awideogram: no image in response", raw.slice(0, 500));
    throw new Error(
      `Ideogram-Antwort ohne Bild-URL. Rohantwort: ${raw.slice(0, 300)}`,
    );
  }
  return { results, body };
}
