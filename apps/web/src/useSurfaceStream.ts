/**
 * useSurfaceStream — subscribe to a surface's live event stream and fold it into state.
 *
 * The browser's `EventSource` auto-resumes with `Last-Event-ID` on reconnect, so the gateway
 * replays only the missing tail (SRF-005 §6.3). Two client-side guards harden that contract:
 *
 *   - Batching: bursts of events (a frame composing → segments + focus + timings within
 *     milliseconds) are buffered and flushed once per animation frame, so the full-log fold runs
 *     once per paint instead of once per event (the O(n²)-refold lag spike, review §25).
 *   - Watermark dedupe: events already appended (by event_id) are dropped before they reach the
 *     log, so redelivery on a reconnect race can never grow the log (the fold's upserts are
 *     idempotent anyway — this keeps the log itself canonical).
 *
 * The fold of the accumulated log is the viewport's only truth; it is recomputed from events,
 * never mutated locally (replay equivalence, SRF-005 §6.2).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { SurfaceState } from "@inevitable/surface/client";
import { API_BASE } from "./api";
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
  const pending = useRef<StreamEvent[]>([]);
  const flushHandle = useRef<number | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!surfaceId) return;
    setEvents([]);
    pending.current = [];
    seenIds.current = new Set();
    setStatus("connecting");

    const hasRaf = typeof requestAnimationFrame !== "undefined";
    const flush = (): void => {
      flushHandle.current = null;
      if (pending.current.length === 0) return;
      const batch = pending.current;
      pending.current = [];
      setEvents((prev) => [...prev, ...batch]);
    };
    const scheduleFlush = (): void => {
      if (flushHandle.current !== null) return;
      flushHandle.current = hasRaf
        ? requestAnimationFrame(flush)
        : (setTimeout(flush, 16) as unknown as number);
    };

    const source = new EventSource(`${API_BASE}/api/surface/${surfaceId}/stream`);
    source.addEventListener("surface", (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent<string>).data) as StreamEvent;
        const eventId = (parsed as { event_id?: string }).event_id;
        if (eventId) {
          if (seenIds.current.has(eventId)) return; // redelivered — already in the log
          seenIds.current.add(eventId);
        }
        pending.current.push(parsed);
        scheduleFlush();
        setStatus("live");
      } catch {
        /* ignore malformed frame */
      }
    });
    source.onopen = () => setStatus("live");
    source.onerror = () => setStatus("reconnecting");
    return () => {
      source.close();
      if (flushHandle.current !== null) {
        if (hasRaf) cancelAnimationFrame(flushHandle.current);
        else clearTimeout(flushHandle.current);
        flushHandle.current = null;
      }
      pending.current = [];
    };
  }, [surfaceId]);

  const state = useMemo(() => foldStream(events), [events]);
  return { state, events, status };
}
