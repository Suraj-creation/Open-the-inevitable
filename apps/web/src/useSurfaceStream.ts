/**
 * useSurfaceStream — subscribe to a surface's live event stream and fold it into state.
 *
 * The browser's `EventSource` auto-resumes with `Last-Event-ID` on reconnect, so the gateway
 * replays only the missing tail (SRF-005 §6.3) — no duplicates, no gaps. The fold of the
 * accumulated log is the viewport's only truth; it is recomputed from events, never mutated locally.
 */
import { useEffect, useMemo, useState } from "react";
import type { SurfaceState } from "@inevitable/surface/client";
import { foldStream, type StreamEvent } from "./surface-stream";

export type ConnectionStatus = "idle" | "connecting" | "live" | "reconnecting";

export interface SurfaceStream {
  readonly state: SurfaceState | null;
  readonly events: readonly StreamEvent[];
  readonly status: ConnectionStatus;
}

export function useSurfaceStream(surfaceId: string | null): SurfaceStream {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("idle");

  useEffect(() => {
    if (!surfaceId) return;
    setEvents([]);
    setStatus("connecting");
    const source = new EventSource(`/api/surface/${surfaceId}/stream`);
    source.addEventListener("surface", (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent<string>).data) as StreamEvent;
        setEvents((prev) => [...prev, parsed]);
        setStatus("live");
      } catch {
        /* ignore malformed frame */
      }
    });
    source.onopen = () => setStatus("live");
    source.onerror = () => setStatus("reconnecting");
    return () => source.close();
  }, [surfaceId]);

  const state = useMemo(() => foldStream(events), [events]);
  return { state, events, status };
}
