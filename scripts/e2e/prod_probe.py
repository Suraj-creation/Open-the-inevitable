#!/usr/bin/env python3
"""
Diagnose WHAT degrades in a live lesson: curriculum concepts, per-frame content richness, image
attachment, narration audio (voiceRef), and which cognitive units fell back to their deterministic
path. Answers "is the poor content a Gemini/quota problem or a code problem?".
"""
from __future__ import annotations
import json, sys, threading, time, urllib.request, urllib.error

try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://inevitable-gateway.onrender.com"
GOAL = sys.argv[2] if len(sys.argv) > 2 else "How transformers work in deep learning"

def http(method, url, body=None, timeout=300):
    data = None if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode())
    req = urllib.request.Request(url, data=data, method=method)
    if body is not None and not isinstance(body, bytes): req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "replace"); return r.status, (json.loads(raw) if raw[:1] in "{[" else raw)
    except urllib.error.HTTPError as e: return e.code, e.read().decode("utf-8", "replace")
    except Exception as e: return None, str(e)

def main():
    print(f"probe {BASE}  goal={GOAL!r}\nwaking…")
    for _ in range(12):
        if http("GET", f"{BASE}/api/sources/commons", timeout=90)[0] == 200: break
        time.sleep(5)
    c, enter = http("POST", f"{BASE}/api/surface", {"goal": GOAL})
    sid = enter.get("surface_id") if isinstance(enter, dict) else None
    print(f"enter HTTP {c} surface={sid}")
    if not sid: return 1
    threading.Thread(target=lambda: http("POST", f"{BASE}/api/surface/{sid}/command", {"type":"ask","goal":GOAL}), daemon=True).start()

    t0 = time.time()
    while time.time()-t0 < 260:
        c, st = http("GET", f"{BASE}/api/surface/{sid}/state", timeout=30)
        s = st.get("state") if isinstance(st, dict) else None
        if s:
            frames = s.get("frames", [])
            composed = [f for f in frames if f.get("mccr")]
            narr = s.get("narration", [])
            if composed and narr:
                break
        time.sleep(5)

    c, st = http("GET", f"{BASE}/api/surface/{sid}/state", timeout=30)
    s = st.get("state") if isinstance(st, dict) else {}
    print(f"\n--- after {time.time()-t0:.0f}s ---")

    # 1. Curriculum: real concepts or the "Foundations of X" deterministic fallback?
    nodes = (s.get("timeline") or {}).get("nodes", [])
    print(f"\nCURRICULUM ({len(nodes)} concepts):")
    for n in nodes: print(f"  - {n.get('title')}  [{n.get('concept_id')}]  status={n.get('status')}")
    fell_back = any("Foundations of" in (n.get("title") or "") for n in nodes)
    print(f"  => curriculum {'FELL BACK to deterministic (Gemini failed)' if fell_back else 'is model-generated'}")

    # 2. Frames: content richness (anchor count) + image attachment.
    frames = s.get("frames", [])
    print(f"\nFRAMES ({len(frames)}):")
    for f in frames:
        m = f.get("mccr") or {}
        anchors = [k for k in m if isinstance(m.get(k), dict) and m[k].get("content")]
        has_img = bool((m.get("image") or {}).get("content"))
        print(f"  - {f.get('title')!r} kind={f.get('kind')} anchors={len(anchors)}{anchors} image={has_img}")

    # 3. Narration: does any segment carry audio (voice_ref) or is it silent text?
    segs = s.get("narration", [])
    with_audio = [x for x in segs if x.get("voice_ref") or x.get("audio_ref") or x.get("artifact_id")]
    print(f"\nNARRATION: {len(segs)} segments, {len(with_audio)} with audio (voice_ref)")
    if segs:
        k0 = segs[0]
        print(f"  sample segment keys: {sorted(k0.keys())}")
        print(f"  sample text: {str(k0.get('text'))[:90]!r}")

    # 4. Degraded units (fallback health).
    health = s.get("cognition_health", [])
    print(f"\nDEGRADED UNITS ({len(health)}):")
    for h in health: print(f"  - {h.get('unit_id')}: {h.get('reason') or h.get('fallback_reason')}")
    if not health: print("  (none reported)")

    # 5. Blocks: response_kind (model vs deterministic).
    print("\nBLOCKS:")
    for b in s.get("blocks", []):
        rk = (b.get("content") or {}).get("response_kind") or (b.get("content") or {}).get("fallback_reason")
        print(f"  - {b.get('block_type')}: {b.get('title')} kind={rk}")
    return 0

if __name__ == "__main__": sys.exit(main())
