import { buildResearchPrompt } from "./retrieval.js";

export const PROVIDERS = {
  local: {
    label: "Local demo mode",
    defaultModel: "retrieval-summary"
  },
  gemini: {
    label: "Google Gemini API",
    defaultModel: "gemini-1.5-flash"
  },
  claude: {
    label: "Anthropic Claude API",
    defaultModel: "claude-3-5-sonnet-latest"
  }
};

function requireApiKey(provider, apiKey) {
  if (!apiKey) {
    const error = new Error(`${PROVIDERS[provider].label} requires an API key. Paste a key from your provider account for this request.`);
    error.statusCode = 400;
    throw error;
  }
}

async function assertOk(response, provider) {
  if (response.ok) {
    return;
  }

  const body = await response.text();
  const error = new Error(`${PROVIDERS[provider].label} request failed (${response.status}): ${body.slice(0, 500)}`);
  error.statusCode = 502;
  throw error;
}

async function callGemini({ apiKey, model, prompt }) {
  requireApiKey("gemini", apiKey);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 900
        }
      })
    }
  );

  await assertOk(response, "gemini");
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text).join("").trim();

  return text || "Gemini returned an empty response.";
}

async function callClaude({ apiKey, model, prompt }) {
  requireApiKey("claude", apiKey);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  await assertOk(response, "claude");
  const data = await response.json();
  const text = data.content?.map((part) => part.text).join("").trim();

  return text || "Claude returned an empty response.";
}

export function createLocalAnswer({ question, rankedDocuments }) {
  if (rankedDocuments.length === 0) {
    return [
      `I could not find a matching uploaded template for: "${question}".`,
      "",
      "Daily next action: upload one relevant template, protocol, note, or bibliography entry, then ask again with a concrete task."
    ].join("\n");
  }

  const sourceBullets = rankedDocuments
    .map((document, index) => `${index + 1}. ${document.title} (${document.kind}) - ${document.excerpt}`)
    .join("\n");

  return [
    `Direct answer: based on the uploaded material, the most relevant sources for "${question}" are listed below. Use them as the evidence base before drafting or deciding.`,
    "",
    "Source notes:",
    sourceBullets,
    "",
    "Daily next action: choose the top source, convert its key points into a short checklist, and ask the assistant to draft the next research artifact from that checklist."
  ].join("\n");
}

export async function answerQuestion({ provider = "local", model, apiKey, question, rankedDocuments }) {
  const selectedProvider = PROVIDERS[provider] ? provider : "local";
  const selectedModel = model || PROVIDERS[selectedProvider].defaultModel;

  if (selectedProvider === "local") {
    return {
      provider: selectedProvider,
      model: selectedModel,
      answer: createLocalAnswer({ question, rankedDocuments })
    };
  }

  const prompt = buildResearchPrompt({ question, rankedDocuments });
  const answer =
    selectedProvider === "gemini"
      ? await callGemini({ apiKey, model: selectedModel, prompt })
      : await callClaude({ apiKey, model: selectedModel, prompt });

  return {
    provider: selectedProvider,
    model: selectedModel,
    answer
  };
}
