import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  danglingPointers,
  hook,
  project,
  record,
  renderStatus,
  renderView,
  runChecks,
  readJournal,
  validate,
} from "./ba.mjs";

const BA = join(dirname(fileURLToPath(import.meta.url)), "ba.mjs");
const CONST = "# C\n\nSee `NOTES.md` and `gone.md` and [x](docs/a.md).\n";

function repo() {
  const root = mkdtempSync(join(tmpdir(), "ba-"));
  const g = (...a) => execFileSync("git", ["-C", root, ...a], { stdio: "ignore" });
  g("init", "-q", "-b", "main");
  g("config", "user.email", "t@t");
  g("config", "user.name", "t");
  g("config", "core.autocrlf", "false");
  for (const f of ["CLAUDE.md", "CODEX.md", "AGENTS.md"]) writeFileSync(join(root, f), CONST);
  writeFileSync(join(root, "NOTES.md"), "x");
  writeFileSync(join(root, "gone.md"), "x");
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "docs", "a.md"), "x");
  g("add", "-A");
  g("commit", "-q", "-m", "init");
  g("rm", "-q", "gone.md", "docs/a.md");
  g("commit", "-q", "-m", "delete");
  return { root, journal: join(root, ".build", "journal.jsonl"), g };
}

test("record never lets a caller supply stamps", () => {
  const { root, journal } = repo();
  const e = record(root, journal, "question", { by: "a", text: "q", id: "x", head: "abc" });
  assert.match(e.errors[0], /stamped by record, not supplied: id, head/);
});

test("the CLI takes the kind positionally or from the JSON, never from a flag", () => {
  const { root, journal } = repo();
  const run = (...a) =>
    spawnSync(process.execPath, [BA, "--root", root, "record", ...a], { encoding: "utf8" });
  const q = JSON.stringify({ by: "a", text: "q" });
  assert.match(run("question", "--json", q).stdout, /recorded question-\d{8}-[0-9a-f]{4}/);
  assert.match(
    run("--json", JSON.stringify({ kind: "question", by: "a", text: "q" })).stdout,
    /recorded question-/,
  );
  assert.equal(run("--json", q).status, 2);
  assert.equal(
    run("decision", "--json", JSON.stringify({ kind: "question", by: "a", text: "q" })).status,
    2,
  );
  assert.ok(readJournal(journal).every((e) => /^question-/.test(e.id)));
});

test("record validates kinds, fields, and unknown keys", () => {
  const { root, journal } = repo();
  assert.ok(
    record(root, journal, "decision", { by: "owner", text: "Delete X", reasons: ["stale"] }).entry,
  );
  assert.match(
    record(root, journal, "decision", { by: "owner", text: "No reasons" }).errors[0],
    /reasons/,
  );
  assert.match(record(root, journal, "nope", { by: "a" }).errors[0], /unknown kind/);
  assert.match(
    record(root, journal, "question", { by: "a", text: "q", txet: "typo" }).errors[0],
    /unknown field "txet"/,
  );
  assert.equal(readJournal(journal).length, 1, "invalid entries are never appended");
});

test("stamps bind every entry to HEAD and tree state", () => {
  const { root, journal } = repo();
  writeFileSync(join(root, "wip.txt"), "x");
  const { entry } = record(root, journal, "question", { by: "a", text: "why?" });
  assert.match(entry.head, /^[0-9a-f]{7,}$/);
  assert.equal(entry.branch, "main");
  assert.equal(entry.dirty, true);
});

test("a verdict on a dirty tree must name what is uncommitted", () => {
  const { root, journal } = repo();
  writeFileSync(join(root, "wip.txt"), "x");
  const v = { by: "a", milestone: "M1", result: "PARTIAL", met: [], unmet: ["x"] };
  assert.match(record(root, journal, "verdict", v).errors[0], /dirty tree/);
  assert.ok(record(root, journal, "verdict", { ...v, refs: ["tree: wip.txt, unrelated"] }).entry);
});

test("resolve and READY verdicts close open intent; supersedes hides the old entry", () => {
  const { root, journal } = repo();
  const q = record(root, journal, "question", { by: "a", text: "q1" }).entry;
  const h = record(root, journal, "hypothesis", { by: "a", text: "h1", settle: "measure" }).entry;
  record(root, journal, "criteria", { by: "a", milestone: "M1", items: ["a"] });
  assert.equal(project(root, journal).open.length, 3);
  record(root, journal, "resolve", { by: "a", target: q.id, text: "answered" });
  record(root, journal, "verdict", {
    by: "a",
    milestone: "M1",
    result: "READY",
    met: ["a"],
    unmet: [],
  });
  record(root, journal, "hypothesis", {
    by: "a",
    text: "h1 restated",
    settle: "measure",
    supersedes: h.id,
  });
  const open = project(root, journal).open.map((e) => e.text);
  assert.deepEqual(open, ["h1 restated"]);
  assert.match(
    record(root, journal, "resolve", { by: "a", target: "nope", text: "x" }).errors[0],
    /does not exist/,
  );
});

test("status surfaces dangling ledger pointers, unrecorded stops, triggers, and pending proposals", () => {
  const { root, journal } = repo();
  mkdirSync(join(root, "packages", "contracts"), { recursive: true });
  writeFileSync(join(root, "packages", "contracts", "x.ts"), "x");
  mkdirSync(join(root, ".build", "governance"), { recursive: true });
  writeFileSync(join(root, ".build", "governance", "001-x.md"), "# 001\n\nSTATUS: PROPOSED\n");
  writeFileSync(join(root, ".build", "governance", "002-y.md"), "# 002\n\nSTATUS: RATIFIED\n");
  const out = renderStatus(project(root, journal), { brief: true });
  assert.match(out, /`gone\.md`, which does not exist/);
  assert.match(out, /`docs\/a\.md`, which does not exist/);
  assert.doesNotMatch(out, /NOTES\.md/);
  assert.match(out, /UNRECORDED STOP/);
  assert.match(out, /ARCHITECTURAL TRIGGER 1/);
  assert.match(out, /PENDING HUMAN DECISION: governance 001-x\.md/);
  assert.doesNotMatch(out, /002-y/);
});

test("a stop entry after the last commit covers the dirty tree", () => {
  const { root, journal } = repo();
  writeFileSync(join(root, "wip.txt"), "x");
  record(root, journal, "stop", { by: "a", text: "paused for review", next: "run verify" });
  const out = renderStatus(project(root, journal));
  assert.doesNotMatch(out, /UNRECORDED STOP/);
  assert.match(out, /Last stop .*paused for review/);
});

test("resumption gap is reported from real time, not trusted text", () => {
  const { root, journal } = repo();
  const later = Date.now() + 5 * 86_400_000;
  assert.match(renderStatus(project(root, journal, later)), /RESUMPTION GAP: 5d/);
  assert.doesNotMatch(renderStatus(project(root, journal)), /RESUMPTION GAP/);
});

test("rejected approaches are shown so they are not re-proposed", () => {
  const { root, journal } = repo();
  record(root, journal, "decision", {
    by: "owner",
    text: "Status lives in the journal",
    reasons: ["prose ledger decayed"],
    rejected: ["restore IMPLEMENTATION.md as the status authority"],
  });
  assert.match(
    renderStatus(project(root, journal), { brief: true }),
    /x restore IMPLEMENTATION\.md .*by owner\)/,
  );
});

test("check: constitution identity, size law, and append-only history", () => {
  const { root, journal, g } = repo();
  assert.ok(runChecks(root, [], journal).failures.some((f) => f.includes("gone.md")));
  writeFileSync(join(root, "CODEX.md"), CONST + "drift\n");
  assert.ok(runChecks(root, [], journal).failures.some((f) => /not identical/.test(f)));
  writeFileSync(join(root, "CODEX.md"), CONST);
  writeFileSync(join(root, "CLAUDE.md"), "x\n".repeat(231));
  assert.ok(runChecks(root, [], journal).failures.some((f) => /231 lines/.test(f)));
  writeFileSync(join(root, "CLAUDE.md"), CONST);

  record(root, journal, "question", { by: "a", text: "q1" });
  g("add", "-A");
  g("commit", "-q", "-m", "j");
  record(root, journal, "question", { by: "a", text: "q2" });
  assert.ok(
    !runChecks(root, readJournal(journal), journal).failures.some((f) => /append-only/.test(f)),
  );
  writeFileSync(journal, readFileSync(journal, "utf8").replace("q1", "rewritten"));
  assert.ok(
    runChecks(root, readJournal(journal), journal).failures.some((f) => /append-only/.test(f)),
  );
});

test("dangling means once tracked and now missing; never-tracked names and dotfiles are ignored", () => {
  const { root } = repo();
  writeFileSync(join(root, "CLAUDE.md"), "see `.env.example`, `never-existed.md`, `gone.md`\n");
  assert.deepEqual(danglingPointers(root), ["gone.md"]);
});

test("hook pre-tool: constitution asks, architectural paths advise, others pass", () => {
  const { root, journal } = repo();
  const c = hook("pre-tool", { tool_input: { file_path: join(root, "AGENTS.md") } }, root, journal);
  assert.equal(c.hookSpecificOutput.permissionDecision, "ask");
  const a = hook(
    "pre-tool",
    { tool_input: { file_path: join(root, "supabase/migrations/1.sql") } },
    root,
    journal,
  );
  assert.match(a.hookSpecificOutput.additionalContext, /trigger 2/);
  assert.equal(a.hookSpecificOutput.permissionDecision, undefined);
  assert.equal(
    hook("pre-tool", { tool_input: { file_path: join(root, "src/a.ts") } }, root, journal),
    null,
  );
  assert.equal(
    hook("pre-tool", { tool_input: { file_path: join(root, "docs/CLAUDE.md") } }, root, journal),
    null,
  );
});

test("hook stop: nudges once only when the tree changed and nothing was recorded", () => {
  const { root, journal } = repo();
  const sid = "s1";
  hook("session-start", { session_id: sid }, root, journal);
  assert.equal(hook("stop", { session_id: sid }, root, journal), null, "unchanged tree: silent");
  writeFileSync(join(root, "wip.txt"), "x");
  assert.equal(
    hook("stop", { session_id: sid, stop_hook_active: true }, root, journal),
    null,
    "never loops",
  );
  assert.equal(hook("stop", { session_id: sid }, root, journal).decision, "block");
  assert.equal(hook("stop", { session_id: sid }, root, journal), null, "nudges at most once");

  hook("session-start", { session_id: "s2" }, root, journal);
  writeFileSync(join(root, "wip2.txt"), "x");
  record(root, journal, "stop", { by: "a", text: "pausing", next: "x" });
  assert.equal(hook("stop", { session_id: "s2" }, root, journal), null, "recorded: silent");
});

test("CLI hook adapter emits SessionStart context and never fails a session", () => {
  const { root } = repo();
  const r = spawnSync(process.execPath, [BA, "hook", "session-start"], {
    input: JSON.stringify({ cwd: root, session_id: "x" }),
    encoding: "utf8",
  });
  assert.equal(r.status, 0);
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /BUILD ANYTHING/);
  const bad = spawnSync(process.execPath, [BA, "hook", "session-start"], {
    input: "{not json",
    encoding: "utf8",
  });
  assert.equal(bad.status, 0);
  assert.equal(bad.stdout, "");
});

test("view is generated from verdicts and criteria", () => {
  const { root, journal } = repo();
  record(root, journal, "criteria", { by: "a", milestone: "M1", items: ["a works", "b works"] });
  record(root, journal, "verdict", {
    by: "a",
    milestone: "M1",
    result: "PARTIAL",
    met: ["a works"],
    unmet: ["b works"],
    gaps: ["b ceiling at 10k"],
  });
  const v = renderView(project(root, journal));
  assert.match(v, /M1 — PARTIAL/);
  assert.match(v, /\[x\] a works/);
  assert.match(v, /\[ \] b works/);
  assert.match(v, /Named gap: b ceiling/);
});

test("validate rejects resolving a non-openable entry", () => {
  const prior = [{ id: "d1", kind: "decision" }];
  assert.match(
    validate({ kind: "resolve", by: "a", target: "d1", text: "x" }, prior)[0],
    /cannot be resolved/,
  );
});
