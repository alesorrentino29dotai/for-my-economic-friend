import type {
  AISettings,
  AssistantResponse,
  PromptTemplate,
  ProviderId,
  SourceSnippet
} from "../../shared/contracts";

interface AssistantRequest {
  message: string;
  mode: "chat" | "daily";
  settings: AISettings;
  template: PromptTemplate | null;
  sources: SourceSnippet[];
}

function buildSystemPrompt(settings: AISettings, template: PromptTemplate | null) {
  return [
    `Researcher profile: ${settings.researcherName}`,
    `Primary goal: ${settings.companionGoal}`,
    template ? `Prompt template (${template.name}): ${template.content}` : "",
    "You must answer using the provided documentary base whenever possible.",
    "If evidence is missing or ambiguous, state that clearly.",
    "Use markdown and keep the response practical."
  ]
    .filter(Boolean)
    .join("\n");
}

function buildUserPrompt(message: string, mode: "chat" | "daily", sources: SourceSnippet[]) {
  const sourceBlock =
    sources.length > 0
      ? sources
          .map(
            (source, index) =>
              `[Source ${index + 1} | ${source.documentName} | score=${source.score}]\n${source.snippet}`
          )
          .join("\n\n")
      : "No documentary sources were retrieved.";

  const task =
    mode === "daily"
      ? `Prepare a daily research briefing based on this request: ${message}`
      : `Answer this researcher question: ${message}`;

  return `${task}\n\nDocumentary base:\n${sourceBlock}\n\nAnswer with a short summary, concrete recommendations, and explicit references to the most relevant sources.`;
}

function buildDemoAnswer(message: string, mode: "chat" | "daily", sources: SourceSnippet[], template: PromptTemplate | null) {
  const sourceBullets =
    sources.length > 0
      ? sources
          .map(
            (source) =>
              `- **${source.documentName}**: ${source.snippet.replace(/\s+/g, " ").trim()}`
          )
          .join("\n")
      : "- No uploaded document matched this request yet. Upload notes, articles, briefs, or methodology guides to improve the assistant.";

  const framing =
    mode === "daily"
      ? "## Daily research briefing"
      : "## Research assistant response";

  const templateNote = template
    ? `Template in use: **${template.name}**`
    : "No custom template was selected, so the default assistant style was used.";

  return [
    framing,
    "",
    `**Request:** ${message}`,
    `**Mode:** Demo mode (local retrieval only)`,
    `**Guidance:** ${templateNote}`,
    "",
    "### What the documentary base suggests",
    sourceBullets,
    "",
    "### Recommended next steps",
    "1. Refine or upload a template that matches the research workflow you want.",
    "2. Add more documentary material so the assistant can ground its answers better.",
    "3. Connect a paid provider key (Gemini or Anthropic) to replace this demo synthesis with live model output."
  ].join("\n");
}

async function callGemini(systemPrompt: string, userPrompt: string, settings: AISettings) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${settings.apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemPrompt}\n\n${userPrompt}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  return (
    data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ||
    "No text returned by Gemini."
  );
}

async function callAnthropic(systemPrompt: string, userPrompt: string, settings: AISettings) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 1200,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic request failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  return (
    data.content
      ?.filter((item) => item.type === "text")
      .map((item) => item.text ?? "")
      .join("")
      .trim() || "No text returned by Anthropic."
  );
}

async function callProvider(
  provider: ProviderId,
  systemPrompt: string,
  userPrompt: string,
  settings: AISettings
) {
  switch (provider) {
    case "gemini":
      return callGemini(systemPrompt, userPrompt, settings);
    case "anthropic":
      return callAnthropic(systemPrompt, userPrompt, settings);
    default:
      return buildDemoAnswer(userPrompt, "chat", [], null);
  }
}

export async function generateAssistantResponse({
  message,
  mode,
  settings,
  template,
  sources
}: AssistantRequest): Promise<AssistantResponse> {
  const provider = settings.provider !== "demo" && settings.apiKey ? settings.provider : "demo";

  if (provider === "demo") {
    return {
      mode: "demo",
      provider,
      model: settings.model,
      answer: buildDemoAnswer(message, mode, sources, template),
      sources
    };
  }

  const systemPrompt = buildSystemPrompt(settings, template);
  const userPrompt = buildUserPrompt(message, mode, sources);
  const answer = await callProvider(provider, systemPrompt, userPrompt, settings);

  return {
    mode: "live",
    provider,
    model: settings.model,
    answer,
    sources
  };
}
