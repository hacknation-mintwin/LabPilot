# Technical Video Script - LabPilot Repo (Updated)

Audience: engineers, maintainers, technical judges  
Target length: 4:30-6:30  
Goal: explain the current onepager + MCP + maintainer architecture

---

## 0:00-0:35 - Architecture at a glance

Voiceover:
> "Current architecture has two parts: onepager web app for interactive use and MCP server for agent integrations."

On screen:
- Show repo root
- Point to `onepager/` and `mcp-server/`
- Diagram: UI -> `/search` + `/plan`; MCP -> `/search`

---

## 0:35-1:35 - Onepager backend pipeline

Voiceover:
> "Core logic lives in `onepager/server.js`. `POST /search` runs a fan-out pipeline with in-memory cache keyed by prompt hash, parallel source calls, Semantic Scholar embedding-based ranking, and enriched top results."

On screen:
- Open `onepager/server.js`
- Highlight:
  - cache setup (`CACHE_TTL_MS = 10 min`)
  - `POST /search`
  - `partialErrors` accumulation
  - cached response branch

Key line:
> "The design is stateless for user data, but still fast via short-lived in-memory cache."

---

## 1:35-2:20 - Search UI details

Voiceover:
> "The single-page UI in `onepager/index.html` enforces a 200-word limit, drives `/search`, displays explicit 0-1 similarity scores, and shows partial failure notes without breaking flow."

On screen:
- Open `onepager/index.html`
- Highlight:
  - word counter logic
  - "Searching 5 sources..." loading state
  - result score rendering (`score: X.XXX (0-1)`)
  - partial error banner handling

Key line:
> "Score transparency is intentional: ranking is visible, not a black box."

---

## 2:20-3:10 - Step 2 planning endpoint

Voiceover:
> "Latest iteration adds `POST /plan`. It uses LLM-assisted synthesis for protocol framing, then runs deterministic server-side post-processing for totals and sanity checks before returning structured sections."

On screen:
- Back to `onepager/server.js`
- Highlight:
  - `POST /plan`
  - provider-chain key guard (at least one configured key)
  - provider priority list (Gemini -> Gemini Lite -> Groq -> Cerebras)
  - deterministic post-processing block
  - `partialErrors.sanity` handling

Key line:
> "Arithmetic is computed in code, not delegated to model output."

Supporting line:
> "If one model provider fails, the chain falls back automatically and still returns best-available planning output."

---

## 3:10-4:00 - MCP tool contract

Voiceover:
> "The MCP server exposes one tool, `search_similar_experiments`. It validates `prompt` and `topK`, calls `/search` on the onepager service, and returns normalized JSON with `cached`, `partialErrors`, and truncated results."

On screen:
- Open `mcp-server/src/index.js` then `mcp-server/src/search-client.js`
- Highlight:
  - tool input schema (`topK` 1..10)
  - prompt normalization
  - timeout signal
  - response normalization

Key line:
> "This keeps agent-side behavior stable even when upstream responses vary."

---

## 4:00-4:40 - Test and maintenance automation

Voiceover:
> "Recent commits also strengthened maintenance automation. The MCP maintainer runbook and workflow sync source updates into `mcp-server`, run tests, and open repair paths when needed."

On screen:
- Open `.github/mcp-maintainer/README.md`
- Highlight:
  - source branch preference + fallback
  - verification step (`npm --prefix ./mcp-server test`)
  - local fallback script (`scripts/mcp-maintainer-local.sh`)

Optional terminal cut:
- Run `npm --prefix mcp-server test`

---

## 4:40-5:20 - Deployment and extension points

Voiceover:
> "Deploy onepager as a single Node service, run MCP via stdio in clients like Cursor or Claude Desktop, and keep extension points clean: swap source bundles, add new post-process validators, or expose more MCP tools without breaking current contracts."

On screen:
- Open `onepager/README.md` and `mcp-server/README.md`
- Highlight environment variables and startup commands
- Close on architecture diagram with extension bullets

---

## Recording Notes

- Zoom editor to at least 125% for code readability
- Keep one known-good query to demonstrate both `/search` and `/plan`
- Capture one dry run of `npm --prefix mcp-server test` before final take
- Keep all claims tied to visible code or command output
