# Research Template Assistant

A small full-stack demo for a researcher who wants to build a documentary base and receive daily AI-assisted help from it.

The app lets a user:

- upload research templates, protocols, grant text, or notes;
- store them through a backend API in `data/documents.json`;
- retrieve the most relevant uploaded snippets for a question;
- answer in local demo mode with no API key;
- optionally send the grounded prompt to Gemini or Claude using an API key supplied for that single request.

## Run locally

```bash
npm start
```

Then open <http://localhost:3000>.

For automatic server reloads while editing:

```bash
npm run dev
```

## Test

```bash
npm test
```

## API integration notes

The demo supports three providers:

- `local`: no external API call; summarizes relevant uploaded snippets.
- `gemini`: calls the Google Gemini API. Paste a Gemini API key in the UI for the request.
- `claude`: calls the Anthropic Claude API. Paste an Anthropic API key in the UI for the request.

API keys are not persisted by this demo. In a production version, move provider credentials into a server-side secret manager, add authentication, and replace the JSON file store with a database plus document embeddings/vector search.

## Project structure

```text
backend/
  aiProviders.js  # provider adapters and local demo answer
  retrieval.js    # tokenization, ranking, prompt construction
  server.js       # HTTP API and static file server
  store.js        # JSON document persistence
frontend/
  app.js
  index.html
  styles.css
test/
  retrieval.test.js
```
