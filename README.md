# Research assistant website demo

This repository now contains a small full-stack demo for a researcher-friendly website with:

- a **frontend dashboard** to upload and manage templates or documentary sources
- a **backend API** that stores those uploads and indexes text-based files
- a configurable **AI settings panel** for **Google Gemini** or **Anthropic Claude**
- a grounded **daily help assistant** that answers from the uploaded knowledge base first

## Why this is useful

The idea is simple: your researcher friend can maintain a documentary base of reusable templates, notes, and process documents, then ask for help that stays anchored to those materials.

Examples:

- upload a recurring daily economics brief template
- upload client onboarding notes or memo structures
- ask the assistant to draft, summarize, or prepare a daily brief using the uploaded base
- connect a paid model API to get stronger answers than the local fallback mode

## Important note on APIs

The UI includes links to acquire API access for:

- **Google Gemini** via Google AI Studio
- **Anthropic Claude** via the Anthropic Console

If you were thinking of "Claude Code", that product is not itself the API you would buy for this app. The compatible paid API for Claude models is the **Anthropic API**.

## Project structure

```text
.
├── backend
│   ├── data
│   ├── uploads
│   ├── package.json
│   └── server.js
├── frontend
│   ├── src
│   └── package.json
└── package.json
```

## Run locally

```bash
npm install
npm run dev
```

That starts:

- backend on `http://localhost:4000`
- frontend on `http://localhost:5173`

## Features included

### 1. Template upload and management

The dashboard accepts text-based files such as:

- `.txt`
- `.md`
- `.csv`
- `.json`
- `.html`
- `.xml`
- `.yml`
- `.yaml`
- code or prompt files

Those files are stored in the backend and indexed if they contain readable text.

### 2. AI provider configuration

The settings panel lets the user:

- choose **Gemini** or **Claude**
- set a model name
- paste a purchased API key
- customize the assistant system prompt

For this demo, the API key is stored locally on the backend machine. In a production deployment, you should move it to proper secrets management.

### 3. Grounded assistant

When a question is submitted, the backend:

1. retrieves the most relevant uploaded sources
2. builds a grounded prompt from those sources
3. calls Gemini or Claude if an API key is configured
4. falls back to local retrieval mode if no API is configured or the provider call fails

## Available scripts

```bash
npm run dev
npm run build
npm run lint
npm run start
```

## Possible next steps

If you want to push this further, I would recommend:

- user authentication for the researcher/admin
- a database instead of JSON files
- support for PDF and DOCX ingestion
- citations with exact passage highlighting
- scheduled daily brief generation by email or Slack
- payment/subscription logic for multiple end users
