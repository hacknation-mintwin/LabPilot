BUILD: AI/ML Experiment Similarity Search — One-Pager

GOAL
Build a single-page web app where a researcher pastes a free-form description
(<=200 words) of an experiment they want to run, and gets back the top 10 most
similar prior experiments from the AI/ML literature, each with a 0-1 similarity
score and links to the source.

STACK (free + open-source only)
- Frontend: plain HTML + vanilla JS + CSS. No framework. One file: index.html.
- Backend: Node.js + Express (or FastAPI if you prefer Python). One endpoint.
- Hosting target: Cloudflare Workers OR Vercel free tier OR a single VPS.
  Pick whichever is simplest; do not over-engineer.
- No database in v1. Stateless. Each query fans out live.

DATA SOURCES (all free, no DB)
1. Semantic Scholar API  https://api.semanticscholar.org/graph/v1
   - Use as the ranking spine. Returns SPECTER2 embeddings for free.
   - Endpoints: /paper/search, /paper/{id}, /paper/{id}/embedding
2. arXiv API  http://export.arxiv.org/api/query
   - Bleeding-edge preprints + full-text PDF links.
3. Papers with Code API  https://paperswithcode.com/api/v1
   - Structured experiments: {paper, task, dataset, method, metric, result}.
4. OpenReview API  https://api.openreview.net
   - Peer-review data for ICLR, NeurIPS, etc.
5. Hugging Face Hub API  https://huggingface.co/api
   - Models + datasets linked to papers.

ARCHITECTURE — one POST /search endpoint
Pipeline per request:

  Step 1 (optional, recommended): Keyword extraction
    - Call a cheap LLM (Haiku 4.5 or GPT-4o-mini) once to turn the 200-word
      prompt into 5-10 search terms + key concepts. Cost ~$0.0001/query.
    - If skipping, pass the raw prompt to each API.

  Step 2: Parallel fan-out (Promise.all / asyncio.gather)
    - Hit all 5 APIs concurrently with the extracted terms.
    - Collect ~100-200 candidate papers total. Dedupe by DOI/arXiv ID/title.

  Step 3: Embed
    - For each candidate, fetch SPECTER2 embedding from Semantic Scholar
      (/paper/{id}/embedding). Skip candidates without one.
    - Embed the user's prompt with the same model server-side, OR use
      Semantic Scholar's /paper/search/match to embed the prompt for you.

  Step 4: Score + rank
    - Cosine similarity between prompt vector and each candidate vector.
    - Sort descending, take top 10.

  Step 5: Enrich
    - For each of the top 10, attach:
        - title, authors, year, venue
        - arXiv link + PDF link if present
        - Papers with Code entry (task/dataset/metric) if present
        - OpenReview review summary if present
        - HF models/datasets if present
        - similarity score (0-1, rounded to 3 decimals)
    - Return as JSON array.

UI REQUIREMENTS (index.html)
- Single page, centered card layout.
- <textarea> with maxlength enforced in JS by WORD count, not char count.
  - Show live word counter ("123 / 200 words").
  - Disable submit button when count > 200 or count == 0.
- Submit button → POST /search → render result list below.
- Each result row:
    [score bar 0-1] [title]          [year, venue]
                   authors
                   [arXiv] [PWC] [OpenReview] [HF]  ← only show if present
                   1-line snippet from abstract
- Loading state (spinner + "Searching 5 sources...").
- Error state (graceful — if one API fails, show partial results, don't 500).

NON-NEGOTIABLES
- Do not store user queries. Stateless.
- All 5 source calls happen in parallel, never sequential.
- Every API call has a timeout (5s) and try/catch — one source down ≠ whole
  request fails.
- Respect rate limits: send User-Agent header with a contact email; cache
  responses in-memory for 10 min by query hash to avoid duplicate fan-outs.
- Similarity score must be in [0,1]. Show it. Do not hide the math.

DO NOT
- Do not add a database, auth, accounts, or user history.
- Do not add Crossref, OpenAlex, PubMed, Nature News — out of scope for v1.
- Do not use Elicit/SciSpace/Dimensions (paid).
- Do not build a React app or use Next.js. Plain HTML.
- Do not hallucinate sources — if a paper isn't in S2, drop it from ranking.

ACCEPTANCE CRITERIA
- npm start (or equivalent) launches the server on a single port.
- Visiting / shows the one-pager.
- Pasting an AI/ML experiment description and clicking Search returns 10
  results with scores within ~3 seconds on a warm cache.
- One source being down still returns partial results.
- Word counter blocks submit at 201 words.

DELIVERABLES
- index.html (frontend)
- server.js (or main.py) — the /search endpoint with the 5-step pipeline
- README.md — setup, env vars, how to run locally
- .env.example — keys for Semantic Scholar (optional), LLM (optional)