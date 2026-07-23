/**
 * M4 — PDF modality adapter (ADR-0036). Gated on the edge-provisioned libraries (pdfjs-dist for
 * extraction, pdf-lib to build the fixture) so the workspace still verifies when they are absent;
 * with them present (they are, at the root edge) the tests run fully offline — PDF parsing is
 * local compute, no network.
 */
import { describe, expect, it } from "vitest";
import { PdfjsModalityAdapter } from "../src/pdf";
import { loadOptional } from "../src/optional";

interface PdfLibModule {
  PDFDocument: {
    create(): Promise<{
      addPage(size?: [number, number]): {
        drawText(text: string, opts: Record<string, unknown>): void;
      };
      embedFont(font: string): Promise<unknown>;
      save(): Promise<Uint8Array>;
    }>;
  };
  StandardFonts: { Helvetica: string; HelveticaBold: string };
}

async function buildFixturePdf(): Promise<Uint8Array | null> {
  const mod = await loadOptional<PdfLibModule>("pdf-lib");
  if (!mod) return null;
  const doc = await mod.PDFDocument.create();
  const bold = await doc.embedFont(mod.StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(mod.StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  page.drawText("Entropy and Microstates", { x: 72, y: 720, size: 20, font: bold });
  page.drawText("Entropy counts the number of microscopic configurations of a system.", {
    x: 72,
    y: 680,
    size: 12,
    font: regular,
  });
  page.drawText("The second law states that entropy of an isolated system never decreases.", {
    x: 72,
    y: 620,
    size: 12,
    font: regular,
  });
  doc.addPage([612, 792]); // page 2: intentionally textless (scanned-page degradation path)
  return doc.save();
}

describe("PdfjsModalityAdapter (gated on edge-provisioned pdfjs-dist)", () => {
  it("extracts structural regions with page+bbox, the visual layer, and honest textless degradation", async () => {
    const connected = await PdfjsModalityAdapter.connect();
    const bytes = await buildFixturePdf();
    if (!connected.ok || !bytes) {
      expect(connected.ok ? "pdf-lib absent" : connected.error.code).toBeDefined();
      return; // libraries not provisioned in this environment — adapter is edge-optional
    }
    const parsed = await connected.value.parseBinary(bytes);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const { structural, visual, confidence } = parsed.value;
    // Page 1: a heading (large bold single line) + two paragraph blocks.
    const p1 = structural.regions.filter((r) => r.page === 1);
    expect(p1.length).toBeGreaterThanOrEqual(3);
    expect(p1[0]?.kind).toBe("heading");
    expect(p1[0]?.text).toContain("Entropy and Microstates");
    expect(p1.every((r) => r.bbox !== undefined && r.confidence === 1)).toBe(true);
    const secondLaw = p1.find((r) => r.text.includes("second law"));
    expect(secondLaw).toBeDefined();

    // Page 2: textless — one honest low-confidence placeholder, never fabricated text.
    const p2 = structural.regions.filter((r) => r.page === 2);
    expect(p2).toHaveLength(1);
    expect(p2[0]?.confidence).toBeLessThanOrEqual(0.1);
    expect(p2[0]?.text).toContain("OCR pending");

    // Visual layer: both pages with geometry; page 2 marked textless.
    expect(visual?.pages).toHaveLength(2);
    expect(visual?.pages[0]).toMatchObject({ page: 1, width: 612, height: 792, textless: false });
    expect(visual?.pages[1]?.textless).toBe(true);

    // Confidence reflects the text/scanned mix (1 of 2 pages textless).
    expect(confidence).toBeCloseTo(0.5, 5);

    // Determinism: same bytes ⇒ identical extraction.
    const again = await connected.value.parseBinary(bytes);
    expect(again).toEqual(parsed);
  });
});
