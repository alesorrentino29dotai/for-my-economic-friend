import { describe, expect, it } from "vitest";
import { buildSources } from "./retrieval.js";
import type { InternalDocument } from "./storage.js";

describe("buildSources", () => {
  it("orders document snippets by term relevance", () => {
    const documents: InternalDocument[] = [
      {
        id: "macro",
        originalName: "macro.md",
        fileName: "macro.md",
        mimeType: "text/markdown",
        size: 12,
        uploadedAt: new Date().toISOString(),
        preview: "inflazione e pil",
        extractedText: "Questa nota parla di inflazione, pil e domanda aggregata."
      },
      {
        id: "template",
        originalName: "template.md",
        fileName: "template.md",
        mimeType: "text/markdown",
        size: 12,
        uploadedAt: new Date().toISOString(),
        preview: "template",
        extractedText: "Template per interviste qualitative."
      }
    ];

    const sources = buildSources("Come interpretare inflazione e PIL?", documents);

    expect(sources[0]).toMatchObject({
      documentId: "macro",
      documentName: "macro.md"
    });
    expect(sources[0].snippet).toContain("inflazione");
  });
});
