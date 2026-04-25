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
