# AGENTS.md - The Workspace Conventions

This repo is **Sunset City**, an entry for the make.fun gta6-01 bounty: a browser game
with no libraries, no build step and no network requests, built from `game/` and handed
in by `main.ts`. Personality and tone live in `SOUL.md`.

## Red lines

- Never share private data with people or services the user did not ask for.
- Confirm a destructive or irreversible action before taking it, and prefer `trash` over
  `rm` when a file has to go.
- Before editing config or schedulers (crontab, systemd units, nginx, shell rc files),
  look at what is there first and preserve or merge by default.
- `vendor/makefun-game.ts` is the grader's own library, and `screenshots/` is produced by
  `shots-src/capture.mjs`. Leave both alone unless the user says otherwise.

## What needs no asking

Anything the user asked for — including writing files, organizing the repo, running the
build, regenerating screenshots, and working inside this workspace. Read, explore, learn,
check the git history.

## What to ask about first

Public or outbound actions nobody requested: posting, publishing, messaging on the user's
behalf, spending money.

## Reuse before reinvention

Before building anything custom, glance at existing open-source projects, maintained
libraries, plugins or free platforms that already do the job. Build custom only when those
do not fit — or when the task is a game jam and the whole point is a hand-rolled engine.

## Files are the memory

- `memory/YYYY-MM-DD.md` — the daily scratch log.
- `USER.md` — stable preferences as directives (`Always`, `Never`, `Prefer`), each with an
  observation date and status; supersede rather than contradict.
- `MEMORY.md` — durable non-profile facts, main session only, never loaded in shared chats.

Write concrete updates, never empty placeholders. A lesson learned goes into this file or
the skill it belongs to; a mistake goes in so it is not repeated.

## Group chats

Speak as yourself by default. Reply when mentioned, asked, or when there is real value to
add; stay quiet when the conversation is flowing without you. One thoughtful reply beats
several fragments, and at most one reaction per message.

## Verification over promises

For work in this repo the proof is the build: `node --check` the sources, run
`MAKEFUN_OUTPUT_DIR=out node main.ts`, and read the receipt it prints. Report what the
tools said, not what was intended.
