const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "been",
  "before",
  "being",
  "between",
  "could",
  "daily",
  "does",
  "from",
  "have",
  "help",
  "into",
  "more",
  "over",
  "research",
  "should",
  "that",
  "the",
  "their",
  "there",
  "these",
  "this",
  "with",
  "what",
  "when",
  "where",
  "which",
  "your"
]);

export function tokenize(text = "") {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function termFrequency(tokens) {
  return tokens.reduce((counts, token) => {
    counts.set(token, (counts.get(token) ?? 0) + 1);
    return counts;
  }, new Map());
}

function excerptAround(text, tokens, maxLength = 520) {
  if (!text) {
    return "";
  }

  const lowerText = text.toLowerCase();
  const firstHit = tokens
    .map((token) => lowerText.indexOf(token.toLowerCase()))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (firstHit === undefined) {
    return text.length <= maxLength ? text : `${text.slice(0, maxLength).trim()}...`;
  }

  const start = Math.max(0, firstHit - Math.floor(maxLength / 3));
  const end = Math.min(text.length, start + maxLength);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";

  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

export function rankDocuments(documents, question, limit = 4) {
  const queryTokens = tokenize(question);

  if (queryTokens.length === 0) {
    return documents
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit)
      .map((document) => ({
        ...document,
        score: 0,
        excerpt: excerptAround(document.content, [])
      }));
  }

  const querySet = new Set(queryTokens);

  return documents
    .map((document) => {
      const tokens = tokenize(`${document.title} ${document.kind} ${document.content}`);
      const frequencies = termFrequency(tokens);
      const score = [...querySet].reduce((total, token) => {
        const exact = frequencies.get(token) ?? 0;
        const related = tokens.some((candidate) => candidate.includes(token) || token.includes(candidate)) ? 0.5 : 0;
        return total + exact + related;
      }, 0);

      return {
        ...document,
        score,
        excerpt: excerptAround(document.content, queryTokens)
      };
    })
    .filter((document) => document.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

export function buildContextBlock(rankedDocuments) {
  if (rankedDocuments.length === 0) {
    return "No matching documents were found in the uploaded knowledge base yet.";
  }

  return rankedDocuments
    .map((document, index) => {
      return [
        `Source ${index + 1}: ${document.title}`,
        `Type: ${document.kind}`,
        `Uploaded: ${document.createdAt}`,
        `Relevant excerpt: ${document.excerpt}`
      ].join("\n");
    })
    .join("\n\n");
}

export function buildResearchPrompt({ question, rankedDocuments }) {
  const context = buildContextBlock(rankedDocuments);

  return [
    "You are a careful research assistant. Use only the provided source excerpts when making factual claims.",
    "If the source base is insufficient, say exactly what is missing and propose the next practical step.",
    "Return a concise answer with: 1) direct answer, 2) cited source notes, 3) a daily next action.",
    "",
    "Uploaded source excerpts:",
    context,
    "",
    "Researcher question:",
    question
  ].join("\n");
}
