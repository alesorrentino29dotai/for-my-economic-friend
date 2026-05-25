import { listDocuments, loadSettings } from "../storage.js";

function tokenize(input) {
  return (input ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

function scoreDocument(questionTokens, document) {
  const sourceText = `${document.title} ${document.description ?? ""} ${document.content ?? ""}`;
  const docTokenSet = new Set(tokenize(sourceText));

  let score = 0;
  for (const token of questionTokens) {
    if (docTokenSet.has(token)) {
      score += 1;
    }
  }

  return score;
}

function selectRelevantDocuments(question, documents) {
  const questionTokens = tokenize(question);

  return [...documents]
    .map((document) => ({
      ...document,
      matchScore: scoreDocument(questionTokens, document),
    }))
    .sort((a, b) => b.matchScore - a.matchScore)
    .filter((document) => document.matchScore > 0 || documents.length <= 3)
    .slice(0, 5);
}

function buildContextBlock(documents) {
  return documents
    .map((document, index) => {
      const snippet = (document.content ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 1200);

      return [
        `Document ${index + 1}: ${document.title}`,
        `Tags: ${(document.tags ?? []).join(", ") || "none"}`,
        `Notes: ${document.description || "none"}`,
        `Content snippet: ${snippet || "[No text extracted from this file format]"}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

function buildPrompt({ question, contextBlock }) {
  return `
You are a practical daily assistant for a researcher.
Ground every recommendation in the provided documentary base.
If context is missing, state assumptions and ask one follow-up question.

Today request:
${question}

Documentary base:
${contextBlock || "No documents available yet."}

Output format:
1) Brief answer
2) Action plan for today (3-6 bullet points)
3) References used (document titles)
`.trim();
}

function extractGeminiText(responsePayload) {
  const parts = responsePayload?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part) => part.text).filter(Boolean).join("\n").trim();
}

async function callGemini(settings, prompt) {
  const apiKey = settings.gemini.apiKey;
  if (!apiKey) {
    return null;
  }

  const model = settings.gemini.model || "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 900,
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${details}`);
  }

  const payload = await response.json();
  return extractGeminiText(payload);
}

async function callCloudCode(settings, prompt) {
  const apiKey = settings.cloudCode.apiKey;
  if (!apiKey) {
    return null;
  }

  const model = settings.cloudCode.model || "gpt-4.1-mini";
  const endpoint = settings.cloudCode.baseUrl;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a precise daily research assistant that cites provided documents.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Cloud Code API error (${response.status}): ${details}`);
  }

  const payload = await response.json();
  return payload?.choices?.[0]?.message?.content?.trim() || null;
}

function fallbackResponse(question, selectedDocuments) {
  const documentReferences =
    selectedDocuments.map((document) => `- ${document.title}`).join("\n") ||
    "- none (upload at least one textual template)";

  return `
No paid model API is configured yet, so this is a local fallback answer.

Question received:
${question}

Suggested daily workflow:
- Review your highest-priority document and extract 3 key claims.
- Translate each claim into one measurable task.
- Allocate one focused block for literature, one for writing, and one for review.
- End the day by updating your template with findings and open questions.

References considered:
${documentReferences}
`.trim();
}

export async function buildDailyHelp(question) {
  const [documents, settings] = await Promise.all([listDocuments(), loadSettings()]);
  const selectedDocuments = selectRelevantDocuments(question, documents);
  const prompt = buildPrompt({
    question,
    contextBlock: buildContextBlock(selectedDocuments),
  });

  let answer;
  let providerUsed = settings.provider;

  if (settings.provider === "gemini") {
    answer = await callGemini(settings, prompt);
  } else {
    answer = await callCloudCode(settings, prompt);
  }

  if (!answer) {
    providerUsed = "local-fallback";
    answer = fallbackResponse(question, selectedDocuments);
  }

  return {
    answer,
    providerUsed,
    usedDocuments: selectedDocuments.map((document) => ({
      id: document.id,
      title: document.title,
      uploadedAt: document.uploadedAt,
      tags: document.tags ?? [],
    })),
    generatedAt: new Date().toISOString(),
  };
}
