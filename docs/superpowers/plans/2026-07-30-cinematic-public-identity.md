# Cinematic Public Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Turn all nine public routes into one accessible, performant cinematic research-institution narrative whose motion makes cognition and infrastructure easier to understand.

**Architecture:** Add a small declarative scene layer to apps/web/src/site/, then compose it through the existing public-page scaffold. Motion policy, state-light handoff, chapter progression, and visual diagrams are shared primitives; individual routes supply only scene data and truthful copy. The existing Home WebGL world remains isolated; inner pages use DOM/SVG/CSS projections that have a static semantic fallback.

**Tech Stack:** React 19, TypeScript, React Router 7, GSAP 3, existing React Three Fiber/Three.js Home world, CSS custom properties, Vitest, Vite.

---

## File structure

| File | Responsibility |
| --- | --- |
| apps/web/src/site/cinematic.ts | Immutable public-scene model and route registry, with no React or browser APIs. |
| apps/web/src/site/motion.ts | Capability and reduced-motion policy. |
| apps/web/src/site/CinematicChapter.tsx | Semantic chapter wrapper and readable static structure. |
| apps/web/src/site/InstrumentVisual.tsx | Decorative graph, flow, orbit, source transformation, and temporal visual projections. |
| apps/web/src/site/RouteHandoff.tsx | Ambient route-change handoff using native View Transitions when present and CSS otherwise. |
| apps/web/src/site/Page.tsx | Composes existing public chrome with page-level cinematic scene metadata. |
| apps/web/src/site/primitives.tsx | Retains current primitives and gains typed cinematic composition helpers. |
| apps/web/src/site/site.css | Shared depth field, chapter, instrument, route, responsive, and reduced-motion styles. |
| apps/web/src/landing/Landing.tsx and apps/web/src/landing/landing.css | Adds the Home documentary prelude while retaining the isolated World canvas and current static fallback. |
| apps/web/src/site/pages/*.tsx | Recompose all nine routes around truthful scene chapters. |
| apps/web/tests/site-cinematic.test.ts | Unit tests for registry, policy, and visual semantic structure. |
| apps/web/tests/site-public-routes.test.tsx | Server-rendered semantic coverage for every public route. |

## Task 1: Establish the public-scene contract

**Files:**

- Create: apps/web/src/site/cinematic.ts
- Create: apps/web/tests/site-cinematic.test.ts

- [ ] **Step 1: Write the failing registry tests.**

~~~ts
import { describe, expect, test } from "vitest";
import { PUBLIC_SCENES, sceneForPath } from "../src/site/cinematic";

describe("public cinematic scene registry", () => {
  test("defines every public route with a distinct semantic visual", () => {
    expect(Object.keys(PUBLIC_SCENES)).toEqual([
      "/", "/vision", "/philosophy", "/surface", "/source",
      "/infrastructure", "/research", "/roadmap", "/about",
    ]);
    expect(new Set(Object.values(PUBLIC_SCENES).map((scene) => scene.visual))).toEqual(
      new Set(["field", "ascent", "constitution", "surface", "sources", "topology", "frontier", "timeline", "settle"]),
    );
  });

  test("falls back to Home for an unknown public path", () => {
    expect(sceneForPath("/not-a-route").id).toBe("home");
  });
});
~~~

- [ ] **Step 2: Run the test to verify it fails.**

Run: pnpm --filter @inevitable/web test -- tests/site-cinematic.test.ts

Expected: FAIL because the cinematic module does not exist.

- [ ] **Step 3: Implement the immutable model and registry.**

~~~ts
export type SceneVisual =
  | "field" | "ascent" | "constitution" | "surface" | "sources"
  | "topology" | "frontier" | "timeline" | "settle";

export interface PublicScene {
  readonly id: string;
  readonly visual: SceneVisual;
  readonly hue: string;
  readonly eyebrow: string;
  readonly motionVerb: "form" | "focus" | "trace" | "transform" | "verify" | "settle";
}

export const PUBLIC_SCENES: Readonly<Record<string, PublicScene>> = {
  "/": { id: "home", visual: "field", hue: "#57c9de", eyebrow: "Universal Cognitive Infrastructure", motionVerb: "form" },
  "/vision": { id: "vision", visual: "ascent", hue: "#ffc46b", eyebrow: "Vision", motionVerb: "form" },
  "/philosophy": { id: "philosophy", visual: "constitution", hue: "#d8b8ad", eyebrow: "Philosophy", motionVerb: "verify" },
  "/surface": { id: "surface", visual: "surface", hue: "#57c9de", eyebrow: "The Cognitive Surface", motionVerb: "focus" },
  "/source": { id: "sources", visual: "sources", hue: "#63dfa1", eyebrow: "Cognitive Source Environment", motionVerb: "transform" },
  "/infrastructure": { id: "infrastructure", visual: "topology", hue: "#7fa8ff", eyebrow: "Universal Cognitive Infrastructure", motionVerb: "trace" },
  "/research": { id: "research", visual: "frontier", hue: "#a78bff", eyebrow: "Research · The Frontier Lab", motionVerb: "verify" },
  "/roadmap": { id: "roadmap", visual: "timeline", hue: "#ffd98e", eyebrow: "Roadmap", motionVerb: "trace" },
  "/about": { id: "about", visual: "settle", hue: "#57c9de", eyebrow: "About", motionVerb: "settle" },
};

export function sceneForPath(pathname: string): PublicScene {
  return PUBLIC_SCENES[pathname] ?? PUBLIC_SCENES["/"];
}
~~~

- [ ] **Step 4: Run the test and verify it passes.**

Run: pnpm --filter @inevitable/web test -- tests/site-cinematic.test.ts

Expected: PASS with two tests.

- [ ] **Step 5: Commit.**

~~~bash
git add apps/web/src/site/cinematic.ts apps/web/tests/site-cinematic.test.ts
git commit -m "feat(web): define public cinematic scenes"
~~~

## Task 2: Govern cinematic motion by user preference and device capability

**Files:**

- Create: apps/web/src/site/motion.ts
- Modify: apps/web/tests/site-cinematic.test.ts

- [ ] **Step 1: Add failing policy tests.**

~~~ts
import { motionModeFor } from "../src/site/motion";

test("uses static scenes whenever reduced motion is requested", () => {
  expect(motionModeFor({ reducedMotion: true, smallViewport: false, saveData: false })).toBe("static");
});

test("uses restrained scenes in low-cost environments", () => {
  expect(motionModeFor({ reducedMotion: false, smallViewport: true, saveData: false })).toBe("restrained");
  expect(motionModeFor({ reducedMotion: false, smallViewport: false, saveData: true })).toBe("restrained");
});

test("uses full scenes only when there is no constrained preference", () => {
  expect(motionModeFor({ reducedMotion: false, smallViewport: false, saveData: false })).toBe("full");
});
~~~

- [ ] **Step 2: Run the test to verify it fails.**

Run: pnpm --filter @inevitable/web test -- tests/site-cinematic.test.ts

Expected: FAIL because motionModeFor is not exported.

- [ ] **Step 3: Implement the pure policy and browser snapshot.**

~~~ts
export type MotionMode = "full" | "restrained" | "static";

export interface MotionEnvironment {
  readonly reducedMotion: boolean;
  readonly smallViewport: boolean;
  readonly saveData: boolean;
}

export function motionModeFor(env: MotionEnvironment): MotionMode {
  if (env.reducedMotion) return "static";
  if (env.smallViewport || env.saveData) return "restrained";
  return "full";
}

export function currentMotionEnvironment(): MotionEnvironment {
  if (typeof window === "undefined") {
    return { reducedMotion: true, smallViewport: false, saveData: false };
  }
  const network = navigator as Navigator & { connection?: { saveData?: boolean } };
  return {
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    smallViewport: Math.min(window.innerWidth, window.innerHeight) < 700,
    saveData: network.connection?.saveData === true,
  };
}
~~~

- [ ] **Step 4: Add useMotionMode using useEffect, matchMedia change, and resize listeners.**

The hook must only call currentMotionEnvironment inside useState/useEffect on the browser, clean up every listener, and return static during server rendering.

- [ ] **Step 5: Verify the policy and type safety, then commit.**

Run: pnpm --filter @inevitable/web test -- tests/site-cinematic.test.ts && pnpm --filter @inevitable/web typecheck

Expected: PASS.

~~~bash
git add apps/web/src/site/motion.ts apps/web/tests/site-cinematic.test.ts
git commit -m "feat(web): govern cinematic motion by capability"
~~~

## Task 3: Build accessible cinematic composition primitives

**Files:**

- Create: apps/web/src/site/CinematicChapter.tsx
- Create: apps/web/src/site/InstrumentVisual.tsx
- Modify: apps/web/src/site/primitives.tsx
- Modify: apps/web/src/site/site.css
- Modify: apps/web/tests/site-cinematic.test.ts

- [ ] **Step 1: Add failing server-render tests.**

~~~tsx
import { renderToStaticMarkup } from "react-dom/server";
import { CinematicChapter } from "../src/site/CinematicChapter";
import { InstrumentVisual } from "../src/site/InstrumentVisual";

test("chapter retains its narrative claim without animation", () => {
  const html = renderToStaticMarkup(
    <CinematicChapter title="From information to understanding" visual="ascent">
      <p>Understanding compounds across a lifetime.</p>
    </CinematicChapter>,
  );
  expect(html).toContain("From information to understanding");
  expect(html).toContain("Understanding compounds across a lifetime.");
  expect(html).toContain("data-cinematic-chapter");
});

test("instrument visuals are decorative", () => {
  expect(renderToStaticMarkup(<InstrumentVisual visual="topology" />)).toContain('aria-hidden="true"');
});
~~~

- [ ] **Step 2: Run the test to verify it fails.**

Run: pnpm --filter @inevitable/web test -- tests/site-cinematic.test.ts

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement CinematicChapter.**

~~~tsx
export function CinematicChapter({
  title,
  visual,
  children,
}: {
  readonly title: string;
  readonly visual: SceneVisual;
  readonly children: ReactNode;
}) {
  return (
    <section className="cinematic-chapter" data-cinematic-chapter data-visual={visual}>
      <div className="cinematic-chapter-copy">
        <h2 className="site-h2">{title}</h2>
        {children}
      </div>
      <InstrumentVisual visual={visual} />
    </section>
  );
}
~~~

- [ ] **Step 4: Implement InstrumentVisual as a non-focusable aria-hidden SVG/DOM visual for every SceneVisual.**

Use static nodes and labels only as decorative shapes. It must represent field, ascent, constitution, surface, sources, topology, frontier, timeline, and settle. A page's equivalent prose remains inside CinematicChapter.

- [ ] **Step 5: Add shared CSS and static fallback.**

Use transform and opacity for motion. Add explicit prefers-reduced-motion rules that remove all transitions/keyframes and keep each visual in a visible stable state. On screens below 860 px, put copy before the visual and cap visual height.

- [ ] **Step 6: Verify and commit.**

Run: pnpm --filter @inevitable/web test -- tests/site-cinematic.test.ts && pnpm --filter @inevitable/web typecheck

Expected: PASS.

~~~bash
git add apps/web/src/site/CinematicChapter.tsx apps/web/src/site/InstrumentVisual.tsx apps/web/src/site/primitives.tsx apps/web/src/site/site.css apps/web/tests/site-cinematic.test.ts
git commit -m "feat(web): add cinematic chapter primitives"
~~~

## Task 4: Add route-level ambient handoff

**Files:**

- Create: apps/web/src/site/RouteHandoff.tsx
- Modify: apps/web/src/site/Page.tsx
- Modify: apps/web/src/site/site.css
- Modify: apps/web/tests/site-cinematic.test.ts

- [ ] **Step 1: Add failing handoff tests.**

~~~ts
import { transitionKindFor } from "../src/site/RouteHandoff";

test("chooses CSS when native View Transitions are unavailable", () => {
  expect(transitionKindFor(false, "restrained")).toBe("css");
});

test("does not animate a route handoff in static mode", () => {
  expect(transitionKindFor(true, "static")).toBe("none");
});
~~~

- [ ] **Step 2: Run the test to verify it fails.**

Run: pnpm --filter @inevitable/web test -- tests/site-cinematic.test.ts

Expected: FAIL because RouteHandoff does not exist.

- [ ] **Step 3: Implement the helper and component.**

~~~tsx
export function transitionKindFor(
  hasViewTransition: boolean,
  mode: MotionMode,
): "native" | "css" | "none" {
  if (mode === "static") return "none";
  return hasViewTransition ? "native" : "css";
}

export function RouteHandoff({ scene }: { readonly scene: PublicScene }) {
  const mode = useMotionMode();
  return <div aria-hidden className="route-handoff" data-scene={scene.id} data-motion={mode} />;
}
~~~

- [ ] **Step 4: Integrate Page without changing its existing responsibilities.**

Obtain sceneForPath(pathname), add data-scene and data-motion to .site-page, and render RouteHandoff inside the decorative .site-field. Preserve document title, meta description, scroll restore, SiteNav, and SiteFooter.

- [ ] **Step 5: Add native and fallback CSS.**

Use root View Transition pseudo-elements only in an @supports block. The CSS fallback may change ambient opacity and transform slightly but must never create an opaque page flash.

- [ ] **Step 6: Verify and commit.**

Run: pnpm --filter @inevitable/web test -- tests/site-cinematic.test.ts && pnpm --filter @inevitable/web typecheck && pnpm --filter @inevitable/web build

Expected: PASS.

~~~bash
git add apps/web/src/site/RouteHandoff.tsx apps/web/src/site/Page.tsx apps/web/src/site/site.css apps/web/tests/site-cinematic.test.ts
git commit -m "feat(web): hand off cinematic route states"
~~~

## Task 5: Recompose Home, Vision, Philosophy, Roadmap, and About

**Files:**

- Modify: apps/web/src/landing/Landing.tsx
- Modify: apps/web/src/landing/landing.css
- Modify: apps/web/src/site/pages/VisionPage.tsx
- Modify: apps/web/src/site/pages/PhilosophyPage.tsx
- Modify: apps/web/src/site/pages/RoadmapPage.tsx
- Modify: apps/web/src/site/pages/AboutPage.tsx
- Create: apps/web/tests/site-public-routes.test.tsx

- [ ] **Step 1: Write failing route semantics tests.**

~~~tsx
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import VisionPage from "../src/site/pages/VisionPage";
import PhilosophyPage from "../src/site/pages/PhilosophyPage";
import RoadmapPage from "../src/site/pages/RoadmapPage";
import AboutPage from "../src/site/pages/AboutPage";

function pageHtml(Page: React.ComponentType) {
  return renderToStaticMarkup(<MemoryRouter><Page /></MemoryRouter>);
}

test("vision renders a semantic ascent chapter", () => {
  expect(pageHtml(VisionPage)).toContain('data-visual="ascent"');
  expect(pageHtml(VisionPage)).toContain("We have democratized information");
});

test("supporting institutional pages retain their truthful anchors", () => {
  expect(pageHtml(PhilosophyPage)).toContain("What this will never be");
  expect(pageHtml(RoadmapPage)).toContain("What exists and is verified");
  expect(pageHtml(AboutPage)).toContain("Why we exist");
});
~~~

- [ ] **Step 2: Run the test to verify it fails.**

Run: pnpm --filter @inevitable/web test -- tests/site-public-routes.test.tsx

Expected: FAIL because the current routes do not expose cinematic chapter visuals.

- [ ] **Step 3: Recompose each route with its declared visual.**

Home receives a compact documentary prelude before its existing scroll journey, reusing the current MOVEMENTS, World, imagery, and static fallback. Vision uses ascent for the mastery ladder. Philosophy uses constitution for values, refusals, and laws. Roadmap uses timeline for verified-now/next/horizon. About uses settle for mission, posture, and contact. Preserve current route sequence, metadata, real claims, and next-step links.

- [ ] **Step 4: Verify and commit.**

Run: pnpm --filter @inevitable/web test -- tests/site-public-routes.test.tsx tests/site-cinematic.test.ts && pnpm --filter @inevitable/web typecheck

Expected: PASS.

~~~bash
git add apps/web/src/landing/Landing.tsx apps/web/src/landing/landing.css apps/web/src/site/pages/VisionPage.tsx apps/web/src/site/pages/PhilosophyPage.tsx apps/web/src/site/pages/RoadmapPage.tsx apps/web/src/site/pages/AboutPage.tsx apps/web/tests/site-public-routes.test.tsx
git commit -m "feat(web): stage the public narrative arc"
~~~

## Task 6: Stage the Cognitive Surface as a visible instrument

**Files:**

- Modify: apps/web/src/site/pages/SurfacePage.tsx
- Modify: apps/web/src/site/site.css
- Modify: apps/web/tests/site-public-routes.test.tsx

- [ ] **Step 1: Add a failing Surface scene test.**

~~~tsx
import SurfacePage from "../src/site/pages/SurfacePage";

test("surface presents cognition as an observable instrument", () => {
  const html = pageHtml(SurfacePage);
  expect(html).toContain('data-visual="surface"');
  expect(html).toContain("Agents think in the open");
  expect(html).toContain("Mastery is earned, not clicked");
});
~~~

- [ ] **Step 2: Run the test to verify it fails.**

Run: pnpm --filter @inevitable/web test -- tests/site-public-routes.test.tsx

Expected: FAIL because Surface does not use the surface visual.

- [ ] **Step 3: Add two Surface chapters.**

Surround the existing real surface-still.webp with a surface visual that traces narration focus across frame, agent, and thread regions. Add a second readable chapter for agents, steering, mastery, and prerequisite descent. Do not replace the actual product still with a fictional dashboard and do not add a second WebGL canvas.

- [ ] **Step 4: Add only CSS state choreography.**

Use data attributes, transform, and opacity to emphasize the visual focus. Do not add a continuous timer or scroll-blocking listener.

- [ ] **Step 5: Verify and commit.**

Run: pnpm --filter @inevitable/web test -- tests/site-public-routes.test.tsx && pnpm --filter @inevitable/web typecheck

Expected: PASS.

~~~bash
git add apps/web/src/site/pages/SurfacePage.tsx apps/web/src/site/site.css apps/web/tests/site-public-routes.test.tsx
git commit -m "feat(web): stage the cognitive surface"
~~~

## Task 7: Visualize source transformation and systems rigor

**Files:**

- Modify: apps/web/src/site/pages/SourcePage.tsx
- Modify: apps/web/src/site/pages/InfrastructurePage.tsx
- Modify: apps/web/src/site/site.css
- Modify: apps/web/tests/site-public-routes.test.tsx

- [ ] **Step 1: Add failing Source and Infrastructure scene tests.**

~~~tsx
import SourcePage from "../src/site/pages/SourcePage";
import InfrastructurePage from "../src/site/pages/InfrastructurePage";

test("sources render artifact-to-cognitive-environment transformation", () => {
  const html = pageHtml(SourcePage);
  expect(html).toContain('data-visual="sources"');
  expect(html).toContain("Documents end. Sources live.");
  expect(html).toContain("The Cognitive Theater");
});

test("infrastructure renders governed topology without hiding its laws", () => {
  const html = pageHtml(InfrastructurePage);
  expect(html).toContain('data-visual="topology"');
  expect(html).toContain("Laws the kernel enforces");
  expect(html).toContain("No memory write without a typed Memory Mutation.");
});
~~~

- [ ] **Step 2: Run the test to verify it fails.**

Run: pnpm --filter @inevitable/web test -- tests/site-public-routes.test.tsx

Expected: FAIL because neither route exposes its scene visual.

- [ ] **Step 3: Recompose Sources with an explicit finite transformation.**

Render these labeled semantic states in document order: Books and artifacts → Semantic understanding → Agent collaboration → Cognitive Surface → Research → Discovery. The visual may trace between them, but every state must remain readable text. Preserve existing anchor, consent, provenance, and No-Ghostwriter laws.

- [ ] **Step 4: Recompose Infrastructure with an illustrative governed topology.**

Render visual nodes for event, memory mutation, governance decision, agent runtime, world state, and observability. Explain through labels that it is a projection of architecture, not a live operational dashboard. Retain all ten invariants as readable text.

- [ ] **Step 5: Verify and commit.**

Run: pnpm --filter @inevitable/web test -- tests/site-public-routes.test.tsx && pnpm --filter @inevitable/web typecheck

Expected: PASS.

~~~bash
git add apps/web/src/site/pages/SourcePage.tsx apps/web/src/site/pages/InfrastructurePage.tsx apps/web/src/site/site.css apps/web/tests/site-public-routes.test.tsx
git commit -m "feat(web): visualize source and infrastructure systems"
~~~

## Task 8: Stage the research frontier and finish verification

**Files:**

- Modify: apps/web/src/site/pages/ResearchPage.tsx
- Modify: apps/web/src/site/site.css
- Modify: apps/web/tests/site-public-routes.test.tsx

- [ ] **Step 1: Add a failing Research scene test.**

~~~tsx
import ResearchPage from "../src/site/pages/ResearchPage";

test("research is presented as an active, governed frontier", () => {
  const html = pageHtml(ResearchPage);
  expect(html).toContain('data-visual="frontier"');
  expect(html).toContain("A system that studies understanding");
  expect(html).toContain("Toward autonomous deep research");
});
~~~

- [ ] **Step 2: Run the test to verify it fails.**

Run: pnpm --filter @inevitable/web test -- tests/site-public-routes.test.tsx

Expected: FAIL because Research does not yet use the frontier scene.

- [ ] **Step 3: Recompose Research into laboratory chapters.**

Use frontier visual chapters for learning-science grounding, evaluation, evidence, uncertainty, and human review. Keep the current distinction that autonomous research is a direction, not a current product claim, and that inference carries provenance and governance.

- [ ] **Step 4: Strengthen complete-site fallbacks.**

In the global reduced-motion block, freeze instrument line/path/keyframe effects, show all chapter content, and remove route handoff animation. In the narrow-screen block, limit visual height and retain copy-first reading order.

- [ ] **Step 5: Run full automated verification.**

~~~bash
pnpm --filter @inevitable/web test
pnpm --filter @inevitable/web typecheck
pnpm --filter @inevitable/web build
~~~

Expected: all commands exit with status 0.

- [ ] **Step 6: Perform manual production verification.**

Run: pnpm --filter @inevitable/web dev

Verify /, /vision, /surface, /source, /infrastructure, /research, /philosophy, /roadmap, and /about at desktop and 390 px wide. For every route, verify a single semantic scene is legible, navigation works by keyboard, no text is obscured by motion, and the next-step link follows the intended narrative. Repeat with OS reduced motion enabled and with WebGL unavailable; content must remain complete and readable.

- [ ] **Step 7: Commit.**

~~~bash
git add apps/web/src/site/pages/ResearchPage.tsx apps/web/src/site/site.css apps/web/tests/site-public-routes.test.tsx
git commit -m "feat(web): complete cinematic public identity"
~~~

## Plan self-review

### Specification coverage

- One continuous nine-route narrative: Tasks 1, 4, and 5.
- Living Instrument shared identity: Tasks 1–4.
- Documentary scale for Home, Vision, and Research: Tasks 5 and 8.
- Source-to-cognitive-world transformation: Task 7.
- Surface experience, visible agents, narration focus, and mastery: Task 6.
- Infrastructure depth, governance, memory, events, and observability: Task 7.
- Research laboratory posture and uncertainty-honest direction: Task 8.
- Performance, responsiveness, accessibility, and semantic motion: Tasks 2–4 and 8.
- Tests, typecheck, build, and manual visual verification: every task, with final verification in Task 8.

### Consistency check

The plan has one source of truth for route scene ids, and it reuses those ids in the page scaffold, visual primitives, route pages, and tests. Motion modes are consistently named full, restrained, and static. It retains existing real copy, public routes, metadata behavior, and the live product visual instead of inventing backend behavior.

