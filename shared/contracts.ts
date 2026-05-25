export type ProviderId = "demo" | "gemini" | "anthropic";

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocument {
  id: string;
  name: string;
  filename: string;
  content: string;
  excerpt: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AISettings {
  provider: ProviderId;
  model: string;
  apiKey: string;
  defaultTemplateId: string | null;
  researcherName: string;
  companionGoal: string;
}

export interface PublicAISettings extends Omit<AISettings, "apiKey"> {
  hasApiKey: boolean;
  maskedApiKey: string | null;
}

export interface ProviderGuide {
  id: ProviderId;
  name: string;
  description: string;
  purchaseUrl: string;
  billingUrl: string;
}

export interface DashboardState {
  templates: PromptTemplate[];
  documents: KnowledgeDocument[];
  settings: PublicAISettings;
  providerGuides: ProviderGuide[];
}

export interface SourceSnippet {
  documentId: string;
  documentName: string;
  snippet: string;
  score: number;
}

export interface AssistantResponse {
  mode: "demo" | "live";
  provider: ProviderId;
  model: string;
  answer: string;
  sources: SourceSnippet[];
}
