/**
 * LaTeX → HTML rendering for MCCR key-formula anchors (UCS, ADR-0030).
 *
 * A math-education surface must never show a learner raw `\sigma(\sum_{i} w_i x_i + b)`. Two
 * renderers live behind one seam:
 *
 *   - KaTeX (publication-grade: derivations, matrices, aligned environments) loads lazily as its
 *     own chunk via `ensureKatex()`; components subscribe with `subscribeMathRenderer` and
 *     re-render the moment it lands. KaTeX renders synchronously and deterministically — the
 *     replay law holds.
 *   - The dependency-free fallback below covers the common notation instantly (first paint, SSR,
 *     tests, KaTeX load failure) — Greek letters, operators, sub/superscripts, fractions, roots,
 *     blackboard-bold — and degrades gracefully (unknown macros lose their backslash, never shout).
 *
 * Output is XSS-safe: KaTeX output is generated markup from parsed math (throwOnError: false), and
 * the fallback HTML-escapes the source FIRST — the only tags introduced afterward are the ones the
 * function emits. The `plain` spoken form remains the accessible + fallback text.
 */

// ---------------------------------------------------------------------------
// KaTeX lazy boundary
// ---------------------------------------------------------------------------

interface KatexLike {
  renderToString(tex: string, options?: Record<string, unknown>): string;
}

let katexModule: KatexLike | null = null;
let katexLoading = false;
const rendererListeners = new Set<() => void>();

/** Kick off the KaTeX chunk load (idempotent). Callers keep using the fallback until it lands. */
export function ensureKatex(): void {
  if (katexModule || katexLoading) return;
  katexLoading = true;
  void Promise.all([import("katex"), import("katex/dist/katex.min.css")])
    .then(([mod]) => {
      katexModule = (mod as { default?: KatexLike }).default ?? (mod as unknown as KatexLike);
      for (const listener of rendererListeners) listener();
    })
    .catch(() => {
      katexLoading = false; // stay on the fallback renderer; a later call may retry
    });
}

/** Subscribe to the renderer upgrade (fallback → KaTeX). For useSyncExternalStore. */
export function subscribeMathRenderer(listener: () => void): () => void {
  rendererListeners.add(listener);
  return () => rendererListeners.delete(listener);
}

/** Snapshot for useSyncExternalStore: bumps when KaTeX becomes available. */
export function mathRendererVersion(): number {
  return katexModule ? 1 : 0;
}

const SYMBOLS: Record<string, string> = {
  // Greek (lower)
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  varepsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  vartheta: "ϑ",
  iota: "ι",
  kappa: "κ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  tau: "τ",
  upsilon: "υ",
  phi: "φ",
  varphi: "φ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
  // Greek (upper)
  Gamma: "Γ",
  Delta: "Δ",
  Theta: "Θ",
  Lambda: "Λ",
  Xi: "Ξ",
  Pi: "Π",
  Sigma: "Σ",
  Phi: "Φ",
  Psi: "Ψ",
  Omega: "Ω",
  // Operators & relations
  sum: "∑",
  prod: "∏",
  int: "∫",
  partial: "∂",
  nabla: "∇",
  infty: "∞",
  pm: "±",
  mp: "∓",
  times: "×",
  div: "÷",
  cdot: "·",
  ast: "∗",
  star: "⋆",
  circ: "∘",
  bullet: "∙",
  leq: "≤",
  le: "≤",
  geq: "≥",
  ge: "≥",
  neq: "≠",
  ne: "≠",
  approx: "≈",
  equiv: "≡",
  sim: "∼",
  propto: "∝",
  ll: "≪",
  gg: "≫",
  rightarrow: "→",
  to: "→",
  leftarrow: "←",
  Rightarrow: "⇒",
  Leftarrow: "⇐",
  leftrightarrow: "↔",
  mapsto: "↦",
  implies: "⟹",
  in: "∈",
  notin: "∉",
  subset: "⊂",
  subseteq: "⊆",
  supset: "⊃",
  supseteq: "⊇",
  cup: "∪",
  cap: "∩",
  emptyset: "∅",
  forall: "∀",
  exists: "∃",
  neg: "¬",
  land: "∧",
  lor: "∨",
  angle: "∠",
  perp: "⊥",
  parallel: "∥",
  degree: "°",
  prime: "′",
  langle: "⟨",
  rangle: "⟩",
  lfloor: "⌊",
  rfloor: "⌋",
  lceil: "⌈",
  rceil: "⌉",
  hbar: "ℏ",
  ell: "ℓ",
  Re: "ℜ",
  Im: "ℑ",
  aleph: "ℵ",
  cdots: "⋯",
  ldots: "…",
  dots: "…",
};

const BLACKBOARD: Record<string, string> = {
  R: "ℝ",
  N: "ℕ",
  Z: "ℤ",
  Q: "ℚ",
  C: "ℂ",
  E: "𝔼",
  P: "ℙ",
  H: "ℍ",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Render LaTeX to a safe HTML string — KaTeX when loaded, else the instant fallback. */
export function latexToHtml(latex: string, plain?: string): string {
  const src = (latex ?? "").trim();
  if (!src) return escapeHtml(plain ?? "");
  if (katexModule) {
    try {
      return katexModule.renderToString(src, {
        throwOnError: false,
        displayMode: false,
        output: "html",
      });
    } catch {
      /* fall through to the dependency-free renderer */
    }
  }
  let s = escapeHtml(src);

  // \frac{a}{b} and \dfrac/\tfrac → a stacked fraction (one level; nested fractions are rare here).
  s = s.replace(
    /\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,
    (_m, num: string, den: string) =>
      `<span class="ltx-frac"><span class="ltx-num">${num}</span><span class="ltx-den">${den}</span></span>`,
  );
  // \sqrt{a} → √(a)
  s = s.replace(
    /\\sqrt\s*\{([^{}]*)\}/g,
    (_m, body: string) => `√<span class="ltx-sqrt">${body}</span>`,
  );
  // \mathbb{R} / \mathbf{x} / \mathrm{d} / \text{...}
  s = s.replace(/\\mathbb\s*\{([^{}]*)\}/g, (_m, body: string) => BLACKBOARD[body.trim()] ?? body);
  s = s.replace(/\\(?:mathbf|mathrm|mathit|text|operatorname)\s*\{([^{}]*)\}/g, "$1");
  // \left( \right) sizing wrappers — the glyphs are kept, the macros dropped.
  s = s.replace(/\\(?:left|right|big|Big|bigg|Bigg)\s*/g, "");

  // Named symbols / Greek / operators. Longest names first so \varepsilon beats \var…, etc.
  const names = Object.keys(SYMBOLS).sort((a, b) => b.length - a.length);
  s = s.replace(
    new RegExp(`\\\\(${names.join("|")})(?![A-Za-z])`, "g"),
    (_m, name: string) => SYMBOLS[name] ?? _m,
  );

  // Superscripts / subscripts: braced group first, then a single token.
  s = s.replace(/\^\{([^{}]*)\}/g, (_m, body: string) => `<sup>${body}</sup>`);
  s = s.replace(/_\{([^{}]*)\}/g, (_m, body: string) => `<sub>${body}</sub>`);
  s = s.replace(/\^(\\?[A-Za-z0-9+-])/g, (_m, ch: string) => `<sup>${ch.replace(/^\\/, "")}</sup>`);
  s = s.replace(/_(\\?[A-Za-z0-9+-])/g, (_m, ch: string) => `<sub>${ch.replace(/^\\/, "")}</sub>`);

  // Spacing macros → thin/regular spaces; drop remaining braces and stray backslashes gracefully.
  s = s.replace(/\\[,;:!]/g, " ").replace(/\\quad|\\qquad/g, "  ");
  s = s.replace(/\\\\/g, " ");
  s = s.replace(/[{}]/g, "");
  s = s.replace(/\\([A-Za-z]+)/g, "$1"); // unknown macro → its name (never a raw backslash)
  s = s.replace(/\s{2,}/g, " ").trim();

  // If everything collapsed to nothing meaningful, fall back to the spoken form.
  if (!s.replace(/<[^>]+>/g, "").trim()) return escapeHtml(plain ?? src);
  return s;
}
