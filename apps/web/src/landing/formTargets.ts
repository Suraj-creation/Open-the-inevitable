/**
 * The morph targets — for each of the eight SubstrateForms, a deterministic set of 3D positions for
 * every particle (CDL v2 §7). The living-cognition substrate is ONE particle system whose points
 * retarget between these forms as the visitor travels, so curiosity *becomes* a neuron *becomes* a
 * knowledge graph *becomes* a civilization — one continuous matter, never a cut. Fully deterministic
 * (seeded PRNG, no Math.random) so the world is replay-stable and SSR-safe.
 */
import type { SubstrateForm } from "../cdl/world";

/** mulberry32 — a tiny deterministic PRNG so every render of a form is identical. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FORMS: readonly SubstrateForm[] = [
  "mote",
  "cloud",
  "neuron",
  "graph",
  "companion",
  "ladder",
  "civilization",
  "settle",
];

export interface FormTargets {
  readonly count: number;
  /** One Float32Array(count*3) per form, keyed by form name. */
  readonly byForm: Record<SubstrateForm, Float32Array>;
  /** Per-particle seed 0..1 (stable), for shader variation + density gating. */
  readonly seeds: Float32Array;
}

export function buildFormTargets(count: number): FormTargets {
  const r = rng(0x9e3779b9 ^ count);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) seeds[i] = r();

  const byForm = {} as Record<SubstrateForm, Float32Array>;
  for (const form of FORMS) byForm[form] = new Float32Array(count * 3);

  // ── mote: a single point of light, a faint few drifting far off. ──
  {
    const a = byForm.mote;
    const rr = rng(11);
    for (let i = 0; i < count; i++) {
      const far = rr() > 0.94;
      const rad = far ? 4 + rr() * 6 : rr() * 0.35;
      const th = rr() * Math.PI * 2;
      const ph = Math.acos(2 * rr() - 1);
      a[i * 3] = rad * Math.sin(ph) * Math.cos(th);
      a[i * 3 + 1] = rad * Math.sin(ph) * Math.sin(th) * 0.7;
      a[i * 3 + 2] = rad * Math.cos(ph) * 0.6;
    }
  }

  // ── cloud: a diffuse sphere of curiosity. ──
  {
    const a = byForm.cloud;
    const rr = rng(23);
    for (let i = 0; i < count; i++) {
      const rad = 2 + Math.pow(rr(), 0.6) * 4;
      const th = rr() * Math.PI * 2;
      const ph = Math.acos(2 * rr() - 1);
      a[i * 3] = rad * Math.sin(ph) * Math.cos(th);
      a[i * 3 + 1] = rad * Math.sin(ph) * Math.sin(th) * 0.8;
      a[i * 3 + 2] = rad * Math.cos(ph) * 0.7;
    }
  }

  // ── neuron: a soma cluster with radiating dendrite branches (thought firing). ──
  {
    const a = byForm.neuron;
    const rr = rng(37);
    const branches = 7;
    const ends: [number, number, number][] = [];
    for (let b = 0; b < branches; b++) {
      const th = (b / branches) * Math.PI * 2 + rr() * 0.4;
      const len = 4 + rr() * 2.5;
      ends.push([Math.cos(th) * len, Math.sin(th) * len * 0.8, (rr() - 0.5) * 2]);
    }
    for (let i = 0; i < count; i++) {
      if (rr() < 0.32) {
        // soma
        const rad = Math.pow(rr(), 0.5) * 0.9;
        const th = rr() * Math.PI * 2;
        const ph = Math.acos(2 * rr() - 1);
        a[i * 3] = rad * Math.sin(ph) * Math.cos(th);
        a[i * 3 + 1] = rad * Math.sin(ph) * Math.sin(th);
        a[i * 3 + 2] = rad * Math.cos(ph);
      } else {
        const e = ends[((Math.floor(rr() * branches) % branches) + branches) % branches]!;
        const t = rr();
        const j = 0.35 * (1 - t);
        a[i * 3] = e[0] * t + (rr() - 0.5) * j;
        a[i * 3 + 1] = e[1] * t + (rr() - 0.5) * j;
        a[i * 3 + 2] = e[2] * t + (rr() - 0.5) * j;
      }
    }
  }

  // ── graph: a constellation of concept nodes + particles along edges. ──
  {
    const a = byForm.graph;
    const rr = rng(53);
    const NODES = 16;
    const nodes: [number, number, number][] = [];
    for (let n = 0; n < NODES; n++) {
      const th = rr() * Math.PI * 2;
      const rad = 1.5 + rr() * 5.5;
      nodes.push([Math.cos(th) * rad, Math.sin(th) * rad * 0.7, (rr() - 0.5) * 3]);
    }
    for (let i = 0; i < count; i++) {
      if (rr() < 0.7) {
        const n = nodes[Math.floor(rr() * NODES) % NODES]!;
        const rad = Math.pow(rr(), 0.5) * 0.5;
        const th = rr() * Math.PI * 2;
        const ph = Math.acos(2 * rr() - 1);
        a[i * 3] = n[0] + rad * Math.sin(ph) * Math.cos(th);
        a[i * 3 + 1] = n[1] + rad * Math.sin(ph) * Math.sin(th);
        a[i * 3 + 2] = n[2] + rad * Math.cos(ph);
      } else {
        const p = nodes[Math.floor(rr() * NODES) % NODES]!;
        const q = nodes[Math.floor(rr() * NODES) % NODES]!;
        const t = rr();
        a[i * 3] = p[0] + (q[0] - p[0]) * t + (rr() - 0.5) * 0.2;
        a[i * 3 + 1] = p[1] + (q[1] - p[1]) * t + (rr() - 0.5) * 0.2;
        a[i * 3 + 2] = p[2] + (q[2] - p[2]) * t + (rr() - 0.5) * 0.2;
      }
    }
  }

  // ── companion: a gentle path across space with a bright companion + trailing motes. ──
  {
    const a = byForm.companion;
    const rr = rng(71);
    for (let i = 0; i < count; i++) {
      if (rr() < 0.18) {
        // the companion presence — a soft cluster near center-left
        const rad = Math.pow(rr(), 0.5) * 0.7;
        const th = rr() * Math.PI * 2;
        a[i * 3] = -1.5 + Math.cos(th) * rad;
        a[i * 3 + 1] = 0.2 + Math.sin(th) * rad;
        a[i * 3 + 2] = (rr() - 0.5) * 0.6;
      } else {
        const x = -7 + rr() * 14;
        a[i * 3] = x;
        a[i * 3 + 1] = Math.sin(x * 0.5) * 1.4 + (rr() - 0.5) * 0.5;
        a[i * 3 + 2] = (rr() - 0.5) * 2.2;
      }
    }
  }

  // ── ladder: five ascending strata (Ignorance→Contribution as rising light). ──
  {
    const a = byForm.ladder;
    const rr = rng(89);
    const RUNGS = 5;
    for (let i = 0; i < count; i++) {
      const rung = Math.floor(rr() * RUNGS);
      const y = -4.5 + (rung / (RUNGS - 1)) * 9;
      a[i * 3] = (rr() - 0.5) * (7 - rung * 0.4);
      a[i * 3 + 1] = y + (rr() - 0.5) * 0.7;
      a[i * 3 + 2] = (rr() - 0.5) * 2.4;
    }
  }

  // ── civilization: a wide field of many small clusters — one connected layer. ──
  {
    const a = byForm.civilization;
    const rr = rng(101);
    const CL = 46;
    const cl: [number, number, number][] = [];
    for (let c = 0; c < CL; c++) {
      cl.push([(rr() - 0.5) * 20, (rr() - 0.5) * 9, (rr() - 0.5) * 6 - 1]);
    }
    for (let i = 0; i < count; i++) {
      const c = cl[Math.floor(rr() * CL) % CL]!;
      const rad = Math.pow(rr(), 0.6) * 0.55;
      const th = rr() * Math.PI * 2;
      const ph = Math.acos(2 * rr() - 1);
      a[i * 3] = c[0] + rad * Math.sin(ph) * Math.cos(th);
      a[i * 3 + 1] = c[1] + rad * Math.sin(ph) * Math.sin(th);
      a[i * 3 + 2] = c[2] + rad * Math.cos(ph);
    }
  }

  // ── settle: a calm, wide constellation at rest (the ending stillness). ──
  {
    const a = byForm.settle;
    const rr = rng(127);
    for (let i = 0; i < count; i++) {
      const rad = 1 + Math.pow(rr(), 0.7) * 6.5;
      const th = rr() * Math.PI * 2;
      a[i * 3] = Math.cos(th) * rad;
      a[i * 3 + 1] = Math.sin(th) * rad * 0.62;
      a[i * 3 + 2] = (rr() - 0.5) * 3.5;
    }
  }

  return { count, byForm, seeds };
}
