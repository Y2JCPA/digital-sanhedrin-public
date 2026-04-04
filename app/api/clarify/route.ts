export const runtime = 'edge';

import { callLLM } from "../../lib/llm";

export async function POST(request: Request) {
  let body: { question?: string; apiKey?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const question = body.question?.trim();
  if (!question) {
    return new Response(JSON.stringify({ error: "Question is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Dual-provider: use Anthropic if user provides their own key, else Gemini Flash (free)
  const userApiKey = body.apiKey?.trim();
  let provider: "anthropic" | "gemini";
  let apiKey: string;

  if (userApiKey) {
    provider = "anthropic";
    apiKey = userApiKey;
  } else {
    const googleKey = process.env.GOOGLE_AI_API_KEY;
    if (!googleKey) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_AI_API_KEY not configured on server" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    provider = "gemini";
    apiKey = googleKey;
  }

  const prompt = `You are the court clerk of the Digital Sanhedrin, a council of 71 great Jewish legal scholars. A questioner has submitted the following she'elah (halachic question):

"${question}"

Your job is to:
1. Restate the question clearly and precisely as the Sanhedrin would understand it
2. Classify it into one of these topic areas:
   - Orach Chayim (אורח חיים) - daily life, Shabbat, holidays, prayer
   - Yoreh De'ah (יורה דעה) - kashrut, niddah, mourning, conversion
   - Even HaEzer (אבן העזר) - marriage, divorce
   - Choshen Mishpat (חושן משפט) - damages, property, courts
   - Hashkafa (השקפה) - philosophy, cross-cutting
3. Note any assumptions you're making or ambiguities that could change the answer

Respond with JSON only:
{
  "clarifiedQuestion": "<the she'elah restated clearly in 1-3 sentences>",
  "topic": "<english topic name>",
  "topicHebrew": "<hebrew topic name>",
  "assumptions": "<any key assumptions or ambiguities, 1-2 sentences, or null if none>"
}

Return ONLY the JSON. No markdown fences.`;

  try {
    const text = await callLLM(apiKey, provider, [{ role: "user", content: prompt }], 512);

    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleaned);
    return new Response(JSON.stringify(parsed), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "LLM call failed";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
