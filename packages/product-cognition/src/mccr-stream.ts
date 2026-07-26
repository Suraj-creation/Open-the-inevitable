/**
 * Incremental MCCR element extraction for live board streaming (ADR-0063 Phase B).
 *
 * The Surface Composer emits ONE structured payload — `{"mccr":{…},"narration_script":{…},
 * "image_plan":{…}}`. To let a learner *watch the board form* while the model is still generating,
 * we stream the composer's tokens and, after each chunk, ask this pure function which MCCR anchors
 * have *fully arrived* so the session can emit a `surface.frame.element.delta` for each newly
 * completed one (element-completion granularity — ADR-0063 Phase B decision).
 *
 * Design constraints:
 * - **Pure + deterministic:** same partial string ⇒ byte-identical result. No wall-clock, no state.
 * - **Truncation-tolerant:** the input may be cut off at ANY byte (mid-key, mid-string, mid-escape).
 *   It returns every anchor completed *so far* and stops at the first incomplete one — never throws.
 * - **String anchors only:** the prose anchors (`core_concept`, `definition`, `mental_model`,
 *   `key_example`, `memory_cue`) carry text worth previewing as it forms. Structured anchors
 *   (`key_formula`, `diagram`, `table`, `process`, `code`, `relationship`, `misconception`) are
 *   skipped here — they land whole with `surface.frame.composed`. Streaming raw JSON for them would
 *   be noise, not cognition.
 *
 * The settled board is ALWAYS `surface.frame.composed` (which clears the transient stream buffer —
 * projection.ts), so these previews never affect canonical state; they are a live reveal only.
 */

/** A completed MCCR string anchor: its slot name and the fully-received text. */
export interface CompletedMccrElement {
  /** The MCCR slot name, e.g. `core_concept`. Element id on the board is `el-<name>`. */
  readonly name: string;
  /** The fully-received string value (unescaped). */
  readonly text: string;
}

/**
 * Live board-streaming sink (ADR-0063 Phase B). The Surface Composer calls this once per MCCR string
 * anchor, the moment that anchor's value is fully received from the model stream — the session turns
 * each call into a `surface.frame.element.delta` (a transient reveal, cleared by `surface.frame.composed`).
 * `onElementComplete` may be async; the composer awaits it so anchors surface in document order.
 */
export interface FrameElementSink {
  onElementComplete(name: string, text: string): void | Promise<void>;
}

const STRING_ANCHORS: ReadonlySet<string> = new Set([
  "core_concept",
  "definition",
  "mental_model",
  "key_example",
  "memory_cue",
]);

const isWs = (c: string): boolean => c === " " || c === "\t" || c === "\n" || c === "\r";

/**
 * Read a JSON string literal starting at `start` (which must index the opening quote). Returns the
 * unescaped value and the index just past the closing quote, or null when the string is not yet
 * fully received (truncated before its closing quote, or truncated mid-escape).
 */
function readJsonString(s: string, start: number): { value: string; end: number } | null {
  if (s[start] !== '"') return null;
  let i = start + 1;
  let out = "";
  const n = s.length;
  while (i < n) {
    const c = s[i]!;
    if (c === "\\") {
      // Need at least the escape char AND the next char to decode — otherwise it's truncated.
      if (i + 1 >= n) return null;
      const esc = s[i + 1]!;
      switch (esc) {
        case '"':
          out += '"';
          break;
        case "\\":
          out += "\\";
          break;
        case "/":
          out += "/";
          break;
        case "b":
          out += "\b";
          break;
        case "f":
          out += "\f";
          break;
        case "n":
          out += "\n";
          break;
        case "r":
          out += "\r";
          break;
        case "t":
          out += "\t";
          break;
        case "u": {
          if (i + 5 >= n) return null; // \uXXXX truncated
          const hex = s.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) return null;
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
        default:
          out += esc; // tolerant: pass through an unknown escape
      }
      i += 2;
      continue;
    }
    if (c === '"') return { value: out, end: i + 1 };
    out += c;
    i++;
  }
  return null; // no closing quote yet
}

/**
 * Skip a balanced `{…}` or `[…]` starting at `start`. Returns the index just past the matching
 * close, or -1 when the structure is not yet fully received (truncated). Tracks string state so
 * braces inside strings don't disturb the depth count.
 */
function skipBalanced(s: string, start: number): number {
  const open = s[start];
  if (open !== "{" && open !== "[") return -1;
  let depth = 0;
  let i = start;
  const n = s.length;
  let inStr = false;
  while (i < n) {
    const c = s[i]!;
    if (inStr) {
      if (c === "\\") {
        if (i + 1 >= n) return -1; // truncated mid-escape
        i += 2;
        continue;
      }
      if (c === '"') inStr = false;
      i++;
      continue;
    }
    if (c === '"') {
      inStr = true;
      i++;
      continue;
    }
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return -1; // never balanced ⇒ still forming
}

/** Skip a primitive (number/true/false/null) until the next `,` or closing `}`; -1 if truncated. */
function skipPrimitive(s: string, start: number): number {
  let i = start;
  const n = s.length;
  while (i < n) {
    const c = s[i]!;
    if (c === "," || c === "}" || isWs(c)) return i;
    i++;
  }
  return -1; // ran off the end ⇒ can't be sure it's complete
}

/**
 * Given accumulated partial composer JSON, return the MCCR string anchors that have fully arrived,
 * in document order. Robust to a leading ```json fence (it locates the `"mccr"` object by substring)
 * and to truncation at any byte. Non-string anchors are consumed but not returned.
 */
export function extractCompletedMccrElements(partial: string): CompletedMccrElement[] {
  const out: CompletedMccrElement[] = [];
  const mccrKey = partial.indexOf('"mccr"');
  if (mccrKey < 0) return out;
  let i = partial.indexOf("{", mccrKey);
  if (i < 0) return out;
  i++; // step past the mccr object's opening brace
  const n = partial.length;
  while (i < n) {
    while (i < n && (isWs(partial[i]!) || partial[i] === ",")) i++;
    if (i >= n) break;
    if (partial[i] === "}") break; // mccr object closed
    if (partial[i] !== '"') break; // not positioned at a key ⇒ stop (tolerant)
    const keyRes = readJsonString(partial, i);
    if (!keyRes) break; // key not fully received yet
    const key = keyRes.value;
    i = keyRes.end;
    while (i < n && isWs(partial[i]!)) i++;
    if (i >= n || partial[i] !== ":") break;
    i++;
    while (i < n && isWs(partial[i]!)) i++;
    if (i >= n) break;
    const c = partial[i]!;
    if (c === '"') {
      const valRes = readJsonString(partial, i);
      if (!valRes) break; // this value's string is still forming ⇒ stop here
      if (STRING_ANCHORS.has(key)) out.push({ name: key, text: valRes.value });
      i = valRes.end;
    } else if (c === "{" || c === "[") {
      const end = skipBalanced(partial, i);
      if (end < 0) break; // structured value still forming
      i = end; // consumed but not emitted (structured anchors land with frame.composed)
    } else {
      const end = skipPrimitive(partial, i);
      if (end < 0) break;
      i = end;
    }
  }
  return out;
}
