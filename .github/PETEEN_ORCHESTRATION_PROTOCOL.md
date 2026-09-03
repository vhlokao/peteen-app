# PETEEN orchestration protocol

Issue #1 is the shared pre-pilot orchestration queue.

## Hosted Claude trigger

A mission intended for the hosted Claude GitHub Action must be a new comment on Issue #1 whose body starts with:

`[PETEEN-ORCH-MISSION]`

The workflow additionally requires the GitHub actor to be `vhlokao`.

## Safety model

- Only Issue #1 is accepted.
- Only comments from `vhlokao` are accepted.
- Only comments starting with the exact mission marker are accepted.
- The workflow uses the ephemeral repository-scoped GitHub Actions token.
- Anthropic authentication must be provided only through the GitHub Actions secret `ANTHROPIC_API_KEY`.
- Never paste or commit that key.
- Product changes remain governed by the mission scope and the protected-area rules in Issue #1.
- The orchestrator reviews resulting commits/evidence before advancing gates.
