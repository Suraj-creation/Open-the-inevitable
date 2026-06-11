# /handoff

Generate a handoff document for this project at `docs/handoff/HANDOFF.md`.

The purpose is NOT to summarize the conversation. The purpose is to preserve the minimum information necessary for another engineer or AI agent to continue the project with near-zero context loss.

## Compression principle

- Decisions over descriptions
- Intentions over history
- State over narrative
- Omit anything reconstructable from source code or git history

## Steps

1. Read `IMPLEMENTATION.md`, `CLAUDE.md`, and `spec/implementation-roadmaps/` to understand phase status.
2. Run `git log --oneline -10` and `git status` to capture exact current state.
3. Read the most recently modified source files and any active specs to understand what is in flight.
4. Check memory files in `C:\Users\Govin\.claude\projects\C--Users-Govin-Desktop-The-inevitable\memory\` for cross-session context.
5. Produce `docs/handoff/HANDOFF.md` with the structure below. Overwrite any previous version.

## Output structure

### 1. PROJECT SNAPSHOT (max 10 bullets)
Mission, current phase, primary objectives, major systems, critical architectural direction. New agent should understand the build within 60 seconds.

### 2. CURRENT STATE
Branch, commit hash, deployment state, build state, test state. Facts only.

### 3. COMPLETED WORK
Meaningful milestones grouped by logical achievement — capabilities added, systems completed. Not a file list.

### 4. ACTIVE WORK
What is currently being built or partially implemented. Include confidence level: HIGH / MEDIUM / LOW.

### 5. ARCHITECTURAL MEMORY (most important)
Decisions that are expensive to rediscover. For each:
- Decision:
- Reason:
- Tradeoffs:
- Alternatives rejected:

### 6. OPEN PROBLEMS
For each unresolved issue:
- Problem:
- Impact:
- Possible causes:
- Recommended investigation:

### 7. IMMEDIATE NEXT STEPS (max 10, ordered by priority)
Executable items only. Bad: "Improve architecture". Good: "Implement SupervisorUnit.route() reading world-state mastery nodes to select target agent CID".

### 8. KNOWN RISKS
Real technical debt, scalability, reliability, or security concerns only. No generic statements.

### 9. CONTEXT REQUIRED FOR CONTINUATION — "READ THESE FIRST"
Specs, architecture docs, roadmap files actually needed to continue. Not a complete file listing.

### 10. AGENT STARTUP PROMPT
Compact (<500 words) prompt allowing another Claude/Codex/GPT session to resume immediately. Must contain: project objective, current phase, active work, constraints, immediate task.

## Quality gate before writing

1. Could another engineer continue without reading chat history? Yes → write it.
2. Does any section repeat what source code already shows? If so, cut it.
3. Is the immediate next task obvious and executable? If not, sharpen it.
