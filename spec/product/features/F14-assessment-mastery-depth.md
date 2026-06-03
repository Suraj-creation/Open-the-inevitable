---
name: F14-assessment-mastery-depth
spec:
  id: F14
  title: Assessment, Mastery & Depth Verification
  pillar: cross-cutting
  domain: product
  status: draft
  owner: product-architecture
  last_reviewed: 2026-06-03
  upstream_dependencies:
    - product/Broader-feature-product
    - product/features/F02-dynamic-cognitive-navigation
    - product/features/F03-recursive-prerequisite-intelligence
    - product/features/F04-adaptive-multimodal-explanation
    - product/features/F05-persistent-cognitive-memory
    - vision-application/Universal-Learning-Intelligence-Agent
  downstream_dependencies:
    - product/features/F10-research-innovation-acceleration
    - product/features/F12-collective-cognitive-evolution
  related_protocols: [cognition-packet-protocol, cognitive-event-protocol, reasoning-trace-protocol, memory-mutation-protocol]
  related_events: [assessment.started, mastery.checkpoint.created, mastery.verified, mastery.rejected, depth.gate.passed, depth.gate.failed]
  related_runtime_systems: [world-state-graph, cognitive-scheduler, deterministic-execution-engine, cognitive-unit-runtime]
  related_governance_systems: [governance-kernel, human-governance, cognitive-safety]
  related_observability_systems: [learner-outcome-telemetry, cognitive-observability, reasoning-trace, otel-edge]
  semantic_tags: [assessment, mastery, depth-verification, learning-outcomes, synthetic-learners, benchmarks]
  canonical_references:
    - product/Broader-feature-product#16-success-metrics--north-star
    - vision-application/Universal-Learning-Intelligence-Agent#xxiii-deep-understanding-enforcement
---

# F14 — Assessment, Mastery & Depth Verification

## 1. Purpose

F14 ensures the platform never confuses speed with understanding. It defines assessment as a
continuous, humane, replayable depth-verification system: concepts are not marked mastered because
the learner watched an explanation or answered a memorized question. Mastery requires transfer,
explanation, reconstruction, application, and resilience under variation.

The product outcome is trust: if the system says a learner understands, that claim is meaningful.

## 2. Scope & Boundaries

- **In scope:** mastery checkpoints, five-test depth verification, adaptive practice, exam
  generation, confidence updates, research-readiness gates, assessment observability, and synthetic
  learner evaluation hooks.
- **Out of scope:** generating the prerequisite graph (F03), teaching the concept (F04), and
  institutional grading policy (F11).
- **Non-goals:** surveillance testing, memorization-first quizzes, vanity progress bars, or
  assessment that advances learners past missing prerequisites.

## 3. Personas & Modes

| Persona / mode | Assessment posture |
|---|---|
| Child / beginner | Gentle, embedded, story/practice oriented; low shame |
| Student | Depth gates, adaptive practice, exam formats when needed |
| Researcher | Advanced transfer, critique, and contribution-readiness checks |
| Educator | Cohort mastery maps and reviewable evidence |
| Institution | Policy-bound reporting and aggregate outcomes |
| Open Mode | Optional checks; no durable mastery claim unless user consents |

## 4. Narrative Experience

Assessment appears as part of learning, not as a separate punitive ritual. A learner explains a
concept in their own words, solves a new problem, applies it in another context, teaches it back,
and survives a twist that breaks memorized patterns. If one part fails, the platform does not say
"wrong" and move on; it identifies the missing foundation and routes back through F03/F04.

## 5. ULI / UALRCI Hooks

- ULI requires mastery gates before advancing past shaky foundations.
- UALRCI uses depth verification to prove that compression did not become omission.
- Research transition cannot occur until Stage 4 mastery passes relevant gates.
- Assessment failures trigger recursive prerequisite descent, not repeated same-level explanation.

## 6. Agents Involved

| Agent | Role |
|---|---|
| Assessment / Evaluator | Owns depth gates and mastery claims |
| Practice Agent | Generates adaptive exercises and variations |
| Socratic Agent | Probes conceptual reasoning without shame |
| Curriculum Agent | Routes failures to missing prerequisites |
| Memory Agent | Commits mastery evidence and confidence updates |
| Research Agent | Consumes readiness signals for F10 |
| Educator Agent | Reviews and contextualizes assessment evidence |

## 7. Cognitive OS Primitives Used

- **World-State Graph** stores mastery state per concept, evidence, confidence, and decay risk.
- **Cognition Packet** represents assessment prompts, learner responses, and evidence.
- **Cognitive Event** records checkpoint lifecycle and depth-gate outcomes.
- **Memory Mutation** writes mastery evidence and updates confidence.
- **Reasoning Trace** explains scoring, failure diagnosis, and path repair.
- **Cognitive Scheduler** schedules practice and assessment under load.

## 8. Events, Protocols & State Transitions

Emits:

- `assessment.started`, `assessment.completed`, `assessment.abandoned`
- `mastery.checkpoint.created`, `mastery.evidence.recorded`
- `depth.gate.passed`, `depth.gate.failed`
- `mastery.verified`, `mastery.rejected`, `mastery.decayed`
- `practice.generated`, `practice.completed`, `prerequisite.repair.requested`
- `research.readiness.granted`, `research.readiness.deferred`

State transitions:

1. Concept engaged -> checkpoint eligible.
2. Evidence collected -> depth gate evaluated.
3. Gate passed -> mastery state updated and downstream path unlocked.
4. Gate failed -> prerequisite repair route emitted.

## 9. Memory & World-State Effects

F14 writes mastery evidence, confidence scores, decay risk, test history, transfer examples,
research-readiness flags, and repair recommendations. It never writes grades as private judgment
without context. Institutional reporting uses F11 policy and aggregate boundaries.

## 10. Governance, Safety, Privacy, Ethics

- Assessment must be transparent: learners can ask why they passed or failed.
- No hidden ranking, discipline, or exclusion based on private mastery data.
- Minors and institutions require stricter reporting policy.
- Adaptive pressure must not become coercive or shame-based.
- High-stakes assessments require human review or explicit institutional policy.

## 11. Observability

- Telemetry: depth pass rate, transfer success, false mastery rate, repair-loop effectiveness,
  time-to-mastery, retention after decay, and assessment anxiety signals where consented.
- Reasoning traces: mandatory for scoring, failure diagnosis, readiness gates, and path repair.
- Replay determinism: **full** for assessment events, evidence, and scoring if deterministic rubric
  inputs are recorded; **trace-level** for model-assisted qualitative scoring.

## 12. Failure Semantics

| Failure | Behavior |
|---|---|
| Assessment cannot score confidently | Ask a clarifying task or route to human/educator review |
| Learner fails depth gate | Trigger prerequisite repair, not punishment |
| Scoring conflict between agents | Emit disagreement and Supervisor/educator arbitration |
| Practice generation low quality | Reject practice set and retry under tighter constraints |
| Mastery data privacy risk | Suppress reporting and emit governance event |

## 13. Architecture Conformance Statement

- Mastery claims are event-sourced and evidence-backed.
- Confidence updates use Memory Mutation.
- Scoring and repair decisions emit reasoning traces.
- Research readiness is gated by depth verification.
- Institutional reporting is governed by F11 policy.
- Replay can reconstruct how a mastery claim was produced.

## 14. Success Metrics

- False mastery rate < 2% in sampled transfer evaluations.
- Repair-loop success: failed gates lead to identified prerequisite gaps > 85% of the time.
- Time-to-mastery improves without depth-score loss.
- 100% of mastery claims have evidence and trace IDs.
- Research-readiness grants correlate with successful F10 frontier engagement.

## 15. MVP -> Advanced -> Frontier Phasing

- **MVP:** mastery state in world-state, five-test depth gate events, adaptive practice, and repair
  routing into F03/F04.
- **Advanced:** educator review, exam generation, retention/decay-driven reassessment, synthetic
  learner benchmarks, and cohort mastery maps.
- **Frontier:** lifelong mastery portfolios, contribution-readiness certification, multimodal
  assessment, and collective evaluation loops feeding F12.

## 16. Open Questions

- What exact five tests become the MVP canonical rubric?
- Which mastery evidence belongs in memory versus world-state only?
- How should qualitative explanations be scored without embedding bias?
- What high-stakes assessment modes require human governance by default?

## 17. References

- `spec/product/Broader-feature-product.md` §16.
- `spec/vision-application/Universal-Learning-Intelligence-Agent.md` §XXIII.
- `spec/world-state/world-state-graph.md`.
- `spec/product/features/F03-recursive-prerequisite-intelligence.md`.
