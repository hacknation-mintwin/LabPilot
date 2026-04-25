const DEFAULT_BASE_URL = process.env.SIMILARITY_SEARCH_BASE_URL || "http://localhost:3000";
const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.SIMILARITY_SEARCH_TIMEOUT_MS || "15000", 10);

export function normalizePrompt(prompt) {
  const normalized = String(prompt || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    throw new Error("Prompt cannot be empty.");
  }
  return normalized;
}

export function selectSourceBranch(refs) {
  const featureRef = "refs/remotes/origin/feature/experiment-similarity-onepager";
  const mainRef = "refs/remotes/origin/main";
  if (refs.includes(featureRef)) return "feature/experiment-similarity-onepager";
  if (refs.includes(mainRef)) return "main";
  throw new Error("No valid source branch found (expected feature/experiment-similarity-onepager or main).");
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Request timed out")), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

export function createSimilaritySearchClient({
  baseUrl = DEFAULT_BASE_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
} = {}) {
  const safeBaseUrl = String(baseUrl).replace(/\/+$/, "");

  return {
    async search({ prompt, topK = 10 }) {
      const normalizedPrompt = normalizePrompt(prompt);
      if (!Number.isInteger(topK) || topK < 1 || topK > 10) {
        throw new Error("topK must be an integer between 1 and 10.");
      }

      const { signal, clear } = createTimeoutSignal(timeoutMs);
      try {
        const response = await fetchImpl(`${safeBaseUrl}/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({ prompt: normalizedPrompt }),
          signal,
        });

        if (!response.ok) {
          let details = "";
          if (typeof response.text === "function") {
            details = await response.text();
          }
          throw new Error(
            `Similarity search request failed (${response.status} ${response.statusText || ""}). ${details}`.trim(),
          );
        }

        const payload = await response.json();
        const results = Array.isArray(payload?.results) ? payload.results.slice(0, topK) : [];
        return {
          cached: Boolean(payload?.cached),
          partialErrors: payload?.partialErrors && typeof payload.partialErrors === "object" ? payload.partialErrors : {},
          results,
        };
      } finally {
        clear();
      }
    },
  };
}
