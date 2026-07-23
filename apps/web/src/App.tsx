/**
 * App — composition root for the public ecosystem AND the visible surface. The router serves the
 * continuous Home journey at `/` and the ecosystem pages (vision/philosophy/surface/source/
 * infrastructure/research/roadmap/about) as lazy routes; a surface id in the URL (`?s=<id>`, any
 * path) always takes precedence and enters the live cognitive environment. The surface flow
 * itself is unchanged: enter → governed commands out, the folded event stream back.
 */
import { Suspense, lazy, useEffect, useRef, useState, type FormEvent } from "react";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { enterSurface, sendCommand } from "./api";
import { Landing } from "./landing/Landing";
import { SiteNav } from "./site/SiteNav";
import { SurfaceView } from "./SurfaceView";
import { useSurfaceStream } from "./useSurfaceStream";

const VisionPage = lazy(() => import("./site/pages/VisionPage"));
const PhilosophyPage = lazy(() => import("./site/pages/PhilosophyPage"));
const SurfacePage = lazy(() => import("./site/pages/SurfacePage"));
const SourcePage = lazy(() => import("./site/pages/SourcePage"));
const InfrastructurePage = lazy(() => import("./site/pages/InfrastructurePage"));
const ResearchPage = lazy(() => import("./site/pages/ResearchPage"));
const RoadmapPage = lazy(() => import("./site/pages/RoadmapPage"));
const AboutPage = lazy(() => import("./site/pages/AboutPage"));

/** The surface id encoded in the URL (`?s=<id>`), so a surface can be linked, resumed, or shared. */
function surfaceIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("s");
}

/**
 * Progress narration (review §21): the pipeline stage, derived purely from folded state — so a long
 * ask reads as "planning → composing → distilling → voicing" rather than dead silence with a spinner.
 */
function phaseOf(state: ReturnType<typeof useSurfaceStream>["state"]): string {
  if (!state) return "reaching the surface";
  if (!state.timeline) return "planning your path";
  if (state.frames.length === 0) return "composing the board";
  if (state.narration.length === 0) return "distilling the anchors";
  return "giving it a voice";
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

function AppRoutes() {
  const location = useLocation();
  // A shared/resumed surface link enters cognition directly, from any path.
  const hasSurface = new URLSearchParams(location.search).get("s") !== null;
  if (hasSurface) return <SurfaceApp />;
  return (
    <Suspense fallback={<div className="site-route-loading" aria-hidden />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/enter" element={<SurfaceApp />} />
        <Route path="/vision" element={<VisionPage />} />
        <Route path="/philosophy" element={<PhilosophyPage />} />
        <Route path="/surface" element={<SurfacePage />} />
        <Route path="/source" element={<SourcePage />} />
        <Route path="/infrastructure" element={<InfrastructurePage />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Suspense>
  );
}

/** The Home journey — the continuous cinematic world, with the ecosystem's nav and footer. */
function Home() {
  const navigate = useNavigate();
  useEffect(() => {
    document.title = "The Inevitable — Universal Cognitive Infrastructure";
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta)
      meta.content =
        "An operating system for human understanding. Intelligence that grows minds — from any starting point to genuine mastery, and onward to original contribution.";
  }, []);
  return <Landing onEnter={() => navigate("/enter")} />;
}

/**
 * SurfaceApp — the live cognitive environment: the enter card (when no surface yet) and the
 * streaming SurfaceView. Owns the surface lifecycle; the router hands over entirely.
 */
function SurfaceApp() {
  // Resume the surface named in the URL on load (review §18/§24) — the gateway rehydrates it.
  const [surfaceId, setSurfaceId] = useState<string | null>(surfaceIdFromUrl);
  const [goal, setGoal] = useState("Teach me Neural Networks");
  const [mode, setMode] = useState<"student" | "educator">("student");
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "Working" acknowledgement (review N7/issue 10): after a command the learner sees the surface is
  // thinking, cleared when new cognition streams in (or after a safety timeout) — never dead silence.
  const [working, setWorking] = useState<string | null>(null);
  const stream = useSurfaceStream(surfaceId);
  const growth =
    (stream.state?.frames.length ?? 0) +
    (stream.state?.narration.length ?? 0) +
    (stream.state?.blocks.length ?? 0);
  const baseline = useRef(0);
  useEffect(() => {
    if (working !== null && growth > baseline.current) setWorking(null);
  }, [growth, working]);
  useEffect(() => {
    if (working === null) return;
    const t = setTimeout(() => setWorking(null), 45000);
    return () => clearTimeout(t);
  }, [working]);

  const enter = async (): Promise<void> => {
    const trimmed = goal.trim();
    if (!trimmed) return;
    setEntering(true);
    setError(null);
    try {
      const id = await enterSurface(trimmed, mode);
      setSurfaceId(id);
      // Reflect the surface in the URL so it can be linked / resumed / shared.
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", `?s=${encodeURIComponent(id)}`);
      }
      // Enter the environment, then begin thinking — effects arrive live over the stream.
      await sendCommand(id, { type: "ask", goal: trimmed });
    } catch (cause) {
      // Never fail silently (N8): surface a real, recoverable error state.
      setError(cause instanceof Error ? cause.message : "Could not reach the cognitive surface.");
      setSurfaceId(null);
    } finally {
      setEntering(false);
    }
  };

  // Fire-and-forget command sender that acknowledges the learner (working state) and routes failures
  // to the error banner instead of the void.
  const send = (command: Parameters<typeof sendCommand>[1]): void => {
    if (!surfaceId) return;
    const labels: Record<string, string> = {
      ask: "Thinking it through",
      advance: "Composing what's next",
      expand: "Going deeper",
      interact: "Adapting to you",
      close: "Wrapping up",
    };
    baseline.current = growth;
    setWorking(labels[command.type] ?? "Working");
    setError(null);
    void sendCommand(surfaceId, command).catch((cause: unknown) => {
      setWorking(null);
      setError(cause instanceof Error ? cause.message : "Command failed.");
    });
  };

  if (!surfaceId) {
    const submit = (event: FormEvent): void => {
      event.preventDefault();
      void enter();
    };
    return (
      <div className="enter">
        <SiteNav onJourney />
        <div className="enter-aura" aria-hidden />
        <div className="enter-card">
          <span className="enter-eyebrow">Cognitive Operating System</span>
          <h1 className="enter-title">
            Watch understanding <em>unfold</em>.
          </h1>
          <p className="enter-sub">
            A living surface where cognition becomes visible — agents think, concepts take the
            stage, and a path forms as you learn.
          </p>
          <form className="enter-form" onSubmit={submit}>
            {error ? (
              <p className="enter-error" role="alert">
                {error}
              </p>
            ) : null}
            <input
              className="enter-input"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="What do you want to understand?"
              aria-label="What do you want to understand?"
            />
            <div className="enter-mode-row" role="group" aria-label="Surface mode">
              {(["student", "educator"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`enter-mode-chip${mode === m ? " enter-mode-chip--active" : ""}`}
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                >
                  {m === "student" ? "Student" : "Educator"}
                </button>
              ))}
            </div>
            <button type="submit" className="enter-go" disabled={entering}>
              {entering ? "Entering…" : "Enter"}
              <span className="enter-go-icon" aria-hidden>
                →
              </span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      {error ? (
        <div className="surface-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">
            ✕
          </button>
        </div>
      ) : null}
      {working ? (
        <div className="surface-working" role="status" aria-live="polite">
          <span className="surface-working-pulse" aria-hidden />
          {working} · {phaseOf(stream.state)}
        </div>
      ) : null}
      <SurfaceView
        surfaceId={surfaceId}
        state={stream.state}
        status={stream.status}
        events={stream.events}
        onAsk={(g) => send({ type: "ask", goal: g })}
        onExpand={(blockId, layer) => send({ type: "expand", block_id: blockId, layer })}
        onAdvance={(conceptId) =>
          send({ type: "advance", ...(conceptId ? { concept_id: conceptId } : {}) })
        }
        onAnswer={(conceptId, text) => send({ type: "answer", concept_id: conceptId, text })}
        onInteract={(kind, targetId) =>
          send({ type: "interact", kind, ...(targetId ? { target_id: targetId } : {}) })
        }
      />
    </>
  );
}
