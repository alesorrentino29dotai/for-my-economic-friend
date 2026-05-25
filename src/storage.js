import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDirectory = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), "data");

const documentsPath = path.join(dataDirectory, "documents.json");
const settingsPath = path.join(dataDirectory, "settings.json");

const defaultSettings = {
  provider: "gemini",
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  },
  cloudCode: {
    apiKey: process.env.CLOUD_CODE_API_KEY ?? "",
    model: process.env.CLOUD_CODE_MODEL ?? "gpt-4.1-mini",
    baseUrl:
      process.env.CLOUD_CODE_BASE_URL ??
      "https://api.openai.com/v1/chat/completions",
  },
  updatedAt: null,
};

async function readJsonFile(filePath, fallbackValue) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallbackValue;
    }

    throw error;
  }
}

async function writeJsonFile(filePath, data) {
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

export async function ensureDataFiles() {
  await mkdir(dataDirectory, { recursive: true });

  const existingDocuments = await readJsonFile(documentsPath, []);
  if (!Array.isArray(existingDocuments)) {
    await writeJsonFile(documentsPath, []);
  } else {
    await writeJsonFile(documentsPath, existingDocuments);
  }

  const existingSettings = await readJsonFile(settingsPath, defaultSettings);
  await writeJsonFile(settingsPath, {
    ...defaultSettings,
    ...existingSettings,
    gemini: { ...defaultSettings.gemini, ...existingSettings.gemini },
    cloudCode: { ...defaultSettings.cloudCode, ...existingSettings.cloudCode },
  });
}

export async function listDocuments() {
  const documents = await readJsonFile(documentsPath, []);
  if (!Array.isArray(documents)) {
    return [];
  }

  return documents.sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  );
}

export async function saveDocument(document) {
  const currentDocuments = await listDocuments();
  currentDocuments.push(document);
  await writeJsonFile(documentsPath, currentDocuments);
  return document;
}

export async function loadSettings() {
  const settings = await readJsonFile(settingsPath, defaultSettings);
  return {
    ...defaultSettings,
    ...settings,
    gemini: { ...defaultSettings.gemini, ...settings.gemini },
    cloudCode: { ...defaultSettings.cloudCode, ...settings.cloudCode },
  };
}

export async function saveSettings(nextSettings) {
  const currentSettings = await loadSettings();
  const mergedSettings = {
    ...currentSettings,
    ...nextSettings,
    gemini: { ...currentSettings.gemini, ...nextSettings.gemini },
    cloudCode: { ...currentSettings.cloudCode, ...nextSettings.cloudCode },
    updatedAt: new Date().toISOString(),
  };

  await writeJsonFile(settingsPath, mergedSettings);
  return mergedSettings;
}

export function settingsSummary(settings) {
  const mask = (value) =>
    value ? `${"•".repeat(Math.max(value.length - 4, 0))}${value.slice(-4)}` : "";

  return {
    provider: settings.provider,
    gemini: {
      model: settings.gemini.model,
      hasApiKey: Boolean(settings.gemini.apiKey),
      apiKeyMasked: mask(settings.gemini.apiKey),
    },
    cloudCode: {
      model: settings.cloudCode.model,
      baseUrl: settings.cloudCode.baseUrl,
      hasApiKey: Boolean(settings.cloudCode.apiKey),
      apiKeyMasked: mask(settings.cloudCode.apiKey),
    },
    updatedAt: settings.updatedAt,
  };
}
