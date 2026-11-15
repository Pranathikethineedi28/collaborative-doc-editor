"use client";

import { useEffect, useState } from "react";
import type { Collaborator, ShareRole } from "@/lib/documents";
import { api, initials } from "./api";

type U = { id: number; name: string; email: string };

export function ShareDialog({ docId, isOwner, onClose }: { docId: string; isOwner: boolean; onClose: () => void }) {
  const [collabs, setCollabs] = useState<Collaborator[] | null>(null);
  const [users, setUsers] = useState<U[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("editor");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ collaborators: Collaborator[] }>(`/api/documents/${docId}/shares`)
      .then((r) => setCollabs(r.collaborators))
      .catch((e) => setError(e.message));
    if (isOwner) api<{ users: U[] }>("/api/users").then((r) => setUsers(r.users)).catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [docId, isOwner, onClose]);

  async function run(p: Promise<{ collaborators: Collaborator[] }>) {
    setBusy(true);
    setError(null);
    try {
      setCollabs((await p).collaborators);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await run(api(`/api/documents/${docId}/shares`, { method: "POST", json: { email, role } }))) setEmail("");
  }

  const existing = new Set(collabs?.map((c) => c.email));
  const suggestions = users.filter((u) => !existing.has(u.email));

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <h2 id="share-title">{isOwner ? "Share document" : "People with access"}</h2>
        <div className="hint">
          {isOwner ? "Editors can change content and the title. Viewers can only read." : "Only the owner can change who has access."}
        </div>

        {isOwner && (
          <form className="modal-row" onSubmit={add}>
            <input
              className="input"
              type="email"
              placeholder="teammate@ajaia.dev"
              list="share-users"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email to share with"
              required
              autoFocus
            />
            <datalist id="share-users">
              {suggestions.map((u) => (
                <option key={u.id} value={u.email}>{u.name}</option>
              ))}
            </datalist>
            <select className="select" value={role} onChange={(e) => setRole(e.target.value as ShareRole)} aria-label="Access level">
              <option value="editor">Can edit</option>
              <option value="viewer">Can view</option>
            </select>
            <button className="btn btn-primary" disabled={busy || !email.trim()}>Share</button>
          </form>
        )}
        {isOwner && suggestions.length > 0 && (
          <div className="hint" style={{ marginTop: 6 }}>
            Try: {suggestions.map((u) => u.email).join(", ")}
          </div>
        )}

        {error && <div className="banner banner-error" style={{ marginTop: 14, marginBottom: 0 }} role="alert">{error}</div>}

        <ul className="collab-list">
          {!collabs && !error && <li className="hint">Loading…</li>}
          {collabs?.map((c) => (
            <li key={c.userId} className="collab">
              <span className="avatar">{initials(c.name)}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div className="collab-name">{c.name}</div>
                <div className="collab-email">{c.email}</div>
              </span>
              {c.role === "owner" ? (
                <span className="badge badge-owner">Owner</span>
              ) : isOwner ? (
                <>
                  <select
                    className="select"
                    value={c.role}
                    disabled={busy}
                    aria-label={`Access for ${c.name}`}
                    onChange={(e) => run(api(`/api/documents/${docId}/shares`, { method: "POST", json: { email: c.email, role: e.target.value } }))}
                  >
                    <option value="editor">Can edit</option>
                    <option value="viewer">Can view</option>
                  </select>
                  <button
                    className="btn btn-sm btn-ghost btn-danger"
                    disabled={busy}
                    onClick={() => run(api(`/api/documents/${docId}/shares/${c.userId}`, { method: "DELETE" }))}
                  >
                    Remove
                  </button>
                </>
              ) : (
                <span className={`badge badge-${c.role}`}>{c.role === "editor" ? "Can edit" : "View only"}</span>
              )}
            </li>
          ))}
        </ul>

        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
