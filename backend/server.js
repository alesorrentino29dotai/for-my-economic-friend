const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("node:fs/promises");
const path = require("node:path");

const {
  ensureStorage,
  createTemplateRecord,
  listTemplateRecords,
  deleteTemplateRecord,
  getTemplatesByIds,
} = require("./services/templateStore");
const { askProvider } = require("./services/aiProviders");

const app = express();
const PORT = Number(process.env.PORT || 4000);

const uploadTmpDir = path.join(process.cwd(), "data", "tmp");
const upload = multer({
  dest: uploadTmpDir,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/providers", (_req, res) => {
  res.json({
    providers: [
      {
        id: "gemini",
        label: "Google Gemini",
        defaultModel: "gemini-1.5-flash",
      },
      {
        id: "openai-compatible",
        label: "OpenAI-compatible (Cloud Code/API Gateway)",
        defaultModel: "gpt-4o-mini",
      },
    ],
  });
});

app.get("/api/templates", async (_req, res) => {
  const templates = await listTemplateRecords();
  res.json({ templates });
});

app.post("/api/templates", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "A template file is required." });
  }

  try {
    const created = await createTemplateRecord({
      file: req.file,
      title: req.body.title,
      description: req.body.description,
      rawTags: req.body.tags,
    });

    return res.status(201).json({ template: created });
  } catch (error) {
    // Best effort cleanup for temporary upload if processing failed.
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    return res.status(500).json({ error: error.message });
  }
});

app.delete("/api/templates/:id", async (req, res) => {
  const deleted = await deleteTemplateRecord(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Template not found." });
  }

  return res.status(204).send();
});

app.post("/api/chat", async (req, res) => {
  const { provider, apiKey, model, message, templateIds, baseUrl } = req.body;

  try {
    const templates = await getTemplatesByIds(templateIds);
    const answer = await askProvider({
      provider,
      apiKey,
      model,
      message,
      templates,
      baseUrl,
    });

    return res.json({
      answer,
      usedSources: templates.map((template) => ({
        id: template.id,
        title: template.title,
      })),
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.use(express.static(path.join(process.cwd(), "frontend")));
app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "frontend", "index.html"));
});

async function bootstrap() {
  await ensureStorage();
  await fs.mkdir(uploadTmpDir, { recursive: true });

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Research doc assistant running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Startup failed:", error);
  process.exit(1);
});
