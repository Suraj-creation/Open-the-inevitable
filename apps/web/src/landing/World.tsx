/**
 * The World — the persistent WebGL layer of the cinematic cognitive journey (CDL v2 §12). One R3F
 * canvas behind the DOM holds the living-cognition substrate: a single particle system that morphs
 * continuously between the eight movement forms (mote → cloud → neuron → graph → companion → ladder
 * → civilization → settle) as the visitor travels. The camera dollies and cranes per movement; the
 * atmosphere grades to the current cognitive-state hue. Driven by the shared `journey` clock, not
 * React state — so it holds 60fps. Decorative + aria-hidden; all meaning lives in the DOM layer.
 */
import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { MOVEMENTS, worldStateAt, HUES } from "../cdl/world";
import { buildFormTargets } from "./formTargets";
import { journey } from "./progress";

/** Per-movement particle buffer (its form's target positions) + its hue as a THREE.Color. */
function useMovementData(count: number) {
  return useMemo(() => {
    const targets = buildFormTargets(count);
    const buffers = MOVEMENTS.map((m) => targets.byForm[m.form]);
    const colors = MOVEMENTS.map((m) => new THREE.Color(m.hue));
    return { targets, buffers, colors };
  }, [count]);
}

const vertexShader = /* glsl */ `
  precision highp float;
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute float aSeed;
  uniform float uBlend;
  uniform float uDensity;
  uniform float uSize;
  uniform float uTime;
  uniform float uLuminance;
  varying float vBright;
  varying float vAlive;
  void main() {
    // Density gate: only the first uDensity fraction of particles are alive (sparse at rest,
    // dense at cognitive peaks). Dead particles collapse to a point and go transparent.
    vAlive = step(aSeed, uDensity);
    vec3 pos = mix(aFrom, aTo, uBlend);
    // Breathing drift — the world is alive even at rest (sub-perceptual).
    float ph = aSeed * 6.2831853;
    pos.x += sin(uTime * 0.35 + ph) * 0.07;
    pos.y += cos(uTime * 0.3 + ph * 1.3) * 0.07;
    pos.z += sin(uTime * 0.25 + ph * 0.7) * 0.05;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = uSize * (0.6 + aSeed * 0.9);
    gl_PointSize = vAlive * size * (300.0 / max(0.001, -mv.z));
    vBright = uLuminance * (0.55 + aSeed * 0.6);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform vec3 uColorFrom;
  uniform vec3 uColorTo;
  uniform float uBlend;
  varying float vBright;
  varying float vAlive;
  void main() {
    if (vAlive < 0.5) discard;
    // Soft round mote with radial falloff (additive → luminous).
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = length(d);
    if (r > 0.5) discard;
    float a = smoothstep(0.5, 0.0, r);
    a = pow(a, 1.6);
    vec3 col = mix(uColorFrom, uColorTo, uBlend) * vBright;
    // A brighter core.
    col += vec3(smoothstep(0.12, 0.0, r)) * vBright * 0.35;
    gl_FragColor = vec4(col, a * 0.85);
  }
`;

function Substrate({ count }: { readonly count: number }) {
  const { targets, buffers, colors } = useMovementData(count);
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const seg = useRef({ from: -1, to: -1 });

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("aFrom", new THREE.BufferAttribute(buffers[0]!.slice(), 3));
    g.setAttribute("aTo", new THREE.BufferAttribute(buffers[1]!.slice(), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(targets.seeds, 1));
    // position is required by three but unused (we compute from aFrom/aTo); use aFrom.
    g.setAttribute("position", new THREE.BufferAttribute(buffers[0]!.slice(), 3));
    return g;
  }, [buffers, targets]);

  const uniforms = useMemo(
    () => ({
      uBlend: { value: 0 },
      uDensity: { value: MOVEMENTS[0]!.density },
      uSize: { value: 2.1 },
      uTime: { value: 0 },
      uLuminance: { value: MOVEMENTS[0]!.luminance },
      uColorFrom: { value: colors[0]!.clone() },
      uColorTo: { value: colors[1]!.clone() },
    }),
    [colors],
  );

  useFrame((_, dt) => {
    const w = worldStateAt(journey.current);
    const m = matRef.current;
    const g = pointsRef.current?.geometry as THREE.BufferGeometry | undefined;
    if (!m || !g) return;
    // Swap the from/to position buffers when the active segment changes.
    if (seg.current.from !== w.fromIndex || seg.current.to !== w.toIndex) {
      seg.current = { from: w.fromIndex, to: w.toIndex };
      const af = g.getAttribute("aFrom") as THREE.BufferAttribute;
      const at = g.getAttribute("aTo") as THREE.BufferAttribute;
      (af.array as Float32Array).set(buffers[w.fromIndex]!);
      (at.array as Float32Array).set(buffers[w.toIndex]!);
      af.needsUpdate = true;
      at.needsUpdate = true;
      (uniforms.uColorFrom.value as THREE.Color).copy(colors[w.fromIndex]!);
      (uniforms.uColorTo.value as THREE.Color).copy(colors[w.toIndex]!);
    }
    uniforms.uBlend.value = w.blend;
    uniforms.uDensity.value = w.density;
    uniforms.uLuminance.value = w.luminance;
    uniforms.uTime.value += dt;
    // Slow full-system rotation gives the constellation life and reads as depth.
    if (pointsRef.current)
      pointsRef.current.rotation.y = Math.sin(journey.current * 3.14159) * 0.28;
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        args={[
          {
            uniforms,
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          },
        ]}
      />
    </points>
  );
}

function Rig() {
  const { camera } = useThree();
  const bg = useRef(new THREE.Color(HUES.void));
  useFrame((state, dt) => {
    const w = worldStateAt(journey.current);
    // Dolly + crane per movement, with subtle pointer parallax and a breathing sway.
    const t = state.clock.elapsedTime;
    const targetX = journey.px * 0.8 + Math.sin(t * 0.15) * 0.15;
    const targetY = w.cameraY + journey.py * 0.5 + Math.cos(t * 0.12) * 0.12;
    camera.position.x += (targetX - camera.position.x) * Math.min(1, dt * 2);
    camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 2);
    camera.position.z += (w.cameraZ - camera.position.z) * Math.min(1, dt * 2);
    camera.lookAt(0, w.cameraY * 0.35, 0);
    // Atmospheric grade: the void takes on a whisper of the current state hue.
    const from = new THREE.Color(w.from.hue);
    const to = new THREE.Color(w.to.hue);
    from.lerp(to, w.blend);
    // The canvas is TRANSPARENT (documentary cinema composites beneath it); the atmospheric grade
    // survives in the fog color, which tints distant particles toward the state hue.
    bg.current.copy(new THREE.Color(HUES.void)).lerp(from, 0.035 * w.luminance + 0.012);
    if (state.scene.fog) (state.scene.fog as THREE.FogExp2).color.copy(bg.current);
  });
  return null;
}

function tierCount(): number {
  if (typeof navigator === "undefined") return 2000;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  const small =
    typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 700;
  if (small || mem <= 3 || cores <= 4) return 900;
  if (mem >= 8 && cores >= 8) return 4200;
  return 2000;
}

export function World() {
  const count = useMemo(tierCount, []);
  return (
    <Canvas
      className="world-canvas"
      aria-hidden
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 52, near: 0.1, far: 100, position: [0, 0, MOVEMENTS[0]!.cameraZ] }}
      frameloop="always"
    >
      <fogExp2 attach="fog" args={[HUES.void, 0.032]} />
      <Substrate count={count} />
      <Rig />
    </Canvas>
  );
}
