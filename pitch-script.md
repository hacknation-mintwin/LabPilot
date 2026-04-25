# Pitch Script — AI/ML Experiment Similarity Search

A 90-second spoken pitch + live demo. Time-boxed, beat-by-beat. Practice it twice before stage.

---

## Beat 1 — The hook (0:00–0:15)

> "Every AI/ML researcher has had this moment: you're about to start a new experiment, you spend a week setting it up, you run it — and only then do you find out four other teams already did the same thing last quarter. The fix isn't more papers. It's faster lookup."

**On screen:** the one-pager, empty textarea, cursor blinking.

---

## Beat 2 — What it is (0:15–0:30)

> "This is a single page. You paste up to 200 words describing the experiment you want to run. You get back the 10 most similar prior experiments from the AI/ML literature, ranked, with similarity scores you can see — and direct links to arXiv, Papers with Code, OpenReview, and Hugging Face."

**On screen:** highlight the word counter ticking up as you paste.

---

## Beat 3 — Live demo (0:30–1:10)

> "Watch. I'm pasting a real description — fine-tuning a 7B model on synthetic instruction data, evaluating on MT-Bench, curriculum-ordered data..."

**Action:** paste the prepared 150-word prompt. Counter shows `147 / 200 words`. Click Search.

> "Behind that button, we're hitting five sources in parallel — Semantic Scholar, arXiv, Papers with Code, OpenReview, Hugging Face. We pull SPECTER2 embeddings, score every candidate by cosine similarity to your query, and rank."

**On screen:** loading state, "Searching 5 sources..." → results in ~3 seconds.

> "Top result: Self-Instruct, score 0.91. Second: Alpaca, 0.89. Every score is visible. Every link is live. Click through —"

**Action:** click the arXiv link on result #1, snap back.

---

## Beat 4 — The "honest math" beat (1:10–1:25)

> "Two things every other tool gets wrong. First: they hide the score. We show it — zero to one, three decimals, no theater. Second: they fall over when one source is slow."

**Action:** open dev tools, throttle one API to fail. Resubmit.

> "OpenReview is down. We still return 10 results — just without OpenReview badges. One source down never breaks the whole request."

---

## Beat 5 — Why this, why now (1:25–1:40)

> "No database. No accounts. No history stored. Stateless by design — your queries are private, and the entire app fits on a free Vercel tier. We're not building a platform. We're building the bookmarks-bar tool every ML researcher should have already had."

---

## Beat 6 — The close (1:40–1:50)

> "Paste, rank, click. That's the whole product. The first thirty seconds of every literature review, compressed into three. Try it: [URL]."

**On screen:** URL on the closing slide. Cursor back in the textarea, ready for judges to type.

---

## Q&A prep

**"Why not a database / search index?"**
> Stateless is the feature. We get freshness for free — every query hits live APIs, so the moment a paper lands on arXiv, it's rankable. A pre-built index goes stale the day you ship it.

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

## Cuts if you're over time

- Drop Beat 4 (honest-math + graceful-degradation demo) → saves ~15 s, biggest cut
- Drop Q&A-prep "what's next" answer → keep it to one sentence
- Skip the arXiv click-through in Beat 3
