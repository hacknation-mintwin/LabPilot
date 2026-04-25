import test from "node:test";
import assert from "node:assert/strict";

import {
  createSimilaritySearchClient,
  normalizePrompt,
  selectSourceBranch,
} from "../src/search-client.js";

test("normalizePrompt collapses whitespace", () => {
  assert.equal(
    normalizePrompt("  test   prompt \n with   spaces "),
    "test prompt with spaces",
  );
});

test("normalizePrompt rejects empty prompt", () => {
  assert.throws(() => normalizePrompt("   "), /cannot be empty/);
});

test("selectSourceBranch prefers feature branch", () => {
  const selected = selectSourceBranch([
    "refs/remotes/origin/main",
    "refs/remotes/origin/feature/experiment-similarity-onepager",
  ]);
  assert.equal(selected, "feature/experiment-similarity-onepager");
});

test("selectSourceBranch falls back to main", () => {
  const selected = selectSourceBranch(["refs/remotes/origin/main"]);
  assert.equal(selected, "main");
});

test("search validates topK range", async () => {
  const client = createSimilaritySearchClient({
    baseUrl: "http://localhost:3000",
    fetchImpl: async () => ({ ok: true, json: async () => ({ results: [] }) }),
  });

  await assert.rejects(() => client.search({ prompt: "x", topK: 0 }), /between 1 and 10/);
  await assert.rejects(() => client.search({ prompt: "x", topK: 11 }), /between 1 and 10/);
});

test("search trims prompt and maps partial errors", async () => {
  let requestBody = null;
  const client = createSimilaritySearchClient({
    baseUrl: "http://localhost:3000",
    fetchImpl: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          cached: false,
          results: [
            { title: "A", similarity: 0.9 },
            { title: "B", similarity: 0.8 },
          ],
          partialErrors: { openreview: "timeout" },
        }),
      };
    },
  });

  const data = await client.search({ prompt: "  hello   world ", topK: 1 });
  assert.equal(requestBody.prompt, "hello world");
  assert.equal(data.results.length, 1);
  assert.equal(data.partialErrors.openreview, "timeout");
});

test("search throws on upstream non-ok response", async () => {
  const client = createSimilaritySearchClient({
    baseUrl: "http://localhost:3000",
    fetchImpl: async () => ({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      text: async () => "upstream",
    }),
  });

  await assert.rejects(() => client.search({ prompt: "hello" }), /502/);
});
