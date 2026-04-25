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
