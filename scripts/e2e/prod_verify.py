#!/usr/bin/env python3
"""
Deep end-to-end verification of the Cognitive Surface gateway in PRODUCTION.

Drives the live gateway exactly as the web client does — enter a surface, open the SSE stream,
fire an ask, and assert the full teaching pipeline fired: curriculum -> frame planner -> composer
-> frames -> narration, INCLUDING the ADR-0063 Phase B live board streaming
(`surface.frame.element.delta`). Also exercises the source-acquisition path (register text ->
attach -> teach) and the Phase F interrupt path, and checks folded-state coherence.

Usage:  python scripts/e2e/prod_verify.py [--base URL] [--goal "..."]
Exit code 0 = all critical checks passed; 1 = a critical check failed.
"""
from __future__ import annotations

import argparse
import json
import sys
import threading
import time
import urllib.error
import urllib.request

# Windows consoles default to cp1252, which can't encode the report glyphs — force UTF-8.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

DEFAULT_BASE = "https://inevitable-gateway.onrender.com"

# ----------------------------------------------------------------------------- reporting
GREEN, RED, YEL, DIM, RST = "\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[0m"
_failures: list[str] = []
_warnings: list[str] = []


def check(name: str, ok: bool, detail: str = "", critical: bool = True) -> bool:
    mark = f"{GREEN}PASS{RST}" if ok else (f"{RED}FAIL{RST}" if critical else f"{YEL}WARN{RST}")
    print(f"  [{mark}] {name}" + (f"  {DIM}{detail}{RST}" if detail else ""))
    if not ok:
        (_failures if critical else _warnings).append(f"{name}: {detail}")
    return ok


def section(title: str) -> None:
    print(f"\n{title}\n" + "-" * len(title))


# ----------------------------------------------------------------------------- http
def http(method: str, url: str, body=None, headers=None, timeout=180):
    data = None
    if body is not None:
        data = body if isinstance(body, (bytes, bytearray)) else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    if not isinstance(body, (bytes, bytearray)) and body is not None:
        req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace")
            return r.status, (json.loads(raw) if raw.strip().startswith(("{", "[")) else raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


# ----------------------------------------------------------------------------- SSE consumer
class SSEStream(threading.Thread):
    """Consumes the surface SSE stream on its own connection; collects every `surface.*` event."""

    def __init__(self, base: str, surface_id: str):
        super().__init__(daemon=True)
        self.url = f"{base}/api/surface/{surface_id}/stream"
        self.events: list[dict] = []
        self.snapshot_complete = False
        self._stop = threading.Event()
        self.error: str | None = None

    def run(self) -> None:
        try:
            req = urllib.request.Request(self.url, headers={"Accept": "text/event-stream"})
            with urllib.request.urlopen(req, timeout=300) as r:
                for raw in r:
                    if self._stop.is_set():
                        break
                    line = raw.decode("utf-8", "replace").rstrip("\r\n")
                    if line.startswith(": snapshot-complete"):
                        self.snapshot_complete = True
                    elif line.startswith("data: "):
                        try:
                            self.events.append(json.loads(line[6:]))
                        except json.JSONDecodeError:
                            pass
        except Exception as e:  # noqa: BLE001 — surfaced as a check
            self.error = f"{type(e).__name__}: {e}"

    def stop(self) -> None:
        self._stop.set()

    def types(self) -> list[str]:
        return [e.get("event_type", "") for e in self.events]

    def of_type(self, t: str) -> list[dict]:
        return [e for e in self.events if e.get("event_type") == t]


def wait_until(predicate, timeout: float, poll: float = 0.5) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(poll)
    return False


def fire_command_async(base: str, surface_id: str, command: dict) -> dict:
    """
    Fire a (long-running) command like the WEB does — fire-and-forget. The teaching pipeline runs
    30–90s inside one HTTP request, which Render's proxy may drop before it responds; the web never
    depends on that response (it reads the SSE + folded state), so neither do we. Returns a mutable
    box that later holds {status|error} for diagnostics.
    """
    box: dict = {"done": False}

    def run() -> None:
        try:
            code, body = http("POST", f"{base}/api/surface/{surface_id}/command", command, timeout=300)
            box.update(status=code, body=body)
        except Exception as e:  # noqa: BLE001 — the drop is expected; state is the source of truth
            box.update(error=f"{type(e).__name__}: {e}")
        finally:
            box["done"] = True

    threading.Thread(target=run, daemon=True).start()
    return box


def poll_state(base: str, surface_id: str):
    code, st = http("GET", f"{base}/api/surface/{surface_id}/state", timeout=30)
    if code == 200 and isinstance(st, dict):
        return st.get("state")
    return None


# ----------------------------------------------------------------------------- wake (cold start)
def wake(base: str) -> bool:
    section("0. Wake the gateway (Render free tier cold-starts ~55s)")
    t0 = time.time()
    for attempt in range(12):
        try:
            code, _ = http("GET", f"{base}/api/sources/commons", timeout=90)
            if code == 200:
                return check("gateway reachable", True, f"200 in {time.time() - t0:.1f}s (attempt {attempt + 1})")
        except Exception as e:  # noqa: BLE001
            print(f"    {DIM}attempt {attempt + 1}: {e}{RST}")
        time.sleep(6)
    return check("gateway reachable", False, "no 200 after 12 attempts")


# ----------------------------------------------------------------------------- test 1: teach a topic
def test_topic(base: str, goal: str) -> dict:
    section(f'1. Teach a topic end-to-end — "{goal}"')

    code, enter = http("POST", f"{base}/api/surface", {"goal": goal})
    check("enter surface (POST /api/surface)", code == 201, f"HTTP {code}")
    surface_id = enter.get("surface_id") if isinstance(enter, dict) else None
    check("surface_id returned", bool(surface_id), str(surface_id))
    if not surface_id:
        return {"surface_id": None}

    sse = SSEStream(base, surface_id)
    sse.start()
    check("SSE stream connects + snapshot", wait_until(lambda: sse.snapshot_complete, 20),
          f"{len(sse.events)} snapshot events" + (f"  err={sse.error}" if sse.error else ""))

    # Fire the ask like the web does (fire-and-forget) and treat the FOLDED STATE as the drop-resilient
    # source of truth: the pipeline runs server-side and streams to the SSE regardless of the POST fate.
    # Render's free tier (0.1 CPU) is slow — a first frame composes ~70–90s in; poll patiently.
    print(f"    {DIM}firing ask (real Gemini pipeline on a slow free tier — up to ~4 min)…{RST}")
    t0 = time.time()
    box = fire_command_async(base, surface_id, {"type": "ask", "goal": goal})

    def composed_and_narrated() -> bool:
        st = poll_state(base, surface_id) or {}
        has_mccr = any(f.get("mccr") for f in st.get("frames", []))
        has_narr = bool(st.get("narration") or st.get("narration_scripts"))
        return has_mccr and has_narr

    done = wait_until(composed_and_narrated, 240, poll=4)
    check("teaching pipeline reached composed + narrated (state-authoritative)", done,
          f"{time.time() - t0:.1f}s")
    # Distinguish a benign proxy-timeout from a real crash: did the long POST return, or was it dropped?
    wait_until(lambda: box.get("done"), 3)
    check("long ask request either returned or was proxy-dropped (web-tolerated)",
          done, f"POST status={box.get('status')} err={bool(box.get('error'))}", critical=False)
    time.sleep(3)  # let trailing events settle on the SSE
    sse.stop()

    types = sse.types()
    uniq = sorted(set(types))
    print(f"    {DIM}{len(types)} events, {len(uniq)} distinct types{RST}")

    # Core pipeline fired.
    check("surface.created present", "surface.created" in types)
    check("ask progressed (surface.ask.progress)", "surface.ask.progress" in types)
    planned = sse.of_type("surface.frame.planned")
    composed = sse.of_type("surface.frame.composed")
    check("frames planned (surface.frame.planned)", len(planned) > 0, f"{len(planned)} frames")
    check("frames composed (surface.frame.composed)", len(composed) > 0, f"{len(composed)} frames")
    check("narration produced", any(t.startswith("surface.narration") for t in types),
          ",".join(t for t in uniq if t.startswith("surface.narration")))

    # ADR-0063 Phase B: the board streamed.
    deltas = sse.of_type("surface.frame.element.delta")
    streamed = len(deltas) > 0
    check("PHASE B: board streamed (surface.frame.element.delta)", streamed,
          f"{len(deltas)} deltas", critical=False)
    if streamed:
        ids = sorted({d.get("payload", {}).get("element_id", "?") for d in deltas})
        check("Phase B: delta element_ids are el-<anchor>",
              all(i.startswith("el-") for i in ids), ", ".join(ids), critical=False)
        # Each frame's deltas precede its own composed (buffer-clear invariant).
        seq = {e.get("sequence", i): i for i, e in enumerate(sse.events)}
        ok_order = True
        for d in deltas:
            fid = d.get("payload", {}).get("frame_id")
            d_seq = d.get("sequence", -1)
            comp = next((c for c in composed if c.get("payload", {}).get("frame_id") == fid), None)
            if comp is not None and comp.get("sequence", 1 << 62) < d_seq:
                ok_order = False
        check("Phase B: every delta precedes its frame.composed", ok_order, critical=False)

    # Folded state coherence.
    code, st = http("GET", f"{base}/api/surface/{surface_id}/state")
    state = st.get("state") if isinstance(st, dict) else None
    check("state endpoint returns a fold", code == 200 and isinstance(state, dict), f"HTTP {code}")
    if isinstance(state, dict):
        frames = state.get("frames", [])
        check("state has composed frames with MCCR", len(frames) > 0
              and any(f.get("mccr") for f in frames), f"{len(frames)} frames")
        check("streaming buffer cleared in settled state (delta-independent)",
              len(state.get("streaming_frame_elements", [])) == 0,
              f"{len(state.get('streaming_frame_elements', []))} left")
        tl = state.get("timeline") or {}
        check("timeline built with concepts", len(tl.get("nodes", [])) > 0,
              f"{len(tl.get('nodes', []))} concepts")

    return {"surface_id": surface_id, "state": state, "events": len(types)}


# ----------------------------------------------------------------------------- test 2: source path
SAMPLE_DOC = (
    "# Entropy in Thermodynamics\n\n"
    "Entropy is a measure of the number of microscopic configurations (microstates) that "
    "correspond to a thermodynamic system's macroscopic state. The second law of thermodynamics "
    "states that the total entropy of an isolated system can never decrease over time.\n\n"
    "Boltzmann's equation, S = k log W, connects entropy S to the number of microstates W, "
    "where k is the Boltzmann constant.\n"
)


def test_source(base: str) -> None:
    section("2. Source acquisition — register a document, attach, teach from it")
    code, reg = http("POST", f"{base}/api/sources?modality=markdown&title=Entropy%20Primer",
                     SAMPLE_DOC.encode("utf-8"))
    check("register source (POST /api/sources)", code == 201, f"HTTP {code}")
    src = reg.get("source") if isinstance(reg, dict) else None
    vid = (src or {}).get("source_version_id") or (src or {}).get("version_id")
    check("source version id returned", bool(vid), str(vid))
    if isinstance(src, dict):
        check("source reports usable layers", bool(src.get("layers_available") or src.get("usable")),
              json.dumps({k: src.get(k) for k in ("layers_available", "usable", "degraded_layers")}),
              critical=False)
    if not vid:
        return

    code, enter = http("POST", f"{base}/api/surface", {"goal": "Teach me entropy"})
    surface_id = enter.get("surface_id") if isinstance(enter, dict) else None
    if not check("enter surface for source test", bool(surface_id), str(surface_id)):
        return

    code, att = http("POST", f"{base}/api/surface/{surface_id}/sources",
                     {"source_version_id": vid})
    check("attach source to surface", code == 200, f"HTTP {code}")

    # Bound state is authoritative even before teaching — verify the attach folded in.
    check("source bound in folded state (after attach)",
          len((poll_state(base, surface_id) or {}).get("sources", [])) > 0,
          f"{len((poll_state(base, surface_id) or {}).get('sources', []))} sources")

    sse = SSEStream(base, surface_id)
    sse.start()
    wait_until(lambda: sse.snapshot_complete, 15)
    print(f"    {DIM}teaching FROM the document (fire-and-forget; long request)…{RST}")
    fire_command_teach = {"done": False}

    def _teach() -> None:
        try:
            c, b = http("POST", f"{base}/api/surface/{surface_id}/teach-source", {}, timeout=300)
            fire_command_teach.update(status=c, body=b)
        except Exception as e:  # noqa: BLE001 — long request may be proxy-dropped; state is truth
            fire_command_teach.update(error=str(e))
        finally:
            fire_command_teach["done"] = True

    threading.Thread(target=_teach, daemon=True).start()
    got = wait_until(
        lambda: len((poll_state(base, surface_id) or {}).get("frames", [])) > 0, 180, poll=3)
    time.sleep(3)
    sse.stop()
    check("source teaching produced frames (state-authoritative)", got,
          f"{len((poll_state(base, surface_id) or {}).get('frames', []))} frames")
    check("source teaching streamed frames on the SSE",
          len(sse.of_type("surface.frame.composed")) > 0,
          f"{len(sse.of_type('surface.frame.composed'))} composed", critical=False)


# ----------------------------------------------------------------------------- test 3: interrupt (Phase F)
def test_interrupt(base: str) -> None:
    section("3. Interrupt path (Phase F) — a learner can stop cognition")
    code, enter = http("POST", f"{base}/api/surface", {"goal": "Teach me calculus"})
    surface_id = enter.get("surface_id") if isinstance(enter, dict) else None
    if not check("enter surface for interrupt test", bool(surface_id)):
        return
    code, res = http("POST", f"{base}/api/surface/{surface_id}/command", {"type": "interact", "kind": "interrupt"})
    check("interrupt accepted (cancelled)", code == 200 and res.get("effect") == "cancelled",
          f"HTTP {code} → {res.get('effect') if isinstance(res, dict) else res}")


# ----------------------------------------------------------------------------- main
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=DEFAULT_BASE)
    ap.add_argument("--goal", default="Teach me how gradient descent works")
    ap.add_argument("--skip-source", action="store_true")
    args = ap.parse_args()

    print(f"Production E2E verification → {args.base}")
    if not wake(args.base):
        print(f"\n{RED}Gateway unreachable — aborting.{RST}")
        return 1

    test_topic(args.base, args.goal)
    if not args.skip_source:
        test_source(args.base)
    test_interrupt(args.base)

    section("Summary")
    if _warnings:
        print(f"{YEL}{len(_warnings)} warning(s):{RST}")
        for w in _warnings:
            print(f"  - {w}")
    if _failures:
        print(f"{RED}{len(_failures)} CRITICAL failure(s):{RST}")
        for f in _failures:
            print(f"  - {f}")
        print(f"\n{RED}RESULT: FAIL{RST}")
        return 1
    print(f"{GREEN}RESULT: all critical checks passed{RST}" +
          (f" ({len(_warnings)} warnings)" if _warnings else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
