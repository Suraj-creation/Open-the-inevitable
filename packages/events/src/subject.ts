/**
 * Subject/topic matching for event subscriptions. NATS-style tokens separated by ".":
 *   "*" matches exactly one token; ">" matches one-or-more trailing tokens (must be last).
 * Spec: spec/communication/universal-cognitive-bus.md, spec/events/event-taxonomy.md.
 */
export function matchSubject(pattern: string, subject: string): boolean {
  if (pattern === subject) return true;
  const p = pattern.split(".");
  const s = subject.split(".");
  for (let i = 0; i < p.length; i++) {
    const token = p[i];
    if (token === ">") {
      return s.length >= i + 1;
    }
    if (i >= s.length) return false;
    if (token === "*") continue;
    if (token !== s[i]) return false;
  }
  return p.length === s.length;
}

/** Extract the family (first token) from an event type / topic. */
export function familyOf(eventType: string): string {
  const idx = eventType.indexOf(".");
  return idx < 0 ? eventType : eventType.slice(0, idx);
}
