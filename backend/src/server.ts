import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import type { AISettings, KnowledgeDocument, PromptTemplate } from "../../shared/contracts";
import { generateAssistantResponse } from "./llm";
import { retrieveSources } from "./retrieval";
import {
  getProviderGuides,
  getSettings,
  initializeStorage,
  listDocuments,
  listTemplates,
  saveDocuments,
  saveSettings,
  saveTemplates,
  toPublicSettings
} from "./store";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }
});
const port = Number(process.env.PORT ?? 4000);

initializeStorage();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function bufferToUtf8(buffer: Buffer) {
  return buffer.toString("utf8").replace(/\u0000/g, "").trim();
}

function persistUpload(folder: "templates" | "documents", originalName: string, buffer: Buffer) {
  const filename = `${Date.now()}-${sanitizeFilename(originalName)}`;
  const targetPath = path.join(process.cwd(), "storage", folder, filename);
  fs.writeFileSync(targetPath, buffer);
}

function getTemplateOrFallback(templateId?: string | null) {
  const templates = listTemplates();
  const settings = getSettings();
  const wantedId = templateId ?? settings.defaultTemplateId;
  return templates.find((template) => template.id === wantedId) ?? templates[0] ?? null;
}

function buildAppState() {
  const settings = getSettings();
  return {
    templates: listTemplates(),
    documents: listDocuments(),
    settings: toPublicSettings(settings),
    providerGuides: getProviderGuides()
  };
}

app.get("/api/app-state", (_request, response) => {
  response.json(buildAppState());
});

app.post("/api/templates", (request, response) => {
  const payload = request.body as Partial<PromptTemplate>;
  if (!payload.name || !payload.content) {
    response.status(400).json({ error: "Template name and content are required." });
    return;
  }

  const now = new Date().toISOString();
  const templates = listTemplates();
  const nextTemplate: PromptTemplate = {
    id: randomUUID(),
    name: payload.name.trim(),
    description: payload.description?.trim() ?? "",
    content: payload.content.trim(),
    createdAt: now,
    updatedAt: now
  };

  saveTemplates([nextTemplate, ...templates]);
  response.status(201).json(nextTemplate);
});

app.put("/api/templates/:templateId", (request, response) => {
  const templateId = request.params.templateId;
  const payload = request.body as Partial<PromptTemplate>;
  const templates = listTemplates();
  const index = templates.findIndex((template) => template.id === templateId);

  if (index === -1) {
    response.status(404).json({ error: "Template not found." });
    return;
  }

  const current = templates[index];
  const updated: PromptTemplate = {
    ...current,
    name: payload.name?.trim() || current.name,
    description: payload.description?.trim() ?? current.description,
    content: payload.content?.trim() || current.content,
    updatedAt: new Date().toISOString()
  };

  templates[index] = updated;
  saveTemplates(templates);
  response.json(updated);
});

app.post("/api/templates/upload", upload.single("file"), (request, response) => {
  if (!request.file) {
    response.status(400).json({ error: "A template file is required." });
    return;
  }

  const content = bufferToUtf8(request.file.buffer);
  if (!content) {
    response.status(400).json({ error: "The uploaded template file is empty or unreadable." });
    return;
  }

  persistUpload("templates", request.file.originalname, request.file.buffer);

  const now = new Date().toISOString();
  const templates = listTemplates();
  const template: PromptTemplate = {
    id: randomUUID(),
    name: request.body.name?.trim() || request.file.originalname.replace(/\.[^.]+$/, ""),
    description: request.body.description?.trim() || "Uploaded from file",
    content,
    createdAt: now,
    updatedAt: now
  };

  saveTemplates([template, ...templates]);
  response.status(201).json(template);
});

app.post("/api/documents/upload", upload.single("file"), (request, response) => {
  if (!request.file) {
    response.status(400).json({ error: "A document file is required." });
    return;
  }

  const content = bufferToUtf8(request.file.buffer);
  if (!content) {
    response.status(400).json({ error: "The uploaded document file is empty or unreadable." });
    return;
  }

  persistUpload("documents", request.file.originalname, request.file.buffer);

  const now = new Date().toISOString();
  const tags =
    typeof request.body.tags === "string"
      ? request.body.tags
          .split(",")
          .map((tag: string) => tag.trim())
          .filter(Boolean)
      : [];

  const document: KnowledgeDocument = {
    id: randomUUID(),
    name: request.body.name?.trim() || request.file.originalname.replace(/\.[^.]+$/, ""),
    filename: request.file.originalname,
    content,
    excerpt: content.slice(0, 180).replace(/\s+/g, " "),
    tags,
    createdAt: now,
    updatedAt: now
  };

  const documents = listDocuments();
  saveDocuments([document, ...documents]);
  response.status(201).json(document);
});

app.post("/api/settings", (request, response) => {
  const payload = request.body as Partial<AISettings> & { clearApiKey?: boolean };
  const current = getSettings();
  const settings: AISettings = {
    provider: payload.provider ?? current.provider,
    model: payload.model?.trim() || current.model,
    apiKey: payload.clearApiKey ? "" : payload.apiKey?.trim() ?? current.apiKey,
    defaultTemplateId: payload.defaultTemplateId ?? current.defaultTemplateId,
    researcherName: payload.researcherName?.trim() || current.researcherName,
    companionGoal: payload.companionGoal?.trim() || current.companionGoal
  };

  saveSettings(settings);
  response.json(toPublicSettings(settings));
});

app.post("/api/assistant/chat", async (request, response) => {
  try {
    const message = String(request.body?.message ?? "").trim();
    const templateId = (request.body?.templateId as string | undefined) ?? null;

    if (!message) {
      response.status(400).json({ error: "A message is required." });
      return;
    }

    const settings = getSettings();
    const documents = listDocuments();
    const template = getTemplateOrFallback(templateId);
    const sources = retrieveSources(message, documents);
    const answer = await generateAssistantResponse({
      message,
      mode: "chat",
      settings,
      template,
      sources
    });

    response.json(answer);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unknown assistant error."
    });
  }
});

app.post("/api/assistant/daily-brief", async (request, response) => {
  try {
    const focus = String(request.body?.focus ?? "Prioritize the day from the current documentary base.").trim();
    const templateId = (request.body?.templateId as string | undefined) ?? null;
    const settings = getSettings();
    const documents = listDocuments();
    const template = getTemplateOrFallback(templateId);
    const sources = retrieveSources(focus, documents);
    const answer = await generateAssistantResponse({
      message: focus,
      mode: "daily",
      settings,
      template,
      sources
    });

    response.json(answer);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unknown assistant error."
    });
  }
});

const clientDist = path.join(process.cwd(), "dist", "client");

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_request, response) => {
    response.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Researcher companion API running on http://localhost:${port}`);
});
