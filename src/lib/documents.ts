import { randomUUID } from "node:crypto";
import type { Db } from "./db";
import { badRequest, conflict, forbidden, notFound } from "./errors";
import { validateContent, validateTitle } from "./content";

/**
 * All document access rules live here. Route handlers stay thin and call these
 * with the signed-in user's id, so permission logic is in one testable place.
 *
 * Roles:  owner  -> read, edit, rename, share, delete
 *         editor -> read, edit, rename
 *         viewer -> read only
 */
export type Role = "owner" | "editor" | "viewer";
export type ShareRole = Exclude<Role, "owner">;

export type DocSummary = {
  id: string;
  title: string;
  updatedAt: string;
  role: Role;
  owner: { id: number; name: string; email: string };
};

export type Doc = DocSummary & { content: string; version: number };

export type Collaborator = { userId: number; name: string; email: string; role: Role };

type DocRow = {
  id: string;
  title: string;
  content: string;
  version: number;
  updated_at: Date | string;
  owner_id: number;
  owner_name: string;
  owner_email: string;
  role: Role;
};

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

function toSummary(r: DocRow): DocSummary {
  return {
    id: r.id,
    title: r.title,
    updatedAt: iso(r.updated_at),
    role: r.role,
    owner: { id: r.owner_id, name: r.owner_name, email: r.owner_email },
  };
}

// Selects a document plus the requesting user's role ($1 = user id).
const DOC_WITH_ROLE = `
  SELECT d.id, d.title, d.content, d.version, d.updated_at, d.owner_id,
         u.name AS owner_name, u.email AS owner_email,
         CASE WHEN d.owner_id = $1 THEN 'owner' ELSE s.role END AS role
  FROM documents d
  JOIN users u ON u.id = d.owner_id
  LEFT JOIN document_shares s ON s.document_id = d.id AND s.user_id = $1
`;

export function canEdit(role: Role) {
  return role === "owner" || role === "editor";
}

export async function listDocuments(db: Db, userId: number): Promise<{ owned: DocSummary[]; shared: DocSummary[] }> {
  const rows = await db.query<DocRow>(
    `${DOC_WITH_ROLE} WHERE d.owner_id = $1 OR s.user_id = $1 ORDER BY d.updated_at DESC`,
    [userId],
  );
  const all = rows.map(toSummary);
  return { owned: all.filter((d) => d.role === "owner"), shared: all.filter((d) => d.role !== "owner") };
}

export async function getDocument(db: Db, userId: number, docId: string): Promise<Doc> {
  const [row] = await db.query<DocRow>(`${DOC_WITH_ROLE} WHERE d.id = $2 AND (d.owner_id = $1 OR s.user_id = $1)`, [
    userId,
    docId,
  ]);
  if (!row) throw notFound();
  return { ...toSummary(row), content: row.content, version: row.version };
}

export async function createDocument(
  db: Db,
  userId: number,
  input: { title?: unknown; content?: unknown; sourceFilename?: string } = {},
): Promise<Doc> {
  const title = input.title === undefined ? "Untitled document" : validateTitle(input.title);
  const content = input.content === undefined ? "" : validateContent(input.content);
  const id = randomUUID();
  await db.query("INSERT INTO documents (id, owner_id, title, content, source_filename) VALUES ($1, $2, $3, $4, $5)", [
    id,
    userId,
    title,
    content,
    input.sourceFilename ?? null,
  ]);
  return getDocument(db, userId, id);
}

/**
 * Optimistic concurrency: the client sends the version it last loaded/saved.
 * If someone else saved in between, we refuse with 409 instead of silently
 * overwriting their work (the alternative, last-write-wins, loses data).
 */
export async function updateDocument(
  db: Db,
  userId: number,
  docId: string,
  input: { title?: unknown; content?: unknown; baseVersion?: unknown },
): Promise<{ version: number; updatedAt: string; title: string }> {
  const doc = await getDocument(db, userId, docId);
  if (!canEdit(doc.role)) throw forbidden("You have view-only access to this document");

  if (input.title === undefined && input.content === undefined) throw badRequest("Nothing to update");
  if (typeof input.baseVersion !== "number" || !Number.isInteger(input.baseVersion)) {
    throw badRequest("baseVersion is required");
  }
  const title = input.title === undefined ? doc.title : validateTitle(input.title);
  const content = input.content === undefined ? doc.content : validateContent(input.content);

  const [row] = await db.query<{ version: number; updated_at: Date | string; title: string }>(
    `UPDATE documents SET title = $1, content = $2, version = version + 1, updated_at = now()
     WHERE id = $3 AND version = $4 RETURNING version, updated_at, title`,
    [title, content, docId, input.baseVersion],
  );
  if (!row) throw conflict("This document was changed by someone else. Reload to get the latest version.");
  return { version: row.version, updatedAt: iso(row.updated_at), title: row.title };
}

export async function deleteDocument(db: Db, userId: number, docId: string) {
  const doc = await getDocument(db, userId, docId);
  if (doc.role !== "owner") throw forbidden("Only the owner can delete this document");
  await db.query("DELETE FROM documents WHERE id = $1", [docId]);
}

export async function listCollaborators(db: Db, userId: number, docId: string): Promise<Collaborator[]> {
  const doc = await getDocument(db, userId, docId);
  const shares = await db.query<{ user_id: number; name: string; email: string; role: ShareRole }>(
    `SELECT s.user_id, u.name, u.email, s.role FROM document_shares s JOIN users u ON u.id = s.user_id
     WHERE s.document_id = $1 ORDER BY u.name`,
    [docId],
  );
  return [
    { userId: doc.owner.id, name: doc.owner.name, email: doc.owner.email, role: "owner" },
    ...shares.map((s) => ({ userId: s.user_id, name: s.name, email: s.email, role: s.role })),
  ];
}

function validateShareRole(role: unknown): ShareRole {
  if (role !== "viewer" && role !== "editor") throw badRequest('Role must be "viewer" or "editor"');
  return role;
}

/** Grant (or change) another user's access. Owner only. */
export async function shareDocument(
  db: Db,
  userId: number,
  docId: string,
  input: { email?: unknown; role?: unknown },
): Promise<Collaborator[]> {
  const doc = await getDocument(db, userId, docId);
  if (doc.role !== "owner") throw forbidden("Only the owner can share this document");
  if (typeof input.email !== "string" || !input.email.trim()) throw badRequest("Enter an email address");
  const role = validateShareRole(input.role ?? "editor");

  const email = input.email.trim().toLowerCase();
  const [target] = await db.query<{ id: number }>("SELECT id FROM users WHERE email = $1", [email]);
  if (!target) throw badRequest(`No user with email ${email}`);
  if (target.id === userId) throw badRequest("You already own this document");

  await db.query(
    `INSERT INTO document_shares (document_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (document_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [docId, target.id, role],
  );
  return listCollaborators(db, userId, docId);
}

/** Remove a collaborator. Owner only. */
export async function unshareDocument(db: Db, userId: number, docId: string, targetUserId: number) {
  const doc = await getDocument(db, userId, docId);
  if (doc.role !== "owner") throw forbidden("Only the owner can change sharing");
  await db.query("DELETE FROM document_shares WHERE document_id = $1 AND user_id = $2", [docId, targetUserId]);
  return listCollaborators(db, userId, docId);
}

