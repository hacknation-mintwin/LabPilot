# Similarity Search App

Similarity Search is a Next.js app for AI/ML experiment ideation workflows, plus an MCP server package that exposes a search tool to external assistants.

## Repository Structure

- `app/` - Next.js frontend and API routes
- `mcp-server/` - stdio MCP server implementation
- `.github/workflows/mcp-maintainer.yml` - scheduled branch-maintenance workflow
- `.github/mcp-maintainer/README.md` - runbook for the 24-hour maintainer campaign

## Run the Web App

```bash
npm install
cp .env.example .env.local
# set OPENROUTER_API_KEY in .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables (Web App)

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | yes | API key for chat route calls |
| `MODEL_NAME` | no | Model slug override (`DEFAULT_MODEL` is used otherwise) |

## Deploy the Web App

```bash
vercel --prod
```

Set environment variables in Vercel after deploy.

## MCP Server

The MCP server lives in `mcp-server/` and exposes:

- Tool name: `search_similar_experiments`
- Transport: stdio
- Upstream dependency: `POST /search` endpoint provided by your similarity-search service

Quick start:

```bash
cd mcp-server
npm install
npm test
npm start
```

For client setup examples (Cursor, Claude Desktop, generic MCP clients), see `mcp-server/README.md`.

## Automated MCP Branch Maintainer

`mcp-maintainer.yml` keeps `mcp-server` synchronized and repairable:

- Source branch preference: `feature/experiment-similarity-onepager`
- Fallback source: `main`
- Target branch: `mcp-server`
- Verification: runs `npm --prefix ./mcp-server test`
- Failure path: opens a repair request and can trigger Cursor Cloud Agent webhook

To operate it, follow `.github/mcp-maintainer/README.md`.
