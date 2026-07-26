/**
 * Incremental MCCR element extraction (ADR-0063 Phase B) — the pure, truncation-tolerant core of
 * live board streaming. These tests hammer the partial-JSON scanner: every truncation boundary,
 * escapes, structured-anchor skipping, leading fences, and monotonic growth as a stream fills.
 */
import { describe, expect, test } from "vitest";
import { extractCompletedMccrElements } from "../src/mccr-stream";

/** A realistic composer payload with both string anchors and structured ones, plus trailing keys. */
const FULL = JSON.stringify({
  mccr: {
    core_concept: "Linear algebra",
    definition: "The study of vectors, matrices, and the linear maps between them.",
    key_formula: { latex: "A\\mathbf{x}=\\mathbf{b}", plain: "A x equals b" },
    mental_model: 'Data as "arrows" in space; matrices reshape it.',
    diagram: { kind: "axes", nodes: [{ id: "n1", label: "v" }], edges: [] },
    key_example: "For A=[[2,0],[0,3]], A·(1,1) = (2,3).",
    memory_cue: "Matrix = machine that moves arrows.",
  },
  narration_script: { segments: [{ text: "spoken", anchor_ref: "core_concept" }] },
  image_plan: { helps: true, prompt: "arrows", rationale: "visual" },
});

const namesOf = (s: string): string[] => extractCompletedMccrElements(s).map((e) => e.name);

describe("extractCompletedMccrElements", () => {
  test("returns all string anchors from a complete payload, in document order (structured skipped)", () => {
    const els = extractCompletedMccrElements(FULL);
    expect(els.map((e) => e.name)).toEqual([
      "core_concept",
      "definition",
      "mental_model",
      "key_example",
      "memory_cue",
    ]);
    expect(els.find((e) => e.name === "core_concept")?.text).toBe("Linear algebra");
    expect(els.find((e) => e.name === "mental_model")?.text).toBe(
      'Data as "arrows" in space; matrices reshape it.',
    );
    // Structured anchors are never emitted as text deltas.
    expect(els.some((e) => e.name === "key_formula" || e.name === "diagram")).toBe(false);
  });

  test("empty / pre-mccr input yields nothing (no throw)", () => {
    expect(extractCompletedMccrElements("")).toEqual([]);
    expect(extractCompletedMccrElements("```json\n{")).toEqual([]);
    expect(extractCompletedMccrElements('{"narration_script":{}}')).toEqual([]);
    expect(extractCompletedMccrElements('{"mccr":')).toEqual([]);
    expect(extractCompletedMccrElements('{"mccr":{')).toEqual([]);
  });

  test("a value still forming is NOT emitted; the completed prefix before it IS", () => {
    // core_concept complete, definition mid-string.
    const partial = '{"mccr":{"core_concept":"Linear algebra","definition":"The study of vec';
    expect(namesOf(partial)).toEqual(["core_concept"]);
  });

  test("monotonic growth: streaming byte-by-byte only ever ADDS completed anchors", () => {
    const seenCounts: number[] = [];
    let prev: string[] = [];
    for (let i = 1; i <= FULL.length; i++) {
      const names = namesOf(FULL.slice(0, i));
      // never loses a previously-completed anchor
      for (const p of prev) expect(names).toContain(p);
      prev = names;
      seenCounts.push(names.length);
    }
    // ends with all five
    expect(prev).toEqual([
      "core_concept",
      "definition",
      "mental_model",
      "key_example",
      "memory_cue",
    ]);
    // and grew monotonically
    for (let i = 1; i < seenCounts.length; i++) {
      expect(seenCounts[i]!).toBeGreaterThanOrEqual(seenCounts[i - 1]!);
    }
  });

  test("truncation at EVERY byte never throws and never returns a partial value", () => {
    for (let i = 0; i <= FULL.length; i++) {
      const els = extractCompletedMccrElements(FULL.slice(0, i));
      // Any returned anchor's text must be a prefix-complete value equal to the final one.
      for (const el of els) {
        const finalText = extractCompletedMccrElements(FULL).find((e) => e.name === el.name)?.text;
        expect(el.text).toBe(finalText);
      }
    }
  });

  test("handles escaped quotes and unicode escapes inside a string value", () => {
    const s = JSON.stringify({
      mccr: {
        core_concept: 'He said "hi"',
        definition: "café — a place",
        mental_model: "line1\nline2",
      },
    });
    const els = extractCompletedMccrElements(s);
    expect(els.find((e) => e.name === "core_concept")?.text).toBe('He said "hi"');
    expect(els.find((e) => e.name === "definition")?.text).toBe("café — a place");
    expect(els.find((e) => e.name === "mental_model")?.text).toBe("line1\nline2");
  });

  test("truncation mid-escape does not emit the forming value", () => {
    const s = '{"mccr":{"core_concept":"ok","definition":"tail \\';
    expect(namesOf(s)).toEqual(["core_concept"]);
  });

  test("tolerates a leading ```json fence", () => {
    const els = extractCompletedMccrElements("```json\n" + FULL + "\n```");
    expect(els.map((e) => e.name)).toEqual([
      "core_concept",
      "definition",
      "mental_model",
      "key_example",
      "memory_cue",
    ]);
  });

  test("a structured anchor mid-stream blocks later anchors until it closes", () => {
    // key_formula object is truncated → nothing after it (mental_model) is emitted yet.
    const partial = '{"mccr":{"core_concept":"C","definition":"D","key_formula":{"latex":"A x';
    expect(namesOf(partial)).toEqual(["core_concept", "definition"]);
    // Once key_formula closes, mental_model can be reached.
    const more =
      '{"mccr":{"core_concept":"C","definition":"D","key_formula":{"latex":"Ax","plain":"a"},"mental_model":"M"}';
    expect(namesOf(more)).toEqual(["core_concept", "definition", "mental_model"]);
  });
});
