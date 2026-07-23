/**
 * Deterministic in-memory reference modality adapters — the offline defaults every modality seam
 * ships with (CSE-002 §7), so the full CSE stack runs and tests hermetically. Markdown/plain-text
 * here; PDF/video/web adapters are deployment-edge tools arriving with their milestones.
 */
import { CosError, err, ok, type Result } from "@inevitable/shared";
import type { SourceModality } from "./identity";
import type {
  StructuralLayerContent,
  StructuralRegion,
  TemporalLayerContent,
  VisualLayerContent,
} from "./layers";

export interface ParsedSource {
  readonly structural: StructuralLayerContent;
  /** Overall extraction confidence 0..1 (native text = 1). */
  readonly confidence: number;
  /** Visual (L3) layer for paginated modalities — page geometry for viewports/overlays (ADR-0036). */
  readonly visual?: VisualLayerContent;
  /** Temporal (L4) layer for time-based modalities — per-region timecodes (video, ADR-0048). */
  readonly temporal?: TemporalLayerContent;
}

/** The modality adapter contract canonicalization runs behind (CSE-002 §4/§7). Text modalities
 * implement `parse`; binary modalities (PDF, images, a/v) implement `parseBinary` — bytes stay
 * out-of-band in the canonical record either way. */
export interface ModalityAdapter {
  readonly modality: SourceModality;
  readonly adapter_id: string;
  parse?(content: string): Result<ParsedSource, CosError>;
  parseBinary?(bytes: Uint8Array): Promise<Result<ParsedSource, CosError>>;
}

interface Block {
  readonly kind: StructuralRegion["kind"];
  readonly text: string;
  readonly char_start: number;
  readonly char_end: number;
  readonly headingLevel?: number;
}

function splitBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  let offset = 0;
  let inCodeFence = false;
  let fenceStart = 0;
  let fenceLines: string[] = [];
  const lines = content.split("\n");
  let paragraph: string[] = [];
  let paragraphStart = 0;

  const flushParagraph = (endOffset: number): void => {
    if (paragraph.length === 0) return;
    const text = paragraph.join("\n").trim();
    if (text.length > 0) {
      const kind = /^([-*+]\s|\d+\.\s)/.test(text) ? "list" : "paragraph";
      blocks.push({ kind, text, char_start: paragraphStart, char_end: endOffset });
    }
    paragraph = [];
  };

  for (const line of lines) {
    const lineStart = offset;
    offset += line.length + 1; // +1 for the split newline
    if (inCodeFence) {
      if (line.trimEnd() === "```") {
        blocks.push({
          kind: "code",
          text: fenceLines.join("\n"),
          char_start: fenceStart,
          char_end: lineStart - 1 < fenceStart ? fenceStart : lineStart - 1,
        });
        inCodeFence = false;
        fenceLines = [];
      } else {
        fenceLines.push(line);
      }
      continue;
    }
    if (line.trimEnd().startsWith("```")) {
      flushParagraph(lineStart - 1);
      inCodeFence = true;
      fenceStart = offset;
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph(lineStart - 1);
      const hashes = heading[1] ?? "#";
      const title = (heading[2] ?? "").trim();
      blocks.push({
        kind: "heading",
        text: title,
        char_start: lineStart,
        char_end: lineStart + line.length,
        headingLevel: hashes.length,
      });
      continue;
    }
    if (line.trim().length === 0) {
      flushParagraph(lineStart - 1);
      continue;
    }
    if (paragraph.length === 0) paragraphStart = lineStart;
    paragraph.push(line);
  }
  if (inCodeFence && fenceLines.length > 0) {
    // Unterminated fence at EOF: keep the content as code rather than silently dropping it.
    blocks.push({
      kind: "code",
      text: fenceLines.join("\n"),
      char_start: fenceStart,
      char_end: offset - 1,
    });
  }
  flushParagraph(offset - 1);
  return blocks;
}

/**
 * Deterministic paths: heading stack (`h<level>-<n>`) joined with per-scope kind counters
 * (`para-2`, `code-1`), so the same content always yields byte-identical structural layers.
 */
function assignPaths(blocks: readonly Block[]): StructuralRegion[] {
  const regions: StructuralRegion[] = [];
  const headingStack: string[] = [];
  const headingCounts = new Map<number, number>();
  let scopeCounters = new Map<string, number>();
  let ordinal = 0;

  for (const block of blocks) {
    if (block.kind === "heading" && block.headingLevel !== undefined) {
      const level = block.headingLevel;
      const count = (headingCounts.get(level) ?? 0) + 1;
      headingCounts.set(level, count);
      for (const deeper of [...headingCounts.keys()]) {
        if (deeper > level) headingCounts.delete(deeper);
      }
      headingStack.length = Math.max(0, level - 1);
      headingStack[level - 1] = `h${level}-${count}`;
      scopeCounters = new Map();
      regions.push({
        path: headingStack.slice(0, level).filter(Boolean).join("/"),
        ordinal: ordinal++,
        kind: "heading",
        text: block.text,
        char_start: block.char_start,
        char_end: block.char_end,
        confidence: 1,
      });
      continue;
    }
    const count = (scopeCounters.get(block.kind) ?? 0) + 1;
    scopeCounters.set(block.kind, count);
    const scope = headingStack.filter(Boolean).join("/");
    const leaf = `${block.kind === "paragraph" ? "para" : block.kind}-${count}`;
    regions.push({
      path: scope ? `${scope}/${leaf}` : leaf,
      ordinal: ordinal++,
      kind: block.kind,
      text: block.text,
      char_start: block.char_start,
      char_end: block.char_end,
      confidence: 1,
    });
  }
  return regions;
}

function parseText(content: string): Result<ParsedSource, CosError> {
  if (content.trim().length === 0) {
    return err(
      new CosError("E_SOURCE_PARSE_EMPTY", "Source content is empty; nothing to canonicalize", {
        specRef: "source-environment/CSE-002-canonical-source-representation#10",
      }),
    );
  }
  const regions = assignPaths(splitBlocks(content));
  return ok({ structural: { regions }, confidence: 1 });
}

export class MarkdownReferenceAdapter implements ModalityAdapter {
  readonly modality: SourceModality = "markdown";
  readonly adapter_id = "reference-markdown";

  parse(content: string): Result<ParsedSource, CosError> {
    return parseText(content);
  }
}

export class PlainTextReferenceAdapter implements ModalityAdapter {
  readonly modality: SourceModality = "text";
  readonly adapter_id = "reference-text";

  parse(content: string): Result<ParsedSource, CosError> {
    return parseText(content);
  }
}

// ── Code modality (M10 T1, ADR-0046) ──────────────────────────────────────────────────────────

/**
 * A column-0 top-level construct across common language families (TS/JS, Python, Go, Rust, Java,
 * C-family): the boundary at which a code file is cut into anchor-addressable regions. Deliberately
 * language-agnostic + heuristic — imperfect parsing is honest coarse structure, never a drop.
 */
const CODE_DECL =
  /^(?:export\s+)?(?:default\s+)?(?:public\s+|private\s+|protected\s+|internal\s+|static\s+|abstract\s+|final\s+|async\s+)*(?:function|class|interface|type|enum|struct|impl|trait|module|namespace|package|def|fn|func|const|let|var)\b/;

/**
 * Split code into blocks: each column-0 construct becomes a heading (its signature) followed by a
 * code body (until the next column-0 construct); leading imports/headers form a preamble code block.
 * Nested constructs stay inside their parent's body in T1 (honest coarse structure). Deterministic.
 */
function splitCodeBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.split("\n");
  let offset = 0;
  let bodyLines: string[] = [];
  let bodyStart = 0;

  const flushBody = (endOffset: number): void => {
    if (bodyLines.length === 0) return;
    const text = bodyLines.join("\n").replace(/\s+$/, "");
    if (text.trim().length > 0) {
      blocks.push({ kind: "code", text, char_start: bodyStart, char_end: endOffset });
    }
    bodyLines = [];
  };

  for (const line of lines) {
    const lineStart = offset;
    offset += line.length + 1; // +1 for the split newline
    const isDecl = line.length > 0 && !/^\s/.test(line) && CODE_DECL.test(line);
    if (isDecl) {
      flushBody(lineStart > bodyStart ? lineStart - 1 : bodyStart);
      blocks.push({
        kind: "heading",
        text: line.trim(),
        char_start: lineStart,
        char_end: lineStart + line.length,
        headingLevel: 1,
      });
    } else {
      if (bodyLines.length === 0) bodyStart = lineStart;
      bodyLines.push(line);
    }
  }
  flushBody(offset - 1);
  return blocks;
}

function parseCode(content: string): Result<ParsedSource, CosError> {
  if (content.trim().length === 0) {
    return err(
      new CosError("E_SOURCE_PARSE_EMPTY", "Source content is empty; nothing to canonicalize", {
        specRef: "source-environment/CSE-002-canonical-source-representation#10",
      }),
    );
  }
  return ok({ structural: { regions: assignPaths(splitCodeBlocks(content)) }, confidence: 1 });
}

export class CodeReferenceAdapter implements ModalityAdapter {
  readonly modality: SourceModality = "code";
  readonly adapter_id = "reference-code";

  parse(content: string): Result<ParsedSource, CosError> {
    return parseCode(content);
  }
}

// ── Web modality (M10 T2, ADR-0047) ───────────────────────────────────────────────────────────

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

/** Decode the common HTML entities (named + numeric) — content, never markup, reaches a region. */
function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** Strip inline tags + decode entities + collapse whitespace → the readable text of a block.
 * Inline tags become a space (word boundaries stay), then a space left before punctuation by a
 * stripped tag is tidied ("the <em>gradient</em>." → "the gradient."). */
function inlineText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?)\]])/g, "$1")
    .trim();
}

/** Remove non-content elements *with their content* (script/style/etc.) — the cleaning step. */
function stripNonContent(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|svg|template|head)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(nav|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
}

/**
 * Extract a page's readable structure from its HTML: drop non-content (script/style/svg/comments)
 * and boilerplate (nav/footer/aside), then pull block elements in document order — headings (with
 * level, so they nest + label), paragraphs, list items, and code. Dependency-free + deterministic;
 * unclosed/exotic markup is honestly skipped, never guessed. Offsets index the cleaned HTML.
 */
function splitHtmlBlocks(html: string): Block[] {
  const cleaned = stripNonContent(html);
  const blocks: Block[] = [];
  const re = /<(h[1-6]|p|li|pre|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cleaned)) !== null) {
    const tag = (match[1] ?? "").toLowerCase();
    const inner = match[2] ?? "";
    const text =
      tag === "pre"
        ? decodeEntities(inner.replace(/<[^>]+>/g, ""))
            .replace(/\s+$/, "")
            .replace(/^\n+/, "")
        : inlineText(inner);
    if (!text.trim()) continue;
    const charStart = match.index;
    const charEnd = match.index + match[0].length;
    if (/^h[1-6]$/.test(tag)) {
      blocks.push({
        kind: "heading",
        text,
        char_start: charStart,
        char_end: charEnd,
        headingLevel: Number(tag[1]),
      });
    } else {
      const kind: StructuralRegion["kind"] =
        tag === "li" ? "list" : tag === "pre" ? "code" : "paragraph";
      blocks.push({ kind, text, char_start: charStart, char_end: charEnd });
    }
  }
  return blocks;
}

function parseHtml(content: string): Result<ParsedSource, CosError> {
  if (content.trim().length === 0) {
    return err(
      new CosError("E_SOURCE_PARSE_EMPTY", "Source content is empty; nothing to canonicalize", {
        specRef: "source-environment/CSE-002-canonical-source-representation#10",
      }),
    );
  }
  const blocks = splitHtmlBlocks(content);
  if (blocks.length === 0) {
    // No recognizable block markup — fall back to the whole readable text as one region (honest).
    // Strip script/style CONTENT first, so a page that is only markup yields nothing (refused).
    const text = inlineText(stripNonContent(content));
    if (!text) {
      return err(
        new CosError("E_SOURCE_PARSE_EMPTY", "Web source had no extractable text content", {
          specRef: "source-environment/CSE-002-canonical-source-representation#10",
        }),
      );
    }
    return ok({
      structural: {
        regions: [
          {
            path: "para-1",
            ordinal: 0,
            kind: "paragraph",
            text,
            char_start: 0,
            char_end: content.length,
            confidence: 1,
          },
        ],
      },
      confidence: 1,
    });
  }
  return ok({ structural: { regions: assignPaths(blocks) }, confidence: 1 });
}

export class WebReferenceAdapter implements ModalityAdapter {
  readonly modality: SourceModality = "web";
  readonly adapter_id = "reference-web";

  parse(content: string): Result<ParsedSource, CosError> {
    return parseHtml(content);
  }
}

// ── Video modality (M10 T3, ADR-0048) — a timed transcript → structural + L4 temporal layers ────

interface TranscriptCue {
  readonly text: string;
  readonly start_ms: number;
  readonly end_ms: number;
}

/** Parse a timecode (`HH:MM:SS.mmm`, `HH:MM:SS,mmm`, or `MM:SS.mmm`) to milliseconds; null if none. */
function parseTimecode(raw: string): number | null {
  const m = /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/.exec(raw.trim());
  if (!m) return null;
  const h = m[1] ? Number(m[1]) : 0;
  const min = Number(m[2]);
  const s = Number(m[3]);
  const frac = Number((m[4] ?? "0").padEnd(3, "0").slice(0, 3));
  return ((h * 60 + min) * 60 + s) * 1000 + frac;
}

/** Cues from WebVTT / SRT: blocks separated by blank lines, each with a `START --> END` line. */
function parseCueBlocks(content: string): TranscriptCue[] {
  const cues: TranscriptCue[] = [];
  const blocks = content.split(/\r?\n\r?\n/);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) continue;
    const arrowIdx = lines.findIndex((l) => l.includes("-->"));
    if (arrowIdx < 0) continue; // header (WEBVTT) or note block — skipped
    const [startRaw, endRaw] = lines[arrowIdx]!.split("-->");
    const start = parseTimecode(startRaw ?? "");
    const end = parseTimecode(endRaw ?? "");
    if (start === null || end === null) continue;
    const text = lines
      .slice(arrowIdx + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    cues.push({ text, start_ms: start, end_ms: end });
  }
  return cues;
}

/** Cues from a JSON array of `{start,end,text}` (start/end in ms via `*_ms`, else seconds). */
function parseJsonCues(content: string): TranscriptCue[] {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return [];
  }
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { cues?: unknown })?.cues)
      ? (raw as { cues: unknown[] }).cues
      : [];
  const cues: TranscriptCue[] = [];
  for (const entry of arr) {
    const c = entry as Record<string, unknown>;
    const text = typeof c["text"] === "string" ? c["text"].trim() : "";
    if (!text) continue;
    const startMs =
      typeof c["start_ms"] === "number"
        ? c["start_ms"]
        : typeof c["start"] === "number"
          ? c["start"] * 1000
          : null;
    const endMs =
      typeof c["end_ms"] === "number"
        ? c["end_ms"]
        : typeof c["end"] === "number"
          ? c["end"] * 1000
          : null;
    if (startMs === null || endMs === null) continue;
    cues.push({ text, start_ms: Math.round(startMs), end_ms: Math.round(endMs) });
  }
  return cues;
}

function parseTranscript(content: string): Result<ParsedSource, CosError> {
  if (content.trim().length === 0) {
    return err(
      new CosError("E_SOURCE_PARSE_EMPTY", "Source content is empty; nothing to canonicalize", {
        specRef: "source-environment/CSE-002-canonical-source-representation#10",
      }),
    );
  }
  const trimmed = content.trimStart();
  const cues =
    trimmed.startsWith("[") || trimmed.startsWith("{")
      ? parseJsonCues(content)
      : parseCueBlocks(content);
  if (cues.length === 0) {
    return err(
      new CosError(
        "E_SOURCE_PARSE_EMPTY",
        "No timed cues found — a video source requires a timed transcript (VTT/SRT/JSON)",
        { specRef: "source-environment/CSE-002-canonical-source-representation#10" },
      ),
    );
  }
  // One structural region (paragraph) per cue, in time order — anchor-addressable transcript.
  let offset = 0;
  const blocks: Block[] = cues.map((cue) => {
    const start = offset;
    offset += cue.text.length + 1;
    return { kind: "paragraph" as const, text: cue.text, char_start: start, char_end: offset - 1 };
  });
  const regions = assignPaths(blocks);
  // The L4 temporal layer: map each region to its cue's timecode (regions are 1:1 with cues here).
  const segments = regions.map((region, i) => ({
    region_path: region.path,
    start_ms: cues[i]!.start_ms,
    end_ms: cues[i]!.end_ms,
  }));
  const duration_ms = segments.reduce((max, s) => Math.max(max, s.end_ms), 0);
  return {
    ok: true,
    value: { structural: { regions }, temporal: { segments, duration_ms }, confidence: 1 },
  };
}

export class VideoTranscriptAdapter implements ModalityAdapter {
  readonly modality: SourceModality = "video";
  readonly adapter_id = "reference-video";

  parse(content: string): Result<ParsedSource, CosError> {
    return parseTranscript(content);
  }
}

// ── Notebook modality (R5, ADR-0059) — a Jupyter .ipynb (JSON) → markdown + code structural layers ─

/** A notebook cell's `source` is a string or an array of line-strings; join to one string. */
function cellSource(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.map((l) => (typeof l === "string" ? l : "")).join("");
  return "";
}

/**
 * Parse a Jupyter notebook into structural blocks in document order: a MARKDOWN cell reuses the
 * markdown splitter (its headings become the notebook's structure); a CODE cell becomes one `code`
 * block (indentation preserved — feeds the `code` MCCR grammar); a raw/unknown cell falls back to a
 * paragraph. Executed outputs are NOT source content (only authored cells canonicalize, ADR-0059).
 * `char_start/end` index this synthesized text stream — deterministic given the cell order.
 */
function splitNotebookBlocks(cells: readonly Record<string, unknown>[]): Block[] {
  const blocks: Block[] = [];
  let offset = 0;
  const emit = (kind: Block["kind"], text: string, headingLevel?: number): void => {
    const char_start = offset;
    offset += text.length + 1; // +1 for the notional separator between cells/blocks
    blocks.push({
      kind,
      text,
      char_start,
      char_end: offset - 1,
      ...(headingLevel !== undefined ? { headingLevel } : {}),
    });
  };
  for (const cell of cells) {
    const type = typeof cell["cell_type"] === "string" ? cell["cell_type"] : "";
    const text = cellSource(cell["source"]);
    if (text.trim().length === 0) continue;
    if (type === "markdown") {
      // Reuse the markdown splitter so a notebook's markdown headings structure the source.
      for (const b of splitBlocks(text)) {
        emit(b.kind, b.text, b.headingLevel);
      }
    } else if (type === "code") {
      emit("code", text.replace(/\s+$/, ""));
    } else {
      emit("paragraph", text.trim());
    }
  }
  return blocks;
}

function parseNotebook(content: string): Result<ParsedSource, CosError> {
  if (content.trim().length === 0) {
    return err(
      new CosError("E_SOURCE_PARSE_EMPTY", "Source content is empty; nothing to canonicalize", {
        specRef: "source-environment/CSE-002-canonical-source-representation#10",
      }),
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return err(
      new CosError("E_SOURCE_PARSE_EMPTY", "Notebook is not valid JSON (.ipynb)", {
        specRef: "source-environment/CSE-002-canonical-source-representation#10",
      }),
    );
  }
  const cells = Array.isArray((raw as { cells?: unknown })?.cells)
    ? ((raw as { cells: unknown[] }).cells.filter(
        (c): c is Record<string, unknown> => !!c && typeof c === "object",
      ) as Record<string, unknown>[])
    : [];
  const blocks = splitNotebookBlocks(cells);
  if (blocks.length === 0) {
    return err(
      new CosError(
        "E_SOURCE_PARSE_EMPTY",
        "Notebook has no authored cell content to canonicalize",
        {
          specRef: "source-environment/CSE-002-canonical-source-representation#10",
        },
      ),
    );
  }
  return ok({ structural: { regions: assignPaths(blocks) }, confidence: 1 });
}

export class NotebookReferenceAdapter implements ModalityAdapter {
  readonly modality: SourceModality = "notebook";
  readonly adapter_id = "reference-notebook";

  parse(content: string): Result<ParsedSource, CosError> {
    return parseNotebook(content);
  }
}

// ── Dataset modality (R5, ADR-0059) — a CSV → schema + shape + bounded preview structural layer ────

/**
 * Parse CSV into rows of fields — RFC-4180-ish: double-quoted fields may contain commas and newlines,
 * and a doubled quote (`""`) is a literal quote. Dependency-free + deterministic; a lone trailing
 * newline does not produce a phantom empty row.
 */
function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let sawAny = false;
  const pushField = (): void => {
    row.push(field);
    field = "";
  };
  const pushRow = (): void => {
    pushField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < content.length; i++) {
    const c = content[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      sawAny = true;
    } else if (c === ",") {
      pushField();
      sawAny = true;
    } else if (c === "\n" || c === "\r") {
      // Swallow a \r\n pair as one break; a break only ends a row if the row has content.
      if (c === "\r" && content[i + 1] === "\n") i++;
      if (sawAny || field.length > 0 || row.length > 0) pushRow();
      sawAny = false;
    } else {
      field += c;
      sawAny = true;
    }
  }
  if (sawAny || field.length > 0 || row.length > 0) pushRow();
  return rows;
}

/** How many data rows the preview table shows (the rest is summarized by the shape, never dropped). */
const DATASET_PREVIEW_ROWS = 8;

function parseDataset(content: string): Result<ParsedSource, CosError> {
  if (content.trim().length === 0) {
    return err(
      new CosError("E_SOURCE_PARSE_EMPTY", "Source content is empty; nothing to canonicalize", {
        specRef: "source-environment/CSE-002-canonical-source-representation#10",
      }),
    );
  }
  const rows = parseCsv(content).filter((r) => r.some((cell) => cell.trim().length > 0));
  const header = rows[0];
  if (!header || header.length === 0) {
    return err(
      new CosError("E_SOURCE_PARSE_EMPTY", "Dataset had no parseable rows (expected CSV)", {
        specRef: "source-environment/CSE-002-canonical-source-representation#10",
      }),
    );
  }
  const dataRows = rows.slice(1);
  const columns = header.map((c) => c.trim()).filter((c) => c.length > 0);
  const blocks: Block[] = [];
  let offset = 0;
  const emit = (kind: Block["kind"], text: string, headingLevel?: number): void => {
    const char_start = offset;
    offset += text.length + 1;
    blocks.push({
      kind,
      text,
      char_start,
      char_end: offset - 1,
      ...(headingLevel !== undefined ? { headingLevel } : {}),
    });
  };
  // The shape (heading), the schema (list of columns), and a bounded preview (table) — coarse,
  // honest structure the learner can be taught from without materializing every row.
  emit("heading", `Dataset — ${columns.length} columns × ${dataRows.length} rows`, 1);
  if (columns.length > 0) emit("list", columns.map((c) => `- ${c}`).join("\n"));
  if (dataRows.length > 0) {
    const preview = [header, ...dataRows.slice(0, DATASET_PREVIEW_ROWS)]
      .map((r) => r.map((cell) => cell.trim()).join(" | "))
      .join("\n");
    emit("table", preview);
  }
  return ok({ structural: { regions: assignPaths(blocks) }, confidence: 1 });
}

export class DatasetReferenceAdapter implements ModalityAdapter {
  readonly modality: SourceModality = "dataset";
  readonly adapter_id = "reference-dataset";

  parse(content: string): Result<ParsedSource, CosError> {
    return parseDataset(content);
  }
}
