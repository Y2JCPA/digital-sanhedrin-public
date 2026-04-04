/**
 * Shared LLM utility — supports Anthropic (BYOK) and Google Gemini Flash (free default).
 */

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const GEMINI_MODEL = "gemini-2.0-flash";

export type Message = { role: string; content: string };

/**
 * Call either Anthropic Claude or Google Gemini and return the response text.
 *
 * @param apiKey  - Anthropic API key (when provider='anthropic') or Google AI API key (when provider='gemini')
 * @param provider - Which LLM provider to use
 * @param messages - Conversation messages
 * @param maxTokens - Max output tokens
 */
export async function callLLM(
  apiKey: string,
  provider: "anthropic" | "gemini",
  messages: Message[],
  maxTokens: number = 4096
): Promise<string> {
  if (provider === "anthropic") {
    return callAnthropic(apiKey, messages, maxTokens);
  } else {
    return callGemini(apiKey, messages, maxTokens);
  }
}

async function callAnthropic(
  apiKey: string,
  messages: Message[],
  maxTokens: number
): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Anthropic API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  const content = data.content?.[0];
  if (content?.type !== "text") {
    throw new Error("Unexpected response format from Anthropic API");
  }
  return content.text.trim();
}

async function callGemini(
  apiKey: string,
  messages: Message[],
  maxTokens: number
): Promise<string> {
  // Convert OpenAI-style messages to Gemini format
  // For single-turn (most of our usage), extract the user message content
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Gemini API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Unexpected response format from Gemini API");
  }
  return text.trim();
}
