# Research Assistant Portal (Frontend + Backend)

This repository now contains a complete full-stack demo that you can show to a researcher:

- **Frontend dashboard** to upload research templates/documents
- **Backend API** to store and manage the documentary base
- **AI integration** with:
  - **Gemini API** (Google)
  - **Cloud Code / OpenAI-compatible API endpoint**
- **Daily help endpoint** that references the uploaded documentary base and returns actionable guidance

> If no API key is configured yet, the app still returns a local fallback answer so the flow remains demonstrable.

## Quick start

```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

## Features

### 1) Upload templates

- Upload text-based files (`.txt`, `.md`, `.csv`, `.json`, `.yaml`, `.yml`) and metadata
- Non-text files can still be tracked as references, but text extraction is disabled
- Templates are persisted in `data/documents.json`

### 2) Configure provider

From the UI, choose:

- `gemini`
- `cloud-code` (OpenAI-compatible chat completions URL)

Saved settings include provider/model/base URL and API key presence (keys are masked in API responses).

### 3) Generate daily help

`POST /api/help/daily`:

- Finds relevant uploaded documents (keyword overlap scoring)
- Builds a grounded prompt from document snippets
- Calls the selected provider API
- Returns answer + referenced documents + generation metadata

## API overview

- `GET /api/health`
- `GET /api/documents`
- `POST /api/documents` (multipart form field: `template`)
- `GET /api/settings`
- `PUT /api/settings`
- `POST /api/help/daily`

## Environment variables (optional)

Create a `.env` file if desired:

```env
PORT=3000
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
CLOUD_CODE_API_KEY=
CLOUD_CODE_MODEL=gpt-4.1-mini
CLOUD_CODE_BASE_URL=https://api.openai.com/v1/chat/completions
DATA_DIR=./data
```

## Notes

- This is a practical prototype focused on demonstrating workflow and integration.
- For production: add authentication, encrypted secret storage, persistent database, and stronger document parsing/indexing.
