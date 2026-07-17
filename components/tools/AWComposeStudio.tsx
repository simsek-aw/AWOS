"use client";

import NextImage from "next/image";
import { useEffect, useRef, useState } from "react";
import { saveComposite } from "@/app/(app)/tools/awcompose/actions";
import Icon from "@/components/icons";
import { toast } from "@/components/toast";

const DISPLAY_W = 600; // fixed display width; all layer coords live in this space

type Bg = { src: string; natW: number; natH: number };
type Layer = {
  id: string;
  origSrc: string; // untouched upload
  src: string; // displayed (possibly white-removed)
  x: number; // center, px in display space
  y: number;
  w: number; // px in display space
  ratio: number; // natW / natH
  rotation: number; // deg
  opacity: number; // 0..1
  flip: boolean;
  whiteRemoved: boolean;
};

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Math.random());

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
    img.src = src;
  });
}
function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    r.readAsDataURL(file);
  });
}
async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return fileToDataUrl(blob);
}
async function removeWhite(src: string, threshold = 238): Promise<string> {
  const img = await loadImage(src);
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i] > threshold && p[i + 1] > threshold && p[i + 2] > threshold)
      p[i + 3] = 0;
  }
  ctx.putImageData(d, 0, 0);
  return c.toDataURL("image/png");
}

export default function AWComposeStudio({
  backgrounds,
}: {
  backgrounds: { id: string; url: string }[];
}) {
  const [bg, setBg] = useState<Bg | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [desc, setDesc] = useState("");
  const drag = useRef<
    null | { id: string; sx: number; sy: number; ox: number; oy: number }
  >(null);

  const selected = layers.find((l) => l.id === selectedId) ?? null;
  const displayH = bg ? Math.round(DISPLAY_W * (bg.natH / bg.natW)) : 380;
  const patch = (id: string, p: Partial<Layer>) =>
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...p } : l)));

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const g = drag.current;
      if (!g) return;
      patch(g.id, {
        x: g.ox + (e.clientX - g.sx),
        y: g.oy + (e.clientY - g.sy),
      });
    };
    const onUp = () => {
      drag.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const setBackgroundFromDataUrl = async (dataUrl: string) => {
    try {
      const img = await loadImage(dataUrl);
      setBg({ src: dataUrl, natW: img.naturalWidth, natH: img.naturalHeight });
    } catch {
      toast("Hintergrund konnte nicht geladen werden.");
    }
  };

  const onBgUpload = async (file: File | undefined) => {
    if (!file) return;
    await setBackgroundFromDataUrl(await fileToDataUrl(file));
  };
  const onPickBackground = async (url: string) => {
    try {
      await setBackgroundFromDataUrl(await urlToDataUrl(url));
    } catch {
      toast("Hintergrund konnte nicht übernommen werden.");
    }
  };

  const addForeground = async (file: File | undefined) => {
    if (!file) return;
    try {
      const src = await fileToDataUrl(file);
      const img = await loadImage(src);
      const ratio = img.naturalWidth / Math.max(1, img.naturalHeight);
      const id = uid();
      setLayers((prev) => [
        ...prev,
        {
          id,
          origSrc: src,
          src,
          x: DISPLAY_W / 2,
          y: displayH / 2,
          w: DISPLAY_W * 0.4,
          ratio,
          rotation: 0,
          opacity: 1,
          flip: false,
          whiteRemoved: false,
        },
      ]);
      setSelectedId(id);
    } catch {
      toast("Produktbild konnte nicht geladen werden.");
    }
  };

  const toggleWhite = async (l: Layer) => {
    if (l.whiteRemoved) {
      patch(l.id, { src: l.origSrc, whiteRemoved: false });
    } else {
      try {
        const out = await removeWhite(l.origSrc);
        patch(l.id, { src: out, whiteRemoved: true });
      } catch {
        toast("Freistellen fehlgeschlagen.");
      }
    }
  };

  const move = (id: string, dir: -1 | 1) =>
    setLayers((prev) => {
      const i = prev.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const remove = (id: string) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const buildExport = async (): Promise<string | null> => {
    if (!bg) return null;
    const cap = 2048;
    const scale = Math.min(1, cap / Math.max(bg.natW, bg.natH));
    const outW = Math.round(bg.natW * scale);
    const outH = Math.round(bg.natH * scale);
    const sf = outW / DISPLAY_W;
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const bgImg = await loadImage(bg.src);
    ctx.drawImage(bgImg, 0, 0, outW, outH);
    for (const l of layers) {
      const img = await loadImage(l.src);
      const w = l.w * sf;
      const h = (l.w / l.ratio) * sf;
      ctx.save();
      ctx.translate(l.x * sf, l.y * sf);
      ctx.rotate((l.rotation * Math.PI) / 180);
      ctx.scale(l.flip ? -1 : 1, 1);
      ctx.globalAlpha = l.opacity;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    return canvas.toDataURL("image/png");
  };

  const download = async () => {
    const url = await buildExport();
    if (!url) {
      toast("Bitte zuerst einen Hintergrund wählen.");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = "awcompose.png";
    a.click();
  };

  const save = async () => {
    const url = await buildExport();
    if (!url) {
      toast("Bitte zuerst einen Hintergrund wählen.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await saveComposite(url, desc);
      toast(error ?? "In Galerie gespeichert");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 26 }}>🧩</span>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>AWcompose</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "2px 0 0" }}>
            Produktfoto exakt auf einen Hintergrund montieren. Hintergrund wählen,
            Produktbild hinzufügen, positionieren, exportieren.
          </p>
        </div>
      </div>

      <div
        className="awcompose-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 320px",
          gap: 20,
          marginTop: 18,
          alignItems: "start",
        }}
      >
        {/* Canvas */}
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <label style={btn}>
              Hintergrund hochladen
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  onBgUpload(e.target.files?.[0]);
                  e.target.value = "";
                }}
                style={{ display: "none" }}
              />
            </label>
            <label style={btn}>
              + Produktbild
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  addForeground(e.target.files?.[0]);
                  e.target.value = "";
                }}
                style={{ display: "none" }}
              />
            </label>
          </div>

          <div style={{ overflow: "auto" }}>
            <div
              style={{
                position: "relative",
                width: DISPLAY_W,
                height: displayH,
                borderRadius: 10,
                border: "1px solid var(--border)",
                overflow: "hidden",
                background: bg
                  ? undefined
                  : "repeating-conic-gradient(var(--surface-2) 0% 25%, var(--surface) 0% 50%) 50% / 24px 24px",
              }}
            >
              {bg && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bg.src}
                  alt="Hintergrund"
                  draggable={false}
                  style={{ width: "100%", height: "100%", objectFit: "cover", userSelect: "none" }}
                />
              )}
              {!bg && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--faint)",
                    fontSize: 13,
                  }}
                >
                  Hintergrund hochladen oder unten aus AWideogram wählen
                </div>
              )}
              {layers.map((l) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={l.id}
                  src={l.src}
                  alt="Layer"
                  draggable={false}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSelectedId(l.id);
                    drag.current = {
                      id: l.id,
                      sx: e.clientX,
                      sy: e.clientY,
                      ox: l.x,
                      oy: l.y,
                    };
                  }}
                  style={{
                    position: "absolute",
                    left: l.x,
                    top: l.y,
                    width: l.w,
                    height: l.w / l.ratio,
                    transform: `translate(-50%, -50%) rotate(${l.rotation}deg) scaleX(${l.flip ? -1 : 1})`,
                    opacity: l.opacity,
                    cursor: "move",
                    outline:
                      selectedId === l.id ? "2px solid var(--accent)" : "none",
                    userSelect: "none",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Background picker from AWideogram */}
          {backgrounds.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
                Aus AWideogram als Hintergrund
              </div>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                {backgrounds.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => onPickBackground(b.url)}
                    title="Als Hintergrund"
                    style={{
                      flexShrink: 0,
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: 0,
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <NextImage
                      src={b.url}
                      alt="AWideogram"
                      width={64}
                      height={64}
                      style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 7, display: "block" }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Panel */}
        <div style={{ display: "grid", gap: 12 }}>
          {selected ? (
            <div style={{ border: "1px solid var(--accent)", borderRadius: 10, padding: 12, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: 13 }}>Ausgewähltes Bild</strong>
                <button onClick={() => remove(selected.id)} style={{ background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 13 }}>
                  Entfernen
                </button>
              </div>
              <Slider label={`Größe ${Math.round((selected.w / DISPLAY_W) * 100)}%`} min={5} max={150} value={Math.round((selected.w / DISPLAY_W) * 100)} onChange={(v) => patch(selected.id, { w: (v / 100) * DISPLAY_W })} />
              <Slider label={`Drehung ${selected.rotation}°`} min={-180} max={180} value={selected.rotation} onChange={(v) => patch(selected.id, { rotation: v })} />
              <Slider label={`Deckkraft ${Math.round(selected.opacity * 100)}%`} min={0} max={100} value={Math.round(selected.opacity * 100)} onChange={(v) => patch(selected.id, { opacity: v / 100 })} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => patch(selected.id, { flip: !selected.flip })} style={chip(selected.flip)}>Spiegeln</button>
                <button onClick={() => toggleWhite(selected)} style={chip(selected.whiteRemoved)}>Weiß entfernen</button>
                <button onClick={() => move(selected.id, 1)} style={chip(false)}>Nach vorne</button>
                <button onClick={() => move(selected.id, -1)} style={chip(false)}>Nach hinten</button>
              </div>
              <p style={{ fontSize: 11, color: "var(--faint)", margin: 0 }}>
                Tipp: „Weiß entfernen" stellt Produktfotos auf weißem Hintergrund frei.
              </p>
            </div>
          ) : (
            <p style={{ color: "var(--faint)", fontSize: 13 }}>
              Produktbild anklicken, um es zu bearbeiten. Ziehen zum Verschieben.
            </p>
          )}

          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--muted)" }}>
            Beschreibung (für die Galerie)
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="z. B. Sommer-Ad alltours" style={inputStyle} />
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={download} style={{ ...btn, flex: 1, justifyContent: "center" }}>
              <Icon name="external" size={15} /> Download
            </button>
            <button onClick={save} disabled={busy} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, flex: 1 }}>
              {busy ? "Speichere…" : "In Galerie"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: "grid", gap: 4, fontSize: 12, color: "var(--muted)" }}>
      {label}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

const btn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 12px",
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const chip = (on: boolean): React.CSSProperties => ({
  background: on ? "var(--active)" : "transparent",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "6px 10px",
  color: on ? "var(--text)" : "var(--muted)",
  fontSize: 12,
  cursor: "pointer",
});

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--input-bg)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 10px",
  color: "var(--text)",
  fontSize: 13,
};
