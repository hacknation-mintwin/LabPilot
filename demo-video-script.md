# Demo Video Script - LabPilot Repo (Evidence-First)

Audience: judges, hackathon reviewers, product-minded engineers  
Target length: 2:00-2:30  
Goal: prove the two-step flow (`/search` -> `/plan`) with visible evidence

Named feature term (use 3+ times): **Expert Preflight**

---

## Before recording: lock real numbers

Replace placeholders with measured values from one recorded run:
- `[SEARCH_LATENCY_MS]` = time to `/search` response
- `[PLAN_LATENCY_MS]` = time to `/plan` response
- `[RESULT_COUNT]` = number of returned results (target: 10)
- `[PARTIAL_ERROR_EXAMPLE]` = one real key from `partialErrors` (if demonstrated)
- `[TOP3_RELEVANT_COUNT]` = how many of top-3 are truly on-prompt by your rubric
- `[CONCEPT_COVERAGE]` = matched core concepts in top-3 (e.g., `7/9`)

If you do not have measured values, remove the number claim from voiceover.

Relevance rubric (define before recording, then show it):
- Prompt has 3 core concept groups (example: model size/task, method, evaluation setup)
- A result is "relevant" only if title+snippet matches at least 2 of 3 groups
- Show one counterexample result and explain why it is excluded

---

## 0:00-0:18 - Hook

Voiceover:
> "Teams need evidence before they spend compute or lab effort. **Expert Preflight** gives two outputs in one flow: similar prior work, then a concrete execution plan."

On screen evidence:
- Open `onepager` app (`http://localhost:3000`)
- Cursor in textarea
- Word counter visible (`0 / 200 words`)

---

## 0:18-0:55 - Step 1 proof: similarity search

Voiceover:
> "Step one of **Expert Preflight** sends one query across five sources in parallel: Semantic Scholar, arXiv, Papers with Code, OpenReview, and Hugging Face."
>
> "In this run, search returned `[RESULT_COUNT]` ranked results in `[SEARCH_LATENCY_MS] ms`, with explicit 0-1 similarity scores."
>
> "For evidence quality, top-3 relevance is `[TOP3_RELEVANT_COUNT]/3` by our rubric, and concept coverage is `[CONCEPT_COVERAGE]`."

On screen evidence:
- Paste prepared 120-170 word prompt:
I want to run an experiment to improve onboarding completion in a productivity app used by remote teams. Current completion is 42% within the first session, and many users drop off before creating their first project. I want to test a guided onboarding flow with three changes: (1) role-based setup questions, (2) an interactive checklist with progress feedback, and (3) contextual tips triggered by inactivity. The primary metric is onboarding completion within one session. Secondary metrics are time-to-first-project, week-1 retention, and support tickets related to setup confusion. I need a practical plan for experiment design, sample size assumptions, implementation steps, instrumentation events, success thresholds, and common failure risks. I also want recommendations for a realistic rollout strategy, guardrail metrics, and how to validate whether results generalize across team sizes and industries.
- Show counter update, click `Search`
- Show loading text: "Searching 5 sources..."
- Show result cards with visible score labels and source links
- Optional: show browser network panel timing for `/search`
- Show a small "Prompt Concepts" side card with 3 concept groups
- For each top-3 result, highlight exact matched words/phrases in title/snippet
- Briefly show one lower-ranked/off-topic result and mark "excluded by rubric"

Avoid saying:
- "Best" or "most accurate" unless you show an eval benchmark

---

## 0:55-1:10 - Prompt-specific extraction proof

Voiceover:
> "This is not just retrieval; it is prompt-specific extraction. We only carry forward references that stay aligned with the prompt concepts."
>
> "Here are the exact fields we extract for downstream planning: title, authors, year, source links, semantic matches, and similarity score."

On screen evidence:
- Open one result JSON (or devtools response preview) and point to extracted fields
- Show top-3 references selected for downstream stage (`qcRefs`) in UI/export
- Confirm each selected reference has at least one direct concept match from the prompt card

---

## 1:10-1:35 - Step 2 proof: plan generation

Voiceover:
> "Step two of **Expert Preflight** builds a plan from the same query and retrieval context."
>
> "This run produced protocol, materials, timeline, and validation in `[PLAN_LATENCY_MS] ms`."
>
> "Plan generation uses a provider fallback chain, and budget and timeline totals are deterministic server-side calculations, not free-form model arithmetic."

On screen evidence:
- Trigger planning action
- Show staged loading messages
- Click tabs in order: `Protocol` -> `Materials` -> `Timeline` -> `Validation`
- Hold on budget/timeline summary fields
- Optional: show a log line or UI note that confirms provider fallback when a primary provider fails



---

## 1:35-1:58 - Reliability proof

Voiceover:
> "When one source is degraded, the app still returns best-available output and exposes what failed through `partialErrors`, so teams always know what is covered and 
never act on hidden gaps."
>
> "Here, we still get results while flagging `[PARTIAL_ERROR_EXAMPLE]`."

On screen evidence:
- Show partial-errors banner/message
- Show result list still rendered
- Optional: briefly show response JSON containing `partialErrors`

---

## 1:58-2:22 - MCP evidence + close

Voiceover:
> "This is also agent-callable. The MCP server exposes `search_similar_experiments`, which returns normalized JSON: `cached`, `partialErrors`, and `results`."
>
> "**Expert Preflight** is live, reproducible, and open-source at [URL]."

On screen evidence:
- Open `mcp-server/README.md`
- Highlight tool name and `/search` contract
- Closing slide with live URL + repo URL

---

## Recording Checklist

- Warm start server and run one full search+plan cycle before the take
- Capture one network timing screenshot for `/search` and `/plan`
- Prepare one relevance overlay slide (prompt concepts -> top-3 concept matches)
- Keep one fallback clip of complete flow in case network is unstable
- Ensure no secrets are visible (`.env`, API keys, headers)
- Remove any unmeasured metric claims before final export
