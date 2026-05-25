import { Router } from "express";
import multer from "multer";
import { listDocuments, saveUploadedDocument } from "../services/storage.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

export function documentsRouter(): Router {
  const router = Router();

  router.get("/", async (_request, response, next) => {
    try {
      response.json(await listDocuments());
    } catch (error) {
      next(error);
    }
  });

  router.post("/", upload.single("file"), async (request, response, next) => {
    try {
      if (!request.file) {
        response.status(400).json({ error: "Campo file mancante." });
        return;
      }

      const document = await saveUploadedDocument({
        originalName: request.file.originalname,
        mimeType: request.file.mimetype,
        buffer: request.file.buffer,
        size: request.file.size
      });
      response.status(201).json(document);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
