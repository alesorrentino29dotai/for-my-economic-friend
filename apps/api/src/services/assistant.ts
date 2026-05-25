import type {
  AiProviderConfig,
  AssistantResponse
} from "@research-assistant/shared";
import { getAiConfig } from "./ai-config.js";
import { buildGroundedPrompt, buildSources } from "./retrieval.js";
import { listInternalDocuments } from "./storage.js";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

export async function answerQuestion(question: string): Promise<AssistantResponse> {
  const [config, documents] = await Promise.all([
    getAiConfig(),
    listInternalDocuments()
  ]);
  const sources = buildSources(question, documents);
  const prompt = buildGroundedPrompt(question, sources);

  if (shouldUseDemoMode(config)) {
    return {
      answer: buildDemoAnswer(question, sources),
      provider: "demo",
      model: "deterministic-demo",
      sources
    };
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "Sei un assistente di ricerca. Usa solo il contesto fornito, segnala incertezza e rispondi in italiano."
    },
    { role: "user", content: prompt }
  ];

  const answer = await callProvider(config, messages);
  return {
    answer,
    provider: config.provider,
    model: config.model,
    sources
  };
}

function shouldUseDemoMode(config: AiProviderConfig): boolean {
  if (config.provider === "local-openai") {
    return false;
  }

  return !config.apiKey;
}

function buildDemoAnswer(question: string, sources: AssistantResponse["sources"]): string {
  if (sources.length === 0) {
    return [
      `Domanda ricevuta: "${question}".`,
      "Carica uno o piu documenti o template per ottenere una risposta ancorata alla base documentale.",
      "Quando configuri una chiave API o un endpoint locale/GPU, questa stessa domanda verra inviata al modello scelto."
    ].join("\n\n");
  }

  const sourceLines = sources
    .map((source, index) => `${index + 1}. ${source.documentName}: ${source.snippet}`)
    .join("\n");

  return [
    "Modalita demo: non e stata configurata una chiave API cloud, quindi restituisco una sintesi deterministica basata sugli snippet piu vicini.",
    "",
    `Domanda: ${question}`,
    "",
    "Elementi rilevanti trovati:",
    sourceLines,
    "",
    "Per una risposta generativa completa, configura Gemini, Claude/Anthropic, un endpoint OpenAI-compatible cloud, oppure un endpoint locale/GPU come Ollama, LM Studio o vLLM."
  ].join("\n");
}

async function callProvider(
  config: AiProviderConfig,
  messages: ChatMessage[]
): Promise<string> {
  switch (config.provider) {
    case "gemini":
      return callGemini(config, messages);
    case "anthropic":
      return callAnthropic(config, messages);
    case "openai-compatible":
    case "local-openai":
      return callOpenAiCompatible(config, messages);
  }
}

async function callOpenAiCompatible(
  config: AiProviderConfig,
  messages: ChatMessage[]
): Promise<string> {
  const baseUrl = stripTrailingSlash(config.baseUrl || "http://localhost:11434/v1");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: buildJsonHeaders(config.apiKey),
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: config.temperature
    })
  });

  const payload = await parseProviderResponse(response);
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Risposta OpenAI-compatible non valida.");
  }

  return content;
}

async function callGemini(
  config: AiProviderConfig,
  messages: ChatMessage[]
): Promise<string> {
  const prompt = messages.map((message) => `${message.role}: ${message.content}`).join("\n\n");
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    config.model
  )}:generateContent?key=${encodeURIComponent(config.apiKey ?? "")}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: config.temperature }
    })
  });

  const payload = await parseProviderResponse(response);
  const content = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof content !== "string") {
    throw new Error("Risposta Gemini non valida.");
  }

  return content;
}

async function callAnthropic(
  config: AiProviderConfig,
  messages: ChatMessage[]
): Promise<string> {
  const system = messages.find((message) => message.role === "system")?.content;
  const user = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n\n");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey ?? "",
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1200,
      temperature: config.temperature,
      system,
      messages: [{ role: "user", content: user }]
    })
  });

  const payload = await parseProviderResponse(response);
  const content = payload?.content?.[0]?.text;
  if (typeof content !== "string") {
    throw new Error("Risposta Anthropic non valida.");
  }

  return content;
}

function buildJsonHeaders(apiKey?: string): Record<string, string> {
  return {
    "content-type": "application/json",
    ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
  };
}

async function parseProviderResponse(response: Response): Promise<any> {
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      `Provider AI non disponibile (${response.status}).`;
    throw new Error(message);
  }

  return payload;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
