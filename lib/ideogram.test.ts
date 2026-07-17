import { describe, expect, it } from "vitest";
import { buildJsonPrompt, type StudioInput } from "./ideogram";

const base: StudioInput = {
  highLevelDescription: "Test-Ad",
  aspectRatio: "1x1",
  renderingSpeed: "DEFAULT",
  boxes: [],
};

describe("buildJsonPrompt", () => {
  it("keeps background as a plain string (API contract)", () => {
    const p = buildJsonPrompt(base) as {
      compositional_deconstruction: { background: unknown };
    };
    expect(typeof p.compositional_deconstruction.background).toBe("string");
  });

  it("maps a text box to a bbox in [y_min,x_min,y_max,x_max] 0–1000 space", () => {
    const p = buildJsonPrompt({
      ...base,
      boxes: [
        {
          type: "text",
          x: 0,
          y: 0,
          w: 0.5,
          h: 0.25,
          text: "SALE",
          desc: "bold",
        },
      ],
    }) as {
      compositional_deconstruction: {
        elements: { type: string; text: string; bbox: number[] }[];
      };
    };
    const el = p.compositional_deconstruction.elements[0];
    expect(el.type).toBe("text");
    expect(el.text).toBe("SALE");
    expect(el.bbox).toEqual([0, 0, 250, 500]);
  });

  it("omits type for non-text (object) elements", () => {
    const p = buildJsonPrompt({
      ...base,
      boxes: [
        { type: "object", x: 0.5, y: 0.5, w: 0.2, h: 0.2, desc: "a pen" },
      ],
    }) as {
      compositional_deconstruction: {
        elements: Record<string, unknown>[];
      };
    };
    expect(p.compositional_deconstruction.elements[0].type).toBeUndefined();
    expect(p.compositional_deconstruction.elements[0].desc).toBe("a pen");
  });
});
