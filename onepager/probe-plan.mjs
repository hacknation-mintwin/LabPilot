const t0 = Date.now();
const res = await fetch("http://localhost:3004/plan", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "transformer fine-tuning for medical text classification" }),
});
const ms = Date.now() - t0;
const text = await res.text();
console.log("elapsed_ms:", ms, "http:", res.status);
let j;
try { j = JSON.parse(text); } catch { console.log("non-JSON:", text.slice(0, 300)); process.exit(2); }
const p = j.plan || {};
console.log("error:", j.error);
console.log("partialErrors:", JSON.stringify(j.partialErrors || {}));
console.log("steps:", (p.protocol || []).length);
console.log("materials:", (p.materials || []).length);
console.log("phases:", ((p.timeline || {}).phases || []).length);
console.log("summary:", (p.summary || "").slice(0, 140));
