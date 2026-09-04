# PETEEN Orchestrator → Claude bridge

The workflow `peteen-orchestrator-claude.yml` is intentionally narrow.

It runs only when all of the following are true:

- the event is a newly created issue comment;
- the issue number is `#1`;
- the GitHub actor is `vhlokao`;
- the comment body starts with `[PETEEN-ORCH-MISSION]`.

The workflow uses the repository-scoped ephemeral GitHub Actions token for GitHub operations and expects `ANTHROPIC_API_KEY` to be configured as a GitHub Actions repository secret.

Never commit the Anthropic key to the repository, issues, comments, logs, or workflow file.

This bridge is orchestration infrastructure only. It does not change the PETEEN product by itself; behavior depends on the explicit mission posted in Issue #1 and the permissions granted to the workflow.
