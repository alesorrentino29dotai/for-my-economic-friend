import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DOCUMENTS_PATH = path.join(DATA_DIR, "documents.json");
const MAX_CONTENT_LENGTH = 300_000;

async function ensureDataFile() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(DOCUMENTS_PATH, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    await writeFile(DOCUMENTS_PATH, "[]\n", "utf8");
  }
}

export async function readDocuments() {
  await ensureDataFile();
  const raw = await readFile(DOCUMENTS_PATH, "utf8");
  return JSON.parse(raw);
}

export async function writeDocuments(documents) {
  await ensureDataFile();
  await writeFile(DOCUMENTS_PATH, `${JSON.stringify(documents, null, 2)}\n`, "utf8");
}

export async function addDocument(input) {
  const title = String(input.title ?? "").trim();
  const kind = String(input.kind ?? "template").trim() || "template";
  const content = String(input.content ?? "").trim();

  if (!title) {
    const error = new Error("Document title is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!content) {
    const error = new Error("Document content is required.");
    error.statusCode = 400;
    throw error;
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    const error = new Error(`Document content must be ${MAX_CONTENT_LENGTH} characters or fewer.`);
    error.statusCode = 413;
    throw error;
  }

  const documents = await readDocuments();
  const document = {
    id: randomUUID(),
    title,
    kind,
    content,
    source: String(input.source ?? "manual-upload").trim() || "manual-upload",
    createdAt: new Date().toISOString(),
    wordCount: content.split(/\s+/).filter(Boolean).length
  };

  documents.push(document);
  await writeDocuments(documents);

  return document;
}

export async function deleteDocument(id) {
  const documents = await readDocuments();
  const nextDocuments = documents.filter((document) => document.id !== id);

  if (nextDocuments.length === documents.length) {
    const error = new Error("Document not found.");
    error.statusCode = 404;
    throw error;
  }

  await writeDocuments(nextDocuments);
}
