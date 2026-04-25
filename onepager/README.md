# AI/ML Experiment Similarity Search — One-Pager (v1)

Single-page web app: paste an AI/ML experiment description (≤200 words) and get the top 10 most similar prior experiments with a **0–1 similarity score** plus best-effort links to sources.

## What this does

- **Frontend**: `index.html` (vanilla JS/CSS, one page)
- **Backend**: `server.js` (Node.js + Express)
- **Stateless**: no DB, no stored user queries
- **Per request pipeline**
  - Keyword extraction (local, free)
  - Parallel fan-out to 5 sources (best-effort with 5s timeouts)
  - Semantic Scholar embeddings as ranking spine (SPECTER2 vectors)
  - Cosine similarity \( \rightarrow \) mapped into \([0,1]\)
  - Enrichment (Papers with Code / OpenReview / Hugging Face) best-effort
- **Caching**: in-memory 10 minutes by SHA-256 hash of the prompt (hash only)

## Requirements

- Node.js 18+ (for built-in `fetch`)

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

- `CONTACT_EMAIL` (recommended): used in `User-Agent` headers for all upstream calls
- `S2_API_KEY` (optional but strongly recommended): Semantic Scholar API key to avoid shared unauthenticated throttling (HTTP 429) and improve reliability

## Run locally

```bash
npm start
```

Then open `http://localhost:3000`.

## API

### `POST /search`

Request:

```json
{ "prompt": "..." }
```

Response:

```json
{
  "cached": false,
  "results": [
    {
      "title": "...",
      "authors": ["..."],
      "year": 2024,
      "venue": "NeurIPS",
      "similarity": 0.873,
      "links": {
        "semanticScholar": "...",
        "arxiv": "...",
        "pdf": "...",
        "pwc": "...",
        "openreview": "...",
        "hfModels": "...",
        "hfDatasets": "..."
      }
    }
  ],
  "partialErrors": {
    "openreview": "timeout"
  }
}
```

## Notes / constraints (v1)

- Ranking is **only over candidates present in Semantic Scholar** (non-negotiable).
- All upstream source calls are made **in parallel** and each has a **5s timeout**; one failure will not 500 the whole request.
- Prompt embedding is obtained via Semantic Scholar `paper/search/match` requesting `embedding.specter_v2` (best-effort). If unavailable, the server falls back to a mean embedding of the first few candidates and returns a `partialErrors.prompt_embedding` note.

