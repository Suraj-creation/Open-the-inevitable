/**
 * SiteNav — whisper-glass navigation for the public ecosystem (CDL: chrome dissolves; the world is
 * primary). A hairline glass bar: wordmark home, the five living regions, and the one real call —
 * enter the surface. On narrow viewports the regions fold into a glass disclosure. Never occludes
 * the journey: transparent over the Home world, bodied glass on inner pages.
 */
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

const LINKS: readonly { to: string; label: string }[] = [
  { to: "/vision", label: "Vision" },
  { to: "/surface", label: "Surface" },
  { to: "/source", label: "Sources" },
  { to: "/infrastructure", label: "Infrastructure" },
  { to: "/research", label: "Research" },
];

export function SiteNav({ onJourney = false }: { readonly onJourney?: boolean }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return (
    <nav className={`site-nav${onJourney ? " site-nav--journey" : ""}`} aria-label="Site">
      <Link className="site-wordmark" to="/" onClick={() => setOpen(false)}>
        <span className="brand-mark" aria-hidden>
          ◇
        </span>
        The Inevitable
      </Link>
      <div className={`site-nav-links${open ? " is-open" : ""}`} id="site-nav-links">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) => `site-nav-link${isActive ? " is-here" : ""}`}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </NavLink>
        ))}
      </div>
      <div className="site-nav-end">
        <button
          type="button"
          className="site-enter"
          onClick={() => {
            setOpen(false);
            navigate("/enter");
          }}
        >
          Enter the surface <span aria-hidden>→</span>
        </button>
        <button
          type="button"
          className="site-nav-toggle"
          aria-expanded={open}
          aria-controls="site-nav-links"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>
    </nav>
  );
}
