import type { AssistantSource } from "@research-assistant/shared";
import type { InternalDocument } from "./storage.js";

const STOP_WORDS = new Set([
  "a",
  "ad",
  "al",
  "alla",
  "che",
  "con",
  "da",
  "del",
  "di",
  "e",
  "for",
  "il",
  "in",
  "is",
  "la",
  "le",
  "of",
  "on",
  "per",
  "the",
  "to",
  "un",
  "una"
]);

export function buildSources(
  question: string,
  documents: InternalDocument[],
  limit = 5
): AssistantSource[] {
  const terms = tokenize(question);
  const scored = documents
    .map((document) => {
      const text = document.extractedText || document.preview || document.originalName;
      const lowerText = text.toLowerCase();
      const score = terms.reduce((total, term) => {
        return total + countOccurrences(lowerText, term);
      }, 0);

      return {
        document,
        score,
        snippet: pickSnippet(text, terms)
      };
    })
    .filter((item) => item.score > 0 || documents.length <= limit)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  return scored.map(({ document, score, snippet }) => ({
    documentId: document.id,
    documentName: document.originalName,
    snippet,
    score
  }));
}

export function buildGroundedPrompt(question: string, sources: AssistantSource[]): string {
  const context = sources
    .map((source, index) => {
      return `[${index + 1}] ${source.documentName}\n${source.snippet}`;
    })
    .join("\n\n");

  return [
    "Sei un assistente per un ricercatore.",
    "Rispondi in modo operativo e cita i documenti forniti quando sono rilevanti.",
    "Se la base documentale non contiene l'informazione, dillo chiaramente e suggerisci il prossimo passo.",
    "",
    `Domanda: ${question}`,
    "",
    "Base documentale:",
    context || "Nessun documento disponibile."
  ].join("\n");
}

function tokenize(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .match(/[a-z0-9]{3,}/g)
        ?.filter((term) => !STOP_WORDS.has(term)) ?? []
    )
  );
}

function countOccurrences(text: string, term: string): number {
  let count = 0;
  let position = text.indexOf(term);
  while (position !== -1) {
    count += 1;
    position = text.indexOf(term, position + term.length);
  }
  return count;
}

function pickSnippet(text: string, terms: string[]): string {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  if (!normalizedText) {
    return "Nessuna anteprima testuale disponibile.";
  }

  const lowerText = normalizedText.toLowerCase();
  const firstMatch = terms
    .map((term) => lowerText.indexOf(term))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  const start = Math.max(0, (firstMatch ?? 0) - 220);
  const end = Math.min(normalizedText.length, start + 700);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalizedText.length ? "..." : "";

  return `${prefix}${normalizedText.slice(start, end)}${suffix}`;
}
