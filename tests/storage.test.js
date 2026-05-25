import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("saveSettings merges and keeps missing keys", async () => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "assistant-storage-"));

  process.env.DATA_DIR = tempDirectory;
  process.env.GEMINI_API_KEY = "";
  process.env.CLOUD_CODE_API_KEY = "";

  const storage = await import(`../src/storage.js?test=${Date.now()}`);
  await storage.ensureDataFiles();

  await storage.saveSettings({
    provider: "cloud-code",
    cloudCode: {
      model: "gpt-4.1",
      baseUrl: "https://example.com/v1/chat/completions",
    },
  });

  const settings = await storage.loadSettings();
  assert.equal(settings.provider, "cloud-code");
  assert.equal(settings.cloudCode.model, "gpt-4.1");
  assert.equal(settings.cloudCode.baseUrl, "https://example.com/v1/chat/completions");
  assert.equal(settings.gemini.model, "gemini-2.5-flash");

  await rm(tempDirectory, { recursive: true, force: true });
});
