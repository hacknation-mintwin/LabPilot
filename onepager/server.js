import "dotenv/config";
import crypto from "node:crypto";
import express from "express";

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "example@example.com";
const S2_API_KEY = process.env.S2_API_KEY || "";

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

// Serve the one-pager
app.get("/", (_req, res) => {
  res.type("html").sendFile(new URL("./index.html", import.meta.url).pathname);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

