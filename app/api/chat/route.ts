import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 30;

const DEFAULT_MODEL = "google/gemma-4-26b-a4b-it:free";

export async function POST(req: Request) {
  let prompt: string;
  try {
    const body = await req.json();
    prompt = String(body?.prompt ?? "").trim();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!prompt) {
    return new Response("Prompt is required", { status: 400 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response(
      "OPENROUTER_API_KEY is not set. Add it to .env.local (or Vercel env).",
      { status: 500 },
    );
  }

  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });

  const model = process.env.MODEL_NAME || DEFAULT_MODEL;

  let upstream;
  try {
    upstream = await client.chat.completions.create({
      model,
      stream: true,
      messages: [
        // SYSTEM_PROMPT — swap this string to change behavior
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
    });
  } catch (err: any) {
    const msg = err?.message || "LLM request failed";
    return new Response(msg, { status: 502 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of upstream) {
          const token = chunk.choices?.[0]?.delta?.content;
          if (token) controller.enqueue(encoder.encode(token));
        }
      } catch (err: any) {
        controller.enqueue(
          encoder.encode(`\n[stream error: ${err?.message || "unknown"}]`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
