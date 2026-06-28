/**
 * useAutoHide — pointer-idle visibility for floating chrome (F09 §4.1). Returns `active` (visible)
 * which flips false after `idleMs` of no pointer/keyboard activity and back true on the next intent.
 * Pure client UI state — never canonical. Used by the transport HUD to maximize immersion while
 * keeping full function one gesture away.
 */
import { useEffect, useRef, useState } from "react";

export function useAutoHide(idleMs = 3200): boolean {
  const [active, setActive] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const arm = (): void => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setActive(false), idleMs);
    };
    const wake = (): void => {
      setActive(true);
      arm();
    };
    window.addEventListener("pointermove", wake, { passive: true });
    window.addEventListener("pointerdown", wake, { passive: true });
    window.addEventListener("keydown", wake);
    arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [idleMs]);

  return active;
}
