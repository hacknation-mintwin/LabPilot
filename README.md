# AI App Skeleton

Generic AI app shell: text input → OpenRouter LLM → streamed response. Swap in domain logic when the challenge drops.

## MCP Maintainer Automation

This repo now includes a remote automation path for keeping an MCP server branch up to date:

- Workflow: `.github/workflows/mcp-maintainer.yml`
- Operator runbook: `.github/mcp-maintainer/README.md`
- MCP server package: `mcp-server/`

The workflow syncs `mcp-server` with `feature/experiment-similarity-onepager` (fallback: `main`), runs MCP tests, opens/updates PRs, and can trigger Cursor Cloud Agent repair via webhook.

## Setup

```bash
pnpm install
cp .env.example .env.local
# edit .env.local and set OPENROUTER_API_KEY
pnpm dev
```

Open http://localhost:3000.

## Environment Variables

| Var | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | OpenRouter API key (required) |
| `MODEL_NAME` | Model slug; defaults to `google/gemma-4-26b-a4b-it:free` |

## Deploy

```bash
vercel --prod
```

Set `OPENROUTER_API_KEY` (and optionally `MODEL_NAME`) in the Vercel dashboard.

## Where to change things

- **System prompt** — [app/api/chat/route.ts](app/api/chat/route.ts) (search `SYSTEM_PROMPT`)
- **Model** — `MODEL_NAME` env var, or the `DEFAULT_MODEL` constant
- **App name** — [app/page.tsx](app/page.tsx) (search `APP_NAME`)
- **File upload / second API call** — extend `app/page.tsx` and `app/api/chat/route.ts`
