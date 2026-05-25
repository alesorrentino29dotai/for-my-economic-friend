import type { AssistantRequest } from "@research-assistant/shared";
import { Router } from "express";
import { z } from "zod";
import { answerQuestion } from "../services/assistant.js";

const assistantRequestSchema = z.object({
  question: z.string().trim().min(3)
});

export function assistantRouter(): Router {
  const router = Router();

  router.post("/ask", async (request, response, next) => {
    const parsed = assistantRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: "Inserisci una domanda di almeno 3 caratteri.",
        details: parsed.error.issues
      });
      return;
    }

    try {
      const payload: AssistantRequest = parsed.data;
      response.json(await answerQuestion(payload.question));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
