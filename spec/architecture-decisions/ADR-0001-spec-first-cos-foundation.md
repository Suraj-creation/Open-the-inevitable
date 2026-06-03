# ADR-0001: Spec-First COS Foundation

**Status:** Accepted  
**Date:** 2026-06-02

## Decision

The Inevitable will treat the spec system as the authoritative architectural source of truth. Implementation is subordinate to specs.

## Rationale

The system is intended to become a cognitive operating system, not a feature app. Without spec-first governance, implementation will drift into local decisions, hidden state mutation, undocumented protocols, and fragile orchestration.

## Consequences

- Major implementation work must trace to specs.
- New architecture requires spec updates first.
- Indexes and dependency maps must stay current.
- Code that violates spec contracts is invalid implementation.

