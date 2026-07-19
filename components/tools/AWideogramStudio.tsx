"use client";

import NextImage from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  deleteGeneration,
  fetchGenerations,
  generateImage,
  type GenerationView,
} from "@/app/(app)/tools/awideogram/actions";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/icons";
import { SectionCard } from "@/components/Section";
import { toast } from "@/components/toast";
import type { RenderingSpeed } from "@/lib/ideogram";

type Box = {
  id: string;
  type: "text" | "object";
  x: number; // 0..1 fractions of the canvas
  y: number;
  w: number;
  h: number;
  text: string;
  desc: string;
  color: string;
};

type Gesture = {
  mode: "draw" | "move" | "resize";
  id: string;
  startX: number;
  startY: number;
  orig: { x: number; y: number; w: number; h: number };
};

const ASPECTS = [
  "1x1",
  "16x9",
  "9x16",
  "4x3",
  "3x4",
  "3x2",
  "2x3",
  "16x10",
  "10x16",
];
const SPEEDS: RenderingSpeed[] = ["TURBO", "DEFAULT", "QUALITY"];

// Quick-start prompt templates for common formats.
const TEMPLATES: { label: string; value: string; aspect?: string }[] = [
  { label: "Vorlage wählen …", value: "" },
  {
    label: "Produkt-Ad (minimal, weiß)",
    value:
      "minimalistische Produkt-Anzeige auf weißem Hintergrund, klare Typografie, viel Weißraum, Apple-Stil, fotorealistisch",
    aspect: "1x1",
  },
  {
    label: "Sale-Poster",
    value:
      "auffälliges Sale-Poster, große fette Typografie, kräftige Farben, moderner Rabatt-Look",
    aspect: "4x3",
  },
  {
    label: "Social-Media-Story",
    value:
      "vertikale Social-Media-Story, moderne Ästhetik, Platz für Text oben, Produkt mittig",
    aspect: "9x16",
  },
  {
    label: "Event-Ankündigung",
    value:
      "elegante Event-Ankündigung, Datum und Titel prominent, hochwertige Typografie",
    aspect: "16x9",
  },
];
const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));

export default function AWideogramStudio({
  initial,
  hasKey,
}: {
  initial: GenerationView[];
  hasKey: boolean;
}) {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GenerationView[]>(initial);
  const [busy, setBusy] = useState(false);
  // Gallery search / filter / paging.
  const GAL_PAGE = 24;
  const [galQ, setGalQ] = useState("");
  const [galMine, setGalMine] = useState(false);
  const [galHasMore, setGalHasMore] = useState(initial.length >= GAL_PAGE);
  const [galLoading, setGalLoading] = useState(false);
  const galInit = useRef(true);

  // Prompt / style state.
  const [hld, setHld] = useState("");
  const [aesthetics, setAesthetics] = useState("");
  const [lighting, setLighting] = useState("");
  const [medium, setMedium] = useState("");
  const [background, setBackground] = useState("");
  const [palette, setPalette] = useState("");
  const [aspect, setAspect] = useState("1x1");
  const [speed, setSpeed] = useState<RenderingSpeed>("DEFAULT");
  const [count, setCount] = useState(1);
  // Style-reference images as compressed data URLs (max 3).
  const [refs, setRefs] = useState<string[]>([]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);

  // Persist the working draft across refreshes (per device).
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("awideogram-draft");
      if (raw) {
        const d = JSON.parse(raw);
        if (typeof d.hld === "string") setHld(d.hld);
        if (typeof d.aesthetics === "string") setAesthetics(d.aesthetics);
        if (typeof d.lighting === "string") setLighting(d.lighting);
        if (typeof d.medium === "string") setMedium(d.medium);
        if (typeof d.background === "string") setBackground(d.background);
        if (typeof d.palette === "string") setPalette(d.palette);
        if (typeof d.aspect === "string") setAspect(d.aspect);
        if (typeof d.speed === "string") setSpeed(d.speed);
        if (Array.isArray(d.boxes)) setBoxes(d.boxes);
        if (Array.isArray(d.refs)) setRefs(d.refs);
      }
    } catch {
      /* ignore */
    }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    const base = {
      hld,
      aesthetics,
      lighting,
      medium,
      background,
      palette,
      aspect,
      speed,
      boxes,
    };
    try {
      localStorage.setItem(
        "awideogram-draft",
        JSON.stringify({ ...base, refs }),
      );
    } catch {
      // Reference images can blow the quota — fall back to saving without them.
      try {
        localStorage.setItem("awideogram-draft", JSON.stringify(base));
      } catch {
        /* ignore */
      }
    }
  }, [hld, aesthetics, lighting, medium, background, palette, aspect, speed, boxes, refs]);

  const selected = boxes.find((b) => b.id === selectedId) ?? null;
  const patch = (id: string, p: Partial<Box>) =>
    setBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, ...p } : b)));

  const frac = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: clamp((clientX - r.left) / r.width),
      y: clamp((clientY - r.top) / r.height),
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const g = gesture.current;
      if (!g) return;
      const p = frac(e.clientX, e.clientY);
      if (g.mode === "draw") {
        patch(g.id, {
          x: Math.min(g.startX, p.x),
          y: Math.min(g.startY, p.y),
          w: Math.abs(p.x - g.startX),
          h: Math.abs(p.y - g.startY),
        });
      } else if (g.mode === "move") {
        const dx = p.x - g.startX;
        const dy = p.y - g.startY;
        patch(g.id, {
          x: clamp(g.orig.x + dx, 0, 1 - g.orig.w),
          y: clamp(g.orig.y + dy, 0, 1 - g.orig.h),
        });
      } else if (g.mode === "resize") {
        patch(g.id, {
          w: clamp(p.x - g.orig.x, 0.03, 1 - g.orig.x),
          h: clamp(p.y - g.orig.y, 0.03, 1 - g.orig.y),
        });
      }
    };
    const onUp = () => {
      const g = gesture.current;
      gesture.current = null;
      if (g?.mode === "draw") {
        // Drop boxes that were basically just a click.
        setBoxes((prev) =>
          prev.filter((b) => b.id !== g.id || (b.w > 0.03 && b.h > 0.03)),
        );
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startDraw = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current) return; // only on empty canvas
    const p = frac(e.clientX, e.clientY);
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Math.random());
    const nb: Box = {
      id,
      type: "text",
      x: p.x,
      y: p.y,
      w: 0,
      h: 0,
      text: "Text",
      desc: "",
      color: "",
    };
    setBoxes((prev) => [...prev, nb]);
    setSelectedId(id);
    gesture.current = {
      mode: "draw",
      id,
      startX: p.x,
      startY: p.y,
      orig: { x: p.x, y: p.y, w: 0, h: 0 },
    };
  };

  const startMove = (e: React.MouseEvent, b: Box) => {
    e.stopPropagation();
    setSelectedId(b.id);
    const p = frac(e.clientX, e.clientY);
    gesture.current = {
      mode: "move",
      id: b.id,
      startX: p.x,
      startY: p.y,
      orig: { x: b.x, y: b.y, w: b.w, h: b.h },
    };
  };

  const startResize = (e: React.MouseEvent, b: Box) => {
    e.stopPropagation();
    setSelectedId(b.id);
    gesture.current = {
      mode: "resize",
      id: b.id,
      startX: b.x,
      startY: b.y,
      orig: { x: b.x, y: b.y, w: b.w, h: b.h },
    };
  };

  const removeBox = (id: string) => {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // Downscale a reference image client-side to keep the upload small.
  const compress = (file: File | Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1280;
        let { width, height } = img;
        if (width > max || height > max) {
          const s = Math.min(max / width, max / height);
          width = Math.round(width * s);
          height = Math.round(height * s);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        URL.revokeObjectURL(url);
        if (!ctx) return reject(new Error("no canvas"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Bild konnte nicht gelesen werden"));
      };
      img.src = url;
    });

  const addRefs = async (files: FileList | null) => {
    if (!files) return;
    const slots = 3 - refs.length;
    const chosen = Array.from(files).slice(0, Math.max(0, slots));
    const out: string[] = [];
    for (const f of chosen) {
      try {
        out.push(await compress(f));
      } catch {
        toast("Ein Referenzbild konnte nicht verarbeitet werden.");
      }
    }
    if (out.length) setRefs((prev) => [...prev, ...out].slice(0, 3));
  };

  // Reuse a generated gallery image as a style reference.
  const applyAsReference = async (url: string) => {
    if (refs.length >= 3) {
      toast("Maximal 3 Referenzbilder.");
      return;
    }
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const dataUrl = await compress(blob);
      setRefs((prev) => [...prev, dataUrl].slice(0, 3));
      toast("Als Referenz übernommen");
    } catch {
      toast("Bild konnte nicht als Referenz übernommen werden.");
    }
  };

  const generate = async () => {
    if (!hld.trim()) {
      toast("Bitte eine Bildbeschreibung eingeben.");
      return;
    }
    setBusy(true);
    try {
      const { images, error } = await generateImage({
        highLevelDescription: hld.trim(),
        aesthetics: aesthetics.trim() || undefined,
        lighting: lighting.trim() || undefined,
        medium: medium.trim() || undefined,
        backgroundDesc: background.trim() || undefined,
        palette: palette
          .split(/[,\s]+/)
          .map((s) => s.trim())
          .filter((s) => /^#?[0-9a-fA-F]{3,8}$/.test(s))
          .map((s) => (s.startsWith("#") ? s : `#${s}`)),
        aspectRatio: aspect,
        renderingSpeed: speed,
        referenceImages: refs,
        boxes: boxes.map((b) => ({
          type: b.type,
          x: b.x,
          y: b.y,
          w: b.w,
          h: b.h,
          text: b.type === "text" ? b.text : undefined,
          desc: b.desc || undefined,
          color: b.color || undefined,
        })),
      }, count);
      // Show any produced images even on partial failure, then surface the error.
      if (images.length) setGallery((prev) => [...images, ...prev]);
      if (error) {
        toast(
          images.length
            ? `${images.length} erstellt · Hinweis: ${error}`
            : error,
        );
      } else {
        toast(`${images.length} Bild${images.length > 1 ? "er" : ""} erstellt`);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Generierung fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    setGallery((prev) => prev.filter((g) => g.id !== id));
    try {
      await deleteGeneration(id);
    } catch {
      toast("Löschen fehlgeschlagen");
    }
  };

  // Refetch the first gallery page when the search term or "mine" filter change.
  useEffect(() => {
    // Skip the very first run — `initial` is already the first page.
    if (galInit.current) {
      galInit.current = false;
      return;
    }
    let active = true;
    setGalLoading(true);
    const t = setTimeout(async () => {
      try {
        const { items, hasMore } = await fetchGenerations({
          q: galQ,
          mine: galMine,
          offset: 0,
          limit: GAL_PAGE,
        });
        if (active) {
          setGallery(items);
          setGalHasMore(hasMore);
        }
      } finally {
        if (active) setGalLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galQ, galMine]);

  const loadMore = async () => {
    setGalLoading(true);
    try {
      const { items, hasMore } = await fetchGenerations({
        q: galQ,
        mine: galMine,
        offset: gallery.length,
        limit: GAL_PAGE,
      });
      setGallery((prev) => [...prev, ...items]);
      setGalHasMore(hasMore);
    } finally {
      setGalLoading(false);
    }
  };

  const [rw, rh] = aspect.split("x").map(Number);

  return (
    <div className="page-enter page-pad" style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 26 }}>🖼️</span>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>AWideogram</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "2px 0 0" }}>
            Bildgenerierung mit Layout-Kontrolle (Ideogram 4.0). Ziehe Kästen auf
            die Fläche und weise ihnen Text/Objekte zu.
          </p>
        </div>
      </div>

      {!hasKey && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--danger-bg)",
            color: "var(--danger)",
            fontSize: 13,
          }}
        >
          Kein <strong>IDEOGRAM_API_KEY</strong> gesetzt — Generierung ist erst
          aktiv, sobald der Key als sensible Env-Var in Vercel hinterlegt ist.
        </div>
      )}

      <div
        className="awideogram-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: 20,
          marginTop: 18,
          alignItems: "start",
        }}
      >
        {/* Canvas editor */}
        <div>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            <Field label="Format">
              <select
                value={aspect}
                onChange={(e) => setAspect(e.target.value)}
                style={inputStyle}
              >
                {ASPECTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Qualität">
              <select
                value={speed}
                onChange={(e) => setSpeed(e.target.value as RenderingSpeed)}
                style={inputStyle}
              >
                {SPEEDS.map((s) => (
                  <option key={s} value={s}>
                    {s === "TURBO"
                      ? "Turbo (schnell)"
                      : s === "QUALITY"
                        ? "Qualität"
                        : "Standard"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Anzahl">
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                style={inputStyle}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} Variante{n > 1 ? "n" : ""}
                  </option>
                ))}
              </select>
            </Field>
            {boxes.length > 0 && (
              <button
                onClick={() => {
                  setBoxes([]);
                  setSelectedId(null);
                }}
                style={{ ...ghostBtn, alignSelf: "flex-end" }}
              >
                Layout leeren
              </button>
            )}
          </div>

          <div
            ref={canvasRef}
            onMouseDown={startDraw}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 640,
              aspectRatio: `${rw} / ${rh}`,
              background:
                "repeating-linear-gradient(0deg, var(--surface-2) 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, var(--surface-2) 0 1px, transparent 1px 40px), var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              overflow: "hidden",
              cursor: "crosshair",
              userSelect: "none",
            }}
          >
            {boxes.map((b) => {
              const isSel = b.id === selectedId;
              const col = b.color || (b.type === "text" ? "#579bfc" : "#00c875");
              return (
                <div
                  key={b.id}
                  onMouseDown={(e) => startMove(e, b)}
                  style={{
                    position: "absolute",
                    left: `${b.x * 100}%`,
                    top: `${b.y * 100}%`,
                    width: `${b.w * 100}%`,
                    height: `${b.h * 100}%`,
                    border: `2px solid ${col}`,
                    background: col + "22",
                    borderRadius: 4,
                    boxShadow: isSel ? `0 0 0 2px ${col}` : undefined,
                    cursor: "move",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    fontSize: 12,
                    color: "var(--text)",
                    padding: 4,
                  }}
                >
                  <span
                    style={{
                      pointerEvents: "none",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontWeight: 600,
                    }}
                  >
                    {b.type === "text" ? b.text || "Text" : b.desc || "Objekt"}
                  </span>
                  {isSel && (
                    <span
                      onMouseDown={(e) => startResize(e, b)}
                      style={{
                        position: "absolute",
                        right: -6,
                        bottom: -6,
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: col,
                        cursor: "nwse-resize",
                        border: "2px solid var(--surface)",
                      }}
                    />
                  )}
                </div>
              );
            })}
            {boxes.length === 0 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--faint)",
                  fontSize: 13,
                  pointerEvents: "none",
                }}
              >
                Kasten aufziehen für Text/Objekt-Platzierung (optional)
              </div>
            )}
          </div>
          <p style={{ color: "var(--faint)", fontSize: 12, marginTop: 8 }}>
            Ohne Kästen wird rein aus der Beschreibung generiert. Mit Kästen wird
            die Position exakt vorgegeben (Layout Control).
          </p>
        </div>

        {/* Settings panel */}
        <div style={{ display: "grid", gap: 12 }}>
          <Field label="Vorlage">
            <select
              value=""
              onChange={(e) => {
                const t = TEMPLATES.find((x) => x.value === e.target.value);
                if (t?.value) {
                  setHld(t.value);
                  if (t.aspect) setAspect(t.aspect);
                }
              }}
              style={inputStyle}
            >
              {TEMPLATES.map((t) => (
                <option key={t.label} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bildbeschreibung *">
            <textarea
              value={hld}
              onChange={(e) => setHld(e.target.value)}
              rows={3}
              placeholder="z. B. Sommer-Sale-Poster für eine Reise-Marke"
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
            />
          </Field>

          {selected ? (
            <div
              style={{
                border: "1px solid var(--accent)",
                borderRadius: 10,
                padding: 10,
                display: "grid",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <strong style={{ fontSize: 13 }}>Ausgewählter Kasten</strong>
                <button
                  onClick={() => removeBox(selected.id)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--danger)",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Entfernen
                </button>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["text", "object"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => patch(selected.id, { type: t })}
                    style={{
                      ...ghostBtn,
                      flex: 1,
                      background:
                        selected.type === t ? "var(--active)" : "transparent",
                      color:
                        selected.type === t ? "var(--text)" : "var(--muted)",
                    }}
                  >
                    {t === "text" ? "Text" : "Objekt"}
                  </button>
                ))}
              </div>
              {selected.type === "text" && (
                <Field label="Text im Bild">
                  <input
                    value={selected.text}
                    onChange={(e) => patch(selected.id, { text: e.target.value })}
                    placeholder="z. B. -50%"
                    style={inputStyle}
                  />
                </Field>
              )}
              <Field label="Beschreibung / Stil">
                <input
                  value={selected.desc}
                  onChange={(e) => patch(selected.id, { desc: e.target.value })}
                  placeholder={
                    selected.type === "text"
                      ? "fette serifenlose Schrift, weiß"
                      : "minimalistischer Alu-Bleistift, grau, edel"
                  }
                  style={inputStyle}
                />
              </Field>
              {selected.type === "object" && (
                <p style={{ fontSize: 11, color: "var(--faint)", margin: 0 }}>
                  Objekt wird aus deiner Beschreibung generiert (Text-zu-Bild) —
                  <strong> kein Bild-Upload/Link</strong>. Echte Produktfotos
                  einsetzen kommt später über Referenzbilder.
                </p>
              )}
              <Field label="Farbe (optional)">
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="color"
                    value={selected.color || "#579bfc"}
                    onChange={(e) => patch(selected.id, { color: e.target.value })}
                    style={{
                      width: 36,
                      height: 30,
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  />
                  {selected.color && (
                    <button
                      onClick={() => patch(selected.id, { color: "" })}
                      style={{ ...ghostBtn, padding: "5px 8px" }}
                    >
                      zurücksetzen
                    </button>
                  )}
                </div>
              </Field>
            </div>
          ) : (
            <details>
              <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--muted)" }}>
                Stil &amp; Hintergrund (optional)
              </summary>
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                <Field label="Ästhetik">
                  <input value={aesthetics} onChange={(e) => setAesthetics(e.target.value)} placeholder="clean, modern" style={inputStyle} />
                </Field>
                <Field label="Licht">
                  <input value={lighting} onChange={(e) => setLighting(e.target.value)} placeholder="weiches Studiolicht" style={inputStyle} />
                </Field>
                <Field label="Medium">
                  <input value={medium} onChange={(e) => setMedium(e.target.value)} placeholder="Fotografie / 3D-Render" style={inputStyle} />
                </Field>
                <Field label="Hintergrund">
                  <input value={background} onChange={(e) => setBackground(e.target.value)} placeholder="schlichter Farbverlauf" style={inputStyle} />
                </Field>
                <Field label="Farbpalette (Hex, kommagetrennt)">
                  <input value={palette} onChange={(e) => setPalette(e.target.value)} placeholder="#0a2540, #ff7a00" style={inputStyle} />
                </Field>
              </div>
            </details>
          )}

          {/* Style-reference images */}
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 10,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              Referenzbild (Style) — bis 3
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {refs.map((src, i) => (
                <div key={i} style={{ position: "relative" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Referenz ${i + 1}`}
                    style={{
                      width: 56,
                      height: 56,
                      objectFit: "cover",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  />
                  <button
                    onClick={() => setRefs((p) => p.filter((_, idx) => idx !== i))}
                    title="Entfernen"
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "var(--danger)",
                      color: "#fff",
                      border: "2px solid var(--surface)",
                      cursor: "pointer",
                      fontSize: 11,
                      lineHeight: 1,
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {refs.length < 3 && (
                <label
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 8,
                    border: "1px dashed var(--border)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "var(--muted)",
                    fontSize: 22,
                  }}
                  title="Referenzbild hinzufügen"
                >
                  +
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={(e) => {
                      addRefs(e.target.files);
                      e.target.value = "";
                    }}
                    style={{ display: "none" }}
                  />
                </label>
              )}
            </div>
            {refs.length > 0 && (
              <p style={{ fontSize: 11, color: "var(--faint)", margin: 0 }}>
                Look, Farben und Komposition des Referenzbildes werden
                übernommen. In diesem Modus steuert die Beschreibung das Layout
                (die Kästen fließen als Text ein).
              </p>
            )}
          </div>

          <button
            onClick={generate}
            disabled={busy}
            className={busy ? undefined : "glow-hover"}
            style={{
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              fontWeight: 700,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Icon name="sparkles" size={16} />
            {busy ? "Generiere…" : "Bild generieren"}
          </button>
          {busy && (
            <div
              className="brand-progress"
              style={{ marginTop: 12 }}
              role="progressbar"
              aria-label="Bild wird generiert"
            />
          )}
        </div>
      </div>

      {/* Gallery */}
      <SectionCard
        title="Galerie"
        icon={<Icon name="grid" size={16} />}
        bodyGap={12}
        style={{ marginTop: 24 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <input
            value={galQ}
            onChange={(e) => setGalQ(e.target.value)}
            placeholder="Galerie durchsuchen …"
            style={{ ...inputStyle, maxWidth: 220 }}
          />
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "var(--muted)",
            }}
          >
            <input
              type="checkbox"
              checked={galMine}
              onChange={(e) => setGalMine(e.target.checked)}
            />
            Nur meine
          </label>
          {galLoading && (
            <span style={{ color: "var(--faint)", fontSize: 12 }}>lädt …</span>
          )}
        </div>
      {gallery.length === 0 ? (
        galQ || galMine ? (
          <EmptyState variant="search" compact title="Keine Treffer" />
        ) : (
          <EmptyState
            variant="inbox"
            compact
            title="Noch keine Bilder"
            hint="Erstelle links dein erstes Bild – es erscheint dann hier."
          />
        )
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {gallery.map((g) => (
            <div
              key={g.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                overflow: "hidden",
                background: "var(--surface)",
              }}
            >
              <a
                href={g.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  position: "relative",
                  display: "block",
                  width: "100%",
                  aspectRatio: "1 / 1",
                }}
              >
                <NextImage
                  src={g.url}
                  alt={g.highLevelDescription ?? "AWideogram"}
                  fill
                  sizes="(max-width: 600px) 50vw, 220px"
                  style={{ objectFit: "cover" }}
                />
              </a>
              <div style={{ padding: "8px 10px", display: "flex", gap: 8, alignItems: "center" }}>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 12,
                    color: "var(--muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={g.highLevelDescription ?? ""}
                >
                  {g.highLevelDescription ?? "—"}
                </span>
                <button
                  onClick={() => applyAsReference(g.url)}
                  title="Als Referenz übernehmen"
                  aria-label="Als Referenz übernehmen"
                  style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", display: "inline-flex" }}
                >
                  <Icon name="copy" size={15} />
                </button>
                <a
                  href={g.url}
                  download
                  title="Herunterladen"
                  aria-label="Bild herunterladen"
                  style={{ color: "var(--muted)", display: "inline-flex" }}
                >
                  <Icon name="external" size={15} />
                </a>
                <button
                  onClick={() => onDelete(g.id)}
                  title="Löschen"
                  aria-label="Bild löschen"
                  style={{ background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer", display: "inline-flex" }}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {galHasMore && (
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button onClick={loadMore} disabled={galLoading} style={ghostBtn}>
            {galLoading ? "Lädt …" : "Mehr laden"}
          </button>
        </div>
      )}
      </SectionCard>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--muted)" }}>
      {label}
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--input-bg)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 10px",
  color: "var(--text)",
  fontSize: 13,
};

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "7px 10px",
  color: "var(--muted)",
  fontSize: 13,
  cursor: "pointer",
};
