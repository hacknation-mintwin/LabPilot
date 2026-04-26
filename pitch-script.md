# Pitch Script — LabPilot

90-second spoken pitch + live demo. Built around the current `onepager` flow (`/search` then `/plan`).

Named feature term: **Expert Preflight**  
Use this phrase at least 3 times.

---

## Beat 1 — Hook (0:00-0:15)

> "Teams spend days on experiments that already have close precedents. We built **Expert Preflight** so they can check similarity and execution feasibility before spending compute or lab budget."

**On screen:** onepager home, empty textarea, visible word counter.

---

## Beat 2 — What it is (0:15-0:30)

> "You paste up to 200 words. Step one runs a five-source fan-out in parallel and ranks the top similar prior work with visible 0-1 scores. Step two turns that context into a realistic plan with protocol, materials, timeline, validation, and budget."

**On screen:** highlight `0 / 200 words`, then the Search button.

---

## Beat 3 — Live demo step one (0:30-1:00)

> "Watch **Expert Preflight** in action. I’ll paste a real experiment description and hit Search."

**Action:** paste prepared 130-170 word prompt, click Search.

> "Behind this, we fan out concurrently to Semantic Scholar, arXiv, Papers with Code, OpenReview, and Hugging Face, then rank with explicit similarity scores."

**On screen:** loading state "Searching 5 sources..." then scored result cards.

> "Every score is visible. Every source link is clickable."

---

## Beat 4 — Live demo step two (1:00-1:20)

> "Now step two of **Expert Preflight**: generate the execution plan from the same prompt plus retrieved context."

**Action:** trigger plan generation.

> "You get structured tabs for protocol, materials, timeline, and validation, plus deterministic budget math."

**On screen:** open each tab quickly and show KPI row.

---

## Beat 5 — Reliability + integration (1:20-1:35)

> "This is built for real usage: one source can fail and we still return results via `partialErrors`, plan generation uses a provider fallback chain, responses are cached by prompt hash, and we expose MCP tool `search_similar_experiments` so assistants can call this directly."

**On screen:** partial-errors banner if available, then `mcp-server/README.md` tool section.

---

## Beat 6 — Close (1:35-1:50)

> "LabPilot gives teams **Expert Preflight** in one place: find what is already close, then plan what to run next. It’s live now, agent-ready, and running at [URL]."

**On screen:** closing slide with URL + repo link.

---

## Q&A Prep

**"How is this different from a normal search?"**  
> We rank by semantic similarity with explicit 0-1 scores and fuse multiple sources in one query, then continue into plan generation. Standard search stops at links.

**"What happens if one source is down?"**  
> Requests are timeout-bounded per source. Failures are captured in `partialErrors`, and we still return best-available results instead of failing the request.

**"Why no database?"**  
> Stateless by design for v1 speed and freshness. We cache prompt-hash responses in-memory for 10 minutes to cut duplicate fan-outs without storing user history.

**"How do agents use this?"**  
> Through MCP tool `search_similar_experiments`, which validates input and returns normalized JSON (`cached`, `partialErrors`, `results`).

**"What if one LLM provider is rate-limited?"**  
> `/plan` uses an ordered provider chain (Gemini primary, then fallbacks), so one provider failure does not block the full planning flow.

**"What is next?"**  
> Expand source bundles by vertical and add richer planning/tooling while keeping the same tool contract.

---

## Demo Prep Checklist (run before stage)

- [ ] Prepared prompt in clipboard (130-170 words)
- [ ] Warm cache by running one query and one plan generation
- [ ] Verify onepager is serving and `/search` + `/plan` both work
- [ ] Verify `npm --prefix mcp-server test` passes
- [ ] Keep a fallback screen recording in case of unstable network
- [ ] URL on closing slide is live deploy, not localhost
- [ ] Named term appears 3+ times: **Expert Preflight**

## Cuts if over time

- Remove detailed source list in Beat 3; keep "five-source parallel fan-out"
- Compress Beat 5 to one sentence (reliability + MCP together)
- Keep both steps (search and plan) even in the shortest cut
