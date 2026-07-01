/**
 * MccrElement — renders one distilled visual anchor of the Minimal Complete Cognitive Representation
 * (UCS, ADR-0030). A small registry keyed by element type, parallel to blocks.tsx. The board holds
 * only these anchors — never teaching prose (that is the narration's job). `diagram`/`table` are
 * deterministic client-rendered projections (data only, no provider). Each element carries
 * `data-element-id` so the HighlightLayer can spotlight the one the narration is discussing.
 */
import type { MccrDiagram, MccrElement as MccrElementModel } from "@inevitable/surface/client";

const TYPE_LABEL: Record<string, string> = {
  core_concept: "Concept",
  definition: "Definition",
  key_formula: "Key formula",
  diagram: "Diagram",
  relationship: "Relationship",
  mental_model: "Mental model",
  table: "Table",
  key_example: "Example",
  memory_cue: "Remember",
  image: "Illustration",
};

export function MccrElementView({
  element,
  active,
}: {
  readonly element: MccrElementModel;
  readonly active: boolean;
}) {
  return (
    <figure
      className={`mccr-el mccr-el--${element.type}`}
      data-element-id={element.element_id}
      data-active={active ? "true" : "false"}
    >
      <span className="mccr-el-tag" aria-hidden>
        {TYPE_LABEL[element.type] ?? element.type}
      </span>
      <div className="mccr-el-body">{renderContent(element)}</div>
    </figure>
  );
}

function renderContent(element: MccrElementModel) {
  const content = element.content;
  switch (content.kind) {
    case "text":
      return <p className="mccr-text">{content.text}</p>;
    case "formula":
      // KaTeX is a deferred enhancement; the `plain` form is the readable + spoken fallback.
      return (
        <code className="mccr-formula" title={content.plain}>
          {content.latex || content.plain}
        </code>
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
    case "diagram":
      return <DiagramView diagram={content.diagram} />;
    case "table":
      return (
        <table className="mccr-table">
          {content.headers.length > 0 && (
            <thead>
              <tr>
                {content.headers.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {content.rows.slice(0, 6).map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "image":
      return content.artifact ? (
        <figure className="mccr-image">
          <div className="mccr-image-frame">
            <img src={content.artifact.content_ref} alt={content.alt} loading="eager" />
            {/* Image-as-cognition (ADR-0030 Phase 4): callout labels annotate the illustration. */}
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
        </figure>
      ) : (
        <div className="mccr-image mccr-image--pending" aria-label={content.alt}>
          <span className="mccr-image-shimmer" />
        </div>
      );
    default:
      return null;
  }
}

/**
 * A deterministic, pure SVG projection of an MCCR diagram — the same principle as the concept-map
 * block (no provider, replay-safe). Nodes are laid out on a simple ring/row; edges drawn beneath.
 */
function DiagramView({ diagram }: { readonly diagram: MccrDiagram }) {
  const nodes = diagram.nodes;
  if (nodes.length === 0) return null;
  const W = 320;
  const H = 180;
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) / 2 - 36;
  // Deterministic positions: a single node centered; ≥2 nodes on a ring (stable by index).
  const pos = nodes.map((n, i) => {
    if (nodes.length === 1) return { id: n.id, x: cx, y: cy };
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    return { id: n.id, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  const at = (id: string) => pos.find((p) => p.id === id);
  return (
    <svg className="mccr-diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="diagram">
      {diagram.edges.map((e, i) => {
        const a = at(e.from);
        const b = at(e.to);
        if (!a || !b) return null;
        return (
          <g key={i} className="mccr-diagram-edge">
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            {e.relation ? (
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} className="mccr-diagram-edge-label">
                {e.relation}
              </text>
            ) : null}
          </g>
        );
      })}
      {pos.map((p, i) => {
        const node = nodes[i]!;
        return (
          <g key={p.id} className="mccr-diagram-node" transform={`translate(${p.x},${p.y})`}>
            <circle r={6} />
            <text y={-12} textAnchor="middle">
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
