import type { SafeAiProviderConfig, StoredDocument } from "@research-assistant/shared";
import { useCallback, useEffect, useState } from "react";
import { AssistantPanel } from "./components/AssistantPanel";
import { DocumentList } from "./components/DocumentList";
import { DocumentUpload } from "./components/DocumentUpload";
import { ProviderSettings } from "./components/ProviderSettings";
import { listDocuments } from "./lib/api";

export function App() {
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [config, setConfig] = useState<SafeAiProviderConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshDocuments = useCallback(async () => {
    try {
      setDocuments(await listDocuments());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Documenti non caricati.");
    }
  }, []);

  useEffect(() => {
    void refreshDocuments();
  }, [refreshDocuments]);

  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">Research Copilot</p>
          <h1>Un laboratorio documentale con AI cloud o modello locale su GPU</h1>
          <p>
            Demo full-stack per un ricercatore: carica template e materiali, scegli un
            provider AI acquistato o locale, e ottieni supporto quotidiano ancorato alle
            fonti.
          </p>
          <div className="hero-actions">
            <a href="#documents">Carica materiali</a>
            <a href="#provider" className="secondary">
              Configura AI
            </a>
          </div>
        </div>

        <div className="hero-card">
          <span>Modalita supportate</span>
          <strong>Gemini + Claude + OpenAI-compatible + GPU locale</strong>
          <small>
            Backend pronto per Ollama, LM Studio e vLLM tramite endpoint
            /v1/chat/completions.
          </small>
        </div>
      </section>

      {loadError ? <p className="status-message error">{loadError}</p> : null}

      <section className="grid" id="documents">
        <DocumentUpload
          onUploaded={(document) => {
            setDocuments((current) => [document, ...current]);
          }}
        />
        <DocumentList documents={documents} />
      </section>

      <section className="grid" id="provider">
        <ProviderSettings onSaved={setConfig} />
        <AssistantPanel config={config} />
      </section>
    </main>
  );
}
