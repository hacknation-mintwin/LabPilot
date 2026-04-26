import "dotenv/config";

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error("GEMINI_API_KEY missing"); process.exit(1); }

const t0 = Date.now();
const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
  method: "POST",
  headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "gemini-2.5-flash",
    messages: [
      { role: "system", content: "You are a senior PI. Output ONLY a JSON object." },
      { role: "user", content: "Return JSON {summary, steps:[{step,title,instructions}]} for: contrastive learning improves protein language model embeddings. 5 steps." },
    ],
    response_format: { type: "json_object" },
    max_tokens: 2048,
    temperature: 0.2,
  }),
});
const text = await res.text();
const ms = Date.now() - t0;
console.log("elapsed_ms:", ms, "http:", res.status);
let j;
try { j = JSON.parse(text); } catch { console.log("HTTP body not JSON:", text.slice(0, 300)); process.exit(2); }
if (j.error) { console.log("API error:", j.error); process.exit(3); }
const choice = j?.choices?.[0];
const msg = choice?.message;
const c = (msg?.content || msg?.reasoning || "").trim();
console.log("finish_reason:", choice?.finish_reason, "content_len:", c.length);
try {
  const p = JSON.parse(c);
  console.log("valid_json: yes; keys:", Object.keys(p), "steps:", (p.steps || []).length);
} catch (e) {
  console.log("valid_json: NO ->", String(e.message).slice(0, 120));
  console.log("first 200:", c.slice(0, 200));
}
