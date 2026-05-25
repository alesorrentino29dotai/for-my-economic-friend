import type {
  AiProviderConfig,
  AiProviderType,
  SafeAiProviderConfig
} from "@research-assistant/shared";
import { type FormEvent, useEffect, useState } from "react";
import { getAiConfig, saveAiConfig } from "../lib/api";

const PROVIDER_LABELS: Record<AiProviderType, string> = {
  gemini: "Gemini",
  anthropic: "Claude / Anthropic",
  "openai-compatible": "OpenAI-compatible cloud",
  "local-openai": "Modello locale su GPU"
};

const PRESETS: Record<AiProviderType, Pick<AiProviderConfig, "model" | "baseUrl">> = {
  gemini: { model: "gemini-1.5-flash", baseUrl: "" },
  anthropic: { model: "claude-3-5-sonnet-latest", baseUrl: "" },
  "openai-compatible": { model: "gpt-4o-mini", baseUrl: "https://api.openai.com/v1" },
  "local-openai": { model: "llama3.1", baseUrl: "http://localhost:11434/v1" }
};

type ProviderSettingsProps = {
  onSaved: (config: SafeAiProviderConfig) => void;
};

export function ProviderSettings({ onSaved }: ProviderSettingsProps) {
  const [form, setForm] = useState<AiProviderConfig>({
    provider: "local-openai",
    model: PRESETS["local-openai"].model,
    baseUrl: PRESETS["local-openai"].baseUrl,
    apiKey: "",
    temperature: 0.2
  });
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void getAiConfig()
      .then((config) => {
        setForm({ ...config, apiKey: "" });
        setApiKeyConfigured(config.apiKeyConfigured);
        onSaved(config);
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "Configurazione non caricata.");
      });
  }, [onSaved]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    try {
      const saved = await saveAiConfig(form);
      setApiKeyConfigured(saved.apiKeyConfigured);
      onSaved(saved);
      setMessage("Configurazione salvata.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Salvataggio non riuscito.");
    }
  }

  function updateProvider(provider: AiProviderType) {
    setForm((current) => ({
      ...current,
      provider,
      model: PRESETS[provider].model,
      baseUrl: PRESETS[provider].baseUrl
    }));
  }

  return (
    <section className="card">
      <div className="section-heading">
        <p className="eyebrow">AI provider</p>
        <h2>Collega API cloud o modello locale</h2>
        <p>
          Le chiavi restano sul backend e non vengono restituite al browser. Per il modello
          locale basta esporre un server OpenAI-compatible sulla GPU.
        </p>
      </div>

      <form className="settings-form" onSubmit={handleSubmit}>
        <label>
          Provider
          <select
            value={form.provider}
            onChange={(event) => updateProvider(event.target.value as AiProviderType)}
          >
            {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Modello
          <input
            value={form.model}
            onChange={(event) => setForm({ ...form, model: event.target.value })}
            placeholder="llama3.1, gemini-1.5-flash, claude..."
          />
        </label>

        <label>
          Base URL
          <input
            value={form.baseUrl ?? ""}
            onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
            placeholder="http://localhost:11434/v1"
          />
        </label>

        <label>
          API key {apiKeyConfigured ? <span className="pill">gia salvata</span> : null}
          <input
            type="password"
            value={form.apiKey ?? ""}
            onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
            placeholder={
              form.provider === "local-openai"
                ? "Opzionale per Ollama/vLLM locali"
                : "Incolla la chiave API"
            }
          />
        </label>

        <label>
          Temperatura: {form.temperature.toFixed(1)}
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.1"
            value={form.temperature}
            onChange={(event) =>
              setForm({ ...form, temperature: Number(event.target.value) })
            }
          />
        </label>

        <button type="submit">Salva provider</button>
      </form>

      <div className="local-help">
        <strong>Preset GPU locale:</strong>
        <code>ollama serve</code>
        <code>ollama pull llama3.1</code>
        <span>oppure vLLM/LM Studio con endpoint tipo http://localhost:8000/v1</span>
      </div>

      {message ? <p className="status-message">{message}</p> : null}
    </section>
  );
}
