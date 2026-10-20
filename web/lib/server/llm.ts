// The twins' voice: GLM on ILMU's OpenAI-compatible API, server side only. ILMU wants streamed requests
// (long unstreamed ones are cut off), and GLM reasons before it answers, so the reply is streamed, collected,
// and the JSON object in it is parsed and checked. Falls back to the next model when one fails.
import "server-only";

const BASE = process.env.ILMU_BASE_URL ?? "https://api.ilmu.ai/v1";
const MODELS = (process.env.LLM_MODELS ?? "ilmu-glm-5.3-flash,ilmu-mini-v3.3").split(",").map((m) => m.trim());

async function complete(model: string, system: string, prompt: string): Promise<string> {
  const key = process.env.ILMU_API_KEY;
  if (!key) throw new Error("ILMU_API_KEY is not set");
  const r = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: 2000,
      temperature: 0.9,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!r.ok || !r.body) throw new Error(`${model} returned ${r.status}`);
  let text = "", buf = "";
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const data = line.trim().replace(/^data:\s*/, "");
      if (!line.trim().startsWith("data:") || data === "[DONE]") continue;
      try {
        const delta = JSON.parse(data).choices?.[0]?.delta; // usage-only chunks have no choices
        if (delta?.content) text += delta.content;
      } catch {
        // a partial or keep-alive line: ignore
      }
    }
  }
  return text;
}

/** One JSON object from the model, with the given keys present. `shape` is shown to the model as the format. */
export async function json<T>(prompt: string, shape: string, required: string[], system: string): Promise<T> {
  let last = "";
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await complete(model, system, `${prompt}\n\nReply with one JSON object only, no other text, in this shape:\n${shape}`);
        const raw = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
        const obj = JSON.parse(raw) as Record<string, unknown>;
        const missing = required.filter((k) => obj[k] === undefined);
        if (missing.length) throw new Error(`reply missing ${missing.join(", ")}`);
        return obj as T;
      } catch (e) {
        last = `${model}: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
  }
  throw new Error(`the twins could not answer (${last})`);
}
