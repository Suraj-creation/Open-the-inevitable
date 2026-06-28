/**
 * Overlay — the reusable transient surface for everything that is not the whiteboard. Per the S-UCS
 * composition law (F09 §4.1), the Cognitive Stage is fullscreen and every other affordance floats over
 * it as a dismissible overlay. Content is ALWAYS mounted and toggled with CSS (`data-open`), never
 * conditionally unmounted — so the surface stays a pure projection and server-rendered markup is stable.
 */
import { useEffect, type ReactNode } from "react";

export type OverlaySide = "right" | "center" | "left";

export interface OverlayProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly side?: OverlaySide;
  readonly className?: string;
  readonly children: ReactNode;
}

export function Overlay({
  open,
  onClose,
  title,
  side = "right",
  className,
  children,
}: OverlayProps) {
  // Escape closes the overlay (intent-driven dismissal); listener only while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={`overlay overlay--${side} ${className ?? ""}`}
      data-open={open ? "true" : "false"}
      aria-hidden={!open}
    >
      <button
        type="button"
        className="overlay-scrim"
        aria-label={`Close ${title}`}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <section className="overlay-panel" role="dialog" aria-label={title} aria-modal="false">
        <header className="overlay-head">
          <h2 className="overlay-title">{title}</h2>
          <button
            type="button"
            className="overlay-close"
            onClick={onClose}
            aria-label={`Close ${title}`}
            tabIndex={open ? 0 : -1}
          >
            ✕
          </button>
        </header>
        <div className="overlay-body">{children}</div>
      </section>
    </div>
  );
}
