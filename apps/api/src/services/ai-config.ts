import type {
  AiProviderConfig,
  AiProviderType,
  SafeAiProviderConfig
} from "@research-assistant/shared";
import fs from "node:fs/promises";
import { z } from "zod";
import { aiConfigPath } from "./paths.js";
import { ensureStorage } from "./storage.js";

const providerSchema = z.enum([
  "gemini",
  "anthropic",
  "openai-compatible",
  "local-openai"
]);

export const aiConfigSchema = z.object({
  provider: providerSchema,
  model: z.string().trim().min(1),
  baseUrl: z.string().trim().optional().or(z.literal("")),
  apiKey: z.string().trim().optional().or(z.literal("")),
  temperature: z.coerce.number().min(0).max(2).default(0.2)
});

const DEFAULT_MODELS: Record<AiProviderType, string> = {
  gemini: "gemini-1.5-flash",
  anthropic: "claude-3-5-sonnet-latest",
  "openai-compatible": "gpt-4o-mini",
  "local-openai": "llama3.1"
};

const DEFAULT_BASE_URLS: Partial<Record<AiProviderType, string>> = {
  "openai-compatible": "https://api.openai.com/v1",
  "local-openai": "http://localhost:11434/v1"
};

export function getDefaultConfig(): AiProviderConfig {
  const provider = parseProvider(process.env.AI_PROVIDER) ?? "local-openai";
  return {
    provider,
    model: process.env.AI_MODEL || DEFAULT_MODELS[provider],
    baseUrl: process.env.AI_BASE_URL || DEFAULT_BASE_URLS[provider],
    apiKey: process.env.AI_API_KEY || "",
    temperature: Number(process.env.AI_TEMPERATURE ?? 0.2)
  };
}

export async function getAiConfig(): Promise<AiProviderConfig> {
  await ensureStorage();
  try {
    const raw = await fs.readFile(aiConfigPath, "utf8");
    return aiConfigSchema.parse({
      ...getDefaultConfig(),
      ...JSON.parse(raw)
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return getDefaultConfig();
    }
    throw error;
  }
}

export async function saveAiConfig(input: unknown): Promise<SafeAiProviderConfig> {
  await ensureStorage();
  const parsed = aiConfigSchema.parse(input);
  await fs.writeFile(aiConfigPath, JSON.stringify(parsed, null, 2), "utf8");
  return toSafeConfig(parsed);
}

export function toSafeConfig(config: AiProviderConfig): SafeAiProviderConfig {
  const { apiKey, ...safeConfig } = config;
  return {
    ...safeConfig,
    apiKeyConfigured: Boolean(apiKey)
  };
}

function parseProvider(value: string | undefined): AiProviderType | undefined {
  const result = providerSchema.safeParse(value);
  return result.success ? result.data : undefined;
}
