import "dotenv/config";
import crypto from "node:crypto";
import express from "express";

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "example@example.com";
const S2_API_KEY = process.env.S2_API_KEY || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const PLAN_MODEL = process.env.PLAN_MODEL || "anthropic/claude-3.5-sonnet";
const FAST_MODEL = process.env.FAST_MODEL || "google/gemini-2.0-flash-001";

const app = express();
app.use(express.json({ limit: "64kb" }));

// ---- In-memory cache (10 min) ----
const CACHE_TTL_MS = 10 * 60 * 1000;
/** @type {Map<string, { expiresAt: number, value: any }>} */
const cache = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache.entries()) {
    if (v.expiresAt <= now) cache.delete(k);
  }
}, 60_000).unref();

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

// ---- HTTP helpers ----
function withTimeout(ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(new Error("timeout")), ms);
  return { signal: ac.signal, cancel: () => clearTimeout(t) };
}

async function fetchJson(url, { method = "GET", headers = {}, body, timeoutMs = 5000 } = {}) {
  const { signal, cancel } = withTimeout(timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "User-Agent": `ai-ml-experiment-similarity-onepager (contact: ${CONTACT_EMAIL})`,
        ...headers,
      },
      body,
      signal,
    });
    const text = await res.text();
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} ${res.statusText}`);
      err.status = res.status;
      err.url = url;
      err.body = text.slice(0, 500);
      throw err;
    }
    try {
      return text ? JSON.parse(text) : null;
    } catch (e) {
      const err = new Error(`Invalid JSON response`);
      err.url = url;
      err.body = text.slice(0, 500);
      throw err;
    }
  } finally {
    cancel();
  }
}

async function fetchText(url, { method = "GET", headers = {}, body, timeoutMs = 5000 } = {}) {
  const { signal, cancel } = withTimeout(timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "User-Agent": `ai-ml-experiment-similarity-onepager (contact: ${CONTACT_EMAIL})`,
        ...headers,
      },
      body,
      signal,
    });
    const text = await res.text();
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} ${res.statusText}`);
      err.status = res.status;
      err.url = url;
      err.body = text.slice(0, 500);
      throw err;
    }
    return text;
  } finally {
    cancel();
  }
}

// ---- Minimal keyword extraction (free; no paid LLM) ----
const STOPWORDS = new Set([
  "a","an","and","are","as","at","be","but","by","can","could","did","do","does","for","from","has","have","had",
  "how","i","if","in","into","is","it","its","may","might","more","most","of","on","or","our","should","so",
  "such","than","that","the","their","then","there","these","this","those","to","use","we","were","what","when",
  "where","which","who","will","with","without","you","your","they","them","also","using","via","based","within",
  "over","under","between","across","towards","toward","per","not"
]);

function extractTerms(prompt, { maxTerms = 10 } = {}) {
  const tokens = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => t.length >= 3 && t.length <= 30)
    .filter((t) => !STOPWORDS.has(t));

  /** @type {Map<string, number>} */
  const freq = new Map();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);

  // Add a few simple bi-grams (helps match dataset/method phrases)
  const bigrams = [];
  for (let i = 0; i < Math.min(tokens.length - 1, 120); i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (!a || !b) continue;
    if (STOPWORDS.has(a) || STOPWORDS.has(b)) continue;
    const bg = `${a} ${b}`;
    bigrams.push(bg);
  }
  const bgFreq = new Map();
  for (const bg of bigrams) bgFreq.set(bg, (bgFreq.get(bg) || 0) + 1);
  const bgSorted = [...bgFreq.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);

  const out = [];
  for (const t of bgSorted.slice(0, 4)) out.push(t);
  for (const t of sorted) {
    if (out.length >= maxTerms) break;
    if (!out.includes(t)) out.push(t);
  }
  return out.slice(0, maxTerms);
}

// ---- Math: cosine similarity + clamp to [0,1] ----
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
function norm(a) {
  return Math.sqrt(dot(a, a));
}
function cosineSim(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  return dot(a, b) / (na * nb);
}
function cosineTo01(cos) {
  // Map [-1,1] -> [0,1], clamp.
  const x = (cos + 1) / 2;
  return Math.max(0, Math.min(1, x));
}

// ---- Source clients ----
const S2_BASE = "https://api.semanticscholar.org/graph/v1";

function s2Headers() {
  const h = { "Accept": "application/json" };
  if (S2_API_KEY) h["x-api-key"] = S2_API_KEY;
  return h;
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchJsonWithRetry(url, opts, { retries = 2 } = {}) {
  let attempt = 0;
  // Retry only on rate limiting / transient upstream failures.
  while (true) {
    try {
      return await fetchJson(url, opts);
    } catch (e) {
      const status = e?.status;
      attempt++;
      const canRetry = attempt <= retries && (status === 429 || status === 503 || status === 502);
      if (!canRetry) throw e;
      const backoff = 250 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 150);
      await sleep(backoff);
    }
  }
}

// Extracts a vector from S2's embedding payload (handles both v2 and v1 shapes).
function getEmbeddingVector(p) {
  const e = p?.embedding;
  if (Array.isArray(e?.specter_v2) && e.specter_v2.length) return e.specter_v2;
  if (Array.isArray(e?.vector) && e.vector.length) return e.vector;
  return null;
}

async function semanticScholarSearch(terms) {
  // Use S2 as ranking spine. Request SPECTER2 *and* default (v1) embeddings;
  // in practice v1 is populated for nearly all papers while v2 is sparse.
  const query = terms.length ? terms.join(" ") : "";
  const fields = [
    "title",
    "abstract",
    "authors",
    "year",
    "venue",
    "url",
    "externalIds",
    "openAccessPdf",
    "embedding",
    "embedding.specter_v2",
  ].join(",");

  const url = new URL(`${S2_BASE}/paper/search`);
  url.searchParams.set("query", query);
  // Smaller pages are noticeably faster from S2 (and the candidate pool is
  // already plenty for ranking).
  url.searchParams.set("limit", "30");
  url.searchParams.set("fields", fields);

  // S2 is the ranking spine — give it a more generous budget than the other
  // best-effort sources. (Other sources stay at 5s per the original spec.)
  const json = await fetchJsonWithRetry(url.toString(), { headers: s2Headers(), timeoutMs: 10000 }, { retries: 2 });
  const data = Array.isArray(json?.data) ? json.data : [];
  return data;
}

async function semanticScholarQueryEmbedding(prompt) {
  // /paper/search/match is title-match only; works only for prompts that look
  // like a paper title. We still try it (fast happy path), then caller falls
  // back to mean-of-top-K candidate embeddings.
  const fields = "embedding,embedding.specter_v2";
  const url = new URL(`${S2_BASE}/paper/search/match`);
  url.searchParams.set("query", prompt);
  url.searchParams.set("fields", fields);
  const json = await fetchJsonWithRetry(url.toString(), { headers: s2Headers(), timeoutMs: 8000 }, { retries: 1 });
  const data = Array.isArray(json?.data) ? json.data[0] : json;
  const vec = getEmbeddingVector(data);
  if (vec) return vec;
  throw new Error("No embedding returned from Semantic Scholar match.");
}

function parseArxivAtom(xml) {
  // Minimal Atom parsing by regex (keeps deps at zero). Good enough for v1.
  const entries = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = entryRe.exec(xml))) {
    const e = m[1];
    const get = (re) => (re.exec(e)?.[1] || "").trim();
    const id = get(/<id>([\s\S]*?)<\/id>/);
    const title = get(/<title>([\s\S]*?)<\/title>/).replace(/\s+/g, " ").trim();
    const summary = get(/<summary>([\s\S]*?)<\/summary>/).replace(/\s+/g, " ").trim();
    const published = get(/<published>([\s\S]*?)<\/published>/);
    const year = published ? Number.parseInt(published.slice(0, 4), 10) : undefined;

    const pdfHref = /<link[^>]*title="pdf"[^>]*href="([^"]+)"/.exec(e)?.[1];
    const absHref = /<link[^>]*rel="alternate"[^>]*href="([^"]+)"/.exec(e)?.[1];

    const authors = [];
    const authorRe = /<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g;
    let am;
    while ((am = authorRe.exec(e))) authors.push(am[1].trim());

    const arxivId = (id || "").replace(/^https?:\/\/arxiv\.org\/abs\//, "");
    entries.push({
      source: "arxiv",
      arxivId: arxivId || undefined,
      title,
      abstract: summary || undefined,
      year,
      authors,
      links: {
        arxiv: absHref || (arxivId ? `https://arxiv.org/abs/${arxivId}` : undefined),
        pdf: pdfHref || (arxivId ? `https://arxiv.org/pdf/${arxivId}.pdf` : undefined),
      },
    });
  }
  return entries;
}

async function arxivSearch(terms) {
  const q = terms.length ? terms.map((t) => `"${t}"`).join(" OR ") : "";
  const url = new URL("http://export.arxiv.org/api/query");
  url.searchParams.set("search_query", q || "all:machine learning");
  url.searchParams.set("start", "0");
  url.searchParams.set("max_results", "40");
  url.searchParams.set("sortBy", "relevance");

  const xml = await fetchText(url.toString(), { timeoutMs: 5000 });
  return parseArxivAtom(xml);
}

async function papersWithCodeSearch(terms) {
  // Best-effort. PWC sometimes serves an HTML WAF page even for /api/v1/...
  // — we tolerate that quietly by returning [] instead of bubbling up an error.
  const q = terms.slice(0, 5).join(" ");
  const url = new URL("https://paperswithcode.com/api/v1/papers/");
  url.searchParams.set("q", q || "machine learning");
  url.searchParams.set("page", "1");
  try {
    const json = await fetchJson(url.toString(), {
      timeoutMs: 5000,
      headers: { "Accept": "application/json" },
    });
    const results = Array.isArray(json?.results) ? json.results : [];
    return results.map((r) => ({
      source: "pwc",
      title: r.title,
      url: r.url_abs || r.url || undefined,
      arxivId: r.arxiv_id || undefined,
      paperUrl: r.paper_url || undefined,
    }));
  } catch {
    return [];
  }
}

async function openReviewSearch(terms) {
  // Use OpenReview's elasticsearch-backed notes search endpoint.
  const q = terms.slice(0, 6).join(" ");
  const url = new URL("https://api.openreview.net/notes/search");
  url.searchParams.set("limit", "50");
  url.searchParams.set("offset", "0");
  url.searchParams.set("term", q || "machine learning");
  const json = await fetchJson(url.toString(), { timeoutMs: 5000 });
  const notes = Array.isArray(json?.notes) ? json.notes : [];
  return notes.map((n) => ({
    source: "openreview",
    id: n.id,
    title: n?.content?.title?.value || n?.content?.title || "",
    venue: n?.content?.venue?.value || n?.content?.venue || undefined,
    year: n?.cdate ? new Date(n.cdate).getUTCFullYear() : undefined,
    url: n?.id ? `https://openreview.net/forum?id=${n.id}` : undefined,
  }));
}

async function huggingFaceSearch(terms) {
  // Best-effort: search both models and datasets.
  const q = encodeURIComponent(terms.slice(0, 6).join(" ") || "machine learning");
  const modelsUrl = `https://huggingface.co/api/models?search=${q}&limit=10`;
  const datasetsUrl = `https://huggingface.co/api/datasets?search=${q}&limit=10`;

  const [models, datasets] = await Promise.all([
    fetchJson(modelsUrl, { timeoutMs: 5000 }),
    fetchJson(datasetsUrl, { timeoutMs: 5000 }),
  ]);

  const modelOut = Array.isArray(models)
    ? models.map((m) => ({ id: m.id, url: `https://huggingface.co/${m.id}` }))
    : [];
  const datasetOut = Array.isArray(datasets)
    ? datasets.map((d) => ({ id: d.id, url: `https://huggingface.co/datasets/${d.id}` }))
    : [];

  return { models: modelOut, datasets: datasetOut };
}

// ---- Candidate normalization / dedupe ----
function normTitle(t) {
  return (t || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function candidateKeyFromS2(p) {
  const ext = p?.externalIds || {};
  const doi = ext?.DOI || ext?.doi;
  const arxiv = ext?.ArXiv || ext?.arXiv || ext?.arxiv;
  const corpus = ext?.CorpusId || ext?.corpusId;
  if (doi) return `doi:${String(doi).toLowerCase()}`;
  if (arxiv) return `arxiv:${String(arxiv).toLowerCase()}`;
  if (p?.paperId) return `s2:${p.paperId}`;
  if (corpus) return `corpus:${corpus}`;
  return `title:${normTitle(p?.title)}`;
}

// ---- Enrichment helpers (best-effort) ----
async function enrichTop10(top, { pwcResults, openreviewNotes, hf }) {
  // Build indices
  const pwcByArxiv = new Map();
  for (const r of pwcResults || []) {
    if (r?.arxivId) pwcByArxiv.set(String(r.arxivId).toLowerCase(), r);
  }
  const openByNormTitle = new Map();
  for (const n of openreviewNotes || []) {
    const k = normTitle(n.title);
    if (k) openByNormTitle.set(k, n);
  }

  return top.map((x) => {
    const arxivId = x.externalIds?.ArXiv || x.externalIds?.arXiv || x.externalIds?.arxiv;
    const pwc = arxivId ? pwcByArxiv.get(String(arxivId).toLowerCase()) : undefined;
    const or = openByNormTitle.get(normTitle(x.title));

    const out = {
      paperId: x.paperId,
      title: x.title,
      authors: Array.isArray(x.authors) ? x.authors.map((a) => a?.name).filter(Boolean) : [],
      year: x.year || null,
      venue: x.venue || null,
      abstract: x.abstract || null,
      externalIds: x.externalIds || {},
      links: {
        semanticScholar: x.url || (x.paperId ? `https://www.semanticscholar.org/paper/${x.paperId}` : undefined),
        arxiv: arxivId ? `https://arxiv.org/abs/${arxivId}` : undefined,
        pdf: x.openAccessPdf?.url || (arxivId ? `https://arxiv.org/pdf/${arxivId}.pdf` : undefined),
        pwc: pwc?.url || pwc?.paperUrl || undefined,
        openreview: or?.url,
        hfModels: hf?.models?.length ? hf.models[0].url : undefined,
        hfDatasets: hf?.datasets?.length ? hf.datasets[0].url : undefined,
      },
      structured: {
        pwc: pwc || null,
        openreview: or || null,
        hf: hf || { models: [], datasets: [] },
      },
      similarity: x.similarity,
    };
    return out;
  });
}

// ---- API: POST /search ----
app.post("/search", async (req, res) => {
  const prompt = String(req.body?.prompt || "").trim();
  if (!prompt) return res.status(400).json({ error: "Missing prompt." });

  // Stateless: never persist prompt; cache is by hash only.
  const cacheKey = sha256(prompt.toLowerCase().replace(/\s+/g, " ").trim());
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ cached: true, results: cached.value.results, partialErrors: cached.value.partialErrors });
  }

  const terms = extractTerms(prompt, { maxTerms: 10 });

  // Step 2: Parallel fan-out (all 5 sources in parallel; each best-effort)
  const safe = async (name, fn) => {
    try {
      return { ok: true, name, data: await fn() };
    } catch (e) {
      return { ok: false, name, error: String(e?.message || e) };
    }
  };

  const [s2, arxiv, pwc, or, hf] = await Promise.all([
    safe("semantic_scholar", () => semanticScholarSearch(terms)),
    safe("arxiv", () => arxivSearch(terms)),
    safe("papers_with_code", () => papersWithCodeSearch(terms)),
    safe("openreview", () => openReviewSearch(terms)),
    safe("huggingface", () => huggingFaceSearch(terms)),
  ]);

  /** @type {Record<string, string>} */
  const partialErrors = {};
  for (const r of [s2, arxiv, pwc, or, hf]) {
    if (!r.ok) partialErrors[r.name] = r.error;
  }

  // Step 2b: Candidate pool from S2 (ranking requires S2, per spec)
  const candidatesRaw = s2.ok ? s2.data : [];
  const seen = new Set();
  const candidates = [];
  for (const p of candidatesRaw) {
    const vec = getEmbeddingVector(p);
    if (!vec) continue;
    const key = candidateKeyFromS2(p);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    candidates.push(p);
  }

  // Step 3: Prompt embedding.
  // Primary path: title-match endpoint (fast, works when prompt is title-like).
  // Fallback: mean of the top-K most-relevant S2 candidate embeddings (their relevance
  // ranker has already ordered the pool — this gives us a robust query vector).
  let queryVec = null;
  try {
    queryVec = await semanticScholarQueryEmbedding(prompt);
  } catch {
    if (candidates.length) {
      const topFew = candidates.slice(0, 5);
      const dim = getEmbeddingVector(topFew[0]).length;
      const mean = new Array(dim).fill(0);
      for (const p of topFew) {
        const v = getEmbeddingVector(p);
        for (let i = 0; i < dim; i++) mean[i] += v[i];
      }
      for (let i = 0; i < dim; i++) mean[i] /= topFew.length;
      queryVec = mean;
    } else {
      return res.json({
        cached: false,
        results: [],
        partialErrors: {
          ...partialErrors,
          prompt_embedding:
            "Unable to embed prompt: Semantic Scholar match returned no embedding and no candidate papers had embeddings either.",
        },
      });
    }
  }

  // Step 4: Score + rank (cosine -> [0,1])
  const scored = candidates.map((p) => {
    const vec = getEmbeddingVector(p);
    const cos = cosineSim(queryVec, vec);
    const sim01 = cosineTo01(cos);
    return {
      ...p,
      similarity: Number(sim01.toFixed(3)),
    };
  });
  scored.sort((a, b) => b.similarity - a.similarity);
  const top10 = scored.slice(0, 10);

  // Step 5: Enrich (best-effort; no additional sequential fanout required)
  const enriched = await enrichTop10(top10, {
    pwcResults: pwc.ok ? pwc.data : [],
    openreviewNotes: or.ok ? or.data : [],
    hf: hf.ok ? hf.data : { models: [], datasets: [] },
  });

  const payload = { cached: false, results: enriched, partialErrors };
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: payload });
  return res.json(payload);
});

// =====================================================================
// Experiment plan generation (Fulcrum Challenge 04)
// =====================================================================

// ---- OpenRouter LLM client (fetch-only, no SDK) ----
async function openrouterChat({ model, system, user, jsonMode = true, temperature = 0.2, timeoutMs = 60000 }) {
  if (!OPENROUTER_API_KEY) {
    const err = new Error("OPENROUTER_API_KEY is not set in onepager/.env");
    err.status = 500;
    throw err;
  }
  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature,
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const json = await fetchJson(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "AI/ML Experiment Plan Generator",
    },
    body: JSON.stringify(body),
    timeoutMs,
  });
  const content = json?.choices?.[0]?.message?.content || "";
  return content;
}

// Robust JSON parse: strips ```json fences if a model emits them despite json_object mode.
function parseJsonLoose(text) {
  if (!text) throw new Error("Empty model response");
  const trimmed = String(text).trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  // Some models emit a leading prose; try to find the first { ... last }.
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  const candidate = first >= 0 && last > first ? trimmed.slice(first, last + 1) : trimmed;
  return JSON.parse(candidate);
}

async function chatJson(opts) {
  const text = await openrouterChat({ ...opts, jsonMode: true });
  try {
    return parseJsonLoose(text);
  } catch (e) {
    // Single retry with a stricter nudge.
    const retried = await openrouterChat({
      ...opts,
      user: `${opts.user}\n\nIMPORTANT: Your previous response could not be parsed as JSON. Output ONLY a single JSON object, no prose, no code fences.`,
      jsonMode: true,
    });
    return parseJsonLoose(retried);
  }
}

// ---- Stage 1: domain + frame extraction (cheap model) ----
async function extractFrame(prompt) {
  const system = `You extract the experimental frame from a scientist's hypothesis.
Return ONLY a JSON object with this shape:
{
  "hypothesis": "<one-sentence restatement>",
  "intervention": "<the thing being tried>",
  "outcome": "<what is measured>",
  "model_system": "<organism/cell line/material/system>",
  "controls": "<the control condition>",
  "threshold": "<numeric success criterion if stated, else null>",
  "domain": "<one of: diagnostics | gut_health | cell_biology | climate | ai_ml | chemistry | materials | neuroscience | pharma | other>",
  "keywords": ["<3-8 short search keywords>"]
}`;
  return await chatJson({ model: FAST_MODEL, system, user: prompt, timeoutMs: 60000 });
}

// ---- Stage 2: RAG — protocols.io best-effort search ----
// protocols.io exposes a public read API at /api/v3/protocols. It does not
// require auth for public protocols. Fields we keep are minimal.
async function protocolsIoSearch(terms) {
  if (!terms || !terms.length) return [];
  const q = terms.slice(0, 5).join(" ");
  const url = new URL("https://www.protocols.io/api/v3/protocols");
  url.searchParams.set("filter", "public");
  url.searchParams.set("order_field", "relevance");
  url.searchParams.set("order_dir", "desc");
  url.searchParams.set("page_size", "5");
  url.searchParams.set("key", q);
  try {
    const json = await fetchJson(url.toString(), { timeoutMs: 5000 });
    const items = Array.isArray(json?.items) ? json.items : Array.isArray(json?.data) ? json.data : [];
    return items.slice(0, 5).map((p) => ({
      title: String(p.title || p.protocol?.title || "").trim(),
      url: p.uri || p.url || (p.id ? `https://www.protocols.io/view/${p.id}` : undefined),
      authors: (p.creator?.name || p.authors || "").toString(),
      description: String(p.description || p.protocol?.description || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 600),
    })).filter((p) => p.title);
  } catch {
    return [];
  }
}

// ---- Stage 3: plan generation (strong model, schema-constrained) ----
const PLAN_SCHEMA_HINT = `{
  "summary": "<1-paragraph plain-English overview of what will be done and why>",
  "frame": {
    "hypothesis": "string", "intervention": "string", "outcome": "string",
    "model_system": "string", "controls": "string", "threshold": "string"
  },
  "protocol": [
    {
      "step": 1,
      "title": "string (≤80 chars, imperative)",
      "duration_hours": <number>,
      "reagents": ["material_id", ...],         /* IDs that match materials[].id */
      "equipment": ["string", ...],
      "instructions": "string (3–6 sentences, concrete enough to execute)",
      "source": { "name": "protocols.io | bio-protocol | published paper | <other>", "url": "https://..." }
    }
    /* AT LEAST 5 steps, in execution order */
  ],
  "materials": [
    {
      "id": "M01",                              /* M01..Mnn */
      "category": "reagent | consumable | equipment | service",
      "name": "string",
      "supplier": "Sigma-Aldrich | Thermo Fisher | IDT | Promega | Qiagen | Addgene | ATCC | Bio-Rad | NEB | <other>",
      "catalog_number": "string (real catalog #; never invented)",
      "pack_size": "string (e.g. '100 µg', '500 mL')",
      "quantity": <number>,                      /* number of packs needed */
      "unit_cost_gbp": <number>,                 /* GBP per pack; realistic */
      "url": "string (supplier URL or search URL by catalog number)"
    }
    /* AT LEAST 8 line items */
  ],
  "budget": {
    "currency": "GBP",
    "fte": <number>,                             /* full-time equivalents on the project */
    "day_rate_gbp": <number>,                    /* default 480 if unsure */
    "contingency_pct": <number>                  /* default 15 */
    /* labour, totals, and per-category breakdowns are computed server-side; do not invent them */
  },
  "timeline": {
    "phases": [
      {
        "name": "Setup | Execution | Analysis | <other>",
        "duration_weeks": <number>,
        "depends_on": ["<other phase name>", ...]   /* DAG, no cycles */
      }
      /* AT LEAST 3 phases */
    ]
  },
  "validation": {
    "primary_endpoint": "string",
    "statistical_test": "string (e.g. 'Two-sided Mann-Whitney U', 't-test', 'ANOVA')",
    "sample_size": <number>,
    "power": <number>,                          /* 0–1, default 0.8 */
    "alpha": <number>,                          /* default 0.05 */
    "success_criteria": ["string", ...],        /* concrete, measurable */
    "failure_modes": ["string", ...]
  },
  "risks": [
    { "risk": "string", "severity": "low | med | high", "mitigation": "string" }
  ]
}`;

function buildPlanGroundingBlock({ retrievals, qcRefs }) {
  const sections = [];

  if (retrievals?.protocols?.length) {
    const lines = retrievals.protocols.map(
      (p, i) => `[P${i + 1}] ${p.title}\n     ${p.url || ""}\n     ${p.description || ""}`,
    );
    sections.push(`PROTOCOLS.IO RESULTS (cite as P1..Pn in protocol[].source):\n${lines.join("\n")}`);
  }

  if (qcRefs?.length) {
    const lines = qcRefs.map((r, i) => {
      const meta = [r.year, r.venue].filter(Boolean).join(", ");
      const url = r.links?.semanticScholar || r.links?.arxiv || r.links?.pdf || "";
      const abs = (r.abstract || "").replace(/\s+/g, " ").trim().slice(0, 400);
      return `[Q${i + 1}] ${r.title || "(untitled)"} (${meta})\n     ${url}\n     ${abs}`;
    });
    sections.push(`PRIOR WORK (literature QC; cite as Q1..Qn when relevant):\n${lines.join("\n")}`);
  }

  return sections.length ? sections.join("\n\n") : "(no external grounding available; rely on training knowledge but be conservative)";
}

async function generatePlan({ prompt, frame, retrievals, qcRefs }) {
  const grounding = buildPlanGroundingBlock({ retrievals, qcRefs });
  const system = `You are a senior PI writing an operationally realistic experiment plan that a CRO scientist could pick up on Monday and run by Friday.

OUTPUT RULES (non-negotiable):
1. Output ONLY a single JSON object — no prose, no code fences, no commentary.
2. Match this schema exactly (field names, types, structure):
${PLAN_SCHEMA_HINT}
3. Use REAL supplier catalog numbers from your training data — Sigma-Aldrich, Thermo Fisher, IDT, Promega, Qiagen, Addgene, ATCC, Bio-Rad, NEB. NEVER invent catalog numbers.
4. If unsure of a catalog number, omit that material rather than fabricate one.
5. URLs for materials should resolve. If you don't have a direct product URL, use the supplier's search URL with the catalog number, e.g. "https://www.sigmaaldrich.com/US/en/search/<catalog>".
6. Every protocol step's "source" must reference one of the provided P# / Q# entries when applicable, or a well-known public protocol/paper URL otherwise.
7. Quantities and unit costs must be realistic for an academic / small-CRO budget. Prices in GBP.
8. Do NOT compute totals or labour. Server computes those deterministically.
9. Reagent IDs in protocol[].reagents MUST match materials[].id strings.
10. timeline.phases must form a DAG (no cycles); use depends_on to express order.

QUALITY BAR: would a real PI trust this plan enough to order materials from it?`;

  const user = `HYPOTHESIS:
${prompt}

EXTRACTED FRAME:
${JSON.stringify(frame, null, 2)}

GROUNDING:
${grounding}

Now produce the JSON plan.`;

  return await chatJson({ model: PLAN_MODEL, system, user, timeoutMs: 240000, temperature: 0.2 });
}

// ---- Stage 4: deterministic post-processing (NEVER trust the LLM with arithmetic) ----
function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function computeMaterials(plan) {
  const materials = Array.isArray(plan?.materials) ? plan.materials : [];
  for (const m of materials) {
    const qty = num(m.quantity, 0);
    const unit = num(m.unit_cost_gbp, 0);
    m.quantity = qty;
    m.unit_cost_gbp = Math.round(unit * 100) / 100;
    m.line_cost_gbp = Math.round(qty * unit * 100) / 100;
    m.category = ["reagent", "consumable", "equipment", "service"].includes(m.category) ? m.category : "consumable";
  }
  return materials;
}

function computeTimeline(plan) {
  const rawPhases = Array.isArray(plan?.timeline?.phases) ? plan.timeline.phases : [];
  const phases = rawPhases.map((p) => ({
    name: String(p.name || "Phase").trim(),
    duration_weeks: Math.max(0, num(p.duration_weeks, 0)),
    depends_on: Array.isArray(p.depends_on) ? p.depends_on.map(String) : [],
    start_week: 0,
    end_week: 0,
  }));

  const byName = new Map(phases.map((p) => [p.name, p]));

  // Topological pass with cycle detection.
  const visiting = new Set();
  const done = new Set();
  let hasCycle = false;
  const order = [];
  function visit(name) {
    if (done.has(name) || hasCycle) return;
    if (visiting.has(name)) {
      hasCycle = true;
      return;
    }
    visiting.add(name);
    const node = byName.get(name);
    if (node) {
      for (const dep of node.depends_on) if (byName.has(dep)) visit(dep);
    }
    visiting.delete(name);
    done.add(name);
    order.push(name);
  }
  for (const p of phases) visit(p.name);

  if (hasCycle) {
    // Linear fallback if the model emitted a cycle.
    let cursor = 0;
    for (const p of phases) {
      p.start_week = cursor;
      p.end_week = cursor + p.duration_weeks;
      cursor = p.end_week;
    }
  } else {
    for (const name of order) {
      const node = byName.get(name);
      if (!node) continue;
      let start = 0;
      for (const dep of node.depends_on) {
        const depNode = byName.get(dep);
        if (depNode) start = Math.max(start, depNode.end_week);
      }
      node.start_week = start;
      node.end_week = start + node.duration_weeks;
    }
  }

  const total_weeks = phases.reduce((acc, p) => Math.max(acc, p.end_week), 0);
  return { unit: "weeks", total_weeks, phases, cycle_detected: hasCycle };
}

function computeBudget(plan) {
  const materials = Array.isArray(plan?.materials) ? plan.materials : [];

  const byCategory = { reagent: 0, consumable: 0, equipment: 0, service: 0 };
  for (const m of materials) {
    const c = m.category in byCategory ? m.category : "consumable";
    byCategory[c] = Math.round((byCategory[c] + num(m.line_cost_gbp, 0)) * 100) / 100;
  }
  const materialsSubtotal = Math.round(Object.values(byCategory).reduce((a, b) => a + b, 0) * 100) / 100;

  const totalWeeks = num(plan?.timeline?.total_weeks, 0);
  const fte = Math.max(0.1, num(plan?.budget?.fte, 1));
  const dayRate = Math.max(0, num(plan?.budget?.day_rate_gbp, 480));
  const workingDays = totalWeeks * 5;
  const labour = Math.round(fte * dayRate * workingDays);

  const subtotal = Math.round((materialsSubtotal + labour) * 100) / 100;
  const contingencyPct = Math.min(50, Math.max(0, num(plan?.budget?.contingency_pct, 15)));
  const contingency = Math.round(subtotal * (contingencyPct / 100));
  const total = Math.round(subtotal + contingency);

  // Per-phase split, prorated by phase duration.
  const phases = Array.isArray(plan?.timeline?.phases) ? plan.timeline.phases : [];
  const totalPhaseDuration = phases.reduce((a, p) => a + num(p.duration_weeks, 0), 0);
  const phaseBreakdown = {};
  for (const p of phases) {
    const frac = totalPhaseDuration ? num(p.duration_weeks, 0) / totalPhaseDuration : 0;
    phaseBreakdown[p.name] = Math.round(subtotal * frac);
  }

  return {
    currency: "GBP",
    fte,
    day_rate_gbp: dayRate,
    contingency_pct: contingencyPct,
    categories: { ...byCategory, labour },
    phases: phaseBreakdown,
    materials_subtotal: materialsSubtotal,
    labour_subtotal: labour,
    contingency,
    subtotal,
    total,
  };
}

function collectCitations(plan, qcRefs) {
  const seen = new Map();
  const add = (entry) => {
    if (!entry || !entry.url) return;
    const key = String(entry.url);
    if (seen.has(key)) return;
    seen.set(key, entry);
  };

  for (const step of plan?.protocol || []) {
    if (step?.source) add({ name: step.source.name || "Source", url: step.source.url, title: step.title });
  }
  for (const m of plan?.materials || []) {
    if (m?.url) add({ name: m.supplier || "Supplier", url: m.url, title: `${m.name} (${m.catalog_number || "—"})` });
  }
  for (const r of qcRefs || []) {
    const url = r?.links?.semanticScholar || r?.links?.arxiv || r?.links?.pdf;
    if (url) add({ name: "Semantic Scholar", url, title: r.title });
  }
  return [...seen.values()];
}

function sanityValidate(plan) {
  const issues = [];
  const protocol = Array.isArray(plan?.protocol) ? plan.protocol : [];
  const materials = Array.isArray(plan?.materials) ? plan.materials : [];
  if (protocol.length < 3) issues.push("Protocol has fewer than 3 steps.");
  if (materials.length < 4) issues.push("Materials list has fewer than 4 line items.");
  if (plan?.budget?.total > 1_000_000) issues.push("Budget exceeds £1,000,000 — likely hallucinated.");
  if (plan?.timeline?.total_weeks > 104) issues.push("Timeline exceeds 104 weeks — likely hallucinated.");

  // Cross-reference reagent IDs in protocol against materials[].id
  const matIds = new Set(materials.map((m) => m.id).filter(Boolean));
  const danglingRefs = new Set();
  for (const step of protocol) {
    for (const r of step?.reagents || []) if (!matIds.has(r)) danglingRefs.add(r);
  }
  if (danglingRefs.size) issues.push(`Protocol references reagents not in materials list: ${[...danglingRefs].join(", ")}`);

  return issues;
}

// ---- POST /plan ----
app.post("/plan", async (req, res) => {
  const prompt = String(req.body?.prompt || "").trim();
  if (!prompt) return res.status(400).json({ error: "Missing prompt." });
  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "OPENROUTER_API_KEY is not set in onepager/.env. Add it and restart." });
  }

  const qcRefs = Array.isArray(req.body?.qcReferences) ? req.body.qcReferences.slice(0, 3) : [];

  const cacheKey = sha256(
    "plan:" +
      prompt.toLowerCase().replace(/\s+/g, " ").trim() +
      ":" +
      qcRefs.map((r) => r?.paperId || r?.title || "").join("|"),
  );
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ cached: true, ...cached.value });
  }

  /** @type {Record<string, string>} */
  const partialErrors = {};

  // 1. Frame extraction (best-effort: if it fails, fall back to a stub)
  let frame;
  try {
    frame = await extractFrame(prompt);
  } catch (e) {
    partialErrors.frame_extraction = String(e?.message || e);
    frame = { hypothesis: prompt, domain: "other", keywords: extractTerms(prompt, { maxTerms: 6 }) };
  }

  // 2. RAG (best-effort, parallel, 5s budgets)
  const terms = Array.isArray(frame?.keywords) && frame.keywords.length
    ? frame.keywords.slice(0, 8)
    : extractTerms(prompt, { maxTerms: 8 });

  const safe = async (name, fn) => {
    try {
      return { ok: true, name, data: await fn() };
    } catch (e) {
      return { ok: false, name, error: String(e?.message || e) };
    }
  };
  const [protocols] = await Promise.all([safe("protocols_io", () => protocolsIoSearch(terms))]);
  for (const r of [protocols]) if (!r.ok) partialErrors[r.name] = r.error;

  const retrievals = { protocols: protocols.ok ? protocols.data : [] };

  // 3. Plan generation (the one expensive LLM call)
  let plan;
  try {
    plan = await generatePlan({ prompt, frame, retrievals, qcRefs });
  } catch (e) {
    return res.status(502).json({
      error: "Plan generation failed: " + String(e?.message || e),
      partialErrors,
    });
  }

  // 4. Deterministic post-processing
  plan.materials = computeMaterials(plan);
  plan.timeline = computeTimeline(plan);
  plan.budget = { ...(plan.budget || {}), ...computeBudget(plan) };
  plan.citations = collectCitations(plan, qcRefs);

  const issues = sanityValidate(plan);
  if (issues.length) partialErrors.sanity = issues.join(" | ");

  const payload = { cached: false, plan, partialErrors };
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: payload });
  return res.json(payload);
});

// Serve the one-pager
app.get("/", (_req, res) => {
  res.type("html").sendFile(new URL("./index.html", import.meta.url).pathname);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

