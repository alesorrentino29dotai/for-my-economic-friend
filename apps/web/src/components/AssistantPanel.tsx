import type { AssistantResponse, SafeAiProviderConfig } from "@research-assistant/shared";
import { type FormEvent, useState } from "react";
import { askAssistant } from "../lib/api";

type AssistantPanelProps = {
  config: SafeAiProviderConfig | null;
};

export function AssistantPanel({ config }: AssistantPanelProps) {
  const [question, setQuestion] = useState(
    "Quali indicazioni operative emergono dai documenti caricati?"
  );
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsAsking(true);
    try {
      setResponse(await askAssistant(question));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Domanda non riuscita.");
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <section className="card assistant-card">
      <div className="section-heading">
        <p className="eyebrow">Copilot quotidiano</p>
        <h2>Fai una domanda alla base documentale</h2>
        <p>
          Il backend recupera gli snippet piu pertinenti e li passa al provider scelto.
          Senza chiave cloud usa una risposta demo verificabile.
        </p>
      </div>

      <div className="provider-summary">
        <span>Provider attivo</span>
        <strong>
          {config
            ? `${config.provider} / ${config.model}`
            : "Configurazione in caricamento..."}
        </strong>
      </div>

      <form className="question-form" onSubmit={handleSubmit}>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={4}
        />
        <button type="submit" disabled={isAsking}>
          {isAsking ? "Sto ragionando..." : "Chiedi al copilot"}
        </button>
      </form>

      {error ? <p className="status-message error">{error}</p> : null}

      {response ? (
        <div className="answer">
          <div className="answer-meta">
            <span>{response.provider}</span>
            <span>{response.model}</span>
          </div>
          <p>{response.answer}</p>

          <h3>Fonti usate</h3>
          {response.sources.length === 0 ? (
            <p className="muted">Nessuna fonte disponibile.</p>
          ) : (
            response.sources.map((source) => (
              <blockquote key={source.documentId}>
                <strong>{source.documentName}</strong>
                <span>{source.snippet}</span>
              </blockquote>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
