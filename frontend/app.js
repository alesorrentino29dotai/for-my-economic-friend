const settingsForm = document.querySelector("#settings-form");
const providerInput = document.querySelector("#provider");
const modelInput = document.querySelector("#model");
const baseUrlInput = document.querySelector("#base-url");
const baseUrlWrapper = document.querySelector("#base-url-wrapper");
const apiKeyInput = document.querySelector("#api-key");

const uploadForm = document.querySelector("#upload-form");
const templatesList = document.querySelector("#templates-list");
const templateItem = document.querySelector("#template-item");

const chatForm = document.querySelector("#chat-form");
const questionInput = document.querySelector("#question");
const chatLog = document.querySelector("#chat-log");

const SETTINGS_STORAGE_KEY = "research-assistant-settings";
let templates = [];

function notify(message) {
  window.alert(message);
}

function readSettingsFromUi() {
  return {
    provider: providerInput.value,
    model: modelInput.value.trim(),
    baseUrl: baseUrlInput.value.trim(),
    apiKey: apiKeyInput.value.trim(),
  };
}

function applyProviderDefaults(provider) {
  if (provider === "gemini") {
    modelInput.value = modelInput.value || "gemini-1.5-flash";
    baseUrlWrapper.classList.add("hidden");
    return;
  }

  modelInput.value = modelInput.value || "gpt-4o-mini";
  baseUrlWrapper.classList.remove("hidden");
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) {
    providerInput.value = "gemini";
    modelInput.value = "gemini-1.5-flash";
    applyProviderDefaults("gemini");
    return;
  }

  const parsed = JSON.parse(raw);
  providerInput.value = parsed.provider || "gemini";
  modelInput.value =
    parsed.model ||
    (providerInput.value === "gemini" ? "gemini-1.5-flash" : "gpt-4o-mini");
  baseUrlInput.value = parsed.baseUrl || "";
  apiKeyInput.value = parsed.apiKey || "";
  applyProviderDefaults(providerInput.value);
}

function createMetaLine(template) {
  const kb = Math.ceil(template.size / 1024);
  const tags = template.tags?.length ? ` | tags: ${template.tags.join(", ")}` : "";
  return `${template.mimeType} | ${kb} KB${tags}`;
}

function selectedTemplateIds() {
  return templatesList.querySelectorAll(".template-checkbox:checked")
    ? Array.from(
        templatesList.querySelectorAll(".template-checkbox:checked"),
        (input) => input.value
      )
    : [];
}

function appendMessage(role, text) {
  const p = document.createElement("p");
  p.className = `chat-msg ${role}`;
  p.textContent = text;
  chatLog.appendChild(p);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function fetchTemplates() {
  const response = await fetch("/api/templates");
  if (!response.ok) {
    throw new Error("Unable to fetch templates.");
  }
  const data = await response.json();
  templates = data.templates || [];
}

function renderTemplates() {
  templatesList.innerHTML = "";
  if (templates.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No template uploaded yet.";
    empty.className = "template-meta";
    templatesList.appendChild(empty);
    return;
  }

  templates.forEach((template) => {
    const node = templateItem.content.cloneNode(true);
    const checkbox = node.querySelector(".template-checkbox");
    const title = node.querySelector(".template-title");
    const meta = node.querySelector(".template-meta");
    const desc = node.querySelector(".template-desc");
    const deleteButton = node.querySelector(".delete");

    checkbox.value = template.id;
    checkbox.checked = true;
    title.textContent = template.title;
    meta.textContent = createMetaLine(template);
    desc.textContent = template.description || "No description.";

    deleteButton.addEventListener("click", async () => {
      if (!window.confirm(`Delete "${template.title}"?`)) {
        return;
      }

      const response = await fetch(`/api/templates/${template.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        notify("Could not delete template.");
        return;
      }

      await refreshTemplates();
    });

    templatesList.appendChild(node);
  });
}

async function refreshTemplates() {
  await fetchTemplates();
  renderTemplates();
}

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const settings = readSettingsFromUi();
  if (!settings.apiKey) {
    notify("Please provide an API key.");
    return;
  }

  saveSettings(settings);
  notify("Local settings saved.");
});

providerInput.addEventListener("change", () => {
  if (providerInput.value === "gemini") {
    if (!modelInput.value || modelInput.value.includes("gpt")) {
      modelInput.value = "gemini-1.5-flash";
    }
  } else if (!modelInput.value || modelInput.value.includes("gemini")) {
    modelInput.value = "gpt-4o-mini";
  }

  applyProviderDefaults(providerInput.value);
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const fileInput = document.querySelector("#file");
  if (!fileInput.files?.[0]) {
    notify("Please choose a file to upload.");
    return;
  }

  const payload = new FormData();
  payload.append("file", fileInput.files[0]);
  payload.append("title", document.querySelector("#title").value);
  payload.append("description", document.querySelector("#description").value);
  payload.append("tags", document.querySelector("#tags").value);

  const response = await fetch("/api/templates", {
    method: "POST",
    body: payload,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    notify(data.error || "Upload failed.");
    return;
  }

  uploadForm.reset();
  await refreshTemplates();
  notify("Template uploaded.");
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const settings = readSettingsFromUi();
  if (!settings.apiKey) {
    notify("Please set and save your API key first.");
    return;
  }

  const question = questionInput.value.trim();
  if (!question) {
    notify("Please type a question.");
    return;
  }

  const templateIds = selectedTemplateIds();
  appendMessage("user", question);
  questionInput.value = "";

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: settings.provider,
      apiKey: settings.apiKey,
      model: settings.model,
      baseUrl: settings.baseUrl,
      message: question,
      templateIds,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    appendMessage("error", data.error || "Assistant request failed.");
    return;
  }

  const sourceLine = data.usedSources?.length
    ? `\n\nSources: ${data.usedSources.map((s) => s.title).join(", ")}`
    : "";
  appendMessage("assistant", `${data.answer}${sourceLine}`);
});

async function bootstrap() {
  loadSettings();
  await refreshTemplates();
  appendMessage(
    "assistant",
    "Assistant ready. Upload templates, configure your API, and ask your daily research questions."
  );
}

bootstrap().catch((error) => {
  appendMessage("error", `Initialization failed: ${error.message}`);
});
