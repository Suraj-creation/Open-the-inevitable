# Architecture Review Workflow

Use this workflow before major architectural changes.

## Review Checklist

- Does this conflict with the two foundational architecture files?
- Does this change protocol behavior?
- Does this change event behavior?
- Does this change memory mutation behavior?
- Does this change runtime lifecycle?
- Does this change governance or security?
- Does this change observability or replay?
- Does this affect scalability or failure semantics?
- Do reference repositories contain a stronger pattern?
- Does research suggest a better abstraction?

## Required Output

Major changes require:

- Updated domain spec.
- Updated indexes.
- ADR in `spec/architecture-decisions/`.
- Validation plan.

