/**
 * Ambient — the living-cognition substrate at ambient amplitude for inner pages (CDL v2 §7:
 * cognition is visible in every frame). A lightweight 2D canvas of motes, filaments, and fading
 * traces — deterministic (seeded, no Math.random), sub-perceptual (≤ ambient tier, CDL v2 §10),
 * and cheap (no three.js on inner pages; the full WebGL World belongs to the Home journey only).
 * Decorative and aria-hidden; honors prefers-reduced-motion with a static field.
 */
import { useEffect, useRef } from "react";

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

interface Mote {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
  drift: number;
}

export function Ambient({ hue = "#57c9de", seed = 7 }: { hue?: string; seed?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    const r = rng(seed);
    const motes: Mote[] = [];
    const COUNT = 42;
    for (let i = 0; i < COUNT; i++) {
      motes.push({
        x: r(),
        y: r(),
        r: 0.6 + r() * 1.8,
        phase: r() * Math.PI * 2,
        speed: 0.05 + r() * 0.12,
        drift: (r() - 0.5) * 0.012,
      });
    }
    // Deterministic filament pairs between nearby motes (relationships forming).
    const pairs: [number, number][] = [];
    for (let i = 0; i < COUNT; i++) {
      for (let j = i + 1; j < COUNT; j++) {
        const dx = motes[i]!.x - motes[j]!.x;
        const dy = motes[i]!.y - motes[j]!.y;
        if (dx * dx + dy * dy < 0.018 && pairs.length < 26) pairs.push([i, j]);
      }
    }

    let raf = 0;
    let running = true;
    const resize = (): void => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (t: number): void => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const time = reduce ? 0 : t / 1000;
      // Filaments first (behind motes) — faint, breathing.
      ctx.lineWidth = 0.6;
      for (const [i, j] of pairs) {
        const a = motes[i]!;
        const b = motes[j]!;
        const pulse = reduce ? 0.5 : 0.35 + 0.3 * Math.sin(time * 0.4 + a.phase);
        ctx.strokeStyle = hue;
        ctx.globalAlpha = 0.05 * pulse;
        ctx.beginPath();
        ctx.moveTo(a.x * w, a.y * h);
        ctx.lineTo(b.x * w, b.y * h);
        ctx.stroke();
      }
      // Motes — soft points of warm light, drifting.
      for (const m of motes) {
        const bx = m.x * w + (reduce ? 0 : Math.sin(time * m.speed + m.phase) * 14);
        const by = m.y * h + (reduce ? 0 : Math.cos(time * m.speed * 0.8 + m.phase) * 10);
        const breath = reduce ? 0.6 : 0.45 + 0.35 * Math.sin(time * 0.5 + m.phase);
        const grad = ctx.createRadialGradient(bx, by, 0, bx, by, m.r * 6);
        grad.addColorStop(0, hue);
        grad.addColorStop(1, "transparent");
        ctx.globalAlpha = 0.1 * breath;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(bx, by, m.r * 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.32 * breath;
        ctx.beginPath();
        ctx.arc(bx, by, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!reduce && running) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [hue, seed]);

  return <canvas className="site-ambient" ref={ref} aria-hidden />;
}
