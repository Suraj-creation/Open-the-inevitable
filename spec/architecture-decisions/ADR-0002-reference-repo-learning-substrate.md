# ADR-0002: Reference Repository Learning Substrate

**Status:** Accepted  
**Date:** 2026-06-02

## Decision

The local reference repositories are treated as a learning substrate for implementation patterns.

## Rationale

The repository contains mature adjacent systems that already solve pieces of the COS problem: persistent agent runtime, control planes, classroom orchestration, simulation pipelines, and modular evented agent harnesses.

## Consequences

- Future implementation should inspect reference repos before inventing patterns.
- Extracted patterns must be adapted to COS specs, not copied blindly.
- Reference learnings should be recorded in `spec/research/` or ADRs.

