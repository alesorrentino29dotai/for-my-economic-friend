import "dotenv/config";

import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";
import multer from "multer";

import {
  ensureDataFiles,
  listDocuments,
  loadSettings,
  saveDocument,
  saveSettings,
  settingsSummary,
} from "./storage.js";
import { buildDailyHelp } from "./services/helpService.js";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const textExtensions = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".yaml",
  ".yml",
]);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function extractDocumentContent(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  const canExtract = textExtensions.has(extension);

  return {
    extension,
    content: canExtract ? file.buffer.toString("utf8").slice(0, 20000) : "",
    extractedAsText: canExtract,
  };
}

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    service: "research-assistant",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/documents", async (_request, response, next) => {
  try {
    const documents = await listDocuments();
    response.json({ documents });
  } catch (error) {
    next(error);
  }
});

app.post("/api/documents", upload.single("template"), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: "Please provide a file in field 'template'." });
      return;
    }

    const title = String(request.body.title || "").trim() || request.file.originalname;
    const description = String(request.body.description || "").trim();
    const tags = String(request.body.tags || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);

    const { extension, content, extractedAsText } = extractDocumentContent(request.file);
    const document = {
      id: randomUUID(),
      title,
      description,
      tags,
      filename: request.file.originalname,
      mimeType: request.file.mimetype,
      sizeBytes: request.file.size,
      extension,
      extractedAsText,
      content,
      uploadedAt: new Date().toISOString(),
    };

    await saveDocument(document);
    response.status(201).json({ document });
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings", async (_request, response, next) => {
  try {
    const settings = await loadSettings();
    response.json({ settings: settingsSummary(settings) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/settings", async (request, response, next) => {
  try {
    const currentSettings = await loadSettings();

    const provider =
      request.body.provider === "cloud-code" || request.body.provider === "gemini"
        ? request.body.provider
        : currentSettings.provider;

    const incomingGeminiKey = String(request.body?.gemini?.apiKey ?? "").trim();
    const incomingCloudCodeKey = String(request.body?.cloudCode?.apiKey ?? "").trim();

    const nextSettings = {
      provider,
      gemini: {
        model: String(request.body?.gemini?.model || currentSettings.gemini.model).trim(),
        apiKey: incomingGeminiKey || currentSettings.gemini.apiKey,
      },
      cloudCode: {
        model: String(
          request.body?.cloudCode?.model || currentSettings.cloudCode.model,
        ).trim(),
        baseUrl: String(
          request.body?.cloudCode?.baseUrl || currentSettings.cloudCode.baseUrl,
        ).trim(),
        apiKey: incomingCloudCodeKey || currentSettings.cloudCode.apiKey,
      },
    };

    const storedSettings = await saveSettings(nextSettings);
    response.json({ settings: settingsSummary(storedSettings) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/help/daily", async (request, response, next) => {
  try {
    const question = String(request.body?.question || "").trim();

    if (!question) {
      response.status(400).json({ error: "Please provide a non-empty 'question' field." });
      return;
    }

    const result = await buildDailyHelp(question);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

app.use(express.static(publicDir));
app.get("/{*splat}", (_request, response) => {
  response.sendFile(path.join(publicDir, "index.html"));
});

app.use((error, _request, response, _next) => {
  const status = Number(error.statusCode || error.status || 500);
  response.status(status).json({
    error: error.message || "Unexpected server error",
  });
});

const port = Number(process.env.PORT || 3000);

await ensureDataFiles();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Research assistant portal running on http://localhost:${port}`);
});
