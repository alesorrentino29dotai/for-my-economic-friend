export type AiProviderType =
  | "gemini"
  | "anthropic"
  | "openai-compatible"
  | "local-openai";

export type StoredDocument = {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  preview: string;
};

export type AiProviderConfig = {
  provider: AiProviderType;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  temperature: number;
};

export type SafeAiProviderConfig = Omit<AiProviderConfig, "apiKey"> & {
  apiKeyConfigured: boolean;
};

export type AssistantSource = {
  documentId: string;
  documentName: string;
  snippet: string;
  score: number;
};

export type AssistantRequest = {
  question: string;
};

export type AssistantResponse = {
  answer: string;
  provider: AiProviderType | "demo";
  model: string;
  sources: AssistantSource[];
};

export type HealthResponse = {
  ok: true;
  service: string;
};
