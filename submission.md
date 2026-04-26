## Project Cover Image
<!-- Optional: team photo or product screenshot -->
⚠️ TODO: Add a cover image URL or local path

## Demo Video *
<!-- Required: 2-min UI/UX showcase, .mp4 or shareable URL -->
⚠️ TODO: Add demo video URL (.mp4, YouTube, or Loom)

## Tech Video *
<!-- Required: stack, architecture, implementation walk-through, .mp4 -->
⚠️ TODO: Add tech video URL (.mp4 or shareable URL)

## Other Visuals
<!-- Optional: screenshots, diagrams, posters, PDFs, ZIPs -->
- `demo-video-script.md`
- `tech-video-script.md`
- `pitch-script.md`

---

## Project Title *
LabPilot Similarity Search

## Short Description *
<!-- ≤15 words, present tense, punchy — this is the judge's first impression -->
We built Expert Preflight to find similar experiments and generate execution plans.

## Structured Project Description
<!-- Opening paragraph: what it is and why it matters. 3–4 sentences. -->
LabPilot Similarity Search gives teams Expert Preflight: a two-step flow that finds similar prior work, then generates a concrete execution plan. Teams currently spend hours searching scattered sources and still miss close precedents, which leads to weak experiment design and wasted budget. We built this in ⚠️ TODO: confirm total build hours to show that evidence-first planning can happen in one fast workflow. It works in a live web app and through MCP for agent-driven usage.

---

## Problem & Challenge *
<!--
Who: [TARGET_AUDIENCE_SHORT]
Pain: [PROBLEM_1_SENTENCE]
Status quo failure: [WHY_EXISTING_TOOLS_FAIL]
-->
AI/ML teams, product experiment owners, and technical researchers need to know whether an idea is already close to prior work before they invest compute, engineering time, or lab budget. Today they manually search multiple sources, compare results by hand, and still struggle to connect findings to an actionable execution plan. Traditional search tools stop at links and do not provide explicit similarity scoring plus downstream planning in one reliable flow.

## Target Audience *
<!--
Specific persona, not "everyone". Include scale if known.
-->
Primary users are AI/ML engineers, applied researchers, and product teams that run experiments under time and budget constraints. Secondary users are agent builders who need a stable MCP tool contract to run evidence-first retrieval before recommending next actions.

## Solution & Core Features *
<!--
Lead with the wow moment. Then features as bullets.
Format: verb-first, present tense ("Analyzes X and returns Y in under 3s").
-->
Expert Preflight takes one prompt, searches five sources in parallel, ranks similar work with transparent 0-1 scores, and turns the same context into a concrete execution plan.

- Searches Semantic Scholar, arXiv, Papers with Code, OpenReview, and Hugging Face in parallel.
- Ranks results with embedding-based similarity and shows explicit 0-1 scores per result.
- Generates a structured plan with protocol, materials, timeline, validation, and deterministic budget math.
- Returns best-available output with `partialErrors` when one source degrades, instead of failing the full request.
- Exposes `search_similar_experiments` via MCP so external assistants can call the same capability.

## Unique Selling Proposition (USP) *
<!--
One thing that nothing else does. Be specific — generic claims lose.
Avoid: "the only", "first ever" unless provably true.
-->
Expert Preflight combines multi-source semantic similarity retrieval and practical execution planning in one continuous workflow. Users do not just receive links; they receive scored evidence plus a structured plan generated from the exact same prompt context.

## Implementation & Technology *
<!--
Stack list + one-sentence architecture. Mention sponsor tools explicitly.
-->
**Stack:** Node.js, Express, vanilla HTML/CSS/JavaScript, OpenAI SDK-compatible provider calls, Semantic Scholar API, arXiv, Papers with Code, OpenReview, Hugging Face, MCP SDK

**Architecture:** A one-page frontend calls a Node/Express backend with `/search` and `/plan`, while a separate MCP server exposes normalized search outputs to assistant clients.

**Key implementation details:**
- Runs five-source fan-out with per-source timeouts and aggregates failures into `partialErrors`.
- Uses Semantic Scholar SPECTER2-style embedding vectors as the ranking spine for similarity scoring.
- Caches prompt-hash responses in memory for 10 minutes to reduce duplicate retrieval latency.

## Results & Impact *
<!--
What worked. Numbers if you have them (latency, accuracy, user reactions).
No hedging — "it produces X" not "it seems to produce X".
-->
The project delivers a full evidence-to-plan loop in one interface and one MCP-integrated backend. It returns top-ranked similar prior work with transparent similarity scoring and source links, then produces structured execution plans from the same query context. It stays usable during partial upstream outages by surfacing degraded providers while continuing to return best-available results. The current demo scripts already define measurable quality and latency checkpoints for judge-facing runs.

## Additional Information
<!--
Optional: sponsor integrations, constraints, team notes, what you'd do next.
-->
The MCP server tool contract is `search_similar_experiments` with normalized JSON output (`cached`, `partialErrors`, `results`) for reliable agent integration. Current constraints: search ranking is bounded by Semantic Scholar candidate coverage and upstream source rate limits/timeouts. Next step: add finalized measured benchmarks (`/search` latency, `/plan` latency, top-3 relevance) directly into the submission and demo narration.

---

## Live Project URL
⚠️ TODO: Add production `https://` URL

## GitHub Repository URL *
https://github.com/hacknation-mintwin/similarity-search

## Technologies / Tags
<!-- Flat list, one per line -->
Node.js
Express
Vanilla JavaScript
OpenAI SDK
Model Context Protocol (MCP)
Semantic Scholar API
arXiv
Papers with Code
OpenReview
Hugging Face
Google Gemini
Groq
Cerebras

## Additional Tags
<!-- Domain keywords -->
AI research
experiment planning
semantic similarity
retrieval
developer tools
agent tooling
