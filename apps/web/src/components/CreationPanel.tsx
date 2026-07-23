/**
 * CreationPanel — Creative Cognition made visible (CSE M11 T1; CSE-016, ADR-0049).
 *
 * The learner authors in the draft field — those are THEIR words. The system is a thinking partner,
 * NOT a ghostwriter (Constitution #5): the four assist buttons only ever return STRUCTURE (scaffold
 * slots), adversarial FINDINGS on the draft, generative QUESTIONS, or grounded reference POINTERS —
 * rendered beside the draft, never inserted into it. There is deliberately no "write it for me"
 * affordance and no way for an assist to carry prose: the no-ghostwriter law is structural, and the UI
 * makes that visible (every assist is stamped "disclosed assist · agent.creation", the learner's to use
 * or ignore). A thin fetch container over the pure `CreationBody` so the projection stays testable.
 */
import { useState } from "react";
import {
  assistCreation,
  completeCreation,
  contributeCreation,
  revokeCreation,
  startCreation,
  type CreationView,
  type CreationAssistView,
} from "../api";

const KIND_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [
  { value: "essay", label: "Essay" },
  { value: "argument", label: "Argument" },
  { value: "hypothesis", label: "Hypothesis" },
  { value: "experiment-design", label: "Experiment design" },
  { value: "proof", label: "Proof" },
  { value: "proposal", label: "Proposal" },
];

const ASSIST_MODES: readonly {
  readonly mode: "scaffold" | "critique" | "provocation" | "reference";
  readonly label: string;
  readonly hint: string;
}[] = [
  { mode: "scaffold", label: "Scaffold", hint: "an empty structure to fill — never content" },
  {
    mode: "critique",
    label: "Critique",
    hint: "adversarial findings on your draft — not a rewrite",
  },
  {
    mode: "provocation",
    label: "Provoke",
    hint: "questions that widen your thinking — not answers",
  },
  { mode: "reference", label: "References", hint: "grounded pointers you can cite — not prose" },
];

export function CreationPanel({
  surfaceId,
  conceptRefs,
  seedTitle,
  open,
  onClose,
}: {
  readonly surfaceId: string;
  readonly conceptRefs: readonly string[];
  readonly seedTitle?: string;
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const [kind, setKind] = useState<string>("essay");
  const [title, setTitle] = useState<string>(seedTitle ?? "");
  const [draft, setDraft] = useState<string>("");
  const [creation, setCreation] = useState<CreationView | null>(null);
  const [busy, setBusy] = useState<
    | null
    | "start"
    | "scaffold"
    | "critique"
    | "provocation"
    | "reference"
    | "complete"
    | "contribute"
    | "revoke"
  >(null);

  const begin = (): void => {
    if (!title.trim()) return;
    setBusy("start");
    void startCreation(surfaceId, { kind, title: title.trim(), conceptRefs, draft })
      .then((c) => setCreation(c))
      .finally(() => setBusy(null));
  };

  const askAssist = (mode: "scaffold" | "critique" | "provocation" | "reference"): void => {
    if (!creation) return;
    setBusy(mode);
    // The learner's current draft goes with the request; the assist NEVER writes it back.
    void assistCreation(surfaceId, creation.creation_id, mode, draft)
      .then((c) => {
        if (c) setCreation(c);
      })
      .finally(() => setBusy(null));
  };

  const finish = (): void => {
    if (!creation) return;
    setBusy("complete");
    void completeCreation(surfaceId, creation.creation_id, draft)
      .then((c) => {
        if (c) setCreation(c);
      })
      .finally(() => setBusy(null));
  };

  const contribute = (): void => {
    if (!creation) return;
    // Explicit, deliberate consent to share the draft into the shared substrate (ADR-0051).
    setBusy("contribute");
    void contributeCreation(surfaceId, creation.creation_id, true)
      .then((c) => {
        if (c) setCreation(c);
      })
      .finally(() => setBusy(null));
  };

  const revoke = (): void => {
    if (!creation) return;
    // The learner's sovereign right to un-share — cascades a redaction (ADR-0054).
    setBusy("revoke");
    void revokeCreation(surfaceId, creation.creation_id)
      .then((c) => {
        if (c) setCreation(c);
      })
      .finally(() => setBusy(null));
  };

  if (!open) return null;
  return (
    <div className="frontier-overlay" role="dialog" aria-label="Create">
      <button type="button" className="fused-scrim" onClick={onClose} aria-label="Close" />
      <div className="creation-panel">
        <header className="fused-head">
          <span className="fused-eyebrow creation-eyebrow">Make something</span>
          <h2 className="fused-title">
            {creation ? creation.title : "Create — you author, the system assists"}
          </h2>
          <button type="button" className="overlay-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <p className="creation-law">
          You write every word. The system is a thinking partner, not a ghostwriter — it offers
          structure, critique, questions, and references, never the artifact itself.
        </p>

        {!creation ? (
          <div className="creation-start">
            <label className="creation-field">
              <span>Kind</span>
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="creation-field">
              <span>Title</span>
              <input
                type="text"
                value={title}
                placeholder="What are you making?"
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="fused-run"
              onClick={begin}
              disabled={busy === "start" || !title.trim()}
            >
              {busy === "start" ? "Opening…" : "Start creating →"}
            </button>
          </div>
        ) : (
          <CreationBody
            creation={creation}
            draft={draft}
            onDraft={setDraft}
            onAssist={askAssist}
            onComplete={finish}
            onContribute={contribute}
            onRevoke={revoke}
            busy={busy}
          />
        )}
      </div>
    </div>
  );
}

/** The pure projection (testable without a network): the learner's draft, the assist controls, and
 * the disclosed assists rendered BESIDE the draft — never merged in. */
export function CreationBody({
  creation,
  draft,
  onDraft,
  onAssist,
  onComplete,
  onContribute,
  onRevoke,
  busy,
}: {
  readonly creation: CreationView;
  readonly draft: string;
  readonly onDraft: (value: string) => void;
  readonly onAssist: (mode: "scaffold" | "critique" | "provocation" | "reference") => void;
  readonly onComplete: () => void;
  readonly onContribute: () => void;
  readonly onRevoke: () => void;
  readonly busy: string | null;
}) {
  const completed = creation.status === "completed";
  const contributed = Boolean(creation.contributed_as);
  return (
    <div className="creation-body">
      <div className="creation-draft-col">
        <div className="creation-draft-head">
          <span className="creation-your-words">Your words</span>
          <span className="creation-status" data-status={creation.status}>
            {creation.status}
          </span>
        </div>
        <textarea
          className="creation-draft"
          value={draft}
          placeholder="Write your draft here. This is yours — the system never writes into it."
          onChange={(e) => onDraft(e.target.value)}
          readOnly={completed}
          rows={16}
        />
        <div className="creation-actions">
          {ASSIST_MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              className="creation-assist-btn"
              title={m.hint}
              onClick={() => onAssist(m.mode)}
              disabled={busy !== null || completed}
            >
              {busy === m.mode ? "…" : m.label}
            </button>
          ))}
          <button
            type="button"
            className="creation-complete-btn"
            onClick={onComplete}
            disabled={busy !== null || completed}
          >
            {busy === "complete" ? "…" : completed ? "Completed" : "Mark complete"}
          </button>
        </div>

        {/* The contribution loop (ADR-0051): once completed, the learner may CONSENT to share their
            draft into the shared substrate as a citable Cognitive Source. Explicit, never automatic. */}
        {completed ? (
          contributed ? (
            <div className="creation-contributed">
              <p className="creation-contributed-note">
                ✓ Contributed as a Cognitive Source — others can now cite, anchor, and build on your
                work. Only your words became the source; your assists stay disclosed provenance.
              </p>
              {/* Sovereignty (ADR-0054): the author can un-share at any time — cascades a redaction. */}
              <button
                type="button"
                className="creation-revoke-btn"
                onClick={onRevoke}
                disabled={busy !== null}
                title="Withdraw this from the commons — its content is withheld and reuse is blocked"
              >
                {busy === "revoke" ? "Revoking…" : "Revoke & redact — take it back"}
              </button>
            </div>
          ) : (
            <div className="creation-contribute">
              <p className="creation-contribute-note">
                Share this into the knowledge commons? Your draft becomes a citable source others
                can learn from and build on. This is your explicit consent — nothing is shared
                otherwise.
              </p>
              <button
                type="button"
                className="creation-contribute-btn"
                onClick={onContribute}
                disabled={busy !== null}
              >
                {busy === "contribute"
                  ? "Contributing…"
                  : "Contribute — consent to share as a source"}
              </button>
            </div>
          )
        ) : null}
      </div>

      <aside className="creation-assists-col" aria-label="Disclosed assists">
        {creation.assists.length === 0 ? (
          <p className="fused-note">
            No assists yet. Ask for a scaffold, critique, provocation, or references — each appears
            here, beside your draft, for you to use or ignore.
          </p>
        ) : (
          <ol className="creation-assists">
            {creation.assists.map((a) => (
              <li key={a.assist_id} className="creation-assist" data-kind={a.kind}>
                <AssistCard assist={a} />
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}

function AssistCard({ assist }: { readonly assist: CreationAssistView }) {
  return (
    <>
      <div className="creation-assist-head">
        <span className="creation-assist-kind">{assist.kind}</span>
        <span className="creation-assist-provenance">
          disclosed assist · {assist.agent_cid}
          {assist.degraded ? " · offline" : ""}
        </span>
      </div>
      {assist.kind === "scaffold" && assist.slots ? (
        <ol className="creation-slots">
          {assist.slots.map((s, i) => (
            <li key={`${s.label}-${i}`} className="creation-slot">
              <span className="creation-slot-label">{s.label}</span>
              <span className="creation-slot-hint">{s.hint}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {assist.kind === "critique" && assist.findings ? (
        <ul className="creation-findings">
          {assist.findings.length === 0 ? (
            <li className="creation-finding">No issues found — the draft holds up.</li>
          ) : (
            assist.findings.map((f, i) => (
              <li key={i} className="creation-finding" data-severity={f.severity}>
                <span className="creation-finding-sev">{f.severity}</span>
                <span className="creation-finding-where">{f.where}</span>
                <span className="creation-finding-issue">{f.issue}</span>
                {f.suggestion ? (
                  <span className="creation-finding-fix">→ {f.suggestion}</span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
      {assist.kind === "provocation" && assist.questions ? (
        <ul className="creation-questions">
          {assist.questions.map((q, i) => (
            <li key={i} className="creation-question">
              {q}
            </li>
          ))}
        </ul>
      ) : null}
      {assist.kind === "reference" && assist.refs ? (
        <ul className="creation-refs">
          {assist.refs.map((r, i) => (
            <li key={`${r.source}-${i}`} className="creation-ref">
              <span className="creation-ref-label">{r.label}</span>
              <span className="creation-ref-source">{r.source}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
