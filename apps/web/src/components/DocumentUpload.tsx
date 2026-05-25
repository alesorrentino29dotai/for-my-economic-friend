import type { StoredDocument } from "@research-assistant/shared";
import { useRef, useState } from "react";
import { uploadDocument } from "../lib/api";

type DocumentUploadProps = {
  onUploaded: (document: StoredDocument) => void;
};

export function DocumentUpload({ onUploaded }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }

    setIsUploading(true);
    setMessage(null);
    try {
      const document = await uploadDocument(file);
      onUploaded(document);
      setMessage(`${file.name} caricato nella base documentale.`);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload non riuscito.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="card accent-card">
      <div className="section-heading">
        <p className="eyebrow">Base documentale</p>
        <h2>Carica template, note e materiali</h2>
        <p>
          I file testuali vengono indicizzati subito. PDF e Word sono salvati e pronti per
          un estrattore dedicato in produzione.
        </p>
      </div>

      <label className="drop-zone">
        <input
          ref={inputRef}
          type="file"
          onChange={(event) => void handleFiles(event.target.files)}
          disabled={isUploading}
        />
        <span>{isUploading ? "Caricamento..." : "Scegli un file da aggiungere"}</span>
        <small>TXT, Markdown, CSV, JSON e altri template fino a 15 MB</small>
      </label>

      {message ? <p className="status-message">{message}</p> : null}
    </section>
  );
}
