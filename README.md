# Research Copilot for an economist friend

Demo full-stack per un ricercatore che vuole caricare template, note e documenti,
configurare un provider AI e ricevere supporto quotidiano ancorato alla propria
base documentale.

## Funzionalita

- Frontend React/Vite con upload documenti, configurazione provider e pannello Q&A.
- Backend Express/TypeScript con API REST sotto `/api`.
- Storage locale demo in `data/` per file caricati, metadati e configurazione AI.
- Provider supportati:
  - Gemini via API key Google.
  - Claude/Anthropic via API key Anthropic.
  - Endpoint OpenAI-compatible cloud.
  - Modello locale su GPU tramite endpoint OpenAI-compatible (Ollama, LM Studio, vLLM).
- Modalita demo: se non c'e una API key cloud, il backend risponde con una sintesi
  deterministica basata sugli snippet recuperati.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Il frontend parte su `http://localhost:5173` e il backend su
`http://localhost:4000`.

## Modello locale su GPU

La configurazione `local-openai` usa `/v1/chat/completions`, quindi puo parlare con
runtime locali che espongono un'API OpenAI-compatible.

Esempio con Ollama:

```bash
ollama serve
ollama pull llama3.1
```

Nel pannello AI usa:

- Provider: `Modello locale su GPU`
- Base URL: `http://localhost:11434/v1`
- Modello: `llama3.1`
- API key: vuota

Esempio con vLLM su una GPU locale:

```bash
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Meta-Llama-3.1-8B-Instruct \
  --host 0.0.0.0 \
  --port 8000
```

Nel pannello AI usa `http://localhost:8000/v1` come Base URL e il nome modello
esposto da vLLM.

## Script utili

```bash
npm run build
npm run typecheck
npm test
```

## Note di produzione

Questa e una demo volutamente piccola. Per un utilizzo reale conviene aggiungere:

- autenticazione e ruoli utente;
- database persistente al posto dei JSON locali;
- estrazione testo robusta per PDF/Word;
- encryption-at-rest per le API key;
- indicizzazione vettoriale e reranking per basi documentali grandi.
