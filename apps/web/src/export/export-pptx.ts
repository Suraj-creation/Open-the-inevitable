/**
 * .pptx renderer — the deck model becomes a professionally formatted PowerPoint (issue 11: a
 * cognitive session is a study artifact, not a dead tab).
 *
 * One frame ⇒ one slide, in the surface's own visual language: the CDL dark stage, the cognitive
 * state's accent, role-labeled anchors, native vector diagrams (reusing the board's deterministic
 * layout function), images embedded, and the narration script as speaker notes. pptxgenjs loads
 * lazily (its own chunk) — the surface never pays for the exporter until the learner asks for it.
 */
import type { SurfaceState } from "@inevitable/surface/client";
import { layoutDiagram } from "../components/MccrElement";
import { buildDeckModel, type DeckBlock, type DeckModel, type DeckSlide } from "./deck-model";

// CDL palette, pptx hex (no '#').
const BG = "121118";
const INK = "F0F1F5";
const SOFT = "B3B8C6";
const FAINT = "7E8494";
const STATE_ACCENT: Record<string, string> = {
  learning: "57C9DE",
  practice: "63DFA1",
  assessment: "A78BFF",
  research: "7FA8FF",
};
const ROLE_ACCENT: Record<string, string> = {
  key_example: "63DFA1",
  misconception: "FF9D6B",
  memory_cue: "D8B8AD",
  mental_model: "FFC46B",
  process: "8FD9C4",
  code: "9FB4D8",
};

const SERIF = "Georgia";
const SANS = "Segoe UI";
const MONO = "Consolas";

// 16:9 canvas in inches.
const PAGE_W = 10;
const PAGE_H = 5.625;
const MARGIN = 0.5;
const BODY_TOP = 1.3;
const BODY_BOTTOM = PAGE_H - 0.3;
const COL_W = (PAGE_W - 2 * MARGIN - 0.2) / 2;

/* pptxgenjs's own types are loose; this narrow surface is all we use. */
interface SlideLike {
  background: { color: string };
  addText(text: unknown, options: Record<string, unknown>): void;
  addTable(rows: unknown[], options: Record<string, unknown>): void;
  addShape(shapeName: unknown, options: Record<string, unknown>): void;
  addImage(options: Record<string, unknown>): void;
  addNotes(notes: string): void;
}
interface PptxLike {
  defineLayout(layout: { name: string; width: number; height: number }): void;
  layout: string;
  ShapeTypes?: unknown;
  ShapeType: Record<string, unknown>;
  addSlide(): SlideLike;
  writeFile(options: { fileName: string }): Promise<string>;
}

/** Export the session as a .pptx download. Returns the file name. */
export async function exportSessionAsPptx(state: SurfaceState): Promise<string> {
  const model = buildDeckModel(state);
  const mod = (await import("pptxgenjs")) as unknown as { default: new () => PptxLike };
  const pptx = new mod.default();
  pptx.defineLayout({ name: "COS_WIDE", width: PAGE_W, height: PAGE_H });
  pptx.layout = "COS_WIDE";

  addCoverSlide(pptx, model);
  for (const slide of model.slides) {
    await addFrameSlide(pptx, slide);
  }

  const fileName = `cognitive-session-${model.surfaceId || "surface"}.pptx`;
  await pptx.writeFile({ fileName });
  return fileName;
}

function addCoverSlide(pptx: PptxLike, model: DeckModel): void {
  const slide = pptx.addSlide();
  slide.background = { color: BG };
  slide.addText("THE INEVITABLE — COGNITIVE SESSION", {
    x: MARGIN,
    y: 0.55,
    w: PAGE_W - 2 * MARGIN,
    h: 0.3,
    fontSize: 11,
    fontFace: SANS,
    color: FAINT,
    charSpacing: 4,
  });
  slide.addText(model.goal ?? "A learning journey", {
    x: MARGIN,
    y: 1.0,
    w: PAGE_W - 2 * MARGIN,
    h: 1.2,
    fontSize: 30,
    fontFace: SERIF,
    color: INK,
    fit: "shrink",
  });
  if (model.path.length > 0) {
    const glyph: Record<string, string> = {
      mastered: "✓",
      in_progress: "●",
      available: "○",
      locked: "·",
    };
    slide.addText("THE PATH", {
      x: MARGIN,
      y: 2.5,
      w: 3,
      h: 0.3,
      fontSize: 10,
      fontFace: SANS,
      color: FAINT,
      charSpacing: 3,
    });
    slide.addText(
      model.path.map((p) => ({
        text: `${glyph[p.status] ?? "·"}  ${p.title}`,
        options: {
          fontSize: 13,
          fontFace: SANS,
          color: p.status === "mastered" ? "6EE7A8" : SOFT,
          breakLine: true,
        },
      })),
      { x: MARGIN, y: 2.85, w: PAGE_W - 2 * MARGIN, h: 2.2, fit: "shrink" },
    );
  }
  slide.addText(
    `${model.slides.length} cognitive frames · exported ${new Date().toISOString().slice(0, 10)}`,
    {
      x: MARGIN,
      y: PAGE_H - 0.5,
      w: PAGE_W - 2 * MARGIN,
      h: 0.3,
      fontSize: 9,
      fontFace: MONO,
      color: FAINT,
    },
  );
}

async function addFrameSlide(pptx: PptxLike, model: DeckSlide): Promise<void> {
  const slide = pptx.addSlide();
  slide.background = { color: BG };
  const accent = STATE_ACCENT[model.state] ?? STATE_ACCENT["learning"]!;

  slide.addText(model.title, {
    x: MARGIN,
    y: 0.3,
    w: PAGE_W - 2 * MARGIN,
    h: 0.75,
    fontSize: 24,
    fontFace: SERIF,
    color: INK,
    fit: "shrink",
  });
  slide.addShape(pptx.ShapeType["rect"], {
    x: MARGIN,
    y: 1.12,
    w: 0.9,
    h: 0.04,
    fill: { color: accent },
    line: { type: "none" },
  });

  // Two-column flow: each block lands in the currently-shorter column; the definition (the
  // gloss) spans full width first, mirroring the board's anchor hierarchy.
  const colY: [number, number] = [BODY_TOP, BODY_TOP];
  const colX = [MARGIN, MARGIN + COL_W + 0.2];
  const overflow: DeckBlock[] = [];

  const ordered = [...model.blocks].sort((a, b) => {
    const isDef = (x: DeckBlock): number => (x.kind === "text" && x.role === "definition" ? 0 : 1);
    return isDef(a) - isDef(b);
  });

  for (const block of ordered) {
    const fullWidth = block.kind === "text" && block.role === "definition";
    const w = fullWidth ? PAGE_W - 2 * MARGIN : COL_W;
    const h = blockHeight(block, w);
    const col = fullWidth ? -1 : colY[0] <= colY[1] ? 0 : 1;
    const x = fullWidth ? MARGIN : colX[col]!;
    const y = fullWidth ? Math.max(colY[0], colY[1]) : colY[col as 0 | 1];
    if (y + h > BODY_BOTTOM) {
      overflow.push(block);
      continue;
    }
    await renderBlock(pptx, slide, block, { x, y, w, h, accent });
    if (fullWidth) {
      colY[0] = y + h + 0.12;
      colY[1] = y + h + 0.12;
    } else {
      colY[col as 0 | 1] = y + h + 0.12;
    }
  }

  // Speaker notes: the narration script (the spoken teaching), plus any anchors the slide could
  // not fit — disclosed, never silently lost.
  const overflowNotes = overflow
    .map((b) => (b.kind === "text" ? `${b.label}: ${b.text}` : `(${b.kind} omitted from slide)`))
    .join("\n");
  const notes = [model.notes, overflowNotes ? `\n— Not shown on slide —\n${overflowNotes}` : ""]
    .filter(Boolean)
    .join("\n");
  if (notes) slide.addNotes(notes);
}

function blockHeight(block: DeckBlock, w: number): number {
  switch (block.kind) {
    case "text": {
      const perLine = w > 5 ? 110 : 52; // chars per line at this width, roughly
      const textLines = Math.max(1, Math.ceil(block.text.length / perLine));
      return 0.32 + textLines * 0.24;
    }
    case "formula":
      return 0.4 + Math.max(1, block.lines.length) * 0.3;
    case "table":
      return 0.35 + Math.min(block.rows.length, 8) * 0.3 + 0.3;
    case "relationship":
      return 0.65;
    case "diagram":
      return 2.1;
    case "image":
      return 2.5;
  }
}

async function renderBlock(
  pptx: PptxLike,
  slide: SlideLike,
  block: DeckBlock,
  box: { x: number; y: number; w: number; h: number; accent: string },
): Promise<void> {
  const { x, y, w, h, accent } = box;
  switch (block.kind) {
    case "text": {
      const roleAccent = ROLE_ACCENT[block.role] ?? accent;
      slide.addText(
        [
          {
            text: `${block.label.toUpperCase()}\n`,
            options: { fontSize: 8, fontFace: SANS, color: roleAccent, charSpacing: 3 },
          },
          {
            text: block.text,
            options: {
              fontSize: block.role === "definition" ? 14 : 12,
              fontFace: block.role === "definition" ? SERIF : SANS,
              color: block.role === "definition" ? INK : SOFT,
              italic: block.role === "mental_model" || block.role === "memory_cue",
            },
          },
        ],
        { x, y, w, h, valign: "top", fit: "shrink" },
      );
      return;
    }
    case "formula": {
      const lines = block.lines.length > 1 ? block.lines : [block.plain];
      slide.addText(
        [
          {
            text: "KEY FORMULA\n",
            options: { fontSize: 8, fontFace: SANS, color: accent, charSpacing: 3 },
          },
          ...lines.map((line) => ({
            text: `${line}\n`,
            options: { fontSize: 13, fontFace: MONO, color: INK },
          })),
        ],
        { x, y, w, h, valign: "top", fit: "shrink" },
      );
      return;
    }
    case "table": {
      const rows = [
        block.headers.length > 0
          ? block.headers.map((cell) => ({
              text: cell,
              options: { bold: true, color: INK, fill: { color: "1A1922" } },
            }))
          : null,
        ...block.rows.slice(0, 8).map((row) => row.map((cell) => ({ text: cell }))),
      ].filter((r): r is NonNullable<typeof r> => r !== null);
      slide.addTable(rows, {
        x,
        y,
        w,
        fontSize: 10,
        fontFace: SANS,
        color: SOFT,
        border: { type: "solid", color: "2A2933", pt: 0.5 },
        fill: { color: BG },
      });
      return;
    }
    case "relationship": {
      slide.addText(
        [
          {
            text: "RELATIONSHIP\n",
            options: { fontSize: 8, fontFace: SANS, color: accent, charSpacing: 3 },
          },
          {
            text: `${block.from}  →  ${block.to}${block.relation ? `   (${block.relation})` : ""}${block.text ? `\n${block.text}` : ""}`,
            options: { fontSize: 12, fontFace: SANS, color: SOFT },
          },
        ],
        { x, y, w, h, valign: "top", fit: "shrink" },
      );
      return;
    }
    case "diagram": {
      // Native vector shapes, reusing the board's deterministic per-kind layout (replay-safe on
      // the slide exactly as on the surface).
      const positions = layoutDiagram(block.diagram);
      const at = new Map(positions.map((p) => [p.id, p] as const));
      const pad = 0.35;
      const sx = (w - 2 * pad) / 340;
      const sy = (h - 0.45 - pad) / 190;
      const ox = x + pad;
      const oy = y + 0.35;
      slide.addText(`DIAGRAM — ${block.diagram.kind.toUpperCase()}`, {
        x,
        y,
        w,
        h: 0.28,
        fontSize: 8,
        fontFace: SANS,
        color: accent,
        charSpacing: 3,
      });
      for (const edge of block.diagram.edges) {
        const a = at.get(edge.from);
        const b = at.get(edge.to);
        if (!a || !b) continue;
        const ax = ox + a.x * sx;
        const ay = oy + a.y * sy;
        const bx = ox + b.x * sx;
        const by = oy + b.y * sy;
        slide.addShape(pptx.ShapeType["line"], {
          x: Math.min(ax, bx),
          y: Math.min(ay, by),
          w: Math.abs(bx - ax),
          h: Math.abs(by - ay),
          flipH: bx < ax,
          flipV: by < ay,
          line: { color: "3A3945", width: 1 },
        });
      }
      for (const node of block.diagram.nodes) {
        const p = at.get(node.id);
        if (!p) continue;
        const nx = ox + p.x * sx;
        const ny = oy + p.y * sy;
        slide.addShape(pptx.ShapeType["ellipse"], {
          x: nx - 0.05,
          y: ny - 0.05,
          w: 0.1,
          h: 0.1,
          fill: { color: accent },
          line: { type: "none" },
        });
        slide.addText(node.label, {
          x: nx - 0.7,
          y: ny - 0.34,
          w: 1.4,
          h: 0.24,
          fontSize: 8,
          fontFace: SANS,
          color: SOFT,
          align: "center",
        });
      }
      return;
    }
    case "image": {
      const data = await fetchAsDataUrl(block.url);
      if (data) {
        slide.addImage({
          data,
          x,
          y,
          w,
          h: h - (block.caption ? 0.3 : 0),
          sizing: { type: "contain", w, h: h - (block.caption ? 0.3 : 0) },
        });
        if (block.caption) {
          slide.addText(block.caption, {
            x,
            y: y + h - 0.3,
            w,
            h: 0.3,
            fontSize: 9,
            fontFace: SANS,
            color: FAINT,
            align: "center",
          });
        }
      } else {
        slide.addText(`Illustration unavailable — ${block.caption ?? block.alt}`, {
          x,
          y,
          w,
          h: 0.6,
          fontSize: 10,
          fontFace: SANS,
          color: FAINT,
          italic: true,
        });
      }
      return;
    }
  }
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
