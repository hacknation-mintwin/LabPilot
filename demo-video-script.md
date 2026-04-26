# Demo Video Script - Similarity Search Repo (Updated)

Audience: judges, hackathon reviewers, product-minded engineers  
Target length: 2:00-2:30  
Goal: show the current two-step flow: similarity search -> experiment plan

Named feature term (use 3+ times): **Expert Preflight**

---

## 0:00-0:20 - Hook

Voiceover:
> "Before teams spend a week on compute , they need one fast answer: has something close already been done, and what is the realistic execution plan? This app gives both in one run. We call it the **Expert Preflight**."

On screen:
- Open `onepager/` app home (`http://localhost:3000`)
- Cursor in prompt textarea
- Word counter visible (`0 / 200 words`)

---

## 0:20-0:55 - Step 1: Similarity search

Voiceover:
> "Step one of **Expert Preflight**: paste an experiment idea, hit Search, and the app fans out to five sources in parallel: Semantic Scholar, arXiv, Papers with Code, OpenReview, and Hugging Face."

On screen:
- Paste a prepared 120-170 word AI/ML experiment description
- Counter updates live
- Click `Search`
- Loading state: "Searching 5 sources..."
- Results list with visible 0-1 scores and source links

Line to emphasize:
> "Every result shows an explicit similarity score, rounded and visible. No hidden ranking."

---

## 0:55-1:30 - Step 2: Build a realistic plan

Voiceover:
> "Step two of **Expert Preflight**: generate a practical execution plan from the same query and retrieved context. The app returns protocol steps, materials, timeline, validation, and a deterministic budget."

On screen:
- Click the planning action in the UI
- Show staged loading messages
- Open plan tabs in order: `Protocol` -> `Materials` -> `Timeline` -> `Validation`
- Show KPI row (budget, weeks, materials count)

Line to emphasize:
> "Budget and timeline totals are computed server-side deterministically, not hallucinated."

---

## 1:30-1:55 - Reliability beat

Voiceover:
> "This stays robust in real usage: each source call has a timeout, failures become `partialErrors`, and one source being down does not kill the whole request."

On screen:
- Briefly show partial-errors banner state if available
- Show that results/plan still render
- Optional cutaway to server logs

---

## 1:55-2:20 - MCP + close

Voiceover:
> "And this is not only a UI. The repo ships an MCP server exposing `search_similar_experiments`, so assistants can run the same search flow as a tool. **Expert Preflight** is live, agent-ready, and open-source."

On screen:
- Open `mcp-server/README.md`
- Highlight tool name and `POST /search` contract
- Closing slide: live URL + repo URL

---

## Recording Checklist

- Warm start onepager server and run one test query before recording
- Keep one polished prompt in clipboard (120-170 words)
- Keep a fallback clip of the search+plan flow in case Wi-Fi is unstable
- Ensure no secrets are visible on screen (`.env`, API keys)
- If time is tight, cut the reliability beat but keep both **Expert Preflight** steps
