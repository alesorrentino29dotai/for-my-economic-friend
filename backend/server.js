import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addDocument, deleteDocument, readDocuments } from "./store.js";
import { answerQuestion, PROVIDERS } from "./aiProviders.js";
import { rankDocuments } from "./retrieval.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, "..", "frontend");
const PORT = Number(process.env.PORT ?? 3000);
const MAX_JSON_BODY = 1_000_000;

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendError(response, error) {
  const statusCode = error.statusCode || 500;
  sendJson(response, statusCode, {
    error: error.message || "Unexpected server error."
  });
}

async function readJsonBody(request) {
  let body = "";

  for await (const chunk of request) {
    body += chunk;
    if (body.length > MAX_JSON_BODY) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
  }

  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      providers: PROVIDERS
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/documents") {
    const documents = await readDocuments();
    sendJson(
      response,
      200,
      documents.map(({ content, ...document }) => ({
        ...document,
        preview: content.length > 220 ? `${content.slice(0, 220)}...` : content
      }))
    );
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/documents") {
    const payload = await readJsonBody(request);
    const document = await addDocument(payload);
    const { content, ...metadata } = document;
    sendJson(response, 201, {
      ...metadata,
      preview: content.length > 220 ? `${content.slice(0, 220)}...` : content
    });
    return;
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/documents/")) {
    const id = decodeURIComponent(url.pathname.replace("/api/documents/", ""));
    await deleteDocument(id);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/chat") {
    const payload = await readJsonBody(request);
    const question = String(payload.question ?? "").trim();

    if (!question) {
      const error = new Error("A question is required.");
      error.statusCode = 400;
      throw error;
    }

    const documents = await readDocuments();
    const rankedDocuments = rankDocuments(documents, question);
    const answer = await answerQuestion({
      provider: payload.provider,
      model: payload.model,
      apiKey: payload.apiKey,
      question,
      rankedDocuments
    });

    sendJson(response, 200, {
      ...answer,
      sources: rankedDocuments.map(({ content, ...document }) => document)
    });
    return;
  }

  sendJson(response, 404, { error: "API route not found." });
}

async function serveStatic(response, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.resolve(FRONTEND_DIR, `.${decodeURIComponent(requestedPath)}`);

  if (!filePath.startsWith(FRONTEND_DIR)) {
    sendJson(response, 403, { error: "Forbidden." });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    const finalPath = fileStat.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const extension = path.extname(finalPath);
    const file = await readFile(finalPath);

    response.writeHead(200, {
      "content-type": CONTENT_TYPES[extension] || "application/octet-stream"
    });
    response.end(file);
  } catch {
    const fallback = await readFile(path.join(FRONTEND_DIR, "index.html"));
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8"
    });
    response.end(fallback);
  }
}

export function createApp() {
  return createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);

    try {
      if (url.pathname.startsWith("/api/")) {
        await handleApi(request, response, url);
        return;
      }

      await serveStatic(response, url);
    } catch (error) {
      sendError(response, error);
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createApp().listen(PORT, () => {
    console.log(`Research template assistant running at http://localhost:${PORT}`);
  });
}
