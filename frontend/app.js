const uploadForm = document.querySelector("#upload-form");
const chatForm = document.querySelector("#chat-form");
const documentsEl = document.querySelector("#documents");
const documentCountEl = document.querySelector("#document-count");
const uploadStatus = document.querySelector("#upload-status");
const chatStatus = document.querySelector("#chat-status");
const answerEl = document.querySelector("#answer");
const refreshButton = document.querySelector("#refresh");
const providerEl = document.querySelector("#provider");
const modelEl = document.querySelector("#model");
const fileEl = document.querySelector("#file");
const titleEl = document.querySelector("#title");
const contentEl = document.querySelector("#content");
const questionEl = document.querySelector("#question");

const DEFAULT_MODELS = {
  local: "retrieval-summary",
  gemini: "gemini-1.5-flash",
  claude: "claude-3-5-sonnet-latest"
};

function setStatus(element, message, type = "") {
  element.textContent = message;
  element.className = `status ${type}`.trim();
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

async function loadDocuments() {
  const documents = await requestJson("/api/documents");
  const label = documents.length === 1 ? "1 document" : `${documents.length} documents`;
  documentCountEl.textContent = label;

  if (documents.length === 0) {
    documentsEl.className = "documents empty";
    documentsEl.textContent = "No documents uploaded yet.";
    return;
  }

  documentsEl.className = "documents";
  documentsEl.innerHTML = documents
    .map(
      (document) => `
        <article class="document-card">
          <div class="document-meta">
            <span>${escapeHtml(document.kind)}</span>
            <span>${document.wordCount} words</span>
          </div>
          <h3>${escapeHtml(document.title)}</h3>
          <p>${escapeHtml(document.preview)}</p>
          <small>Uploaded ${formatDate(document.createdAt)}</small>
          <div style="margin-top: 14px">
            <button class="delete" type="button" data-id="${escapeHtml(document.id)}">Delete</button>
          </div>
        </article>
      `
    )
    .join("");
}

async function readSelectedFile() {
  const file = fileEl.files?.[0];

  if (!file) {
    return "";
  }

  if (!titleEl.value.trim()) {
    titleEl.value = file.name.replace(/\.[^.]+$/, "");
  }

  return file.text();
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(uploadStatus, "Saving document...");

  try {
    const fileText = await readSelectedFile();
    const payload = {
      title: titleEl.value,
      kind: document.querySelector("#kind").value,
      content: fileText || contentEl.value,
      source: fileText ? fileEl.files[0].name : "manual-paste"
    };

    await requestJson("/api/documents", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    uploadForm.reset();
    setStatus(uploadStatus, "Saved to the knowledge base.", "success");
    await loadDocuments();
  } catch (error) {
    setStatus(uploadStatus, error.message, "error");
  }
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(chatStatus, "Asking assistant...");
  answerEl.classList.add("hidden");

  try {
    const payload = {
      provider: providerEl.value,
      model: modelEl.value.trim() || undefined,
      apiKey: document.querySelector("#api-key").value.trim() || undefined,
      question: questionEl.value
    };

    const response = await requestJson("/api/chat", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const sourceList =
      response.sources.length > 0
        ? response.sources.map((source) => `${escapeHtml(source.title)} (${escapeHtml(source.kind)})`).join(", ")
        : "No matching sources";

    answerEl.innerHTML = `
      <h3>Assistant answer</h3>
      <div class="answer-meta">Provider: ${escapeHtml(response.provider)} · Model: ${escapeHtml(response.model)} · Sources: ${sourceList}</div>
      <div>${escapeHtml(response.answer)}</div>
    `;
    answerEl.classList.remove("hidden");
    setStatus(chatStatus, "Answer ready.", "success");
  } catch (error) {
    setStatus(chatStatus, error.message, "error");
  }
});

documentsEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-id]");

  if (!button) {
    return;
  }

  await requestJson(`/api/documents/${encodeURIComponent(button.dataset.id)}`, {
    method: "DELETE"
  });
  await loadDocuments();
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    questionEl.value = button.dataset.prompt;
    questionEl.focus();
  });
});

providerEl.addEventListener("change", () => {
  modelEl.placeholder = DEFAULT_MODELS[providerEl.value];
});

refreshButton.addEventListener("click", () => {
  loadDocuments().catch((error) => setStatus(uploadStatus, error.message, "error"));
});

modelEl.placeholder = DEFAULT_MODELS[providerEl.value];
loadDocuments().catch((error) => setStatus(uploadStatus, error.message, "error"));
