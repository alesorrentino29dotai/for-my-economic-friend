const uploadForm = document.querySelector("#upload-form");
const uploadStatus = document.querySelector("#upload-status");
const settingsForm = document.querySelector("#settings-form");
const settingsStatus = document.querySelector("#settings-status");
const helpForm = document.querySelector("#help-form");
const helpAnswer = document.querySelector("#help-answer");
const helpMeta = document.querySelector("#help-meta");
const documentsList = document.querySelector("#documents-list");

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.style.color = isError ? "#ff9fa4" : "#a6ffcd";
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

function renderDocuments(documents) {
  documentsList.innerHTML = "";
  if (!documents.length) {
    const item = document.createElement("li");
    item.textContent = "No templates uploaded yet.";
    documentsList.append(item);
    return;
  }

  for (const documentItem of documents) {
    const item = document.createElement("li");
    const tags = (documentItem.tags ?? []).join(", ");
    item.textContent = `${documentItem.title} (${documentItem.filename}) - uploaded ${formatDate(documentItem.uploadedAt)}${tags ? ` - tags: ${tags}` : ""}`;
    documentsList.append(item);
  }
}

async function loadDocuments() {
  const response = await fetch("/api/documents");
  const payload = await response.json();
  renderDocuments(payload.documents || []);
}

async function loadSettings() {
  const response = await fetch("/api/settings");
  const payload = await response.json();
  const settings = payload.settings;

  settingsForm.provider.value = settings.provider;
  settingsForm.geminiModel.value = settings.gemini.model;
  settingsForm.cloudCodeModel.value = settings.cloudCode.model;
  settingsForm.cloudCodeBaseUrl.value = settings.cloudCode.baseUrl;

  setStatus(
    settingsStatus,
    `Loaded settings. Gemini key: ${settings.gemini.hasApiKey ? "configured" : "missing"} | Cloud Code key: ${settings.cloudCode.hasApiKey ? "configured" : "missing"}`,
  );
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(uploadStatus, "Uploading...");

  try {
    const formData = new FormData(uploadForm);
    const response = await fetch("/api/documents", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Upload failed");
    }

    setStatus(uploadStatus, `Uploaded: ${payload.document.title}`);
    uploadForm.reset();
    await loadDocuments();
  } catch (error) {
    setStatus(uploadStatus, error.message, true);
  }
});

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(settingsStatus, "Saving settings...");

  try {
    const body = {
      provider: settingsForm.provider.value,
      gemini: {
        apiKey: settingsForm.geminiApiKey.value,
        model: settingsForm.geminiModel.value,
      },
      cloudCode: {
        apiKey: settingsForm.cloudCodeApiKey.value,
        model: settingsForm.cloudCodeModel.value,
        baseUrl: settingsForm.cloudCodeBaseUrl.value,
      },
    };

    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Saving settings failed");
    }

    settingsForm.geminiApiKey.value = "";
    settingsForm.cloudCodeApiKey.value = "";
    setStatus(
      settingsStatus,
      `Saved. Current provider: ${payload.settings.provider}. Gemini key set: ${payload.settings.gemini.hasApiKey ? "yes" : "no"}. Cloud Code key set: ${payload.settings.cloudCode.hasApiKey ? "yes" : "no"}.`,
    );
  } catch (error) {
    setStatus(settingsStatus, error.message, true);
  }
});

helpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  helpMeta.textContent = "Generating answer...";
  helpAnswer.textContent = "";

  try {
    const question = helpForm.question.value;
    const response = await fetch("/api/help/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not generate help");
    }

    helpMeta.textContent = `Provider: ${payload.providerUsed} | Generated at: ${formatDate(payload.generatedAt)} | Documents used: ${payload.usedDocuments.length}`;
    helpAnswer.textContent = payload.answer;
  } catch (error) {
    helpMeta.textContent = "";
    helpAnswer.textContent = error.message;
  }
});

await Promise.all([loadDocuments(), loadSettings()]);
