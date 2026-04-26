<<<<<<< Updated upstream
# LabPilot

LabPilot includes a one-page AI/ML experiment similarity demo, a Next.js app, and an MCP server package that exposes search to external assistants.

## Key Features

- **Prompt-to-experiment discovery**: quickly surface related AI/ML experiments to reduce ideation time.
- **Onepager-first demo**: run a lightweight single-page interface with a simple Node/Express backend.
- **Web app + MCP in one project**: use the UI directly or connect the same capability to assistants through MCP.
- **Client-ready MCP server**: built for stdio workflows and easy setup with Cursor, Claude Desktop, and generic MCP clients.

## Repository Structure

- `app/` - Next.js frontend and API routes
- `onepager/` - single-page demo app (vanilla frontend + Node/Express backend)
- `mcp-server/` - stdio MCP server implementation
- `.github/workflows/mcp-maintainer.yml` - scheduled branch-maintenance workflow
- `.github/mcp-maintainer/README.md` - runbook for the 24-hour maintainer campaign

## Run the Onepager (Recommended Quick Start)

```bash
cd onepager
npm install
cp .env.example .env
# set CONTACT_EMAIL (recommended) and S2_API_KEY (optional)
npm start
```

Open `http://localhost:3000`.

See `onepager/README.md` for API details and constraints.

## Run the Next.js Web App (Optional)

```bash
npm install
cp .env.example .env.local
# set OPENROUTER_API_KEY in .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables (Next.js App)

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
- Upstream dependency: `POST /search` endpoint provided by your LabPilot service

Quick start:

```bash
cd mcp-server
npm install
npm test
npm start
```

For client setup examples (Cursor, Claude Desktop, generic MCP clients), see `mcp-server/README.md`.

=======
# Similarity Search (Onepager-only)

This repo now runs only the `onepager` app.

## Run

```bash
npm install
npm run dev
```

This starts the onepager server via the root script wrapper.

Open `http://localhost:3000`.

## Environment

Copy `onepager/.env.example` to `onepager/.env` and set:

- `GEMINI_API_KEY` (required)
- `CONTACT_EMAIL` (recommended)
- `S2_API_KEY` (optional but recommended)
>>>>>>> Stashed changes
