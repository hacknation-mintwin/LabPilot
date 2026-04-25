# CLAUDE.md

Guidance for Claude sessions working in this repo.

## What this repo is

A **generic AI app skeleton** built during the PRE phase of an LLM hackathon. It is deliberately empty of product: input box → `/api/chat` → OpenRouter LLM → streamed response. When a challenge drops, pour domain logic in; do not rebuild the plumbing.

The skeleton target is "repurpose into any specific product in under 20 minutes." Bias every change toward preserving that property.

## Use the `llm-hackathon-playbook` skill

Before scoping, scheduling, or feature-decision work in this repo, invoke the `llm-hackathon-playbook` skill. It has phase-specific rules (PRE / BUILD / SHIP / PITCH) that override generic advice:

- **PRE** (before challenge drops): skeleton + infra only. No product decisions, no domain code.
- **BUILD**: pour domain logic into the existing skeleton. Don't re-architect.
- **SHIP / PITCH**: Devpost copy, demo video, repurposing for Energy criteria.

The skill's phase files live at `.claude/skills/llm-hackathon-playbook/phase-*.md` in the parent workspace (one level up from this repo). Read the active phase file before giving advice that depends on timing or scope.

## Stack

- Next.js 14 (app router), TypeScript, Tailwind, minimal shadcn-style UI (`Button`, `Input`)
- OpenAI SDK pointed at OpenRouter (`baseURL: https://openrouter.ai/api/v1`)
- No auth, no database, no external state — single Next.js project

## Where to change things

| Task | File |
| --- | --- |
| System prompt / model behavior | [app/api/chat/route.ts](app/api/chat/route.ts) (search `SYSTEM_PROMPT`) |
| Default model slug | same file, `DEFAULT_MODEL` constant (env `MODEL_NAME` overrides) |
| App name / header | [app/page.tsx](app/page.tsx) (search `APP_NAME`) |
| Input shape, file upload, second API call | extend [app/page.tsx](app/page.tsx) + [app/api/chat/route.ts](app/api/chat/route.ts) |
| UI tokens / colors | [app/globals.css](app/globals.css) + [tailwind.config.ts](tailwind.config.ts) |

## Deploy

```bash
vercel --prod
```

Env vars (`OPENROUTER_API_KEY`, `MODEL_NAME`) must also be set in the Vercel dashboard or via `vercel env add` — they are not pushed from `.env.local`.

## What not to do here

- Don't add auth, a database, or persistence unless the challenge specifically requires it.
- Don't introduce a state-management library. `useState` is enough for a 24h build.
- Don't optimize the skeleton itself — it's throwaway plumbing around the real product.
- Don't rename files to match a specific product until after the challenge drops; keep names generic so the skeleton stays reusable across pivots.
