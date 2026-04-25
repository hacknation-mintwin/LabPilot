# AI App Skeleton

Generic AI app shell: text input → OpenRouter LLM → streamed response. Swap in domain logic when the challenge drops.

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
