import type { StoredDocument } from "@research-assistant/shared";

type DocumentListProps = {
  documents: StoredDocument[];
};

export function DocumentList({ documents }: DocumentListProps) {
  return (
    <section className="card">
      <div className="section-heading">
        <p className="eyebrow">Archivio</p>
        <h2>{documents.length} documenti caricati</h2>
      </div>

      <div className="document-list">
        {documents.length === 0 ? (
          <p className="muted">
            Nessun documento ancora presente. Carica un template per iniziare a fare domande
            alla base documentale.
          </p>
        ) : (
          documents.map((document) => (
            <article className="document-item" key={document.id}>
              <div>
                <h3>{document.originalName}</h3>
                <p>{document.preview || "Anteprima non disponibile."}</p>
              </div>
              <span>{formatBytes(document.size)}</span>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
