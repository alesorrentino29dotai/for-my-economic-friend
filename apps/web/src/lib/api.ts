import type {
  AiProviderConfig,
  AssistantRequest,
  AssistantResponse,
  SafeAiProviderConfig,
  StoredDocument
} from "@research-assistant/shared";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new Error(payload?.error ?? `Richiesta fallita: ${response.status}`);
  }

  return payload as T;
}

export function listDocuments(): Promise<StoredDocument[]> {
  return request<StoredDocument[]>("/api/documents");
}

export async function uploadDocument(file: File): Promise<StoredDocument> {
  const body = new FormData();
  body.append("file", file);
  return request<StoredDocument>("/api/documents", {
    method: "POST",
    body
  });
}

export function getAiConfig(): Promise<SafeAiProviderConfig> {
  return request<SafeAiProviderConfig>("/api/ai-config");
}

export function saveAiConfig(config: AiProviderConfig): Promise<SafeAiProviderConfig> {
  return request<SafeAiProviderConfig>("/api/ai-config", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(config)
  });
}

export function askAssistant(question: string): Promise<AssistantResponse> {
  const payload: AssistantRequest = { question };
  return request<AssistantResponse>("/api/assistant/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}
