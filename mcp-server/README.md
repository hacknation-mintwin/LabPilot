# similarity-search MCP server

MCP stdio server that exposes one tool backed by the onepager API:

- Tool: `search_similar_experiments`
- Upstream endpoint: `POST /search` on the similarity-search onepager service
- Output: JSON payload with `results`, `partialErrors`, and `cached`

## Quick start

```bash
npm install
npm test
npm start
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `SIMILARITY_SEARCH_BASE_URL` | `http://localhost:3000` | Base URL of the onepager web service |
| `SIMILARITY_SEARCH_TIMEOUT_MS` | `15000` | Timeout for MCP -> onepager requests |

## Tool contract

Input:

```json
{
  "prompt": "experiment description",
  "topK": 10
}
```

Rules:

- `prompt` is required and normalized before request.
- `topK` must be integer `1..10`.
- MCP server returns top `topK` from `/search`.

## Test

```bash
npm test
```

Tests cover prompt normalization, branch fallback utility, topK validation, and API error mapping.

## Connect to popular MCP clients

This server uses stdio transport (`node src/index.js`), so most clients can launch it as a local process.

### Cursor

Add an MCP server in Cursor settings (MCP section) with:

- Command: `node`
- Args: `["/absolute/path/to/similarity-search/mcp-server/src/index.js"]`
- Environment:
  - `SIMILARITY_SEARCH_BASE_URL=http://localhost:3000`
  - `SIMILARITY_SEARCH_TIMEOUT_MS=15000`

After saving, open a new chat and verify tool `search_similar_experiments` is available.

### Claude Desktop

Add this to your Claude Desktop MCP config:

```json
{
  "mcpServers": {
    "similarity-search": {
      "command": "node",
      "args": [
        "/absolute/path/to/similarity-search/mcp-server/src/index.js"
      ],
      "env": {
        "SIMILARITY_SEARCH_BASE_URL": "http://localhost:3000",
        "SIMILARITY_SEARCH_TIMEOUT_MS": "15000"
      }
    }
  }
}
```

Restart Claude Desktop and confirm the tool is listed.

### Generic MCP clients

Use the same stdio launch contract:

- command: `node`
- args: `["/absolute/path/to/mcp-server/src/index.js"]`
- env:
  - `SIMILARITY_SEARCH_BASE_URL`
  - `SIMILARITY_SEARCH_TIMEOUT_MS`

You can also use `mcp-manifest.json` as a reference descriptor in clients that support manifest import.
