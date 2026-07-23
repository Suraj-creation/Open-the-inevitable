/**
 * EventInspector — the Observatory's raw canonical record (F09 §4.1: nothing about the cognition
 * stays hidden). The surface IS its event log; this panel makes that literal — searchable by event
 * type or payload text, newest first, each event expandable to its full JSON. An operating-system
 * inspector for the cognitive OS. Pure projection of the streamed log; render capped for weight.
 */
import { useMemo, useState } from "react";

interface InspectableEvent {
  readonly event_id?: string;
  readonly event_type?: string;
  readonly hlc?: string;
  readonly [key: string]: unknown;
}

const RENDER_CAP = 150;

export function EventInspector({ events }: { readonly events: readonly unknown[] }) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const typed = events as readonly InspectableEvent[];
    const matched = q
      ? typed.filter((e) => {
          if ((e.event_type ?? "").toLowerCase().includes(q)) return true;
          try {
            return JSON.stringify(e).toLowerCase().includes(q);
          } catch {
            return false;
          }
        })
      : typed;
    return matched.slice(-RENDER_CAP).reverse(); // newest first
  }, [events, query]);

  if (events.length === 0) return null;
  return (
    <section className="event-inspector" aria-label="Event log">
      <h2 className="rail-title">
        Event log <span className="event-count">{events.length}</span>
      </h2>
      <input
        className="event-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter events (type or payload)…"
        aria-label="Filter events"
      />
      <ol className="event-list">
        {filtered.map((e, i) => {
          const id = e.event_id ?? `evt-${i}`;
          const open = openId === id;
          return (
            <li key={id} className="event-item" data-open={open ? "true" : "false"}>
              <button
                type="button"
                className="event-row"
                onClick={() => setOpenId(open ? null : id)}
                aria-expanded={open}
              >
                <span className="event-type">{e.event_type ?? "unknown"}</span>
                <span className="event-hlc">{(e.hlc ?? "").slice(0, 17)}</span>
              </button>
              {open ? <pre className="event-json">{JSON.stringify(e, null, 2)}</pre> : null}
            </li>
          );
        })}
      </ol>
      {filtered.length === RENDER_CAP ? (
        <p className="event-capped">Showing the latest {RENDER_CAP} matches.</p>
      ) : null}
    </section>
  );
}
