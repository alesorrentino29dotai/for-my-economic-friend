const fs = require("node:fs/promises");
const path = require("node:path");
const { v4: uuidv4 } = require("uuid");

const DATA_DIR = path.join(process.cwd(), "data");
const FILES_DIR = path.join(DATA_DIR, "templates");
const INDEX_FILE = path.join(DATA_DIR, "templates-index.json");

async function ensureStorage() {
  await fs.mkdir(FILES_DIR, { recursive: true });

  try {
    await fs.access(INDEX_FILE);
  } catch {
    await fs.writeFile(INDEX_FILE, "[]", "utf-8");
  }
}

async function readIndex() {
  await ensureStorage();
  const raw = await fs.readFile(INDEX_FILE, "utf-8");
  return JSON.parse(raw);
}

async function writeIndex(records) {
  await fs.writeFile(INDEX_FILE, JSON.stringify(records, null, 2), "utf-8");
}

function parseTags(rawTags) {
  if (!rawTags || typeof rawTags !== "string") {
    return [];
  }

  return rawTags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function detectTextType(mimeType, originalName) {
  const lowerName = originalName.toLowerCase();
  const textExtensions = [
    ".txt",
    ".md",
    ".markdown",
    ".json",
    ".csv",
    ".yaml",
    ".yml",
    ".xml",
    ".html",
  ];

  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    textExtensions.some((ext) => lowerName.endsWith(ext))
  );
}

async function extractText(filePath, mimeType, originalName) {
  if (!detectTextType(mimeType, originalName)) {
    return `Unsupported structured extraction for "${originalName}". Use .txt/.md/.json/.csv for full-context AI grounding.`;
  }

  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

async function createTemplateRecord({ file, title, description, rawTags }) {
  const id = uuidv4();
  const safeName = file.originalname.replace(/[^\w.-]/g, "_");
  const storedFilename = `${id}-${safeName}`;
  const storedPath = path.join(FILES_DIR, storedFilename);

  await fs.rename(file.path, storedPath);

  const extractedText = await extractText(
    storedPath,
    file.mimetype,
    file.originalname
  );
  const record = {
    id,
    title: title?.trim() || file.originalname,
    description: description?.trim() || "",
    tags: parseTags(rawTags),
    originalName: file.originalname,
    storedFilename,
    mimeType: file.mimetype,
    size: file.size,
    extractedText,
    createdAt: new Date().toISOString(),
  };

  const records = await readIndex();
  records.unshift(record);
  await writeIndex(records);

  return record;
}

async function listTemplateRecords() {
  const records = await readIndex();
  return records;
}

async function deleteTemplateRecord(id) {
  const records = await readIndex();
  const index = records.findIndex((entry) => entry.id === id);
  if (index === -1) {
    return false;
  }

  const [deleted] = records.splice(index, 1);
  await writeIndex(records);

  const storedPath = path.join(FILES_DIR, deleted.storedFilename);
  try {
    await fs.unlink(storedPath);
  } catch {
    // File may have already been removed manually.
  }

  return true;
}

async function getTemplatesByIds(ids) {
  const all = await readIndex();
  if (!ids || ids.length === 0) {
    return all;
  }

  const set = new Set(ids);
  return all.filter((entry) => set.has(entry.id));
}

module.exports = {
  ensureStorage,
  createTemplateRecord,
  listTemplateRecords,
  deleteTemplateRecord,
  getTemplatesByIds,
};
