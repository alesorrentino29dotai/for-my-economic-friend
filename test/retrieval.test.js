import test from "node:test";
import assert from "node:assert/strict";
import { buildResearchPrompt, rankDocuments, tokenize } from "../backend/retrieval.js";
import { createLocalAnswer } from "../backend/aiProviders.js";

const documents = [
  {
    id: "template-1",
    title: "Interview protocol template",
    kind: "protocol",
    content: "Use semi structured interviews, consent language, and coding notes for participant research.",
    createdAt: "2026-01-02T10:00:00.000Z",
    wordCount: 12
  },
  {
    id: "grant-1",
    title: "Grant budget checklist",
    kind: "grant",
    content: "Summarize costs, personnel, travel, equipment, and risk assumptions.",
    createdAt: "2026-01-01T10:00:00.000Z",
    wordCount: 9
  }
];

test("tokenize removes common helper words and punctuation", () => {
  assert.deepEqual(tokenize("What should I do with the research protocol today?"), ["protocol", "today"]);
});

test("rankDocuments returns the most relevant uploaded source", () => {
  const ranked = rankDocuments(documents, "How should I prepare consent for interviews?");

  assert.equal(ranked[0].id, "template-1");
  assert.match(ranked[0].excerpt, /consent/);
});

test("buildResearchPrompt includes source excerpts and the user question", () => {
  const ranked = rankDocuments(documents, "budget risk");
  const prompt = buildResearchPrompt({
    question: "budget risk",
    rankedDocuments: ranked
  });

  assert.match(prompt, /Grant budget checklist/);
  assert.match(prompt, /budget risk/);
  assert.match(prompt, /daily next action/i);
});

test("createLocalAnswer gives a grounded demo response", () => {
  const ranked = rankDocuments(documents, "interview coding");
  const answer = createLocalAnswer({
    question: "interview coding",
    rankedDocuments: ranked
  });

  assert.match(answer, /Interview protocol template/);
  assert.match(answer, /Daily next action/);
});
