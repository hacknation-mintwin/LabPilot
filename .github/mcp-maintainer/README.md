# MCP Maintainer Runbook

This runbook operates the `MCP Server Maintainer` workflow for a 24-hour autonomous campaign.

## What it does

On each run:

1. Resolves source branch:
   - `feature/experiment-similarity-onepager` if present
   - otherwise `main`
2. Ensures `mcp-server` branch exists
3. Merges source branch updates into `mcp-server`
4. Runs `npm --prefix ./mcp-server test`
5. Pushes branch and opens/updates PR back into source branch
6. On failure, opens/updates a repair-request PR and optionally triggers Cursor webhook
7. Uploads run status artifact `mcp-maintainer-status-<run_id>`

## Required configuration

### Repository variables

- `MCP_MAINTAINER_STARTED_AT` (ISO UTC timestamp, example: `2026-04-25T23:30:00Z`)
- `MCP_MAINTAINER_DURATION_HOURS` (optional, default `24`)

### Repository secret

- `CURSOR_AUTOMATION_WEBHOOK_URL` (optional but recommended)
  - When set, failures are posted to Cursor Cloud Agent automation for repair.

## Start a 24-hour campaign

1. Set `MCP_MAINTAINER_STARTED_AT` to current UTC time.
2. Set `MCP_MAINTAINER_DURATION_HOURS=24`.
3. Trigger the workflow manually once (`workflow_dispatch`) to validate setup.
4. Let `schedule` runs continue every 30 minutes.

The workflow auto-skips once the campaign window expires.

## Dry-run and failure simulation

Use manual dispatch with:

- `force_cursor_repair=false` for normal dry-run
- `force_cursor_repair=true` to test failure path (repair PR + webhook)

## Stop campaign

Either:

- Clear `MCP_MAINTAINER_STARTED_AT`, or
- Set it far enough in the past so window is elapsed.

## Local fallback (no Cursor Cloud dependency)

Use `scripts/mcp-maintainer-local.sh` when cloud repair is unavailable.

### What it does

- Fetches from `origin`
- Uses an isolated git worktree under `.artifacts/local-maintainer/worktree` (does not touch your active working tree)
- Chooses source branch (`feature/experiment-similarity-onepager`, fallback `main`)
- Syncs into `mcp-server`
- Runs `npm --prefix ./mcp-server test`
- On failure, invokes a local Cursor repair hook if configured

### Run once

```bash
RUN_ONCE=1 AUTO_PUSH=0 ./scripts/mcp-maintainer-local.sh
```

### Run periodically (every 10 minutes)

```bash
INTERVAL_SECONDS=600 AUTO_PUSH=0 ./scripts/mcp-maintainer-local.sh
```

If SSH fetch/push needs explicit host key config in your environment, prepend:

```bash
GIT_SSH_COMMAND='ssh -o UserKnownHostsFile=/path/to/known_hosts -o StrictHostKeyChecking=yes' \
INTERVAL_SECONDS=600 AUTO_PUSH=0 ./scripts/mcp-maintainer-local.sh
```

### Enable automatic Cursor repair command

Set `CURSOR_REPAIR_COMMAND` to any local command that should run when sync/tests fail.
The script exports:

- `CURSOR_REPAIR_REASON`
- `CURSOR_REPAIR_SOURCE_BRANCH`
- `CURSOR_REPAIR_TARGET_BRANCH`
- `CURSOR_REPAIR_PROMPT_FILE`

Example:

```bash
CURSOR_REPAIR_COMMAND='echo "repair needed: $CURSOR_REPAIR_REASON (see $CURSOR_REPAIR_PROMPT_FILE)"' \
RUN_ONCE=1 \
./scripts/mcp-maintainer-local.sh
```
