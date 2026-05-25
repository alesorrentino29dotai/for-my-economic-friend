# Researcher Companion Demo

A small full-stack prototype that shows what Cursor can scaffold from scratch:

- **Frontend**: React + Vite dashboard
- **Backend**: Express API with file uploads
- **Knowledge flow**: upload templates and documentary files, then query them through a grounded assistant
- **Provider integration**: demo mode out of the box, plus configurable **Gemini** or **Anthropic Claude** API access once the researcher buys a key

## What it does

This project gives a researcher one place to:

1. **Upload prompt templates**
   - write them in the UI
   - or upload `.txt`, `.md`, `.json`, or `.html` files
2. **Build a documentary base**
   - upload notes, reports, briefs, or reference files
   - the backend indexes them with a lightweight retrieval step
3. **Connect a paid LLM API**
   - use demo mode with no external key
   - or save a Gemini / Anthropic key
4. **Ask for daily help**
   - normal question-answering on top of the uploaded base
   - or a daily brief generated from the current documents

## Project structure

```text
backend/        Express API, uploads, retrieval, provider calls
frontend/       React dashboard
shared/         Shared TypeScript contracts
data/           Runtime JSON storage (ignored by git)
storage/        Uploaded files (ignored by git)
```

## Run locally

```bash
npm install
npm run dev
```

That starts:

- frontend on `http://localhost:5173`
- backend on `http://localhost:4000`

## Production-style build

```bash
npm run build
npm start
```

The backend will serve the built frontend from `dist/client`.

## Configure an API

The app works immediately in **demo mode**. To use a live model:

1. Open the **Provider settings** section
2. Choose **Gemini** or **Anthropic Claude**
3. Buy or enable your API access on the provider website
4. Paste the API key into the dashboard
5. Save the settings

The dashboard includes direct links to key creation and billing pages.

## Notes

- This is a **demo / prototype**, not a hardened production deployment.
- API keys are stored server-side in a local JSON file for convenience in this prototype.
- Document retrieval is intentionally lightweight so the project stays easy to understand and extend.
