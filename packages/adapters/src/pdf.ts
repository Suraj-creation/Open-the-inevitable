/**
 * PDF modality adapter (CSE M4, ADR-0036). Extracts the anchor substrate — structural regions
 * with page + bbox geometry and the visual (L3) page layer — from canonical PDF bytes via
 * `pdfjs-dist` (guarded dynamic import; provisioned at the deployment edge like pg/@google/genai,
 * never a workspace dependency). Rendering of record stays CLIENT-native from the same bytes
 * (ADR-0036); this adapter never rasterizes.
 *
 * Extraction heuristics (deterministic for given bytes + adapter version):
 *  - text items group into blocks by line gaps (> 60% of median line height ⇒ new block);
 *  - a short single-line block in a font ≥ 1.2× the page's median size reads as a heading;
 *  - a page with no extractable text yields one honest low-confidence `textless` placeholder
 *    region (OCR is a later, separately-governed tool) — degradation, never fabrication.
 */
import { CosError, err, ok, type Result } from "@inevitable/shared";
import type {
  ModalityAdapter,
  ParsedSource,
  SourceModality,
  StructuralRegion,
  VisualPage,
} from "@inevitable/source-environment";
import { requireOptional } from "./optional";

interface PdfTextItem {
  str: string;
  transform: number[]; // [a,b,c,d,e,f] — e=x, f=y (baseline), a≈font size
  width: number;
  height: number;
}
interface PdfTextContent {
  items: PdfTextItem[];
}
interface PdfPageLike {
  getTextContent(): Promise<PdfTextContent>;
  getViewport(opts: { scale: number }): { width: number; height: number };
}
interface PdfDocumentLike {
  numPages: number;
  getPage(n: number): Promise<PdfPageLike>;
}
interface PdfLoadingTaskLike {
  promise: Promise<PdfDocumentLike>;
  /** pdfjs v5: cleanup lives on the loading task, not the document proxy. */
  destroy?(): Promise<void>;
}
interface PdfjsModule {
  getDocument(src: { data: Uint8Array; useSystemFonts?: boolean }): PdfLoadingTaskLike;
}

const PDFJS_SPECIFIER = "pdfjs-dist/legacy/build/pdf.mjs";

interface Line {
  y: number;
  x: number;
  xMax: number;
  size: number;
  text: string;
}

function linesFromItems(items: readonly PdfTextItem[]): Line[] {
  const lines: Line[] = [];
  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;
    const x = item.transform[4] ?? 0;
    const y = item.transform[5] ?? 0;
    const size = Math.abs(item.transform[0] ?? item.height) || item.height || 10;
    const existing = lines.find((l) => Math.abs(l.y - y) < size * 0.5);
    if (existing) {
      existing.text += (x > existing.xMax + size * 0.3 ? " " : "") + item.str;
      existing.xMax = Math.max(existing.xMax, x + item.width);
      existing.x = Math.min(existing.x, x);
      existing.size = Math.max(existing.size, size);
    } else {
      lines.push({ y, x, xMax: x + item.width, size, text: item.str });
    }
  }
  return lines.sort((a, b) => b.y - a.y); // PDF origin bottom-left: top of page first
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export class PdfjsModalityAdapter implements ModalityAdapter {
  readonly modality: SourceModality = "pdf";
  readonly adapter_id = "pdfjs-extractor@1.0.0";

  private constructor(private readonly pdfjs: PdfjsModule) {}

  /** Guarded connect: typed E_ADAPTER_UNAVAILABLE when pdfjs-dist is not provisioned. */
  static async connect(): Promise<Result<PdfjsModalityAdapter, CosError>> {
    const mod = await requireOptional<PdfjsModule>(PDFJS_SPECIFIER);
    if (!mod.ok) return mod;
    return ok(new PdfjsModalityAdapter(mod.value));
  }

  /** Test seam: injected (fake) pdfjs module. */
  static fromModule(pdfjs: PdfjsModule): PdfjsModalityAdapter {
    return new PdfjsModalityAdapter(pdfjs);
  }

  async parseBinary(bytes: Uint8Array): Promise<Result<ParsedSource, CosError>> {
    let task: PdfLoadingTaskLike | null = null;
    try {
      // pdfjs transfers (detaches) the buffer it is given to its worker — hand it a copy so the
      // caller's canonical bytes are never consumed (idempotent re-parse, determinism tests).
      task = this.pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true });
      const doc = await task.promise;
      const regions: StructuralRegion[] = [];
      const pages: VisualPage[] = [];
      let charOffset = 0;
      let textlessPages = 0;

      for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
        const page = await doc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const lines = linesFromItems((await page.getTextContent()).items);

        if (lines.length === 0) {
          // Scanned/textless page: honest degraded placeholder — never fabricated text.
          textlessPages++;
          pages.push({
            page: pageNumber,
            width: viewport.width,
            height: viewport.height,
            textless: true,
          });
          regions.push({
            path: `p${pageNumber}/textless-1`,
            ordinal: regions.length,
            kind: "figure",
            text: `[page ${pageNumber}: no extractable text — scanned page, OCR pending]`,
            char_start: charOffset,
            char_end: charOffset,
            confidence: 0.1,
            page: pageNumber,
            bbox: [0, 0, viewport.width, viewport.height],
          });
          continue;
        }
        pages.push({
          page: pageNumber,
          width: viewport.width,
          height: viewport.height,
          textless: false,
        });

        const medianSize = median(lines.map((l) => l.size));
        // New block when the vertical gap exceeds ~2 line-heights: intra-paragraph leading is
        // typically 1.2–1.5× the font size, paragraph/heading gaps exceed 2×. Anchoring on line
        // height (not median gap) keeps sparse pages from collapsing into one block.
        const blockGap = medianSize * 2;

        let block: Line[] = [];
        let blockCount = 0;
        const flush = (): void => {
          if (block.length === 0) return;
          blockCount++;
          const text = block
            .map((l) => l.text)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          const isHeading =
            block.length === 1 && text.length <= 90 && (block[0]?.size ?? 0) >= medianSize * 1.2;
          const x = Math.min(...block.map((l) => l.x));
          const xMax = Math.max(...block.map((l) => l.xMax));
          const yTop = (block[0]?.y ?? 0) + (block[0]?.size ?? 0);
          const yBottom = block[block.length - 1]?.y ?? 0;
          regions.push({
            path: `p${pageNumber}/${isHeading ? "h" : "blk"}-${blockCount}`,
            ordinal: regions.length,
            kind: isHeading ? "heading" : "paragraph",
            text,
            char_start: charOffset,
            char_end: charOffset + text.length,
            confidence: 1, // native text layer
            page: pageNumber,
            bbox: [x, yBottom, Math.max(0, xMax - x), Math.max(0, yTop - yBottom)],
          });
          charOffset += text.length + 1;
          block = [];
        };
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          const previous = block[block.length - 1];
          if (previous && previous.y - line.y > blockGap) flush();
          block.push(line);
        }
        flush();
      }

      if (regions.length === 0) {
        return err(
          new CosError("E_SOURCE_PARSE_EMPTY", "PDF yielded no pages", {
            specRef: "source-environment/CSE-002-canonical-source-representation#10",
          }),
        );
      }
      const textPages = pages.length - textlessPages;
      // Confidence: fully text-backed = 1; all-scanned = 0.1 (degraded, OCR pending).
      const confidence = pages.length === 0 ? 0.1 : Math.max(0.1, textPages / pages.length);
      return ok({ structural: { regions }, confidence, visual: { pages } });
    } catch (cause) {
      return err(
        new CosError("E_SOURCE_PARSE_FAILED", "PDF parse failed", {
          specRef: "source-environment/CSE-002-canonical-source-representation#10",
          details: { cause: cause instanceof Error ? cause.message : String(cause) },
        }),
      );
    } finally {
      await task?.destroy?.().catch(() => undefined);
    }
  }
}
