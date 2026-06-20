/**
 * CognitiveStage — the center of gravity. One concept is in focus, rendered richly and spotlighted;
 * everything else recedes into a dim context ribbon. This is the "theater of thought": the learner
 * watches the focused cognition, not a feed. Pure projection of the focused CognitionBlock.
 */
import type { CognitionBlock } from "@inevitable/surface/client";
import { identityFor } from "../agents";
import { blockLede, renderBlockBody } from "../blocks";

export interface CognitiveStageProps {
  readonly block: CognitionBlock | null;
  readonly speaking: boolean;
  readonly context: readonly CognitionBlock[];
  readonly activeId: string | null;
  readonly onSelect: (blockId: string) => void;
  readonly thinking: boolean;
}

export function CognitiveStage({
  block,
  speaking,
  context,
  activeId,
  onSelect,
  thinking,
}: CognitiveStageProps) {
  if (!block) {
    return (
      <section className="stage stage-empty" aria-live="polite">
        <div className="stage-core stage-core-empty">
          <span className={`stage-pulse ${thinking ? "is-thinking" : ""}`} aria-hidden />
          <p className="stage-empty-line">
            {thinking ? "Understanding your goal…" : "The surface is listening."}
          </p>
          <p className="stage-empty-sub">Cognition will take the stage as it unfolds.</p>
        </div>
      </section>
    );
  }

  const agent = identityFor(block.provenance.agent_id ?? block.provenance.producer_cid);

  return (
    <section className="stage" aria-live="polite">
      <article
        key={block.block_id}
        className={`stage-core ${speaking ? "is-speaking" : ""}`}
        style={{ ["--stage-accent" as string]: agent.accent }}
      >
        <header className="stage-head">
          <span className="stage-agent">
            <span className="stage-sigil" style={{ color: agent.accent }}>
              {agent.sigil}
            </span>
            {agent.label}
          </span>
          <span className="stage-kind">{block.block_type}</span>
          {speaking ? <span className="stage-live">narrating</span> : null}
        </header>
        <h2 className="stage-title">{block.title.replace(/^.*—\s*/, "")}</h2>
        <div className="stage-body">{renderBlockBody(block)}</div>
      </article>

      {context.length > 0 ? (
        <div className="stage-ribbon" role="tablist" aria-label="Other cognition on this surface">
          {context.map((b) => {
            const id = identityFor(b.provenance.agent_id ?? b.provenance.producer_cid);
            return (
              <button
                key={b.block_id}
                type="button"
                role="tab"
                aria-selected={b.block_id === activeId}
                className={`facet ${b.block_id === activeId ? "is-active" : ""}`}
                style={{ ["--facet-accent" as string]: id.accent }}
                onClick={() => onSelect(b.block_id)}
                title={blockLede(b)}
              >
                <span className="facet-sigil" style={{ color: id.accent }}>
                  {id.sigil}
                </span>
                <span className="facet-kind">{b.block_type}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
