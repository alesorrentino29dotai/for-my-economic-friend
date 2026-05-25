import type { StoredDocument } from "@research-assistant/shared";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { dataDir, documentsDbPath, uploadDir } from "./paths.js";

export type InternalDocument = StoredDocument & {
  extractedText: string;
};

const TEXT_EXTENSIONS = new Set([
  ".csv",
  ".json",
  ".md",
  ".markdown",
  ".rtf",
  ".txt",
  ".tsv",
  ".yaml",
  ".yml"
]);

export async function ensureStorage(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.mkdir(uploadDir, { recursive: true });
  try {
    await fs.access(documentsDbPath);
  } catch {
    await fs.writeFile(documentsDbPath, "[]", "utf8");
  }
}

export async function listInternalDocuments(): Promise<InternalDocument[]> {
  await ensureStorage();
  const raw = await fs.readFile(documentsDbPath, "utf8");
  return JSON.parse(raw) as InternalDocument[];
}

export async function listDocuments(): Promise<StoredDocument[]> {
  const documents = await listInternalDocuments();
  return documents.map(({ extractedText: _extractedText, ...document }) => document);
}

export async function saveUploadedDocument(input: {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
  size: number;
}): Promise<StoredDocument> {
  await ensureStorage();

  const id = randomUUID();
  const safeName = input.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${id}-${safeName}`;
  const filePath = path.join(uploadDir, fileName);
  await fs.writeFile(filePath, input.buffer);

  const extractedText = extractReadableText(input.buffer, input.originalName, input.mimeType);
  const document: InternalDocument = {
    id,
    originalName: input.originalName,
    fileName,
    mimeType: input.mimeType || "application/octet-stream",
    size: input.size,
    uploadedAt: new Date().toISOString(),
    preview: extractedText.slice(0, 420),
    extractedText
  };

  const documents = await listInternalDocuments();
  documents.unshift(document);
  await fs.writeFile(documentsDbPath, JSON.stringify(documents, null, 2), "utf8");

  const { extractedText: _extractedText, ...safeDocument } = document;
  return safeDocument;
}

function extractReadableText(buffer: Buffer, originalName: string, mimeType: string): string {
  const extension = path.extname(originalName).toLowerCase();
  const looksTextual = mimeType.startsWith("text/") || TEXT_EXTENSIONS.has(extension);

  if (!looksTextual) {
    return [
      `Documento caricato: ${originalName}.`,
      "Anteprima testuale non disponibile per questo formato nella demo.",
      "Per PDF o Word reali, collegare un estrattore come pdf-parse, unstructured o Apache Tika."
    ].join(" ");
  }

  return buffer
    .toString("utf8")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 120_000);
}
