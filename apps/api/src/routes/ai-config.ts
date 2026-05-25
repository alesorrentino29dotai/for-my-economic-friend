import { Router } from "express";
import { ZodError } from "zod";
import { getAiConfig, saveAiConfig, toSafeConfig } from "../services/ai-config.js";

export function aiConfigRouter(): Router {
  const router = Router();

  router.get("/", async (_request, response, next) => {
    try {
      response.json(toSafeConfig(await getAiConfig()));
    } catch (error) {
      next(error);
    }
  });

  router.put("/", async (request, response, next) => {
    try {
      response.json(await saveAiConfig(request.body));
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json({ error: "Configurazione non valida.", details: error.issues });
        return;
      }
      next(error);
    }
  });

  return router;
}
