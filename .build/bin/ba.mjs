#!/usr/bin/env node
// ba — Build Anything project control. Zero dependencies.
//
// The journal (.build/journal.jsonl) is append-only and typed: it holds only what git cannot
// answer — decisions and their reasons, hypotheses, questions, non-goals, acceptance criteria,
// verdicts, why work stopped, and the chosen next action. Everything else `ba` prints is a
// projection computed from git, the working tree, and the journal. Nothing here stores state.
//
//   ba status [--brief]          position, open intent, boundary detections
//   ba record <kind> --json '{}' validate and append one entry (or --file <path>)
//   ba view                      generated current-state view (never committed)
//   ba check                     mechanical checks; exit 1 on violation
//   ba hook <event>              Claude Code hook adapter (reads hook JSON on stdin)
//
// Global options: --root <dir> (default: git toplevel of cwd), --journal <file>.

import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import { basename, dirname, join, relative, resolve } from "node:path";

export const SCHEMA_VERSION = 1;
const DAY = 86_400_000;
const GAP_DAYS = 2;
const CONSTITUTION = ["CLAUDE.md", "CODEX.md", "AGENTS.md"];
const SIZE_LAW = 230;
// The five escalation triggers in SKILL.md. Trigger 5 (a law) is the constitution itself.
export const ARCH_TRIGGERS = [
  { n: 1, name: "versioned contract", re: /^packages\/(protocols\/schemas|contracts)\// },
  { n: 2, name: "durable table or migration", re: /(^|\/)migrations\// },
  { n: 5, name: "constitution", re: /^(CLAUDE|CODEX|AGENTS)\.md$/ },
];

// ---------------------------------------------------------------- journal schema

const str = (v) => typeof v === "string" && v.trim().length > 0;
const strs = (v) => Array.isArray(v) && v.every(str);
const nonEmpty = (v) => strs(v) && v.length > 0;
const opt = (check) => (v) => v === undefined || check(v);

// Each kind names its required and optional fields. Unknown fields are rejected, so a typo
// fails loudly instead of silently becoming dead data.
export const KINDS = {
  decision: { text: str, reasons: nonEmpty, rejected: opt(strs) },
  hypothesis: { text: str, settle: str },
  question: { text: str },
  "non-goal": { text: str, until: opt(str) },
  criteria: { milestone: str, items: nonEmpty },
  verdict: {
    milestone: str,
    result: (v) => ["READY", "PARTIAL", "NOT READY"].includes(v),
    met: strs,
    unmet: strs,
    gaps: opt(strs),
  },
  stop: { text: str, next: str, unfinished: opt(strs) },
  next: {
    do: str,
    why: str,
    depends: strs,
    reduces: str,
    alternatives: nonEmpty,
    notYet: nonEmpty,
  },
  resolve: { target: str, text: str },
};
const COMMON = { by: str, refs: opt(strs), supersedes: opt(str) };
const STAMP = ["v", "id", "ts", "kind", "head", "branch", "dirty"];
const OPENABLE = new Set(["hypothesis", "question", "criteria"]);

export function validate(entry, prior = []) {
  const errors = [];
  const shape = KINDS[entry.kind];
  if (!shape)
    return [`unknown kind "${entry.kind}" (expected one of: ${Object.keys(KINDS).join(", ")})`];
  const fields = { ...COMMON, ...shape };
  for (const [k, check] of Object.entries(fields))
    if (!check(entry[k])) errors.push(`${entry.kind}.${k} is missing or malformed`);
  for (const k of Object.keys(entry))
    if (!(k in fields) && !STAMP.includes(k)) errors.push(`unknown field "${k}" on ${entry.kind}`);
  const ids = new Map(prior.map((e) => [e.id, e]));
  if (entry.supersedes && !ids.has(entry.supersedes))
    errors.push(`supersedes "${entry.supersedes}" does not exist`);
  if (entry.kind === "resolve") {
    const t = ids.get(entry.target);
    if (!t) errors.push(`resolve target "${entry.target}" does not exist`);
    else if (!OPENABLE.has(t.kind))
      errors.push(`resolve target "${entry.target}" is a ${t.kind}, which cannot be resolved`);
  }
  if (
    entry.kind === "verdict" &&
    entry.dirty &&
    !(entry.refs ?? []).some((r) => r.startsWith("tree:"))
  )
    errors.push(
      'verdict on a dirty tree must say what is uncommitted: add a refs entry "tree: <what>"',
    );
  return errors;
}

// ---------------------------------------------------------------- io helpers

function git(root, args, fallback = "") {
  try {
    return execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trimEnd();
  } catch {
    return fallback;
  }
}

export function readJournal(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l, i) => {
      try {
        return JSON.parse(l);
      } catch {
        return { kind: "__corrupt__", line: i + 1 };
      }
    });
}

function readText(path) {
  return existsSync(path) ? readFileSync(path, "utf8").replace(/\r\n/g, "\n") : null;
}

const age = (ms) => {
  const d = Math.floor(ms / DAY);
  if (d >= 1) return `${d}d`;
  const h = Math.floor(ms / 3_600_000);
  return h >= 1 ? `${h}h` : `${Math.max(1, Math.floor(ms / 60_000))}m`;
};

// The journal's own pending entries are not work in progress: excluding it keeps a fresh record
// from making the tree it describes look dirty. Untracked directories are expanded so a new file
// under a trigger path is seen.
export function dirtyPaths(root, journalFile) {
  const skip = relative(root, journalFile).replace(/\\/g, "/");
  return git(root, ["status", "--porcelain", "--untracked-files=all"])
    .split("\n")
    .filter(Boolean)
    .map((l) => ({
      code: l.slice(0, 2).trim(),
      path: l.slice(3).replace(/^"|"$/g, "").split(" -> ").pop(),
    }))
    .filter((d) => d.path !== skip);
}

// ---------------------------------------------------------------- projection

export function project(root, journalFile, now = Date.now()) {
  const journal = readJournal(journalFile);
  const live = journal.filter((e) => !journal.some((o) => o.supersedes === e.id));
  const resolved = new Set(live.filter((e) => e.kind === "resolve").map((e) => e.target));
  for (const v of live.filter((e) => e.kind === "verdict" && e.result === "READY"))
    for (const c of live.filter((e) => e.kind === "criteria" && e.milestone === v.milestone))
      resolved.add(c.id);
  const open = live.filter((e) => OPENABLE.has(e.kind) && !resolved.has(e.id));
  const latest = (kind) => [...live].reverse().find((e) => e.kind === kind);

  const branch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"], "?");
  const head = git(root, ["rev-parse", "--short", "HEAD"], "?");
  const lastCommitMs = Number(git(root, ["log", "-1", "--format=%ct"], "0")) * 1000;
  const dirty = dirtyPaths(root, journalFile);
  let oldestDirtyMs = null;
  for (const d of dirty.slice(0, 500)) {
    try {
      const m = statSync(join(root, d.path)).mtimeMs;
      if (oldestDirtyMs === null || m < oldestDirtyMs) oldestDirtyMs = m;
    } catch {
      /* deleted paths have no mtime */
    }
  }
  const lastJournalMs = journal.length ? Date.parse(journal.at(-1).ts) || 0 : 0;
  const lastActivityMs = Math.max(lastCommitMs, lastJournalMs);

  const lastStop = latest("stop");
  const lastNext = latest("next");
  const coveredByStop = lastStop && Date.parse(lastStop.ts) >= lastCommitMs;
  const commitsSince = (e) =>
    e?.head ? Number(git(root, ["rev-list", "--count", `${e.head}..HEAD`], "NaN")) : NaN;

  const alerts = [];
  if (now - lastActivityMs > GAP_DAYS * DAY && lastActivityMs > 0)
    alerts.push(
      `RESUMPTION GAP: ${age(now - lastActivityMs)} since the last commit or journal entry. Verify position before acting.`,
    );
  if (dirty.length && !coveredByStop)
    alerts.push(
      `UNRECORDED STOP: ${dirty.length} uncommitted path(s)` +
        (oldestDirtyMs ? `, oldest change ${age(now - oldestDirtyMs)} ago` : "") +
        ", and no stop entry explains them. Their intent is unknown; do not invent it.",
    );
  for (const t of ARCH_TRIGGERS) {
    const hits = dirty.filter((d) => t.re.test(d.path));
    if (hits.length)
      alerts.push(
        `ARCHITECTURAL TRIGGER ${t.n} (${t.name}) in the dirty tree: ${hits.map((h) => h.path).join(", ")}`,
      );
  }
  const checks = runChecks(root, journal, journalFile);
  for (const c of checks.failures) alerts.push(`CHECK: ${c}`);
  const proposals = pendingProposals(root);
  for (const p of proposals) alerts.push(`PENDING HUMAN DECISION: governance ${p}`);

  return {
    branch,
    head,
    lastCommitMs,
    dirty,
    oldestDirtyMs,
    journal,
    live,
    open,
    lastStop,
    lastNext,
    commitsSince,
    alerts,
    now,
  };
}

export function pendingProposals(root) {
  const dir = join(root, ".build", "governance");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^\d+-.*\.md$/.test(f) && !f.includes(".candidate"))
    .filter((f) => /^STATUS:\s*PROPOSED\b/m.test(readText(join(dir, f)) ?? ""));
}

// Paths the constitution points at must exist. A pointer to a deleted file is how a ledger
// silently stops being one.
export function danglingPointers(root) {
  const text = readText(join(root, "CLAUDE.md"));
  if (text === null) return [];
  const tokens = new Set();
  for (const m of text.matchAll(/`([^`\s]+)`/g)) tokens.add(m[1]);
  for (const m of text.matchAll(/\]\(([^)\s#]+)\)/g)) tokens.add(m[1]);
  return (
    [...tokens]
      .filter(
        (t) =>
          /^[\w.-]+(\/[\w.-]*)*$/.test(t) &&
          (t.endsWith("/") || /\.(md|json|ts|mjs|yaml|yml)$/.test(t)),
      )
      .filter((t) => !t.startsWith(".") || t.startsWith(".build") || t.startsWith(".claude"))
      .filter((t) => !existsSync(join(root, t)))
      // Only a path git has known is a broken pointer; a bare name in prose or link text is not.
      .filter((t) => git(root, ["log", "-1", "--format=%h", "--", t]) !== "")
  );
}

export function runChecks(root, journal, journalFile) {
  const failures = [];
  const texts = CONSTITUTION.map((f) => readText(join(root, f)));
  if (texts.every((t) => t !== null)) {
    if (new Set(texts).size > 1)
      failures.push(`${CONSTITUTION.join(", ")} are not identical (CRLF-normalised)`);
    const lines = texts[0].split("\n").length - (texts[0].endsWith("\n") ? 1 : 0);
    if (lines > SIZE_LAW)
      failures.push(`CLAUDE.md is ${lines} lines, over the ${SIZE_LAW}-line size law`);
  }
  for (const p of danglingPointers(root))
    failures.push(`CLAUDE.md points at \`${p}\`, which does not exist`);
  journal.forEach((e, i) => {
    if (e.kind === "__corrupt__") return failures.push(`journal line ${e.line} is not valid JSON`);
    const errs = validate(e, journal.slice(0, i));
    if (errs.length) failures.push(`journal ${e.id ?? `line ${i + 1}`}: ${errs.join("; ")}`);
  });
  // Append-only: the committed journal must be a prefix of the working one.
  const rel = relative(root, journalFile).replace(/\\/g, "/");
  if (!rel.startsWith("..")) {
    const committed = git(root, ["show", `HEAD:${rel}`], null);
    const current = readText(journalFile) ?? "";
    if (committed !== null && !current.startsWith(committed.replace(/\r\n/g, "\n").trimEnd()))
      failures.push(
        "journal history was edited: entries are append-only (correct with a new entry that supersedes)",
      );
  }
  return { failures };
}

// ---------------------------------------------------------------- rendering

const short = (s, n = 110) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const label = (e) =>
  e.text ?? e.do ?? (e.milestone ? `${e.milestone}${e.result ? `: ${e.result}` : ""}` : "");

export function renderStatus(p, { brief = false } = {}) {
  const out = [];
  const tree = p.dirty.length ? `dirty: ${p.dirty.length} path(s)` : "clean";
  out.push(
    `BUILD ANYTHING · ${p.branch} @ ${p.head} · last commit ${p.lastCommitMs ? age(p.now - p.lastCommitMs) : "?"} ago · tree ${tree}`,
  );
  if (p.alerts.length) {
    out.push("", "Boundaries detected:");
    for (const a of p.alerts.slice(0, brief ? 8 : Infinity)) out.push(`  ! ${a}`);
    if (brief && p.alerts.length > 8) out.push(`  … ${p.alerts.length - 8} more (ba status)`);
  }
  out.push("", `Open intent (${p.open.length}):`);
  if (!p.open.length) out.push("  (none recorded)");
  for (const e of p.open.slice(0, brief ? 6 : Infinity))
    out.push(`  ? ${e.id} [${e.kind}] ${short(label(e))}`);
  if (brief && p.open.length > 6) out.push(`  … ${p.open.length - 6} more`);
  if (p.lastStop)
    out.push(
      "",
      `Last stop (${p.lastStop.ts.slice(0, 10)}): ${short(p.lastStop.text)}`,
      `  next was: ${short(p.lastStop.next)}`,
    );
  if (p.lastNext) {
    const n = p.commitsSince(p.lastNext);
    out.push(
      "",
      `Last chosen next action (${p.lastNext.ts.slice(0, 10)}): ${short(p.lastNext.do)}`,
    );
    if (Number.isFinite(n))
      out.push(
        `  ${n} commit(s) since it was chosen — check whether it happened before choosing again.`,
      );
  }
  const rejected = p.live.filter((e) => e.kind === "decision" && e.rejected?.length);
  if (rejected.length) {
    out.push("", "Rejected approaches (do not re-propose without citing what changed):");
    for (const e of rejected.slice(-6))
      for (const r of e.rejected)
        out.push(`  x ${short(r)}  (${e.id}, by ${e.by.split(/[ (]/)[0]})`);
  }
  const nonGoals = p.live.filter((e) => e.kind === "non-goal");
  if (nonGoals.length) {
    out.push("", "Non-goals:");
    for (const e of nonGoals)
      out.push(`  - ${short(e.text)}${e.until ? ` (until: ${short(e.until, 60)})` : ""}`);
  }
  if (!brief) {
    const decisions = p.live.filter((e) => e.kind === "decision").slice(-8);
    if (decisions.length) {
      out.push("", "Recent decisions:");
      for (const e of decisions) out.push(`  * ${e.id} ${short(e.text)}`);
    }
    if (p.dirty.length) {
      out.push("", "Uncommitted:");
      for (const d of p.dirty.slice(0, 40)) out.push(`  ${d.code.padEnd(2)} ${d.path}`);
    }
  }
  return out.join("\n");
}

export function renderView(p) {
  const out = [
    "# Current state (generated by `ba view` from .build/journal.jsonl — a projection; do not commit)",
    "",
  ];
  out.push(
    `Position: \`${p.branch}\` @ \`${p.head}\`, tree ${p.dirty.length ? "dirty" : "clean"}.`,
    "",
  );
  const milestones = [...new Set(p.live.filter((e) => e.milestone).map((e) => e.milestone))];
  out.push("## Milestones", "");
  if (!milestones.length) out.push("_None recorded._", "");
  for (const m of milestones) {
    const crit = [...p.live].reverse().find((e) => e.kind === "criteria" && e.milestone === m);
    const v = [...p.live].reverse().find((e) => e.kind === "verdict" && e.milestone === m);
    out.push(
      `### ${m} — ${v ? `${v.result} (binds to \`${v.head}\`, tree ${v.dirty ? "dirty" : "clean"})` : "no verdict yet"}`,
      "",
    );
    if (crit) for (const i of crit.items) out.push(`- [${v?.met.includes(i) ? "x" : " "}] ${i}`);
    for (const g of v?.gaps ?? []) out.push(`- Named gap: ${g}`);
    out.push("");
  }
  const sec = (title, kind, fmt) => {
    const es = p.live.filter((e) => e.kind === kind);
    if (!es.length) return;
    out.push(`## ${title}`, "");
    for (const e of es) out.push(`- ${fmt(e)}`);
    out.push("");
  };
  sec(
    "Decisions",
    "decision",
    (e) =>
      `**${e.text}** — ${e.reasons.join("; ")}${e.rejected?.length ? ` _(rejected: ${e.rejected.join("; ")})_` : ""}`,
  );
  sec("Non-goals", "non-goal", (e) => e.text + (e.until ? ` — until ${e.until}` : ""));
  out.push("## Open", "");
  for (const e of p.open) out.push(`- \`${e.id}\` (${e.kind}) ${label(e)}`);
  if (!p.open.length) out.push("_Nothing open._");
  return out.join("\n");
}

// ---------------------------------------------------------------- record

export function record(root, journalFile, kind, fields, now = new Date()) {
  // Stamps are the tool's testimony (who, when, at which commit): a caller never supplies them.
  const forged = STAMP.filter((k) => k in fields);
  if (forged.length) return { errors: [`stamped by record, not supplied: ${forged.join(", ")}`] };
  const prior = readJournal(journalFile);
  const entry = {
    v: SCHEMA_VERSION,
    id: `${kind}-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(2).toString("hex")}`,
    ts: now.toISOString(),
    kind,
    head: git(root, ["rev-parse", "--short", "HEAD"], "?"),
    branch: git(root, ["rev-parse", "--abbrev-ref", "HEAD"], "?"),
    dirty: dirtyPaths(root, journalFile).length > 0,
    ...fields,
  };
  const errors = validate(entry, prior);
  if (errors.length) return { errors };
  mkdirSync(dirname(journalFile), { recursive: true });
  appendFileSync(journalFile, `${JSON.stringify(entry)}\n`);
  return { entry };
}

// ---------------------------------------------------------------- hooks

function sessionFile(root, id) {
  const dir = resolve(
    root,
    git(root, ["rev-parse", "--git-path", "ba-sessions"], ".git/ba-sessions"),
  );
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    try {
      if (Date.now() - statSync(p).mtimeMs > 7 * DAY) rmSync(p);
    } catch {
      /* best effort */
    }
  }
  return join(dir, `${String(id).replace(/[^\w-]/g, "_")}.json`);
}
const fingerprint = (root, journalFile) =>
  JSON.stringify(dirtyPaths(root, journalFile)) + git(root, ["rev-parse", "HEAD"]);

export function hook(event, input, root, journalFile) {
  if (event === "session-start") {
    if (input.session_id)
      writeFileSync(
        sessionFile(root, input.session_id),
        JSON.stringify({ start: Date.now(), fp: fingerprint(root, journalFile) }),
      );
    const status = renderStatus(project(root, journalFile), { brief: true });
    return {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext:
          `${status}\n\nThis is computed project position (build-anything). Address any boundary above before ` +
          `new work; record decisions, stops and next actions with \`node .build/bin/ba.mjs record\`.`,
      },
    };
  }
  if (event === "pre-tool") {
    const file = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
    if (!file) return null;
    const rel = relative(root, resolve(root, file)).replace(/\\/g, "/");
    if (CONSTITUTION.includes(rel))
      return {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "ask",
          permissionDecisionReason:
            `${rel} is the constitution. Agents propose, never apply (CLAUDE.md §3, build-anything govern.md). ` +
            "Approve only if you, the owner, are ratifying a proposal now; all three files must change identically.",
        },
      };
    const t = ARCH_TRIGGERS.find((x) => x.re.test(rel));
    if (t)
      return {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          additionalContext: `${rel} hits Architectural trigger ${t.n} (${t.name}). Per build-anything this work is Architectural regardless of diff size.`,
        },
      };
    return null;
  }
  if (event === "stop") {
    if (input.stop_hook_active || !input.session_id) return null;
    const f = sessionFile(root, input.session_id);
    const s = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
    if (!s || s.nudged || s.fp === fingerprint(root, journalFile)) return null;
    const recorded = readJournal(journalFile).some(
      (e) => ["stop", "next"].includes(e.kind) && Date.parse(e.ts) >= s.start,
    );
    if (recorded) return null;
    writeFileSync(f, JSON.stringify({ ...s, nudged: true }));
    return {
      decision: "block",
      reason:
        "The tree or HEAD changed this session and nothing in .build/journal.jsonl says why. If work is pausing, " +
        "record a stop (why, next, unfinished); if a direction was chosen, record a decision or next. If neither applies, say so in one line and finish.",
    };
  }
  return null;
}

// ---------------------------------------------------------------- cli

function main(argv) {
  const args = [...argv];
  const take = (flag) => {
    const i = args.indexOf(flag);
    if (i < 0) return undefined;
    const [, v] = args.splice(i, 2);
    return v;
  };
  const has = (flag) => {
    const i = args.indexOf(flag);
    if (i >= 0) args.splice(i, 1);
    return i >= 0;
  };
  const root = resolve(
    take("--root") ?? (git(process.cwd(), ["rev-parse", "--show-toplevel"]) || process.cwd()),
  );
  const journalFile = resolve(take("--journal") ?? join(root, ".build", "journal.jsonl"));
  const [cmd, sub] = args;

  if (cmd === "status" || cmd === undefined)
    return (console.log(renderStatus(project(root, journalFile), { brief: has("--brief") })), 0);
  if (cmd === "view") return (console.log(renderView(project(root, journalFile))), 0);
  if (cmd === "check") {
    const { failures } = runChecks(root, readJournal(journalFile), journalFile);
    for (const f of failures) console.error(`FAIL ${f}`);
    if (!failures.length) console.log("ok");
    return failures.length ? 1 : 0;
  }
  if (cmd === "record") {
    const json = take("--json") ?? (take("--file") && readFileSync(args.at(-1), "utf8"));
    let fields;
    try {
      fields = JSON.parse(json ?? "");
    } catch {
      return (console.error("record needs --json '{...}' with valid JSON"), 2);
    }
    // The kind is positional (`record decision --json ...`) or a "kind" member of the JSON; flags
    // were removed from args above, so args[1] is never a flag.
    const { kind: jsonKind, ...rest } = fields;
    const kind = args[1] ?? jsonKind;
    if (!kind || (jsonKind !== undefined && jsonKind !== kind))
      return (
        console.error('record needs one kind: `record <kind> --json ...` or a "kind" member'),
        2
      );
    const { errors, entry } = record(root, journalFile, kind, rest);
    if (errors) return (console.error(errors.map((e) => `invalid: ${e}`).join("\n")), 2);
    return (console.log(`recorded ${entry.id}`), 0);
  }
  if (cmd === "hook") {
    // Hooks must never break a session: any failure degrades to silence.
    try {
      let raw = "";
      try {
        raw = readFileSync(0, "utf8");
      } catch {
        /* no stdin */
      }
      const input = raw.trim() ? JSON.parse(raw) : {};
      const hookRoot = input.cwd
        ? resolve(git(input.cwd, ["rev-parse", "--show-toplevel"]) || root)
        : root;
      const out = hook(
        sub,
        input,
        hookRoot,
        journalFile.startsWith(root) ? join(hookRoot, relative(root, journalFile)) : journalFile,
      );
      if (out) process.stdout.write(JSON.stringify(out));
    } catch (e) {
      if (process.env.BA_DEBUG) console.error(e);
    }
    return 0;
  }
  console.error(
    "usage: ba status [--brief] | record <kind> --json {...} | view | check | hook <session-start|pre-tool|stop>",
  );
  return 2;
}

if (process.argv[1] && basename(process.argv[1]) === "ba.mjs")
  process.exitCode = main(process.argv.slice(2));
