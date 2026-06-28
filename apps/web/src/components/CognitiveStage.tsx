/**
 * CognitiveStage — the center of gravity. One concept is in focus, rendered richly and spotlighted;
 * everything else recedes into a dim context ribbon. This is the "theater of thought": the learner
 * watches the focused cognition, not a feed. Pure projection of the focused CognitionBlock.
 */
import type { CognitionBlock } from "@inevitable/surface/client";
import { identityFor } from "../agents";
import { renderBlockBody } from "../blocks";
import { ActivityTimeline } from "./ActivityTimeline";

export interface CognitiveStageProps {
  readonly block: CognitionBlock | null;
  readonly speaking: boolean;
  readonly context: readonly CognitionBlock[];
  readonly activeId: string | null;
  readonly onSelect: (blockId: string) => void;
  readonly thinking: boolean;
  /** An in-flight streamed explanation (S-UCS, ADR-0028): show it forming until the whole block lands. */
  readonly streaming?: { readonly text: string } | null;
  /** Media blocks (image/video/sim) sharing the focused concept — rendered inline, beside it (S-UCS). */
  readonly relatedMedia?: readonly CognitionBlock[];
}

export function CognitiveStage({
  block,
  speaking,
  context,
  activeId,
  onSelect,
  thinking,
  streaming,
  relatedMedia = [],
}: CognitiveStageProps) {
  // Streaming preview: cognition is unfolding live — show the text forming with a caret (ADR-0028).
  if (streaming && streaming.text) {
    return (
      <section className="stage" aria-live="polite">
        <article
          className="stage-core is-speaking is-streaming"
          style={{ ["--stage-accent" as string]: "var(--agent-explainer)" }}
        >
          <header className="stage-head">
            <span className="stage-agent">
              <span className="stage-sigil" style={{ color: "var(--agent-explainer)" }}>
                ◈
              </span>
              Explainer
            </span>
            <span className="stage-kind">explanation</span>
            <span className="stage-live">generating</span>
          </header>
          <div className="stage-body">
            <p className="block-lede">
              {streaming.text}
              <span className="stream-caret" aria-hidden />
            </p>
          </div>
        </article>
      </section>
    );
  }

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
  const responseKind = block.content["response_kind"] as string | undefined;
  const fallbackReason = block.content["fallback_reason"] as string | undefined;
  const modelName = block.content["model"] as string | undefined;

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
          {responseKind === "deterministic-fallback" ? (
            <span
              className="stage-badge stage-badge--fallback"
              title={`deterministic fallback${fallbackReason ? ` · ${fallbackReason}` : ""}`}
            >
              deterministic
            </span>
          ) : modelName && modelName !== "null" ? (
            <span className="stage-badge stage-badge--model" title={modelName}>
              {modelName.replace(/^gemini-/, "").replace(/-preview.*$/, "")}
            </span>
          ) : null}
          {speaking ? <span className="stage-live">narrating</span> : null}
        </header>
        <h2 className="stage-title">{block.title.replace(/^.*—\s*/, "")}</h2>
        <div className="stage-body">{renderBlockBody(block)}</div>
        {relatedMedia.length > 0 ? (
          <div className="stage-media" aria-label="Illustrations for this concept">
            {relatedMedia.map((m) => (
              <figure key={m.block_id} className="stage-figure">
                {renderBlockBody(m)}
                <figcaption className="stage-figure-cap">
                  {m.title.replace(/^.*—\s*/, "")}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : null}
      </article>

      {context.length > 0 ? (
        <ActivityTimeline blocks={[...context].reverse()} activeId={activeId} onSelect={onSelect} />
      ) : null}
    </section>
  );
}
