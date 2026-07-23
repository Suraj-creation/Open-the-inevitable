/**
 * HealthPanel — cognition health at a glance (review §22: "silence looks like success" is the hole).
 *
 * Aggregates `surface.cognition.degraded` markers per unit: how often each cognitive unit fell back
 * to its deterministic path this session, and why (the last reason). A session with zero fallbacks
 * says so explicitly — health is a claim, not an absence of alarms. Pure projection of folded state.
 */
import type { SurfaceState } from "@inevitable/surface/client";

type DegradedRecord = SurfaceState["cognition_health"][number];

export function HealthPanel({ health }: { readonly health: readonly DegradedRecord[] }) {
  const byUnit = new Map<string, { count: number; lastReason: string }>();
  for (const record of health) {
    const entry = byUnit.get(record.unit_id) ?? { count: 0, lastReason: "" };
    entry.count += 1;
    entry.lastReason = record.reason;
    byUnit.set(record.unit_id, entry);
  }
  return (
    <section className="health-panel" aria-label="Cognition health">
      <h2 className="rail-title">Cognition health</h2>
      {byUnit.size === 0 ? (
        <p className="health-clean">Every unit ran its model path — no degradation this session.</p>
      ) : (
        <ul className="health-list">
          {[...byUnit.entries()].map(([unit, entry]) => (
            <li key={unit} className="health-item">
              <span className="health-unit">{unit}</span>
              <span className="health-count">
                {entry.count} fallback{entry.count === 1 ? "" : "s"}
              </span>
              <span className="health-reason" title={entry.lastReason}>
                {entry.lastReason}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
