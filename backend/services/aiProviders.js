function truncate(text, maxLength = 18000) {
  if (!text) {
    return "";
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n\n[...truncated for prompt size...]`;
}

function buildGroundedPrompt({ message, templates }) {
  const context = templates
    .map((template, index) => {
      const body = truncate(template.extractedText || "");
      return [
        `SOURCE #${index + 1}`,
        `Title: ${template.title}`,
        `Description: ${template.description || "N/A"}`,
        `Tags: ${template.tags?.join(", ") || "none"}`,
        `Document:`,
        body || "[No extractable text content]",
      ].join("\n");
    })
    .join("\n\n---------------------\n\n");

  return `
You are a helpful daily research assistant.
Use the documentary sources below as the primary references.
If sources are insufficient, say what is missing and propose next steps.
Cite sources by "SOURCE #X" in your response when relevant.

DOCUMENTARY SOURCES
${context || "[No sources selected]"}

USER QUESTION
${message}
`.trim();
}

async function askGemini({ apiKey, model, prompt }) {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model || "gemini-1.5-flash"
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${body}`);
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim() || "";

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

function normalizeBaseUrl(input) {
  const fallback = "https://api.openai.com/v1";
  if (!input || typeof input !== "string") {
    return fallback;
  }

  return input.endsWith("/") ? input.slice(0, -1) : input;
}

async function askOpenAiCompatible({ apiKey, model, prompt, baseUrl }) {
  const endpoint = `${normalizeBaseUrl(baseUrl)}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are an accurate daily research assistant grounded in provided documents.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI-compatible API error (${response.status}): ${body}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Provider returned an empty response.");
  }

  return content;
}

async function askProvider({
  provider,
  apiKey,
  model,
  message,
  templates,
  baseUrl,
}) {
  if (!apiKey) {
    throw new Error("API key is required.");
  }
  if (!message || !message.trim()) {
    throw new Error("A user message is required.");
  }

  const prompt = buildGroundedPrompt({ message, templates });

  if (provider === "gemini") {
    return askGemini({ apiKey, model, prompt });
  }

  if (provider === "openai-compatible") {
    return askOpenAiCompatible({ apiKey, model, prompt, baseUrl });
  }

  throw new Error(
    `Unsupported provider "${provider}". Use "gemini" or "openai-compatible".`
  );
}

module.exports = {
  askProvider,
  buildGroundedPrompt,
};
