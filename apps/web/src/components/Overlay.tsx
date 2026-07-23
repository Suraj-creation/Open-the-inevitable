/**
 * Overlay — the reusable transient surface for everything that is not the whiteboard. Per the S-UCS
 * composition law (F09 §4.1), the Cognitive Stage is fullscreen and every other affordance floats over
 * it as a dismissible overlay. Content is ALWAYS mounted and toggled with CSS (`data-open`), never
 * conditionally unmounted — so the surface stays a pure projection and server-rendered markup is stable.
 */
import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

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
  const panelRef = useRef<HTMLElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // Escape closes; Tab is trapped within the panel (a11y §17a). Focus moves in on open and is
  // restored to the opener on close, so keyboard users never fall out of the dialog or lose their place.
  useEffect(() => {
    if (!open) return;
    openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
    // Move focus into the panel (first focusable, else the panel itself).
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && activeEl === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && activeEl === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // Restore focus to whatever opened the overlay (if it is still in the document).
      const opener = openerRef.current;
      if (opener && document.contains(opener)) opener.focus();
    };
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
      <section
        className="overlay-panel"
        role="dialog"
        aria-label={title}
        aria-modal="true"
        tabIndex={-1}
        ref={panelRef}
      >
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
