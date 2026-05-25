import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  AssistantResponse,
  DashboardState,
  PromptTemplate,
  ProviderId,
  PublicAISettings
} from "@shared/contracts";

type Banner = {
  tone: "success" | "error";
  text: string;
};

type TemplateFormState = {
  id: string | null;
  name: string;
  description: string;
  content: string;
};

type SettingsFormState = {
  provider: ProviderId;
  model: string;
  apiKey: string;
  defaultTemplateId: string;
  researcherName: string;
  companionGoal: string;
  clearApiKey: boolean;
};

const emptyTemplateForm: TemplateFormState = {
  id: null,
  name: "",
  description: "",
  content: ""
};

async function readJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload as T;
}

function toSettingsForm(settings: PublicAISettings): SettingsFormState {
  return {
    provider: settings.provider,
    model: settings.model,
    apiKey: "",
    defaultTemplateId: settings.defaultTemplateId ?? "",
    researcherName: settings.researcherName,
    companionGoal: settings.companionGoal,
    clearApiKey: false
  };
}

function App() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(emptyTemplateForm);
  const [settingsForm, setSettingsForm] = useState<SettingsFormState | null>(null);
  const [assistantText, setAssistantText] = useState(
    "What should I focus on today based on the documentary base?"
  );
  const [assistantTemplateId, setAssistantTemplateId] = useState("");
  const [assistantResult, setAssistantResult] = useState<AssistantResponse | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);

  async function loadState() {
    const payload = await readJson<DashboardState>("/api/app-state");
    setState(payload);
    setSettingsForm(toSettingsForm(payload.settings));
    setAssistantTemplateId((current) => current || payload.settings.defaultTemplateId || payload.templates[0]?.id || "");
  }

  useEffect(() => {
    loadState().catch((error: Error) => {
      setBanner({ tone: "error", text: error.message });
    });
  }, []);

  const selectedTemplate = useMemo(
    () => state?.templates.find((template) => template.id === templateForm.id) ?? null,
    [state, templateForm.id]
  );

  function editTemplate(template: PromptTemplate) {
    setTemplateForm({
      id: template.id,
      name: template.name,
      description: template.description,
      content: template.content
    });
  }

  function resetTemplateForm() {
    setTemplateForm(emptyTemplateForm);
  }

  async function submitTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("template");
    setBanner(null);

    try {
      const method = templateForm.id ? "PUT" : "POST";
      const endpoint = templateForm.id ? `/api/templates/${templateForm.id}` : "/api/templates";

      await readJson(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateForm.name,
          description: templateForm.description,
          content: templateForm.content
        })
      });

      await loadState();
      resetTemplateForm();
      setBanner({
        tone: "success",
        text: method === "POST" ? "Template created." : "Template updated."
      });
    } catch (error) {
      setBanner({ tone: "error", text: error instanceof Error ? error.message : "Template save failed." });
    } finally {
      setBusyAction(null);
    }
  }

  async function uploadTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("upload-template");
    setBanner(null);

    try {
      const formData = new FormData(event.currentTarget);
      await readJson("/api/templates/upload", {
        method: "POST",
        body: formData
      });
      await loadState();
      event.currentTarget.reset();
      setBanner({ tone: "success", text: "Template file uploaded." });
    } catch (error) {
      setBanner({ tone: "error", text: error instanceof Error ? error.message : "Upload failed." });
    } finally {
      setBusyAction(null);
    }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("upload-document");
    setBanner(null);

    try {
      const formData = new FormData(event.currentTarget);
      await readJson("/api/documents/upload", {
        method: "POST",
        body: formData
      });
      await loadState();
      event.currentTarget.reset();
      setBanner({ tone: "success", text: "Document added to the knowledge base." });
    } catch (error) {
      setBanner({ tone: "error", text: error instanceof Error ? error.message : "Document upload failed." });
    } finally {
      setBusyAction(null);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settingsForm) {
      return;
    }

    setBusyAction("settings");
    setBanner(null);

    try {
      await readJson("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settingsForm.provider,
          model: settingsForm.model,
          apiKey: settingsForm.apiKey || undefined,
          defaultTemplateId: settingsForm.defaultTemplateId || null,
          researcherName: settingsForm.researcherName,
          companionGoal: settingsForm.companionGoal,
          clearApiKey: settingsForm.clearApiKey
        })
      });
      await loadState();
      setSettingsForm((current) =>
        current
          ? {
              ...current,
              apiKey: "",
              clearApiKey: false
            }
          : current
      );
      setBanner({ tone: "success", text: "Provider settings saved." });
    } catch (error) {
      setBanner({ tone: "error", text: error instanceof Error ? error.message : "Settings save failed." });
    } finally {
      setBusyAction(null);
    }
  }

  async function runAssistant(mode: "chat" | "daily") {
    setBusyAction(mode);
    setBanner(null);

    try {
      const endpoint = mode === "chat" ? "/api/assistant/chat" : "/api/assistant/daily-brief";
      const payload =
        mode === "chat"
          ? { message: assistantText, templateId: assistantTemplateId || null }
          : { focus: assistantText, templateId: assistantTemplateId || null };

      const result = await readJson<AssistantResponse>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      setAssistantResult(result);
      setBanner({
        tone: "success",
        text: mode === "chat" ? "Assistant response generated." : "Daily brief generated."
      });
    } catch (error) {
      setBanner({ tone: "error", text: error instanceof Error ? error.message : "Assistant request failed." });
    } finally {
      setBusyAction(null);
    }
  }

  if (!state || !settingsForm) {
    return <div className="shell loading">Loading the researcher companion...</div>;
  }

  return (
    <div className="shell">
      <header className="hero card">
        <div>
          <p className="eyebrow">Frontend + backend demo</p>
          <h1>Researcher Companion</h1>
          <p className="hero-copy">
            A single workspace where a researcher can upload prompt templates, curate a documentary
            base, connect a paid LLM provider, and ask for grounded daily help.
          </p>
        </div>
        <div className="stats">
          <div className="stat-card">
            <span className="stat-label">Templates</span>
            <strong>{state.templates.length}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Documents</span>
            <strong>{state.documents.length}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Provider</span>
            <strong>{state.settings.provider}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">API key</span>
            <strong>{state.settings.hasApiKey ? "configured" : "demo only"}</strong>
          </div>
        </div>
      </header>

      {banner ? <div className={`banner ${banner.tone}`}>{banner.text}</div> : null}

      <main className="layout">
        <section className="card">
          <div className="section-header">
            <div>
              <p className="eyebrow">1. Prompt operations</p>
              <h2>Template manager</h2>
            </div>
            <button className="ghost-button" onClick={resetTemplateForm} type="button">
              New template
            </button>
          </div>

          <div className="section-grid">
            <div className="stack">
              {state.templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={`list-card ${selectedTemplate?.id === template.id ? "active" : ""}`}
                  onClick={() => editTemplate(template)}
                >
                  <div className="list-card-top">
                    <strong>{template.name}</strong>
                    <span>{new Date(template.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <p>{template.description || "No description yet."}</p>
                </button>
              ))}
            </div>

            <div className="stack">
              <form className="stack" onSubmit={submitTemplate}>
                <label>
                  Template name
                  <input
                    value={templateForm.name}
                    onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Daily synthesis template"
                    required
                  />
                </label>
                <label>
                  Description
                  <input
                    value={templateForm.description}
                    onChange={(event) =>
                      setTemplateForm((current) => ({ ...current, description: event.target.value }))
                    }
                    placeholder="When should this prompt style be used?"
                  />
                </label>
                <label>
                  Template content
                  <textarea
                    value={templateForm.content}
                    onChange={(event) => setTemplateForm((current) => ({ ...current, content: event.target.value }))}
                    placeholder="Explain how the assistant should answer."
                    rows={9}
                    required
                  />
                </label>
                <button className="primary-button" disabled={busyAction === "template"} type="submit">
                  {templateForm.id ? "Update template" : "Create template"}
                </button>
              </form>

              <form className="upload-form" onSubmit={uploadTemplate}>
                <h3>Upload a template file</h3>
                <input name="name" placeholder="Optional display name" />
                <input name="description" placeholder="Optional description" />
                <input accept=".txt,.md,.json,.html" name="file" required type="file" />
                <button className="secondary-button" disabled={busyAction === "upload-template"} type="submit">
                  Upload template
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="section-header">
            <div>
              <p className="eyebrow">2. Documentary base</p>
              <h2>Knowledge uploads</h2>
            </div>
          </div>

          <div className="section-grid">
            <form className="upload-form" onSubmit={uploadDocument}>
              <h3>Add a document</h3>
              <input name="name" placeholder="Optional document name" />
              <input name="tags" placeholder="Tags separated by commas" />
              <input accept=".txt,.md,.json,.html,.csv" name="file" required type="file" />
              <button className="primary-button" disabled={busyAction === "upload-document"} type="submit">
                Upload document
              </button>
            </form>

            <div className="stack">
              {state.documents.map((document) => (
                <article className="list-card static" key={document.id}>
                  <div className="list-card-top">
                    <strong>{document.name}</strong>
                    <span>{document.filename}</span>
                  </div>
                  <p>{document.excerpt}</p>
                  <div className="tag-row">
                    {document.tags.length > 0 ? (
                      document.tags.map((tag) => (
                        <span className="tag" key={tag}>
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="tag muted">No tags</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="section-header">
            <div>
              <p className="eyebrow">3. API wiring</p>
              <h2>Provider settings</h2>
            </div>
          </div>

          <div className="provider-guides">
            {state.providerGuides.map((guide) => (
              <article className="guide-card" key={guide.id}>
                <strong>{guide.name}</strong>
                <p>{guide.description}</p>
                <div className="guide-actions">
                  <a href={guide.purchaseUrl} rel="noreferrer" target="_blank">
                    Get API key
                  </a>
                  <a href={guide.billingUrl} rel="noreferrer" target="_blank">
                    Billing
                  </a>
                </div>
              </article>
            ))}
          </div>

          <form className="settings-form" onSubmit={saveSettings}>
            <label>
              Provider
              <select
                value={settingsForm.provider}
                onChange={(event) =>
                  setSettingsForm((current) =>
                    current
                      ? {
                          ...current,
                          provider: event.target.value as ProviderId,
                          model:
                            event.target.value === "gemini"
                              ? "gemini-2.5-flash"
                              : event.target.value === "anthropic"
                                ? "claude-3-5-sonnet-latest"
                                : "demo-research-companion"
                        }
                      : current
                  )
                }
              >
                <option value="demo">Demo mode</option>
                <option value="gemini">Gemini</option>
                <option value="anthropic">Anthropic Claude</option>
              </select>
            </label>

            <label>
              Model
              <input
                value={settingsForm.model}
                onChange={(event) =>
                  setSettingsForm((current) => (current ? { ...current, model: event.target.value } : current))
                }
                placeholder="gemini-2.5-flash"
              />
            </label>

            <label>
              Researcher name
              <input
                value={settingsForm.researcherName}
                onChange={(event) =>
                  setSettingsForm((current) =>
                    current ? { ...current, researcherName: event.target.value } : current
                  )
                }
              />
            </label>

            <label>
              Default template
              <select
                value={settingsForm.defaultTemplateId}
                onChange={(event) =>
                  setSettingsForm((current) =>
                    current ? { ...current, defaultTemplateId: event.target.value } : current
                  )
                }
              >
                <option value="">No default</option>
                {state.templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="full-width">
              Companion goal
              <textarea
                rows={4}
                value={settingsForm.companionGoal}
                onChange={(event) =>
                  setSettingsForm((current) =>
                    current ? { ...current, companionGoal: event.target.value } : current
                  )
                }
              />
            </label>

            <label className="full-width">
              New API key
              <input
                type="password"
                value={settingsForm.apiKey}
                onChange={(event) =>
                  setSettingsForm((current) => (current ? { ...current, apiKey: event.target.value } : current))
                }
                placeholder={
                  state.settings.hasApiKey
                    ? `Existing key: ${state.settings.maskedApiKey ?? "configured"}`
                    : "Paste a provider API key"
                }
              />
            </label>

            <label className="checkbox">
              <input
                checked={settingsForm.clearApiKey}
                onChange={(event) =>
                  setSettingsForm((current) =>
                    current ? { ...current, clearApiKey: event.target.checked } : current
                  )
                }
                type="checkbox"
              />
              Clear the currently stored API key on save
            </label>

            <button className="primary-button" disabled={busyAction === "settings"} type="submit">
              Save provider settings
            </button>
          </form>
        </section>

        <section className="card">
          <div className="section-header">
            <div>
              <p className="eyebrow">4. Daily help</p>
              <h2>Document-grounded assistant</h2>
            </div>
          </div>

          <div className="assistant-controls">
            <label>
              Template for this run
              <select value={assistantTemplateId} onChange={(event) => setAssistantTemplateId(event.target.value)}>
                <option value="">Use saved default</option>
                {state.templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Request
              <textarea
                rows={6}
                value={assistantText}
                onChange={(event) => setAssistantText(event.target.value)}
                placeholder="Ask a question or describe the daily brief you want."
              />
            </label>

            <div className="action-row">
              <button className="primary-button" disabled={busyAction === "chat"} onClick={() => runAssistant("chat")}>
                Ask question
              </button>
              <button
                className="secondary-button"
                disabled={busyAction === "daily"}
                onClick={() => runAssistant("daily")}
              >
                Generate daily brief
              </button>
            </div>
          </div>

          <div className="assistant-output">
            {assistantResult ? (
              <>
                <div className="result-meta">
                  <span>{assistantResult.mode === "live" ? "Live provider" : "Demo mode"}</span>
                  <span>
                    {assistantResult.provider} / {assistantResult.model}
                  </span>
                </div>
                <pre>{assistantResult.answer}</pre>
                <h3>Sources used</h3>
                <div className="stack">
                  {assistantResult.sources.map((source) => (
                    <article className="list-card static" key={`${source.documentId}-${source.snippet}`}>
                      <div className="list-card-top">
                        <strong>{source.documentName}</strong>
                        <span>score {source.score}</span>
                      </div>
                      <p>{source.snippet}</p>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p className="empty-state">
                Ask a question or generate a daily brief to see how the documentary base feeds the assistant.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
