import type { KnowledgeDocument, SourceSnippet } from "../../shared/contracts";

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function chunkText(content: string, chunkSize = 700, overlap = 120) {
  const chunks: string[] = [];

  if (content.length <= chunkSize) {
    return [content];
  }

  let cursor = 0;
  while (cursor < content.length) {
    const next = content.slice(cursor, cursor + chunkSize).trim();
    if (next) {
      chunks.push(next);
    }
    if (cursor + chunkSize >= content.length) {
      break;
    }
    cursor += chunkSize - overlap;
  }

  return chunks;
}

function scoreSnippet(queryTokens: string[], snippet: string) {
  const haystack = snippet.toLowerCase();
  return queryTokens.reduce((score, token) => {
    if (haystack.includes(token)) {
      return score + 1 + Math.min(4, haystack.split(token).length - 1);
    }
    return score;
  }, 0);
}

export function retrieveSources(message: string, documents: KnowledgeDocument[], limit = 5): SourceSnippet[] {
  const queryTokens = tokenize(message);
  const ranked = documents.flatMap((document) =>
    chunkText(document.content).map((snippet) => ({
      documentId: document.id,
      documentName: document.name,
      snippet,
      score: scoreSnippet(queryTokens, snippet)
    }))
  );

  return ranked
    .filter((item) => item.score > 0 || queryTokens.length === 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => ({
      ...item,
      snippet: item.snippet.length > 320 ? `${item.snippet.slice(0, 317)}...` : item.snippet
    }));
}
