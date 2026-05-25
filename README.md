# Research Template Assistant

Full-stack demo (frontend + backend) to help a researcher:

- Upload and manage documentary templates.
- Connect a paid AI API (Google Gemini or any OpenAI-compatible provider).
- Ask daily grounded questions based on the uploaded template base.

## Stack

- **Backend**: Node.js + Express + Multer
- **Frontend**: Vanilla HTML/CSS/JS
- **Storage**: Local filesystem (`data/`) for template files + metadata index

## Features

1. **Template management**
   - Upload files with title/description/tags.
   - List and delete templates.
   - Automatic extraction for text-based formats (`.txt`, `.md`, `.json`, `.csv`, etc.).
2. **Configurable AI provider**
   - `gemini` (Google AI Studio API key)
   - `openai-compatible` (custom base URL supported, for Cloud Code/API gateways)
3. **Daily assistant**
   - Choose which templates to use as sources.
   - Ask questions and get source-grounded answers.
   - Response includes source references.

## Quickstart

```bash
npm install
npm run dev
```

Open: `http://localhost:4000`

## API Overview

- `GET /api/health`
- `GET /api/providers`
- `GET /api/templates`
- `POST /api/templates` (multipart form with `file`, optional `title`, `description`, `tags`)
- `DELETE /api/templates/:id`
- `POST /api/chat`

### `POST /api/chat` payload

```json
{
  "provider": "gemini",
  "apiKey": "YOUR_API_KEY",
  "model": "gemini-1.5-flash",
  "baseUrl": "https://api.openai.com/v1",
  "message": "Summarize today's outlook from selected templates.",
  "templateIds": ["template-id-1", "template-id-2"]
}
```

## Security notes

- API keys are stored in browser `localStorage` by this demo (not in backend).
- Do not use this setup as-is for production:
  - Move to secure secret management.
  - Add authentication + per-user permissions.
  - Add stricter document parsing and scanning.
