import { useEffect, useMemo, useState } from 'react'
import './App.css'

const quickPrompts = [
  'Give me a daily briefing based on the uploaded research templates.',
  'Draft a first response to a client using the most relevant template.',
  'Summarize the gaps in my documentation base and tell me what to upload next.',
]

const defaultSettings = {
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  systemPrompt:
    'You are a precise research assistant. Use the uploaded material first, quote source titles when useful, and openly state when the knowledge base is missing information.',
  hasApiKey: false,
}

const emptyUpload = {
  title: '',
  category: '',
  description: '',
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

function formatDate(isoDate) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoDate))
}

async function parseJson(response) {
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'Request failed.')
  }
  return payload
}

function App() {
  const [templates, setTemplates] = useState([])
  const [settings, setSettings] = useState(defaultSettings)
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [uploadForm, setUploadForm] = useState(emptyUpload)
  const [selectedFile, setSelectedFile] = useState(null)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Welcome. Upload your templates or research notes, connect a model API if you have one, and ask for grounded daily help from your own knowledge base.',
      providerUsed: 'local-demo',
      usedExternalApi: false,
      sources: [],
    },
  ])
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [asking, setAsking] = useState(false)

  const stats = useMemo(() => {
    const indexedCount = templates.filter((template) => template.indexed).length
    return {
      total: templates.length,
      indexed: indexedCount,
      lastSource: templates[0]?.title || 'No uploads yet',
    }
  }, [templates])

  useEffect(() => {
    void refreshTemplates()
    void refreshSettings()
  }, [])

  async function refreshTemplates() {
    setLoadingTemplates(true)
    try {
      const payload = await parseJson(await fetch('/api/templates'))
      setTemplates(payload.templates)
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setLoadingTemplates(false)
    }
  }

  async function refreshSettings() {
    setLoadingSettings(true)
    try {
      const payload = await parseJson(await fetch('/api/settings'))
      setSettings(payload.settings)
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setLoadingSettings(false)
    }
  }

  async function handleUpload(event) {
    event.preventDefault()

    if (!selectedFile) {
      setStatus({ type: 'error', message: 'Pick a file before uploading.' })
      return
    }

    const formData = new FormData()
    formData.append('title', uploadForm.title)
    formData.append('category', uploadForm.category)
    formData.append('description', uploadForm.description)
    formData.append('file', selectedFile)

    setUploading(true)
    try {
      const payload = await parseJson(
        await fetch('/api/templates/upload', {
          method: 'POST',
          body: formData,
        }),
      )

      setTemplates((current) => [payload.template, ...current])
      setUploadForm(emptyUpload)
      setSelectedFile(null)
      setStatus({ type: 'success', message: payload.message })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteTemplate(templateId) {
    const confirmed = window.confirm('Delete this uploaded template?')
    if (!confirmed) return

    try {
      const payload = await parseJson(
        await fetch(`/api/templates/${templateId}`, {
          method: 'DELETE',
        }),
      )

      setTemplates((current) => current.filter((template) => template.id !== templateId))
      setStatus({ type: 'success', message: payload.message })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    }
  }

  async function handleSaveSettings(event) {
    event.preventDefault()
    setSavingSettings(true)

    try {
      const payload = await parseJson(
        await fetch('/api/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider: settings.provider,
            model: settings.model,
            systemPrompt: settings.systemPrompt,
            apiKey: apiKeyDraft,
          }),
        }),
      )

      setSettings(payload.settings)
      setApiKeyDraft('')
      setStatus({ type: 'success', message: payload.message })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleClearApiKey() {
    setSavingSettings(true)

    try {
      const payload = await parseJson(
        await fetch('/api/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider: settings.provider,
            model: settings.model,
            systemPrompt: settings.systemPrompt,
            removeApiKey: true,
          }),
        }),
      )

      setSettings(payload.settings)
      setApiKeyDraft('')
      setStatus({ type: 'success', message: payload.message })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setSavingSettings(false)
    }
  }

  async function submitQuestion(nextQuestion = question) {
    const trimmedQuestion = nextQuestion.trim()
    if (!trimmedQuestion || asking) return

    setMessages((current) => [
      ...current,
      {
        role: 'user',
        content: trimmedQuestion,
      },
    ])
    setQuestion('')
    setAsking(true)

    try {
      const payload = await parseJson(
        await fetch('/api/assistant/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ question: trimmedQuestion }),
        }),
      )

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: payload.answer,
          providerUsed: payload.providerUsed,
          usedExternalApi: payload.usedExternalApi,
          warning: payload.warning,
          sources: payload.sources || [],
        },
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: 'The assistant request failed. Check the backend logs or your API configuration and try again.',
          providerUsed: 'local-demo',
          usedExternalApi: false,
          warning: error.message,
          sources: [],
        },
      ])
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div>
          <p className="eyebrow">Research knowledge base + daily AI help</p>
          <h1>Template-driven assistant for your researcher friend</h1>
          <p className="hero-copy">
            Upload reusable templates, notes, or process documents. Then connect Gemini or Claude,
            ask questions against that documentary base, and turn the site into a practical daily
            copilot.
          </p>
        </div>
        <div className="hero-actions">
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
            Buy / create Gemini API access
          </a>
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            Buy / create Claude API access
          </a>
        </div>
        <div className="stats-grid">
          <article className="stat-card">
            <span>Templates stored</span>
            <strong>{stats.total}</strong>
          </article>
          <article className="stat-card">
            <span>Indexed for grounding</span>
            <strong>{stats.indexed}</strong>
          </article>
          <article className="stat-card">
            <span>Assistant mode</span>
            <strong>{settings.hasApiKey ? settings.provider : 'local demo'}</strong>
          </article>
          <article className="stat-card">
            <span>Latest source</span>
            <strong>{stats.lastSource}</strong>
          </article>
        </div>
      </header>

      {status.message ? <div className={`status-banner ${status.type}`}>{status.message}</div> : null}

      <main className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">1. Build the documentary base</p>
              <h2>Upload templates and research material</h2>
            </div>
          </div>
          <form className="stacked-form" onSubmit={handleUpload}>
            <label>
              Title
              <input
                type="text"
                placeholder="Example: Macro daily briefing template"
                value={uploadForm.title}
                onChange={(event) => setUploadForm((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
            <label>
              Category
              <input
                type="text"
                placeholder="Economics, onboarding, outreach..."
                value={uploadForm.category}
                onChange={(event) => setUploadForm((current) => ({ ...current, category: event.target.value }))}
              />
            </label>
            <label>
              Description
              <textarea
                rows="4"
                placeholder="What this template is for and when the assistant should use it"
                value={uploadForm.description}
                onChange={(event) =>
                  setUploadForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </label>
            <label>
              File
              <input
                type="file"
                accept=".txt,.md,.markdown,.csv,.json,.html,.xml,.yml,.yaml,.js,.ts,.jsx,.tsx,.py,.prompt"
                onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              />
            </label>
            <p className="help-text">
              Best results come from text-based files. PDFs or office files can be converted to text
              before upload if you want them indexed for grounded answers.
            </p>
            <button className="primary-button" type="submit" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload template'}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">2. Let him manage the library</p>
              <h2>Document base</h2>
            </div>
            <button className="ghost-button" type="button" onClick={() => void refreshTemplates()}>
              Refresh
            </button>
          </div>
          {loadingTemplates ? <p className="empty-state">Loading templates...</p> : null}
          {!loadingTemplates && templates.length === 0 ? (
            <p className="empty-state">No templates uploaded yet. Start with a daily brief or note template.</p>
          ) : null}
          <div className="template-list">
            {templates.map((template) => (
              <article className="template-card" key={template.id}>
                <div className="template-header">
                  <div>
                    <h3>{template.title}</h3>
                    <p>{template.description || 'No description provided.'}</p>
                  </div>
                  <span className={`chip ${template.indexed ? 'ready' : 'muted'}`}>
                    {template.indexed ? 'Indexed' : 'Stored only'}
                  </span>
                </div>
                <dl className="meta-grid">
                  <div>
                    <dt>Category</dt>
                    <dd>{template.category || 'Uncategorized'}</dd>
                  </div>
                  <div>
                    <dt>Added</dt>
                    <dd>{formatDate(template.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>File</dt>
                    <dd>{template.fileName}</dd>
                  </div>
                  <div>
                    <dt>Size</dt>
                    <dd>{formatBytes(template.fileSize)}</dd>
                  </div>
                </dl>
                <p className="excerpt">{template.excerpt}</p>
                <p className="help-text">{template.note}</p>
                <div className="card-actions">
                  <a href={template.downloadUrl} target="_blank" rel="noreferrer">
                    Open file
                  </a>
                  <button className="danger-button" type="button" onClick={() => void handleDeleteTemplate(template.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">3. Connect a paid model</p>
              <h2>AI settings</h2>
            </div>
          </div>
          {loadingSettings ? <p className="empty-state">Loading assistant settings...</p> : null}
          {!loadingSettings ? (
            <form className="stacked-form" onSubmit={handleSaveSettings}>
              <label>
                Provider
                <select
                  value={settings.provider}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      provider: event.target.value,
                      model:
                        event.target.value === 'anthropic'
                          ? 'claude-3-7-sonnet-latest'
                          : 'gemini-2.5-flash',
                    }))
                  }
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="anthropic">Anthropic Claude</option>
                </select>
              </label>
              <label>
                Model
                <input
                  type="text"
                  value={settings.model}
                  onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))}
                />
              </label>
              <label>
                API key
                <input
                  type="password"
                  placeholder={settings.hasApiKey ? 'A key is already stored on the backend' : 'Paste a new API key'}
                  value={apiKeyDraft}
                  onChange={(event) => setApiKeyDraft(event.target.value)}
                />
              </label>
              <label>
                System behavior
                <textarea
                  rows="5"
                  value={settings.systemPrompt}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, systemPrompt: event.target.value }))
                  }
                />
              </label>
              <p className="help-text">
                For this demo the key is stored locally on the backend machine. In production you would
                move it to a secure secret manager or server-only environment variable. Note: Claude
                Code itself is not the API product; the compatible paid API is Anthropic Claude.
              </p>
              <div className="button-row">
                <button className="primary-button" type="submit" disabled={savingSettings}>
                  {savingSettings ? 'Saving...' : 'Save AI settings'}
                </button>
                <button className="ghost-button" type="button" onClick={() => void handleClearApiKey()}>
                  Clear stored key
                </button>
              </div>
            </form>
          ) : null}
        </section>

        <section className="panel assistant-panel">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">4. Ask for daily help</p>
              <h2>Grounded assistant</h2>
            </div>
            <span className={`chip ${settings.hasApiKey ? 'ready' : 'muted'}`}>
              {settings.hasApiKey ? 'External API connected' : 'Local retrieval mode'}
            </span>
          </div>

          <div className="quick-prompts">
            {quickPrompts.map((prompt) => (
              <button key={prompt} type="button" className="ghost-button" onClick={() => void submitQuestion(prompt)}>
                {prompt}
              </button>
            ))}
          </div>

          <div className="message-list">
            {messages.map((message, index) => (
              <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <div className="message-topline">
                  <strong>{message.role === 'assistant' ? 'Assistant' : 'You'}</strong>
                  {message.role === 'assistant' ? (
                    <span className="provider-pill">
                      {message.usedExternalApi ? `via ${message.providerUsed}` : 'local retrieval'}
                    </span>
                  ) : null}
                </div>
                <p>{message.content}</p>
                {message.warning ? <p className="warning-text">{message.warning}</p> : null}
                {message.sources?.length ? (
                  <div className="sources-block">
                    <span>Sources used</span>
                    <ul>
                      {message.sources.map((source) => (
                        <li key={source.id}>
                          <strong>{source.title}</strong>
                          <p>{source.excerpt}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <form
            className="assistant-form"
            onSubmit={(event) => {
              event.preventDefault()
              void submitQuestion()
            }}
          >
            <textarea
              rows="4"
              placeholder="Ask for a summary, a draft, a daily brief, or help grounded in the uploaded templates"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <div className="button-row">
              <button className="primary-button" type="submit" disabled={asking}>
                {asking ? 'Thinking...' : 'Ask assistant'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  )
}

export default App
