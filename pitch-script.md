# Pitch Script — AI/ML Experiment Similarity Search

A 90-second spoken pitch + live demo. Time-boxed, beat-by-beat. Practice it twice before stage.

---

## Beat 1 — The hook (0:00–0:15)

> "We built a held-out set of 50 manually-labeled experiment descriptions. On that set, the most relevant prior experiment lands in our top 3 results 84% of the time, in 3 seconds. Right now a researcher does that lookup by hand in 4 hours — if they bother at all. Most don't, and they re-run experiments that already exist."

**On screen:** the one-pager, empty textarea, cursor blinking.

> *Stat note: replace 50 / 84% with your actual eval numbers before stage. The shape of the sentence is what matters — number first, baseline second.*

---

## Beat 2 — What it is (0:15–0:30)

> "This is a single page. You paste up to 200 words describing the experiment you want to run. We run the **five-source fan-out** — Semantic Scholar, arXiv, Papers with Code, OpenReview, Hugging Face, all in parallel — and you get back the 10 most similar prior experiments, ranked, with similarity scores you can see and direct links to every source."

**On screen:** highlight the word counter ticking up as you paste.

---

## Beat 3 — Live demo (0:30–1:10)

> "Watch. I'm pasting a real description — fine-tuning a 7B model on synthetic instruction data, evaluating on MT-Bench, curriculum-ordered data..."

**Action:** paste the prepared 150-word prompt. Counter shows `147 / 200 words`. Click Search.

> "Behind that button is the **five-source fan-out** — Semantic Scholar, arXiv, Papers with Code, OpenReview, Hugging Face. All concurrent. We pull SPECTER2 embeddings, score every candidate by cosine similarity to your query, and rank."

**On screen:** loading state, "Searching 5 sources..." → results in ~3 seconds.

> "Top result: Self-Instruct, score 0.91. Second: Alpaca, 0.89. Every score is visible. Every link is live. Click through —"

**Action:** click the arXiv link on result #1, snap back.

---

## Beat 4 — The "honest math" beat (1:10–1:25)

> "Two things every other tool gets wrong. First: they hide the score. We show it — zero to one, three decimals, no theater. Second: they fall over when one source is slow."

**Action:** open dev tools, throttle one API to fail. Resubmit.

> "OpenReview is down. We still return 10 results — just without OpenReview badges. One source down never breaks the whole request. And same input, same output — scores are deterministic, cached by query hash. Reproducible by default."

---

## Beat 5 — Where this slots in (1:25–1:40)

> "Here's where this lives. Before a researcher — or an AI coding agent — kicks off a week of GPU time, they paste the experiment here. If 'fine-tune 7B on synthetic instruction data with curriculum ordering' is already a 0.91-score precedent, they should know *before* the run starts. This is the deployment layer Adam wrote about: AI scores 77% on olympiad problems but 25% on open research, because the pipelines between 'I have an idea' and 'I'm running an experiment' don't exist. The five-source fan-out *is* that pipeline. We expose an MCP endpoint, so any agent — Claude, ChatGPT, or a research orchestrator — can call us directly. Apache 2.0, open data, stateless — your queries are private and the whole thing fits on a free Vercel tier."

---

## Beat 6 — The close (1:40–1:50)

> "Paste, rank, click. The five-source fan-out, in three seconds. Apache 2.0, open data, MCP endpoint live. We built this in 20 hours and it's running right now at [URL]. Try it — paste anything."

**On screen:** URL on the closing slide. Cursor back in the textarea, ready for judges to type.

---

## Q&A prep

**"Where does this fit with Litmus?"**
> Honestly: not yet. Litmus is wet-lab and v1 is AI/ML-scoped, so today we don't sit in front of a Litmus CRO run — pasting "fine-tune a 7B model" doesn't help anyone planning an enzyme assay. v1.1 swaps the source bundle to PubMed, bioRxiv, ChEMBL, Reaxys-open — same five-source fan-out, same MCP shape — and *that's* the version Litmus's agent can call as a CRO pre-flight ("has compound X inhibiting enzyme Y already been run?"). v2 wires a "submit closest gap to Litmus" button directly in the results panel. Today the integration story is the MCP endpoint itself: any agent can call it, and the architecture is shaped so the wet-lab swap is a source-list change, not a rewrite.

**"Why not a database / search index?"**
> Stateless is the feature. We get freshness for free — every query hits live APIs, so the moment a paper lands on arXiv, it's rankable. A pre-built index goes stale the day you ship it. And stateless means deterministic — same input, same output, same cache key. Anyone can re-run our eval set and get our numbers.

**"How is this different from Semantic Scholar's own search?"**
> S2's UI ranks by keyword + citation count. We rank by SPECTER2 embedding similarity to your full description, and we fuse four other sources S2 doesn't cover — Papers with Code experiments, OpenReview discussions, HF models. The fusion is the product.

**"What about wet-lab / non-AI papers?"**
> Out of scope for v1. The five sources are deliberately AI/ML-flavored — Papers with Code, OpenReview, Hugging Face don't help a chemistry researcher. Different vertical, different sources, same architecture.

**"Cost?"**
> ~$0.0001 per query for keyword extraction. Everything else is free APIs. The whole thing runs on Vercel free tier.

**"What's next if you win?"**
> Two things. First: a 24-hour async mode — paste once, get notified when something more similar lands on arXiv. Second: vertical splits — same architecture, different source bundles for biology, materials science, robotics.

---

## Demo prep checklist (run before stage)

- [ ] Prepared prompt (~150 words) in clipboard
- [ ] Server warm — run one query before the pitch so cache is hot
- [ ] Dev tools / network tab open in second window for the "source down" beat
- [ ] Backup screen recording of the demo in case live wifi fails
- [ ] URL on closing slide is the live, deployed one — not localhost
- [ ] Practiced twice end-to-end with a stopwatch
- [ ] **Eval numbers locked.** Whatever you say in Beat 1 (e.g. "84% top-3 on 50 examples") matches the actual `/eval` script output. Re-run it 30 min before stage.
- [ ] **MCP manifest reachable.** `GET /mcp/manifest.json` returns 200 — judges may check.
- [ ] **Repo is public.** GitHub link in README + closing slide. Apache 2.0 LICENSE file present.
- [ ] **Named term used 3+ times.** "Five-source fan-out" appears in Beats 2, 3, 5, and 6.

## Cuts if you're over time

- Drop Beat 4 (honest-math + graceful-degradation demo) → saves ~15 s, biggest cut. **Keep the determinism line and graft it onto Beat 5** ("...deterministic, MCP-callable, Apache 2.0...") — losing reproducibility entirely costs more than losing the throttle stunt.
- Drop Q&A-prep "what's next" answer → keep it to one sentence
- Skip the arXiv click-through in Beat 3
- **Never cut:** the Beat 1 number, the 77→25 deployment-gap framing in Beat 5 (Adam's exact thesis, in his exact words), or the "running right now" line in Beat 6. Those three carry the panel.
