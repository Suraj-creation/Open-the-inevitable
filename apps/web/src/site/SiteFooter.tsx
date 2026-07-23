/**
 * SiteFooter — the ecosystem's quiet close (CDL: the world settles). The full map of the public
 * site in whisper type over the deep field, the mission line as the last word, and the enter
 * affordance one final time. One footer for every page — the ecosystem is coherent.
 */
import { Link, useNavigate } from "react-router-dom";

const COLUMNS: readonly {
  readonly title: string;
  readonly links: readonly { to: string; label: string }[];
}[] = [
  {
    title: "Understand",
    links: [
      { to: "/vision", label: "Vision" },
      { to: "/philosophy", label: "Philosophy" },
      { to: "/roadmap", label: "Roadmap" },
    ],
  },
  {
    title: "The system",
    links: [
      { to: "/surface", label: "Cognitive Surface" },
      { to: "/source", label: "Source Environment" },
      { to: "/infrastructure", label: "Infrastructure" },
    ],
  },
  {
    title: "The work",
    links: [
      { to: "/research", label: "Research" },
      { to: "/about", label: "About & Contact" },
      { to: "/enter", label: "Enter the surface" },
    ],
  },
];

export function SiteFooter() {
  const navigate = useNavigate();
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <span className="site-wordmark site-wordmark--footer">
            <span className="brand-mark" aria-hidden>
              ◇
            </span>
            The Inevitable
          </span>
          <p className="site-footer-mission">
            Universal Cognitive Infrastructure — so that understanding, once formed, compounds for a
            lifetime.
          </p>
          <button type="button" className="site-enter" onClick={() => navigate("/enter")}>
            Enter the surface <span aria-hidden>→</span>
          </button>
        </div>
        <nav className="site-footer-cols" aria-label="Site map">
          {COLUMNS.map((col) => (
            <div className="site-footer-col" key={col.title}>
              <span className="site-footer-col-title">{col.title}</span>
              {col.links.map((l) => (
                <Link key={l.to} to={l.to} className="site-footer-link">
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </div>
      <div className="site-footer-base">
        <span>
          © {new Date().getFullYear()} The Inevitable · Universal Cognitive Infrastructure
        </span>
        <span className="site-footer-whisper">Every thought traceable, replayable, governed.</span>
      </div>
    </footer>
  );
}
