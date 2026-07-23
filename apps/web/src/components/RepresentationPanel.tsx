/**
 * RepresentationPanel — the RIA's decision, made inspectable (ADR-0058 §5; CSE-018). The
 * `RepresentationPlan` is recorded per frame (hierarchy + epistemic role per element, the density
 * verdict, the exclusion list, and the Law-8 adaptivity note); this panel answers "why THIS
 * representation?" the same way ReasoningPanel answers "why this routing?". Pure projection of the
 * folded `representations` slice — it owns no truth.
 */
import type { RepresentationPlan, SurfaceState } from "@inevitable/surface/client";

/** Strip the "el-" id prefix to the element's readable slot name (el-core_concept → core concept). */
function elementLabel(elementId: string): string {
  return elementId.replace(/^el-/, "").replace(/_/g, " ");
}

export function RepresentationPanel({
  representations,
  activeFrameId = null,
}: {
  readonly representations: readonly RepresentationPlan[];
  readonly activeFrameId?: string | null;
}) {
  // Prefer the plan for the frame being voiced; else the most recent plan (latest wins on upsert).
  const plan: RepresentationPlan | null =
    (activeFrameId ? representations.find((p) => p.frame_id === activeFrameId) : undefined) ??
    representations[representations.length - 1] ??
    null;

  return (
    <section className="rep-panel" aria-label="Representation plan">
      <h2 className="rail-title">Representation</h2>
      {!plan ? (
        <p className="rep-empty">No representation plan yet — the board renders at its floor.</p>
      ) : (
        <>
          <p className="rep-meta">
            <span className={`rep-kind rep-kind--${plan.plan_kind}`}>{plan.plan_kind}</span>
            <span
              className={`rep-density${plan.density.within_budget ? "" : " rep-density--over"}`}
              title={
                plan.density.within_budget
                  ? "Within the working-memory budget"
                  : "Over budget — the signal to split this frame upstream (Law 3)"
              }
            >
              {plan.density.count}/{plan.density.budget} anchors
            </span>
          </p>
          {plan.adaptivity ? (
            <p className="rep-adaptivity">
              <span className="rep-expertise">{plan.adaptivity.expertise}</span>
              {plan.adaptivity.note}
            </p>
          ) : null}
          <ul className="rep-composition">
            {plan.composition.map((c) => (
              <li key={c.element_id} className="rep-el" data-hierarchy={c.hierarchy}>
                <span className="rep-el-name">{elementLabel(c.element_id)}</span>
                <span className="rep-el-role" data-epistemic-role={c.epistemic_role}>
                  {c.epistemic_role}
                </span>
                <span className="rep-el-hierarchy">{c.hierarchy}</span>
              </li>
            ))}
          </ul>
          {plan.exclusions.length > 0 ? (
            <div className="rep-exclusions">
              <span className="rep-exclusions-label">Left off the board</span>
              <ul>
                {plan.exclusions.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
