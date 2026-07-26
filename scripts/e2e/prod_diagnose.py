#!/usr/bin/env python3
"""
Patient production diagnostic: does the gateway pipeline actually reach COMPOSED + NARRATED, or
does it stall after streaming? Polls the folded /state over up to 5 minutes and logs the pipeline
advancing (planned -> composed[mccr] -> narrated), so a slow-but-working run is distinguished from a
genuine stall. Drop-resilient: the long ask POST is fired fire-and-forget; /state is the source of truth.
"""
from __future__ import annotations

import json
import sys
import threading
import time
import urllib.error
import urllib.request

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://inevitable-gateway.onrender.com"
GOAL = sys.argv[2] if len(sys.argv) > 2 else "Teach me the Pythagorean theorem"


def http(method, url, body=None, timeout=300):
    data = None
    if body is not None:
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method)
    if body is not None and not isinstance(body, bytes):
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace")
            return r.status, (json.loads(raw) if raw[:1] in "{[" else raw)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        return None, str(e)


def main() -> int:
    print(f"Diagnose {BASE}  goal={GOAL!r}")
    print("waking…")
    for _ in range(12):
        c, _b = http("GET", f"{BASE}/api/sources/commons", timeout=90)
        if c == 200:
            break
        time.sleep(5)

    c, enter = http("POST", f"{BASE}/api/surface", {"goal": GOAL})
    sid = enter.get("surface_id") if isinstance(enter, dict) else None
    print(f"enter: HTTP {c} surface={sid}")
    if not sid:
        return 1

    # Fire the ask fire-and-forget (the long request may be proxy-dropped; state is truth).
    box: dict = {}

    def _ask() -> None:
        box["result"] = http("POST", f"{BASE}/api/surface/{sid}/command", {"type": "ask", "goal": GOAL})

    threading.Thread(target=_ask, daemon=True).start()

    t0 = time.time()
    last = ""
    composed_at = narrated_at = None
    deadline = t0 + 300
    while time.time() < deadline:
        c, st = http("GET", f"{BASE}/api/surface/{sid}/state", timeout=30)
        state = st.get("state") if isinstance(st, dict) else None
        if isinstance(state, dict):
            frames = state.get("frames", [])
            composed = [f for f in frames if f.get("mccr")]
            narr = state.get("narration", []) or state.get("narration_scripts", [])
            buf = state.get("streaming_frame_elements", [])
            blocks = state.get("blocks", [])
            phase = ""
            # last ask.progress phase if surfaced in state (best-effort)
            line = (f"t+{time.time() - t0:4.0f}s  frames={len(frames)} composed={len(composed)} "
                    f"narration={len(narr)} blocks={len(blocks)} stream_buf={len(buf)}")
            if line != last:
                print(" ", line)
                last = line
            if composed and composed_at is None:
                composed_at = time.time() - t0
            if narr and narrated_at is None:
                narrated_at = time.time() - t0
            # Done when a frame has mccr AND narration exists AND the transient buffer is cleared.
            if composed and narr and len(buf) == 0:
                print(f"\nCOMPLETE: composed@{composed_at:.0f}s narrated@{narrated_at:.0f}s "
                      f"({len(composed)}/{len(frames)} frames have mccr, buffer cleared)")
                bx = box.get("result")
                print(f"ask POST outcome: {bx[0] if bx else 'still-in-flight'}")
                return 0
        time.sleep(5)

    print("\nTIMEOUT after 300s — pipeline did not fully compose+narrate+clear.")
    c, st = http("GET", f"{BASE}/api/surface/{sid}/state")
    state = st.get("state") if isinstance(st, dict) else {}
    frames = state.get("frames", [])
    print("final frames:", json.dumps(
        [{"concept": f.get("concept_id"), "has_mccr": bool(f.get("mccr")),
          "status": f.get("status"), "title": f.get("title")} for f in frames], indent=2)[:1500])
    print("final stream_buf:", len(state.get("streaming_frame_elements", [])))
    print("final narration:", len(state.get("narration", [])))
    print("cognition_health (degraded units):",
          json.dumps(state.get("cognition_health", []))[:500])
    return 1


if __name__ == "__main__":
    sys.exit(main())
