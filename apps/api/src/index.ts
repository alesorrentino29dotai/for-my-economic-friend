import cors from "cors";
import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import { aiConfigRouter } from "./routes/ai-config.js";
import { assistantRouter } from "./routes/assistant.js";
import { documentsRouter } from "./routes/documents.js";
import { ensureStorage } from "./services/storage.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(
  cors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173"
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, service: "research-assistant-api" });
});
app.use("/api/documents", documentsRouter());
app.use("/api/ai-config", aiConfigRouter());
app.use("/api/assistant", assistantRouter());

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({
    error: error instanceof Error ? error.message : "Errore inatteso."
  });
};

app.use(errorHandler);

await ensureStorage();

app.listen(port, () => {
  console.log(`Research assistant API listening on http://localhost:${port}`);
});
