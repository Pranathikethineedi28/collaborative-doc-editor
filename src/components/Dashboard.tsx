"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DocSummary } from "@/lib/documents";
import { api, timeAgo } from "./api";

const ACCEPT = ".txt,.md,.docx";

export function Dashboard({ owned: initialOwned, shared }: { owned: DocSummary[]; shared: DocSummary[] }) {
  const router = useRouter();
  const [owned, setOwned] = useState(initialOwned);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "create" | "import">(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function createDoc() {
    setBusy("create");
    setError(null);
    try {
      const { document } = await api<{ document: DocSummary }>("/api/documents", { method: "POST", json: {} });
      router.push(`/docs/${document.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function importFile(file: File) {
    setBusy("import");
    setError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const { document } = await api<{ document: DocSummary }>("/api/documents/import", { method: "POST", body: form });
      router.push(`/docs/${document.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function deleteDoc(id: string) {
    setError(null);
    try {
      await api(`/api/documents/${id}`, { method: "DELETE" });
      setOwned((docs) => docs.filter((d) => d.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Documents</h1>
          <div className="hint">Import supports .txt, .md and .docx files up to 5 MB.</div>
        </div>
        <div className="actions">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            id="import-file"
            onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
          />
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
            {busy === "import" ? "Importing…" : "↑ Import file"}
          </button>
          <button className="btn btn-primary" onClick={createDoc} disabled={busy !== null}>
            {busy === "create" ? "Creating…" : "+ New document"}
          </button>
        </div>
      </div>

      {error && (
        <div className="banner banner-error" role="alert">
          {error}
          <button className="btn btn-ghost btn-sm" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <section className="section">
        <h2 className="section-title">Owned by me <span className="count">{owned.length}</span></h2>
        <div className="doc-list">
          {owned.length === 0 && <div className="empty">No documents yet. Create one or import a file.</div>}
          {owned.map((d) => (
            <DocRow key={d.id} doc={d} onDelete={() => deleteDoc(d.id)} />
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Shared with me <span className="count">{shared.length}</span></h2>
        <div className="doc-list">
          {shared.length === 0 && <div className="empty">Nothing has been shared with you yet.</div>}
          {shared.map((d) => (
            <DocRow key={d.id} doc={d} />
          ))}
        </div>
      </section>
    </main>
  );
}

function DocRow({ doc, onDelete }: { doc: DocSummary; onDelete?: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="doc-row">
      <Link href={`/docs/${doc.id}`} className="doc-link">
        <span className="doc-icon" aria-hidden />
        <span style={{ minWidth: 0 }}>
          <div className="doc-title">{doc.title}</div>
          <div className="doc-meta">
            {doc.role === "owner" ? "You" : doc.owner.name} · edited {timeAgo(doc.updatedAt)}
          </div>
        </span>
      </Link>
      <span className={`badge badge-${doc.role}`}>
        {doc.role === "owner" ? "Owner" : doc.role === "editor" ? "Can edit" : "View only"}
      </span>
      <span style={{ minWidth: 120, textAlign: "right" }}>
        {onDelete &&
          (confirming ? (
            <>
              <button className="btn btn-sm btn-danger" onClick={onDelete}>Delete</button>{" "}
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn btn-sm btn-ghost" onClick={() => setConfirming(true)} aria-label={`Delete ${doc.title}`}>
              Delete
            </button>
          ))}
      </span>
    </div>
  );
}
