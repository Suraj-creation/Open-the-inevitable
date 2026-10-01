#!/usr/bin/env node
// Architecture check: the laws that matter most, enforced mechanically (UCI §37; CLAUDE.md §3).
//
//   1. The UCI core's dependencies point inward:
//        kernel <- adapters, substrate <- harness <- env-tutor <- cli
//      (adapters depend only on the kernel; nothing depends on cli).
//   2. Zero @uci/* -> @inevitable/* edges, over the TRANSITIVE closure of declared dependencies and
//      of actual import specifiers in source. No allowlist.
//   3. Nothing under apps/, packages/, services/ or core/ imports from Reference-Architecture-Observatory.
//   4. The frozen Gen 1/2 packages match their recorded content hashes (tools/arch-baseline.json).
//      Changing a frozen package is allowed only as a bug fix: re-baseline with --rebaseline in a
//      `fix:` commit, so every such change is visible in review.
//
// Usage: node tools/arch-check.mjs [--rebaseline]
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const BASELINE = join(ROOT, "tools", "arch-baseline.json");

const ALLOWED = {
  "@uci/kernel": [],
  "@uci/adapters": ["@uci/kernel"],
  "@uci/substrate": ["@uci/kernel"],
  "@uci/harness": ["@uci/kernel", "@uci/substrate"],
  "@uci/env-tutor": ["@uci/kernel", "@uci/harness"],
  "@uci/cli": ["@uci/kernel", "@uci/substrate", "@uci/harness", "@uci/env-tutor", "@uci/adapters"],
};
// Test-only edges (devDependencies and files under tests/) may reach adapters for real storage.
const TEST_ALLOWED = { "@uci/harness": ["@uci/adapters"] };

const FROZEN = [
  "kernel",
  "governance",
  "execution",
  "events",
  "memory",
  "world-state",
  "context",
  "runtime",
  "scheduler",
  "orchestration",
  "evaluation",
  "cognitive-loop",
].map((p) => `packages/${p}`);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".turbo" || name === "coverage")
      continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const importsOf = (file) =>
  [
    ...readFileSync(file, "utf8").matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g),
  ].map((m) => m[1]);

const failures = [];

// --- 1 & 2: the core's dependency graph.
const corePkgs = new Map();
for (const name of existsSync(join(ROOT, "core")) ? readdirSync(join(ROOT, "core")) : []) {
  const pj = join(ROOT, "core", name, "package.json");
  if (!existsSync(pj)) continue;
  const json = JSON.parse(readFileSync(pj, "utf8"));
  corePkgs.set(json.name, { dir: join(ROOT, "core", name), json });
}
for (const [name, { dir, json }] of corePkgs) {
  if (!(name in ALLOWED)) {
    failures.push(`${name}: not in the declared core layering (tools/arch-check.mjs ALLOWED)`);
    continue;
  }
  const deps = Object.keys(json.dependencies ?? {});
  const devDeps = Object.keys(json.devDependencies ?? {});
  for (const d of deps) {
    if (d.startsWith("@inevitable/"))
      failures.push(`${name} depends on ${d}: the core may never reach Gen 1-3`);
    else if (d.startsWith("@uci/") && !ALLOWED[name].includes(d))
      failures.push(`${name} depends on ${d}: outward or sideways dependency`);
  }
  for (const d of devDeps) {
    if (d.startsWith("@inevitable/"))
      failures.push(`${name} devDepends on ${d}: the core may never reach Gen 1-3`);
    else if (
      d.startsWith("@uci/") &&
      !ALLOWED[name].includes(d) &&
      !(TEST_ALLOWED[name] ?? []).includes(d)
    )
      failures.push(`${name} devDepends on ${d}: not an allowed test edge`);
  }
  for (const file of walk(dir).filter((f) => /\.(ts|mts|mjs|js)$/.test(f))) {
    const isTest = relative(dir, file).split(/[\\/]/)[0] === "tests";
    for (const spec of importsOf(file)) {
      if (spec.startsWith("@inevitable/"))
        failures.push(`${relative(ROOT, file)} imports ${spec}: the core may never reach Gen 1-3`);
      if (spec.startsWith("@uci/") && spec !== name) {
        const target = spec.split("/").slice(0, 2).join("/");
        const ok =
          ALLOWED[name].includes(target) || (isTest && (TEST_ALLOWED[name] ?? []).includes(target));
        if (!ok)
          failures.push(`${relative(ROOT, file)} imports ${spec}: outward or sideways import`);
      }
    }
  }
}
// Transitive closure over declared dependencies: no path from any @uci package to an @inevitable one.
const workspaceManifests = new Map();
for (const area of ["packages", "apps", "services", "core"]) {
  for (const name of existsSync(join(ROOT, area)) ? readdirSync(join(ROOT, area)) : []) {
    const pj = join(ROOT, area, name, "package.json");
    if (existsSync(pj)) {
      const json = JSON.parse(readFileSync(pj, "utf8"));
      workspaceManifests.set(json.name, json);
    }
  }
}
for (const name of corePkgs.keys()) {
  const seen = new Set();
  const stack = [name];
  while (stack.length) {
    const cur = stack.pop();
    if (seen.has(cur)) continue;
    seen.add(cur);
    const json = workspaceManifests.get(cur);
    if (!json) continue;
    for (const d of Object.keys(json.dependencies ?? {})) {
      if (d.startsWith("@inevitable/"))
        failures.push(`${name} reaches ${d} transitively via ${cur}`);
      if (workspaceManifests.has(d)) stack.push(d);
    }
  }
}

// --- 3: no observatory code anywhere in the product.
for (const area of ["apps", "packages", "services", "core"]) {
  for (const file of walk(join(ROOT, area)).filter((f) =>
    /\.(ts|tsx|mts|mjs|js|cjs|json)$/.test(f),
  )) {
    const text = readFileSync(file, "utf8");
    if (
      /Reference-Architecture-Observatory/.test(text) &&
      /\.(ts|tsx|mts|mjs|js|cjs)$/.test(file) &&
      importsOf(file).some((s) => s.includes("Reference-Architecture-Observatory"))
    )
      failures.push(`${relative(ROOT, file)} imports from Reference-Architecture-Observatory`);
  }
}

// --- 4: the frozen generation.
function hashPackage(dir) {
  const h = createHash("sha256");
  for (const file of walk(join(ROOT, dir)).sort()) {
    h.update(relative(ROOT, file).replace(/\\/g, "/"));
    h.update(readFileSync(file, "utf8").replace(/\r\n/g, "\n"));
  }
  return h.digest("hex");
}
const current = Object.fromEntries(FROZEN.map((d) => [d, hashPackage(d)]));
if (process.argv.includes("--rebaseline")) {
  writeFileSync(
    BASELINE,
    `${JSON.stringify({ note: "Gen 1/2 freeze (journal decision-20261001-a80d). Change only in fix: commits; re-baseline with --rebaseline.", packages: current }, null, 2)}\n`,
  );
  console.log(`arch-check: baseline written for ${FROZEN.length} frozen packages`);
} else if (!existsSync(BASELINE)) {
  failures.push("tools/arch-baseline.json is missing: run node tools/arch-check.mjs --rebaseline");
} else {
  const baseline = JSON.parse(readFileSync(BASELINE, "utf8")).packages ?? {};
  for (const d of FROZEN)
    if (baseline[d] !== current[d])
      failures.push(`${d} changed while frozen: bug fixes only, re-baselined in a fix: commit`);
}

if (failures.length) {
  for (const f of failures) console.error(`arch-check FAIL ${f}`);
  process.exit(1);
}
console.log(
  `arch-check ok: ${corePkgs.size} core packages layered inward, zero @uci->@inevitable edges, no observatory imports, ${FROZEN.length} frozen packages intact`,
);
