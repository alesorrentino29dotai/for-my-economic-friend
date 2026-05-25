const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const express = require('express')
const cors = require('cors')
const multer = require('multer')
require('dotenv').config()

const app = express()
const PORT = Number(process.env.PORT || 4000)

const DATA_DIR = path.join(__dirname, 'data')
const UPLOADS_DIR = path.join(__dirname, 'uploads')
const DOCUMENTS_FILE = path.join(DATA_DIR, 'documents.json')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')
const MAX_CONTEXT_CHARS = 9000
const SUPPORTED_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.json',
  '.html',
  '.xml',
  '.yml',
  '.yaml',
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.py',
  '.prompt',
])

const defaultSettings = {
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  apiKey: '',
  systemPrompt:
    'You are a precise research assistant. Use the uploaded material first, quote source titles when useful, and openly state when the knowledge base is missing information.',
  lastUpdated: null,
}

function ensureStorage() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })

  if (!fs.existsSync(DOCUMENTS_FILE)) {
    fs.writeFileSync(DOCUMENTS_FILE, '[]\n')
  }

  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2) + '\n')
  }
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    return fallback
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n')
}

function getDocuments() {
  return readJson(DOCUMENTS_FILE, [])
}

function saveDocuments(documents) {
  writeJson(DOCUMENTS_FILE, documents)
}

function getSettings() {
  return {
    ...defaultSettings,
    ...readJson(SETTINGS_FILE, defaultSettings),
  }
}

function saveSettings(settings) {
  writeJson(SETTINGS_FILE, settings)
}

function publicSettings(settings) {
  const { apiKey, ...rest } = settings

  return {
    ...rest,
    hasApiKey: Boolean(apiKey),
  }
}

function normalizeText(text) {
  return text.replace(/\r/g, '').replace(/\s+/g, ' ').trim()
}

function getExcerpt(text, maxLength = 220) {
  const compact = normalizeText(text)
  if (!compact) {
    return 'No readable text could be indexed from this file.'
  }

  if (compact.length <= maxLength) {
    return compact
  }

  return compact.slice(0, maxLength).trimEnd() + '...'
}

function readTextFile(filePath, originalName) {
  const extension = path.extname(originalName).toLowerCase()

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    return {
      content: '',
      indexed: false,
      note: 'Stored for management, but not indexed because this format is not text based.',
    }
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const normalized = normalizeText(content)

  return {
    content: normalized,
    indexed: Boolean(normalized),
    note: normalized
      ? 'Indexed and ready for grounded answers.'
      : 'The file was uploaded, but it did not contain readable text.',
  }
}

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9]{3,}/g) || []).slice(0, 500)
}

function scoreDocument(document, questionTokens) {
  const haystack = `${document.title} ${document.description} ${document.content}`.toLowerCase()
  let score = 0

  for (const token of questionTokens) {
    if (haystack.includes(token)) {
      score += token.length > 6 ? 2 : 1
    }
  }

  return score
}

function pickRelevantDocuments(question, documents) {
  const questionTokens = tokenize(question)

  return documents
    .filter((document) => document.indexed && document.content)
    .map((document) => ({
      ...document,
      score: scoreDocument(document, questionTokens),
    }))
    .filter((document) => document.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
}

function buildPrompt(settings, question, sources) {
  const context = sources.length
    ? sources
        .map((source, index) => {
          const trimmed = source.content.slice(0, Math.floor(MAX_CONTEXT_CHARS / Math.max(sources.length, 1)))
          return `Source ${index + 1}: ${source.title}
Category: ${source.category || 'Uncategorized'}
Content:
${trimmed}`
        })
        .join('\n\n---\n\n')
    : 'No relevant uploaded source matched the request.'

  return `${settings.systemPrompt}

Use the following knowledge base first. If it is insufficient, say what is missing instead of inventing details.

${context}

User request: ${question}`
}

function buildFallbackAnswer(question, sources, warning) {
  if (!sources.length) {
    return {
      answer: `I could not find a strong match in the uploaded knowledge base for: "${question}". Try uploading a more specific template or document, or connect a paid model API to get a richer answer.`,
      warning,
    }
  }

  const sourceSummary = sources
    .map((source) => `- ${source.title}: ${getExcerpt(source.content, 240)}`)
    .join('\n')

  return {
    answer: `Here is a grounded synthesis based on the best matching uploaded material:

${sourceSummary}

Suggested next step: ask a narrower follow-up question or connect Gemini / Anthropic to turn this retrieval into a stronger daily assistant.`,
    warning,
  }
}

async function callGemini(settings, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${encodeURIComponent(settings.apiKey)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const data = await response.json()
  const answer = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim()

  if (!answer) {
    throw new Error('Gemini did not return any text.')
  }

  return answer
}

async function callAnthropic(settings, prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 900,
      system: settings.systemPrompt,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const data = await response.json()
  const answer = data.content?.map((item) => item.text || '').join('\n').trim()

  if (!answer) {
    throw new Error('Anthropic did not return any text.')
  }

  return answer
}

async function answerWithProvider(settings, prompt) {
  if (settings.provider === 'anthropic') {
    return callAnthropic(settings, prompt)
  }

  return callGemini(settings, prompt)
}

function serializeDocument(document) {
  return {
    id: document.id,
    title: document.title,
    description: document.description,
    category: document.category,
    fileName: document.fileName,
    fileSize: document.fileSize,
    mimeType: document.mimeType,
    createdAt: document.createdAt,
    indexed: document.indexed,
    note: document.note,
    excerpt: getExcerpt(document.content),
    downloadUrl: `/uploads/${document.storedName}`,
  }
}

ensureStorage()

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, UPLOADS_DIR),
  filename: (_request, file, callback) => {
    const extension = path.extname(file.originalname)
    callback(null, `${crypto.randomUUID()}${extension}`)
  },
})

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
})

app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use('/uploads', express.static(UPLOADS_DIR))

app.get('/api/health', (_request, response) => {
  response.json({ ok: true })
})

app.get('/api/templates', (_request, response) => {
  const documents = getDocuments()
    .slice()
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .map(serializeDocument)

  response.json({ templates: documents })
})

app.post('/api/templates/upload', upload.single('file'), (request, response) => {
  if (!request.file) {
    return response.status(400).json({ error: 'A file is required.' })
  }

  const title = String(request.body.title || '').trim() || request.file.originalname
  const description = String(request.body.description || '').trim()
  const category = String(request.body.category || '').trim()
  const parsed = readTextFile(request.file.path, request.file.originalname)

  const documents = getDocuments()
  const document = {
    id: crypto.randomUUID(),
    title,
    description,
    category,
    fileName: request.file.originalname,
    storedName: request.file.filename,
    fileSize: request.file.size,
    mimeType: request.file.mimetype,
    createdAt: new Date().toISOString(),
    indexed: parsed.indexed,
    note: parsed.note,
    content: parsed.content,
  }

  documents.push(document)
  saveDocuments(documents)

  return response.status(201).json({
    message: 'Template uploaded successfully.',
    template: serializeDocument(document),
  })
})

app.delete('/api/templates/:id', (request, response) => {
  const documents = getDocuments()
  const document = documents.find((item) => item.id === request.params.id)

  if (!document) {
    return response.status(404).json({ error: 'Template not found.' })
  }

  const remaining = documents.filter((item) => item.id !== request.params.id)
  saveDocuments(remaining)

  const uploadPath = path.join(UPLOADS_DIR, document.storedName)
  if (fs.existsSync(uploadPath)) {
    fs.unlinkSync(uploadPath)
  }

  return response.json({ message: 'Template removed.' })
})

app.get('/api/settings', (_request, response) => {
  response.json({ settings: publicSettings(getSettings()) })
})

app.put('/api/settings', (request, response) => {
  const current = getSettings()
  const provider = request.body.provider === 'anthropic' ? 'anthropic' : 'gemini'
  const model = String(request.body.model || '').trim()
  const systemPrompt = String(request.body.systemPrompt || '').trim()
  const rawApiKey = typeof request.body.apiKey === 'string' ? request.body.apiKey.trim() : ''
  const removeApiKey = Boolean(request.body.removeApiKey)

  const nextSettings = {
    ...current,
    provider,
    model: model || (provider === 'anthropic' ? 'claude-3-7-sonnet-latest' : 'gemini-2.5-flash'),
    systemPrompt: systemPrompt || defaultSettings.systemPrompt,
    apiKey: removeApiKey ? '' : rawApiKey || current.apiKey,
    lastUpdated: new Date().toISOString(),
  }

  saveSettings(nextSettings)

  response.json({
    message: removeApiKey ? 'Stored API key cleared.' : 'Assistant settings saved.',
    settings: publicSettings(nextSettings),
  })
})

app.post('/api/assistant/query', async (request, response) => {
  const question = String(request.body.question || '').trim()

  if (!question) {
    return response.status(400).json({ error: 'A question is required.' })
  }

  const settings = getSettings()
  const documents = getDocuments()
  const relevantDocuments = pickRelevantDocuments(question, documents)
  const prompt = buildPrompt(settings, question, relevantDocuments)
  const sourcePayload = relevantDocuments.map((source) => ({
    id: source.id,
    title: source.title,
    category: source.category,
    score: source.score,
    excerpt: getExcerpt(source.content, 260),
  }))

  if (!settings.apiKey) {
    const fallback = buildFallbackAnswer(question, relevantDocuments)
    return response.json({
      answer: fallback.answer,
      warning: fallback.warning,
      providerUsed: 'local-demo',
      usedExternalApi: false,
      sources: sourcePayload,
    })
  }

  try {
    const answer = await answerWithProvider(settings, prompt)
    return response.json({
      answer,
      providerUsed: settings.provider,
      usedExternalApi: true,
      sources: sourcePayload,
    })
  } catch (error) {
    const fallback = buildFallbackAnswer(
      question,
      relevantDocuments,
      `The external provider request failed, so the app fell back to local retrieval. Details: ${error.message}`,
    )

    return response.json({
      answer: fallback.answer,
      warning: fallback.warning,
      providerUsed: 'local-demo',
      usedExternalApi: false,
      sources: sourcePayload,
    })
  }
})

app.listen(PORT, () => {
  console.log(`Research assistant backend listening on http://localhost:${PORT}`)
})
