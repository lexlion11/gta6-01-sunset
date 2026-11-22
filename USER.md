# USER.md - User Model

Stable preferences and profile facts for future sessions, stored as directives.

One directive per entry, each with an observation date and status:

```md
<!-- observed: YYYY-MM-DD | status: active -->

- Prefer ...
```

- Begin each directive with an imperative such as `Always`, `Never`, or `Prefer`.
- When a preference changes, mark the old entry `superseded` and rewrite the active
  directive in place. Never leave two contradictory active directives.
- Keep communication style, relationships, and active-project context here; durable
  non-profile facts belong in `MEMORY.md`.
- This file loads every session with a separate 4,000-character budget.

## Directives

<!-- observed: 2026-11-22 | status: active -->

- Always verify a change by running the build or the check that proves it, and report
  what the tool said; a status update that only promises work is not an answer.

<!-- observed: 2026-11-22 | status: active -->

- Prefer keeping the gta6-01 entry self-contained: no new dependencies, no network
  requests, no assets that are not drawn in code — the grader reads every byte.

## Related

- [Agent workspace](/concepts/agent-workspace)
