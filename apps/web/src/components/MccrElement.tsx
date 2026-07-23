/**
 * MccrElement — renders one distilled visual anchor of the Minimal Complete Cognitive Representation
 * (UCS, ADR-0030). A small registry keyed by element type, parallel to blocks.tsx. The board holds
 * only these anchors — never teaching prose (that is the narration's job). `diagram`/`table` are
 * deterministic client-rendered projections (data only, no provider). Each element carries
 * `data-element-id` so the HighlightLayer can spotlight the one the narration is discussing.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import type { MccrDiagram, MccrElement as MccrElementModel } from "@inevitable/surface/client";
import { ensureKatex, latexToHtml, mathRendererVersion, subscribeMathRenderer } from "../latex";

export const TYPE_LABEL: Record<string, string> = {
  core_concept: "Concept",
  definition: "Definition",
  key_formula: "Key formula",
  diagram: "Diagram",
  relationship: "Relationship",
  mental_model: "Mental model",
  table: "Table",
  key_example: "Example",
  memory_cue: "Remember",
  misconception: "Watch out",
  image: "Illustration",
  source_viewport: "From the source",
  process: "Steps",
  code: "Code",
};

/**
 * A targeted act the learner can perform on a specific anchor (F16 causal transparency; CSE-014
 * interaction grammar, M8 T2). Reshaping asks re-frame cognition; `annotate` is a Mark that evolves
 * the Scene in place (the learner acts on cognition — ADR-0033 organ 4).
 */
export type ElementAction = "request_simplify" | "request_depth" | "challenge" | "annotate";

const ELEMENT_ACTIONS: ReadonlyArray<{ kind: ElementAction; label: string; hint: string }> = [
  { kind: "request_simplify", label: "Simpler", hint: "Explain this more simply" },
  { kind: "request_depth", label: "Deeper", hint: "Go deeper on this" },
  { kind: "challenge", label: "Why?", hint: "Challenge or justify this" },
  { kind: "annotate", label: "Mark", hint: "Mark this — the Scene keeps your note" },
];

export function MccrElementView({
  element,
  active,
  revealed = true,
  marked = false,
  receded = false,
  epistemicRole,
  hierarchy,
  onAction,
}: {
  readonly element: MccrElementModel;
  readonly active: boolean;
  /** Staged reveal (UCS, ADR-0030): false until the narration reaches this element. */
  readonly revealed?: boolean;
  /** The learner has marked this anchor (a scene evolution, CSE M8 T2) — show a durable mark. */
  readonly marked?: boolean;
  /** R3d (ADR-0057; CSE-012 §4): the Scene's lighting recedes this actor (it's not the focus). */
  readonly receded?: boolean;
  /** R4b (ADR-0058; CSE-018 Law 5): the RIA's epistemic role — the KIND of knowledge, as a CDL hue. */
  readonly epistemicRole?: string;
  /** R4b: the RIA's representational hierarchy (primary/supporting/residue). */
  readonly hierarchy?: string;
  /** Act on the lesson from THIS anchor — makes the board manipulable (F16, CSE-014). Passes the
   *  element id so a Mark targets the anchor. Absent ⇒ read-only. */
  readonly onAction?: (kind: ElementAction, elementId: string) => void;
}) {
  return (
    <figure
      className={`mccr-el mccr-el--${element.type}`}
      data-element-id={element.element_id}
      data-active={active ? "true" : "false"}
      data-revealed={revealed ? "true" : "false"}
      data-marked={marked ? "true" : "false"}
      {...(receded ? { "data-lit": "recede" } : {})}
      {...(epistemicRole ? { "data-epistemic-role": epistemicRole } : {})}
      {...(hierarchy ? { "data-hierarchy": hierarchy } : {})}
    >
      <span className="mccr-el-tag" aria-hidden>
        {TYPE_LABEL[element.type] ?? element.type}
      </span>
      {marked ? (
        <span
          className="mccr-el-mark"
          title="You marked this — the Scene kept your note"
          aria-label="marked"
        >
          ✎
        </span>
      ) : null}
      <div className="mccr-el-body">{renderContent(element, active)}</div>
      {onAction ? (
        <div className="mccr-el-actions" role="group" aria-label={`Act on ${element.type}`}>
          {ELEMENT_ACTIONS.map((a) => (
            <button
              key={a.kind}
              type="button"
              className="mccr-el-action"
              onClick={() => onAction(a.kind, element.element_id)}
              title={a.hint}
              aria-label={a.hint}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
    </figure>
  );
}

function renderContent(element: MccrElementModel, active: boolean) {
  const content = element.content;
  switch (content.kind) {
    case "text":
      return <p className="mccr-text">{content.text}</p>;
    case "formula":
      // Rendered math (KaTeX once loaded; instant fallback before). `plain` is the accessible +
      // spoken fallback; the raw LaTeX is never shown to the learner. A multi-line derivation
      // renders as a stacked sequence — the board reads like a textbook page, not a web page.
      // R3a (ADR-0057): while this formula is the active (spoken) element, its derivation lines
      // stage in one by one — the learner watches the derivation constructed, not handed over whole.
      return (
        <FormulaView
          latex={content.latex}
          plain={content.plain}
          lines={content.lines}
          {...(content.line_labels ? { lineLabels: content.line_labels } : {})}
          progressive={active}
        />
      );
    case "relationship":
      return (
        <p className="mccr-relationship">
          <span className="mccr-rel-node">{content.from}</span>
          <span className="mccr-rel-arrow" aria-hidden>
            →
          </span>
          <span className="mccr-rel-node">{content.to}</span>
          {content.relation ? <span className="mccr-rel-label">{content.relation}</span> : null}
          {content.text ? <span className="mccr-rel-text">{content.text}</span> : null}
        </p>
      );
    case "misconception":
      // R4e (ADR-0058; CSE-013 dissolve grammar): not two facts side by side — the wrong belief
      // struck through, resolving DOWN into the correction. While spoken, the dissolve plays.
      return (
        <MisconceptionView
          wrong={content.wrong}
          correction={content.correction}
          dissolving={active}
        />
      );
    case "diagram":
      return <DiagramView diagram={content.diagram} />;
    case "process":
      // R4e (ADR-0058; CSE-018 §6): an ordered procedure — the steps reveal one at a time while
      // the narration is on this anchor, so the learner watches the process unfold.
      return <StepsView steps={content.steps} progressive={active} />;
    case "code":
      // R4e (ADR-0058; CSE-018 §6): real source, indentation preserved, salient lines annotated.
      return <CodeView language={content.language} lines={content.lines} active={active} />;
    case "table":
      return <TableView headers={content.headers} rows={content.rows} />;
    case "image":
      return <ImageView content={content} />;
    case "source_viewport":
      // Anchored evidence on the board (CSE M5): the source's own words in the EVIDENCE provenance
      // channel — visibly the source's voice, never restyled into the surface's (CSE-008 §7).
      return (
        <blockquote className="mccr-source" data-provenance="evidence">
          <p className="mccr-source-quote">{content.quote}</p>
          <footer className="mccr-source-ref">
            {content.region.page !== null ? `p. ${content.region.page}` : content.region.path}
          </footer>
        </blockquote>
      );
    default:
      return null;
  }
}

/**
 * A comparison table under the no-scroll law. The board shows the first rows; the remainder is
 * DISCLOSED, never silently lost — "+ N more rows" opens the full table on a glass focus plane
 * (the same pattern as folded anchors: progressive disclosure, not truncation).
 */
function TableView({
  headers,
  rows,
}: {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}) {
  const MAX_ROWS = 8;
  const [expanded, setExpanded] = useState(false);
  const shown = rows.slice(0, MAX_ROWS);
  const hidden = rows.length - shown.length;
  const renderTable = (tableRows: readonly (readonly string[])[]) => (
    <table className="mccr-table">
      {headers.length > 0 && (
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {tableRows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => (
              <td key={c}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <div className="mccr-table-wrap">
      {renderTable(shown)}
      {hidden > 0 ? (
        <button
          type="button"
          className="mccr-table-more"
          onClick={() => setExpanded(true)}
          aria-haspopup="dialog"
        >
          + {hidden} more {hidden === 1 ? "row" : "rows"}
        </button>
      ) : null}
      {expanded ? (
        <div className="mccr-focus-layer mccr-focus-layer--table" role="dialog" aria-label="Table">
          <button
            type="button"
            className="mccr-focus-scrim"
            onClick={() => setExpanded(false)}
            aria-label="Close"
          />
          <div className="mccr-focus-card">
            {renderTable(rows)}
            <button
              type="button"
              className="overlay-close mccr-focus-close"
              onClick={() => setExpanded(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * A misconception rendered as a DISSOLVE (R4e; ADR-0058; CSE-013), not a flat comparison: the false
 * belief is stated as the learner holds it, struck through, and resolves DOWN into the correction —
 * the learner watches the wrong model give way to the right one (Law 2 Progressive Construction).
 * While the narration is on this anchor (`dissolving`) the transition plays; otherwise both states
 * rest in place. Under prefers-reduced-motion the CSS drops the motion — the strike, the arrow, and
 * the correction still carry the whole meaning, so nothing is lost without the animation.
 */
function MisconceptionView({
  wrong,
  correction,
  dissolving = false,
}: {
  readonly wrong: string;
  readonly correction: string;
  readonly dissolving?: boolean;
}) {
  return (
    <div className="mccr-misconception" {...(dissolving ? { "data-dissolving": "true" } : {})}>
      <p className="mccr-misconception-wrong">
        <span className="mccr-misconception-mark mccr-misconception-mark--wrong" aria-hidden>
          ✗
        </span>
        <s>{wrong}</s>
      </p>
      <span className="mccr-misconception-arrow" aria-hidden>
        ↓
      </span>
      <p className="mccr-misconception-right">
        <span className="mccr-misconception-mark mccr-misconception-mark--right" aria-hidden>
          ✓
        </span>
        {correction}
      </p>
    </div>
  );
}

type ProcessContent = Extract<MccrElementModel["content"], { kind: "process" }>;

/**
 * R4e (ADR-0058; CSE-018 §6 process/algorithm grammar): an ordered procedure rendered as a numbered
 * sequence. While the narration is on this anchor (`progressive`) the steps stage in one at a time —
 * the learner watches the process unfold, the same whiteboard feel as the derivation. At rest every
 * step is present. Reduced-motion drops the staging (CSS), so no step is ever hidden by motion.
 */
function StepsView({
  steps,
  progressive = false,
}: {
  readonly steps: ProcessContent["steps"];
  readonly progressive?: boolean;
}) {
  return (
    <ol className={`mccr-process${progressive ? " mccr-process--staging" : ""}`}>
      {steps.map((step, i) => (
        <li key={i} className="mccr-process-step" style={{ ["--line-index" as string]: i }}>
          <span className="mccr-process-text">{step.text}</span>
          {step.detail ? <span className="mccr-process-detail">{step.detail}</span> : null}
        </li>
      ))}
    </ol>
  );
}

type CodeContent = Extract<MccrElementModel["content"], { kind: "code" }>;

/**
 * R4e (ADR-0058; CSE-018 §6 code grammar): real source rendered as a first-class anchor — monospace,
 * indentation preserved, language-tagged. A line's `note` annotates a salient line (only the taught
 * lines are annotated); while the narration is on this anchor (`active`) the annotated lines are
 * emphasized so the learner's eye lands where the voice is. Static layout — no motion to gate.
 */
function CodeView({
  language,
  lines,
  active,
}: {
  readonly language: CodeContent["language"];
  readonly lines: CodeContent["lines"];
  readonly active: boolean;
}) {
  return (
    <div className="mccr-code" data-language={language} data-active={active ? "true" : "false"}>
      <span className="mccr-code-lang" aria-hidden>
        {language}
      </span>
      <pre className="mccr-code-pre">
        <code>
          {lines.map((line, i) => (
            <span
              key={i}
              className="mccr-code-line"
              {...(line.note ? { "data-noted": "true" } : {})}
            >
              {/* A zero-width space keeps blank lines from collapsing in the flex row. */}
              <span className="mccr-code-text">{line.text === "" ? "​" : line.text}</span>
              {line.note ? <span className="mccr-code-note">{line.note}</span> : null}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

type ImageContent = Extract<MccrElementModel["content"], { kind: "image" }>;

/**
 * Image-as-cognition (ADR-0030 Phase 4). A failed artifact load must never leave a blank hole:
 * the caption and callout labels ARE the cognition — they survive as a quiet text panel while the
 * pixels are declared missing (honest degradation, review §22).
 */
function ImageView({ content }: { readonly content: ImageContent }) {
  const [failed, setFailed] = useState(false);
  if (!content.artifact) {
    return (
      <div className="mccr-image mccr-image--pending" aria-label={content.alt}>
        <span className="mccr-image-shimmer" />
      </div>
    );
  }
  if (failed) {
    return (
      <div className="mccr-image mccr-image--failed" role="note" aria-label={content.alt}>
        <p className="mccr-image-failed-note">Illustration unavailable</p>
        {content.caption || content.alt ? (
          <p className="mccr-image-failed-caption">{content.caption ?? content.alt}</p>
        ) : null}
        {content.labels.length > 0 ? (
          <ul className="mccr-image-labels mccr-image-labels--inline">
            {content.labels.map((label, i) => (
              <li key={`${label}-${i}`} className="mccr-image-label">
                {label}
              </li>
            ))}
          </ul>
        ) : null}
        <ImageRationale rationale={content.rationale} />
      </div>
    );
  }
  return (
    <figure className="mccr-image">
      <div className="mccr-image-frame">
        <img
          src={content.artifact.content_ref}
          alt={content.alt}
          loading="eager"
          onError={() => setFailed(true)}
        />
        {/* Callout labels annotate the illustration's salient parts. */}
        {content.labels.length > 0 ? (
          <ul className="mccr-image-labels" aria-label="Illustration callouts">
            {content.labels.map((label, i) => (
              <li key={`${label}-${i}`} className="mccr-image-label">
                {label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {content.caption || content.alt ? (
        <figcaption>{content.caption ?? content.alt}</figcaption>
      ) : null}
      <ImageRationale rationale={content.rationale} />
    </figure>
  );
}

/**
 * R4e (ADR-0058; CSE-018 Law 9): an image on the board is never mute decoration — it carries the
 * recorded reason it earns its place. Shown as a quiet, opt-in disclosure so the WHY is always one
 * step away (F16 causal transparency) without competing with the illustration itself. Static text —
 * no motion to gate.
 */
function ImageRationale({ rationale }: { readonly rationale?: string | null }) {
  if (!rationale) return null;
  return (
    <details className="mccr-image-rationale">
      <summary>Why this image</summary>
      <p>{rationale}</p>
    </details>
  );
}

/**
 * A formula (or a stacked multi-line derivation), rendered through the math seam. Subscribes to
 * the renderer upgrade so the board re-renders from the instant fallback to publication-grade
 * KaTeX the moment its lazy chunk lands — no flash, no reload.
 */
function FormulaView({
  latex,
  plain,
  lines,
  lineLabels,
  progressive = false,
}: {
  readonly latex: string;
  readonly plain: string;
  readonly lines: readonly string[];
  /** R4c (ADR-0058; CSE-018 §6): the transformation label per derivation line (aligned by index). */
  readonly lineLabels?: readonly string[];
  /** R3a (ADR-0057): stage the derivation lines in sequence while this formula is being spoken. */
  readonly progressive?: boolean;
}) {
  useSyncExternalStore(subscribeMathRenderer, mathRendererVersion, mathRendererVersion);
  useEffect(() => ensureKatex(), []);
  if (lines.length > 1) {
    return (
      <span
        className={`mccr-formula mccr-formula--derivation${
          progressive ? " mccr-formula--staging" : ""
        }`}
        role="math"
        aria-label={plain || latex}
        title={plain}
      >
        {lines.map((line, i) => {
          const label = lineLabels?.[i]?.trim();
          return (
            <span key={i} className="mccr-formula-line" style={{ ["--line-index" as string]: i }}>
              <span
                className="mccr-formula-latex"
                dangerouslySetInnerHTML={{ __html: latexToHtml(line) }}
              />
              {label ? <span className="mccr-formula-label">{label}</span> : null}
            </span>
          );
        })}
      </span>
    );
  }
  return (
    <span
      className="mccr-formula"
      role="math"
      aria-label={plain || latex}
      title={plain}
      dangerouslySetInnerHTML={{ __html: latexToHtml(latex, plain) }}
    />
  );
}

interface DiagramPos {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

const DIAGRAM_W = 340;
const DIAGRAM_H = 190;

/**
 * Deterministic node positions BY DIAGRAM KIND (UCS, ADR-0030): the planner's `kind` carries
 * pedagogical structure, so a flow, a tree, an axes plane, and a free graph must not all collapse to
 * one ring. Pure + replay-safe (no provider, layout is a function of the data + index).
 */
export function layoutDiagram(diagram: MccrDiagram): DiagramPos[] {
  const nodes = diagram.nodes;
  const n = nodes.length;
  const W = DIAGRAM_W;
  const H = DIAGRAM_H;
  const padX = 44;
  const padY = 34;
  if (n === 0) return [];
  if (n === 1) return [{ id: nodes[0]!.id, x: W / 2, y: H / 2 }];

  switch (diagram.kind) {
    case "flow": {
      // A left-to-right pipeline: evenly spaced along a single row (the assembly line).
      const step = (W - 2 * padX) / (n - 1);
      return nodes.map((nd, i) => ({ id: nd.id, x: padX + i * step, y: H / 2 }));
    }
    case "tree": {
      // Layered top-down: rank nodes by their longest incoming-edge depth, spread each rank across.
      const depth = treeDepths(diagram);
      const maxDepth = Math.max(0, ...depth.values());
      const perRank = new Map<number, number>();
      const rankIndex = new Map<string, number>();
      for (const nd of nodes) {
        const d = depth.get(nd.id) ?? 0;
        const idx = perRank.get(d) ?? 0;
        rankIndex.set(nd.id, idx);
        perRank.set(d, idx + 1);
      }
      const rowStep = maxDepth > 0 ? (H - 2 * padY) / maxDepth : 0;
      return nodes.map((nd) => {
        const d = depth.get(nd.id) ?? 0;
        const count = perRank.get(d) ?? 1;
        const idx = rankIndex.get(nd.id) ?? 0;
        const colStep = (W - 2 * padX) / Math.max(1, count);
        return { id: nd.id, x: padX + colStep * (idx + 0.5), y: padY + d * rowStep };
      });
    }
    case "axes": {
      // A coordinate plane: place nodes around the quadrants, stable by index.
      const cx = W / 2;
      const cy = H / 2;
      const rx = (W - 2 * padX) / 2;
      const ry = (H - 2 * padY) / 2;
      return nodes.map((nd, i) => {
        const angle = (2 * Math.PI * i) / n - Math.PI / 4;
        return { id: nd.id, x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
      });
    }
    case "cycle": {
      // A closed loop (water cycle, feedback loop, TCA cycle): a ring ordered by the edge chain
      // when one exists, so arrows flow around the circle instead of criss-crossing it.
      const order = cycleOrder(diagram);
      const cx = W / 2;
      const cy = H / 2;
      const r = Math.min(W, H) / 2 - 40;
      const posByIndex = new Map(
        order.map((id, i) => {
          const angle = (2 * Math.PI * i) / n - Math.PI / 2;
          return [id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }] as const;
        }),
      );
      return nodes.map((nd) => {
        const p = posByIndex.get(nd.id) ?? { x: cx, y: cy };
        return { id: nd.id, x: p.x, y: p.y };
      });
    }
    case "node-graph":
    default: {
      // A free relationship graph: a stable ring, ordered so higher-degree nodes sit opposite
      // one another (spreads the visual weight; deterministic — a function of the data only).
      const cx = W / 2;
      const cy = H / 2;
      const r = Math.min(W, H) / 2 - 40;
      return nodes.map((nd, i) => {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        return { id: nd.id, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
      });
    }
  }
}

/** Order cycle nodes by walking the edge chain from the first node (falls back to given order). */
function cycleOrder(diagram: MccrDiagram): string[] {
  const next = new Map<string, string>();
  for (const e of diagram.edges) {
    if (!next.has(e.from)) next.set(e.from, e.to);
  }
  const start = diagram.nodes[0]?.id;
  if (!start) return [];
  const order: string[] = [];
  const seen = new Set<string>();
  let current: string | undefined = start;
  while (current && !seen.has(current) && order.length < diagram.nodes.length) {
    order.push(current);
    seen.add(current);
    current = next.get(current);
  }
  // Any nodes not on the chain keep their declared order after it.
  for (const nd of diagram.nodes) {
    if (!seen.has(nd.id)) order.push(nd.id);
  }
  return order;
}

/** Longest-path depth of each node from a root (no incoming edges), for the tree layout. */
function treeDepths(diagram: MccrDiagram): Map<string, number> {
  const depth = new Map<string, number>();
  const incoming = new Map<string, string[]>();
  for (const nd of diagram.nodes) incoming.set(nd.id, []);
  for (const e of diagram.edges) incoming.get(e.to)?.push(e.from);
  const visiting = new Set<string>();
  const resolve = (id: string): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (visiting.has(id)) return 0; // cycle guard — treat as a root
    visiting.add(id);
    const parents = incoming.get(id) ?? [];
    const d = parents.length === 0 ? 0 : 1 + Math.max(...parents.map(resolve));
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  for (const nd of diagram.nodes) resolve(nd.id);
  return depth;
}

/**
 * A deterministic, pure SVG projection of an MCCR diagram — the same principle as the concept-map
 * block (no provider, replay-safe). Layout is chosen by `diagram.kind`
 * (flow/tree/axes/cycle/node-graph); node hue by semantic `group` (structure, never decoration).
 */
function DiagramView({ diagram }: { readonly diagram: MccrDiagram }) {
  const nodes = diagram.nodes;
  if (nodes.length === 0) return null;
  const pos = layoutDiagram(diagram);
  const at = (id: string) => pos.find((p) => p.id === id);
  const directed = diagram.kind === "flow" || diagram.kind === "tree" || diagram.kind === "cycle";
  // Deterministic group → hue index (order of first appearance); ungrouped nodes stay neutral.
  const groupIndex = new Map<string, number>();
  for (const nd of nodes) {
    if (nd.group && !groupIndex.has(nd.group)) groupIndex.set(nd.group, groupIndex.size);
  }
  return (
    <svg
      className={`mccr-diagram mccr-diagram--${diagram.kind}`}
      viewBox={`0 0 ${DIAGRAM_W} ${DIAGRAM_H}`}
      role="img"
      aria-label={`${diagram.kind} diagram`}
    >
      {directed ? (
        <defs>
          <marker
            id="mccr-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L8,4 L0,8 z" />
          </marker>
        </defs>
      ) : null}
      {/* An axes diagram gets its actual axes — a coordinate plane without axis lines is a ring. */}
      {diagram.kind === "axes" ? (
        <g className="mccr-diagram-axes" aria-hidden>
          <line x1={DIAGRAM_W / 2} y1={10} x2={DIAGRAM_W / 2} y2={DIAGRAM_H - 10} />
          <line x1={16} y1={DIAGRAM_H / 2} x2={DIAGRAM_W - 16} y2={DIAGRAM_H / 2} />
        </g>
      ) : null}
      {diagram.edges.map((e, i) => {
        const a = at(e.from);
        const b = at(e.to);
        if (!a || !b) return null;
        return (
          <g key={i} className="mccr-diagram-edge">
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              markerEnd={directed ? "url(#mccr-arrow)" : undefined}
            />
            {e.relation ? (
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} className="mccr-diagram-edge-label">
                {truncateLabel(e.relation, 18)}
              </text>
            ) : null}
          </g>
        );
      })}
      {pos.map((p, i) => {
        const node = nodes[i]!;
        const gi = node.group ? groupIndex.get(node.group) : undefined;
        return (
          <g
            key={p.id}
            className={`mccr-diagram-node${gi !== undefined ? ` mccr-diagram-node--g${gi % 5}` : ""}`}
            transform={`translate(${p.x},${p.y})`}
          >
            <circle r={6} />
            <text y={-12} textAnchor="middle">
              {truncateLabel(node.label, 24)}
              <title>{node.label}</title>
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function truncateLabel(label: string, max: number): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}
