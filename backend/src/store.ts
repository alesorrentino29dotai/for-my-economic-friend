import fs from "node:fs";
import path from "node:path";
import type {
  AISettings,
  KnowledgeDocument,
  PromptTemplate,
  ProviderGuide,
  PublicAISettings
} from "../../shared/contracts";

const dataDir = path.join(process.cwd(), "data");
const storageDir = path.join(process.cwd(), "storage");
const templatesFile = path.join(dataDir, "templates.json");
const documentsFile = path.join(dataDir, "documents.json");
const settingsFile = path.join(dataDir, "settings.json");

const defaultTemplateId = "daily-research-copilot";

const defaultTemplates: PromptTemplate[] = [
  {
    id: defaultTemplateId,
    name: "Daily research copilot",
    description: "Turns your uploaded documentary base into practical daily guidance.",
    content:
      "You are an expert research assistant. Answer only from the documentary base below when possible. If the evidence is incomplete, say so explicitly, then give a careful next best action. Prefer concise recommendations, bullet lists, and actionable follow-ups for the researcher.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const defaultDocuments: KnowledgeDocument[] = [
  {
    id: "welcome-brief",
    name: "Welcome brief",
    filename: "welcome-brief.md",
    content:
      "# Welcome\nThis demo lets a researcher upload prompt templates and documentary files, then ask questions or request a daily brief grounded in those documents. Add your own material to replace this starter note.",
    excerpt:
      "This demo lets a researcher upload prompt templates and documentary files, then ask questions or request a daily brief grounded in those documents.",
    tags: ["demo", "onboarding"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const defaultSettings: AISettings = {
  provider: "demo",
  model: "demo-research-companion",
  apiKey: "",
  defaultTemplateId,
  researcherName: "Economic researcher",
  companionGoal:
    "Help me navigate my document base, prepare daily research priorities, and answer questions with explicit references."
};

const providerGuides: ProviderGuide[] = [
  {
    id: "demo",
    name: "Demo mode",
    description: "No paid API key required. Uses the local retrieval engine to demonstrate the workflow.",
    purchaseUrl: "https://cursor.com",
    billingUrl: "https://cursor.com"
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Buy or enable access in Google AI Studio / Google Cloud, then paste the API key here.",
    purchaseUrl: "https://aistudio.google.com/app/apikey",
    billingUrl: "https://console.cloud.google.com/billing"
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Create a Claude API key and billing plan, then use the same document-grounded workflow.",
    purchaseUrl: "https://console.anthropic.com/settings/keys",
    billingUrl: "https://console.anthropic.com/settings/billing"
  }
];

function ensureDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensureFile<T>(filePath: string, fallback: T) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), "utf8");
  }
}

export function initializeStorage() {
  ensureDirectory(dataDir);
  ensureDirectory(path.join(storageDir, "templates"));
  ensureDirectory(path.join(storageDir, "documents"));

  ensureFile(templatesFile, defaultTemplates);
  ensureFile(documentsFile, defaultDocuments);
  ensureFile(settingsFile, defaultSettings);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function writeJson<T>(filePath: string, value: T) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

export function listTemplates() {
  return readJson<PromptTemplate[]>(templatesFile);
}

export function saveTemplates(templates: PromptTemplate[]) {
  writeJson(templatesFile, templates);
}

export function listDocuments() {
  return readJson<KnowledgeDocument[]>(documentsFile);
}

export function saveDocuments(documents: KnowledgeDocument[]) {
  writeJson(documentsFile, documents);
}

export function getSettings() {
  return readJson<AISettings>(settingsFile);
}

export function saveSettings(settings: AISettings) {
  writeJson(settingsFile, settings);
}

export function toPublicSettings(settings: AISettings): PublicAISettings {
  const maskedApiKey =
    settings.apiKey.length > 8
      ? `${settings.apiKey.slice(0, 4)}...${settings.apiKey.slice(-4)}`
      : settings.apiKey
        ? "configured"
        : null;

  return {
    provider: settings.provider,
    model: settings.model,
    defaultTemplateId: settings.defaultTemplateId,
    researcherName: settings.researcherName,
    companionGoal: settings.companionGoal,
    hasApiKey: settings.apiKey.length > 0,
    maskedApiKey
  };
}

export function getProviderGuides() {
  return providerGuides;
}
