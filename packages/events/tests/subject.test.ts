import { describe, it, expect } from "vitest";
import { matchSubject, familyOf } from "../src/subject";

describe("matchSubject", () => {
  it("matches exact subjects", () => {
    expect(matchSubject("agent.completed", "agent.completed")).toBe(true);
    expect(matchSubject("agent.completed", "agent.failed")).toBe(false);
  });

  it("matches single-token wildcard *", () => {
    expect(matchSubject("agent.*", "agent.completed")).toBe(true);
    expect(matchSubject("agent.*", "agent.completed.extra")).toBe(false);
    expect(matchSubject("*.completed", "agent.completed")).toBe(true);
  });

  it("matches multi-token tail >", () => {
    expect(matchSubject("memory.>", "memory.mutation.committed")).toBe(true);
    expect(matchSubject(">", "anything.at.all")).toBe(true);
    expect(matchSubject("memory.>", "agent.completed")).toBe(false);
  });
});

describe("familyOf", () => {
  it("extracts the leading family token", () => {
    expect(familyOf("agent.completed")).toBe("agent");
    expect(familyOf("solo")).toBe("solo");
  });
});
