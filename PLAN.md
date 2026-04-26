# PLAN.md — Experiment Plan Generator (Fulcrum Challenge 04)

Recommendation for adding the **Experiment Plan** stage on top of the existing
`onepager/` (Input + Literature QC). This is the third and primary deliverable
of the Fulcrum "AI Scientist" brief.

---

## 0. What we already have

- `onepager/index.html` + `onepager/server.js` (Express, no DB)
  - Stage 1: **Input** — textarea, ≤200 words.
  - Stage 2: **Literature QC** — `POST /search` fans out to Semantic Scholar +
    arXiv + Papers with Code + OpenReview + Hugging Face, returns top-10 with
    `similarity ∈ [0,1]`.
- Stack: Node 18+, vanilla JS frontend, no build step. `dotenv` for `S2_API_KEY`
  + `CONTACT_EMAIL`.

**Decision: extend, don't re-architect.** Add one new endpoint
(`POST /plan`) and one new section on the page. Keep the single-file, dep-light
character of the onepager — that's what makes it demoable in a hackathon.

---

## 1. What the plan must contain (per Fulcrum brief)

A scientist would trust the plan only if all five blocks are present and
self-consistent:

| Block | Must answer |
| --- | --- |
| **Protocol** | Numbered, ordered steps. Each step lists reagents/equipment used and a duration. Grounded in a published protocol when possible. |
| **Materials** | Reagent / consumable / equipment line items. Supplier, catalog number, pack size, qty needed, unit cost, line cost. |
| **Budget** | Sum of materials + labour (FTE × weeks × rate) + overhead/contingency. Broken down by category and phase. |
| **Timeline** | Phased Gantt — phase, start week, duration, dependencies, blocking risks. |
| **Validation** | Primary endpoint, statistical test, sample size & power, success threshold, failure modes. |

Two cross-cutting requirements:

- **Novelty signal** carries through from QC step ("not found" / "similar work
  exists" / "exact match found") and is shown on top of the plan.
- **Citations**: every protocol step and reagent must link to the source it was
  grounded in (protocol DB, paper, supplier page) so a PI can verify in one
  click. Without citations the plan is not trustworthy.

---

## 2. Two big risks of the current QC stage (read before scoping plan)

The Fulcrum sample inputs are **wet-lab life science** (biosensors, mice,
HeLa cells, CO₂-fixing microbes). The current QC sources are heavily AI/ML:

- ✅ Semantic Scholar — covers all sciences, keep as ranking spine.
- ✅ arXiv — has bio-archive cross-listings, keep.
- ❌ Papers with Code, OpenReview, Hugging Face — AI/ML only. For Fulcrum
  inputs they will return junk or empty.

**Recommendation for QC** (small, ~30 min):

- Replace PWC / OpenReview / HF with **bioRxiv** + **medRxiv** + **PubMed
  E-utilities** for the Fulcrum demo. The fan-out / scoring logic stays
  identical; only the source clients change.
- Or: keep the AI/ML sources behind a domain detector and only fire them when
  the prompt is AI/ML.

This is not "the plan" but the QC-step references shown above the plan need to
be credible to bio judges, otherwise the whole demo loses trust.

---

## 3. Backend: `POST /plan` pipeline

Single endpoint, single file (`onepager/server.js`). Stateless, in-memory cache
keyed by `sha256(prompt + qcReferenceIds)` for 10 min — same pattern as
`/search`.

### 3.1 Pipeline (six stages, all in one request)

```
prompt
  │
  ├─ (1) classify domain          ── tiny LLM call (one-line classifier) or rule-based
  │
  ├─ (2) extract experiment frame ── LLM → { intervention, outcome, model_system, controls, threshold }
  │
  ├─ (3) RAG: ground in real data ── parallel fan-out, 5s timeout each:
  │       • protocols.io search   (free public search)
  │       • bio-protocol           (HTML scrape title+url, best-effort)
  │       • Thermo Fisher / Sigma  (search reagents → catalog # + price)
  │       • Addgene                (plasmid catalog if applicable)
  │       • the QC papers from /search (already have abstracts)
  │
  ├─ (4) generate plan            ── ONE LLM call, JSON Schema-constrained,
  │                                  context = frame + retrieved snippets.
  │
  ├─ (5) post-process             ── deterministic, NOT in LLM:
  │       • budget = Σ(qty × unit_price) + labour + 15% contingency
  │       • timeline = topo-sort steps → critical path → start/end weeks
  │       • validate JSON shape; reject + retry once if malformed
  │
  └─ (6) return structured plan
```

Why this shape:

- **One LLM call**, not a chain of agents. Hackathon-fast, debuggable, cheap.
- **Calculation is deterministic** (budget, timeline). Never trust the LLM with
  arithmetic — it will silently confabulate £4,127 line totals. Have it emit
  qty + unit cost; sum in JS.
- **RAG before generate**, not after. Retrieved snippets are the "grounding"
  that gives the plan its protocols.io / catalog-number specificity.
- **5s per source, best-effort** — keep the pattern that already works in
  `/search`. Plan should never 500 because Sigma is slow.

### 3.2 LLM choice

Reuse the existing `OPENROUTER_API_KEY` from `app/api/chat/route.ts`
(root project). Recommended models:

- **Plan generation**: `anthropic/claude-3.5-sonnet` or `openai/gpt-4o` via
  OpenRouter. Strong JSON schema adherence + protocol knowledge.
- **Frame extraction & domain classification**: a fast cheap model
  (`google/gemini-2.0-flash` or `gpt-4o-mini`).

Stay under ~$0.10 per plan generation. Budget-wise that's fine even for many
demo runs.

### 3.3 JSON Schema (the single source of truth)

```jsonc
{
  "novelty": { "signal": "similar_work_exists", "references": [/* up to 3 */] },
  "summary": "One-paragraph plain-English what we will do and why.",
  "frame": {
    "hypothesis": "...", "intervention": "...", "outcome": "...",
    "model_system": "...", "controls": "...", "threshold": "..."
  },
  "protocol": [
    {
      "step": 1,
      "title": "Synthesise antibody-functionalised electrode",
      "duration_hours": 6,
      "reagents": ["reagent_id_1", "reagent_id_2"],
      "equipment": ["equipment_id_1"],
      "instructions": "...",
      "source": { "name": "protocols.io", "url": "..." }
    }
  ],
  "materials": [
    {
      "id": "reagent_id_1",
      "category": "reagent" | "consumable" | "equipment" | "service",
      "name": "Anti-CRP polyclonal antibody",
      "supplier": "Sigma-Aldrich",
      "catalog_number": "C-7398",
      "pack_size": "100 µg",
      "quantity": 2,
      "unit_cost_gbp": 312,
      "line_cost_gbp": 624,             // computed in JS, not LLM
      "url": "https://www.sigmaaldrich.com/..."
    }
  ],
  "budget": {                            // entire object computed in JS
    "currency": "GBP",
    "categories": { "reagents": 2840, "consumables": 410, "equipment": 0, "labour": 8000, "overhead": 1500 },
    "phases":     { "setup": 1200, "execution": 9100, "analysis": 2450 },
    "contingency_pct": 15,
    "subtotal": 12750,
    "total":    14662
  },
  "timeline": {                          // computed in JS from step deps
    "unit": "weeks",
    "total_weeks": 10,
    "phases": [
      { "name": "Setup",     "start_week": 0, "duration_weeks": 2, "depends_on": [] },
      { "name": "Execution", "start_week": 2, "duration_weeks": 6, "depends_on": ["Setup"] },
      { "name": "Analysis",  "start_week": 8, "duration_weeks": 2, "depends_on": ["Execution"] }
    ]
  },
  "validation": {
    "primary_endpoint": "Detection of CRP at 0.5 mg/L within 10 min",
    "statistical_test": "Two-sided Mann-Whitney U vs. ELISA reference",
    "sample_size": 30, "power": 0.8, "alpha": 0.05,
    "success_criteria": ["Sensitivity ≥ 0.5 mg/L", "Specificity ≥ 90%", "TTR ≤ 10 min"],
    "failure_modes": ["Antibody fouling", "Whole-blood matrix interference"]
  },
  "risks": [
    { "risk": "Antibody batch variability", "severity": "med", "mitigation": "..." }
  ],
  "citations": [/* every {source,url} touched, deduped */]
}
```

This object is the API response and also the only thing the UI renders.

### 3.4 Calculation rules (deterministic, server-side)

- **Budget total**:
  `subtotal = Σ(line_cost) + labour_total`
  `total = round(subtotal × (1 + contingency_pct/100))`
- **Labour**: from frame's expected FTEs and project length;
  default `£480/day × FTE × working_days_in_timeline`. Surface as a single
  line; don't ask the LLM to dream up a daily rate.
- **Timeline total_weeks**: longest path through the DAG of phase/step
  `depends_on`. Reject the plan if there's a cycle.
- **Sanity guards** (return `partialErrors` instead of failing the request):
  - Reject if `materials` is empty → "No reagents grounded" warning.
  - Reject any line item where `unit_cost × quantity ≠ line_cost`.
  - Cap `total ≤ £1,000,000` and `total_weeks ≤ 104`. Anything beyond that is
    an LLM hallucination, not a runnable plan.

---

## 4. UI: how to render it

Stay inside `onepager/index.html`. Add one new section that appears after
the QC results.

### 4.1 Page flow (vertical, single page)

```
┌─────────────────────────────────────────────┐
│  Input (textarea + Run QC button)           │
├─────────────────────────────────────────────┤
│  QC: novelty pill + 2-3 references          │
│  [ Generate experiment plan ▶ ]             │
├─────────────────────────────────────────────┤
│  Plan summary card                          │
│   total: £14,662 · timeline: 10 weeks       │
│   [ Protocol ] [ Materials ] [ Budget ]     │ ← sticky tab bar
│   [ Timeline ] [ Validation ] [ Risks ]     │
├─────────────────────────────────────────────┤
│  active tab content (scrollable section)    │
│  …                                          │
├─────────────────────────────────────────────┤
│  [ Export markdown ]  [ Export JSON ]       │
│  [ Edit plan / give feedback ] (stretch)    │
└─────────────────────────────────────────────┘
```

Tabs are anchor links (`#protocol`, `#materials`, …) on the same page — no
SPA framework. Highlight the active tab on scroll.

### 4.2 Per-tab rendering

- **Protocol** — vertical stepper. Each step: number badge, title, duration
  pill, body, reagent chips that scroll-link to the Materials row. Source link
  at the right of the title (`protocols.io ↗`).
- **Materials** — table: Category · Name · Supplier · Cat # (link) · Qty ·
  Unit cost · Line cost. Sortable. Group rows by category. Footer shows
  per-category subtotal.
- **Budget** — three big numbers at top (subtotal / contingency / total).
  Below: stacked horizontal bar by category, second one by phase. No charting
  library needed; CSS flex with `width: %` is enough.
- **Timeline** — CSS Gantt: each phase row, bar positioned by
  `left: start/total*100%; width: duration/total*100%`. Hover reveals
  dependencies. ~30 lines of CSS, no library.
- **Validation** — single card: primary endpoint, success criteria checklist,
  sample-size sentence ("n=30 per arm, α=0.05, power=0.8"), failure modes.
- **Risks** — coloured pills (green/amber/red by severity), one-liner each,
  click to expand mitigation.

### 4.3 States

- Loading: existing spinner pattern, message rotates: "Extracting frame…",
  "Searching protocols.io…", "Pricing reagents…", "Drafting plan…". Use
  server-sent stages (or fake the rotation client-side every 1.5s — fine for
  a demo).
- Partial-errors banner above the plan, same component as `/search`.
- Empty material list → red banner "Plan ungrounded — re-running with
  broader retrieval"; auto-retry once with `intervention` only.

### 4.4 Export

- **Markdown export**: render the same JSON to a markdown string client-side.
  Copy-to-clipboard + download. Judges love being able to paste the plan into
  their own doc.
- **JSON export**: `JSON.stringify(plan, null, 2)`. Same button group.

---

## 5. Stretch — Scientist Review (closing the learning loop)

Highest-ceiling item. Worth attempting only after §3 + §4 are solid.

- **Edit-in-place** on every plan section. `contenteditable` blocks for prose;
  table-row edits for materials; inline edit + thumbs for steps.
- **Feedback model** (file-based, zero infra): on every save, append to
  `feedback.jsonl`:

  ```json
  { "domain": "diagnostics-biosensor", "section": "materials",
    "before": {...}, "after": {...}, "rationale": "...", "ts": 1745... }
  ```

- **Use feedback on next generation**: in `(4) generate plan`, read up to 3
  past feedback rows whose `domain` matches the new prompt's classified
  domain and inject them as few-shot examples ahead of the JSON Schema.
- **Demo moment**: judge edits a reagent ("use Bovine Serum Albumin from
  Thermo, 1 mg/mL, A7906"), generates a similar plan, the new plan picks
  the BSA from Thermo without being prompted. That's the win condition the
  brief describes.

Tag every feedback row with `domain` + `section` so retrieval is cheap (no
embeddings needed for v1).

---

## 6. File-level changes (concrete)

| File | Change |
| --- | --- |
| `onepager/server.js` | Add `extractFrame()`, `classifyDomain()`, RAG clients (`protocolsIoSearch`, `sigmaSearch`, etc.), `computeBudget()`, `computeTimeline()`, `POST /plan` route. ~300 LOC. |
| `onepager/index.html` | Add plan card + tabs + exporters below `#results`. ~250 LOC of HTML/CSS, ~150 LOC of vanilla JS render. |
| `onepager/.env.example` | Add `OPENROUTER_API_KEY=`. |
| `onepager/.env` | Add the user's actual key (already gitignored). |
| `onepager/feedback.jsonl` (stretch) | Created on first feedback write. Add to `.gitignore`. |

No new dependencies. `fetch` is built-in; JSON is built-in; nothing else
needed. Keep it that way.

---

## 7. Suggested time budget (single 24h hackathon BUILD slot)

| Hours | Task |
| --- | --- |
| 0.5 | Swap QC sources for bio-relevant ones (bioRxiv + PubMed) — §2 |
| 1.0 | Frame extraction + domain classifier (LLM, JSON-mode) |
| 2.0 | RAG: protocols.io + Sigma/Thermo reagent search clients |
| 2.0 | Plan generation LLM call + JSON Schema validation + retry |
| 1.0 | Deterministic budget + timeline calculators |
| 2.5 | Plan UI tabs (Protocol, Materials, Budget, Timeline, Validation) |
| 1.0 | Markdown + JSON exporters, partial-error banner, polish |
| 1.0 | One real end-to-end run on each of the 4 sample inputs |
| ---- | --- |
| 11.0 | **Core, demoable** |
| 4.0  | Stretch: scientist review + feedback loop |
| 2.0  | Stretch: critical-path animation on Gantt + cost-bar polish |

Ship the core before touching stretch. The brief's quality bar is "would a PI
order materials from this on Monday?", not "does it have a feedback loop?".

---

## 8. What "good" looks like (acceptance check before demo)

Run the 4 sample inputs. For each, the plan must satisfy:

- [ ] At least 5 protocol steps, each with a duration and a real source link.
- [ ] At least 8 material lines, each with a non-fake catalog number that
      resolves on the supplier's site.
- [ ] Budget arithmetic checks out: `Σ line_costs + labour + contingency = total`.
- [ ] Timeline is a valid DAG (no cycles), and `total_weeks` matches the
      Gantt's longest bar.
- [ ] Validation block has a primary endpoint matching the input's threshold,
      a statistical test, and a sample size with α/power.
- [ ] Novelty pill from QC is visible at the top of the plan.
- [ ] Markdown export is a paste-ready doc — no JSON or `[object Object]`.

If all four sample inputs pass these eight checks, the build is demo-ready.
