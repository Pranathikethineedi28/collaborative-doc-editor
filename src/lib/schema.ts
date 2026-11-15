import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import type { Db } from "./db";

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id              TEXT PRIMARY KEY,
  owner_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL DEFAULT '',
  version         INTEGER NOT NULL DEFAULT 1,
  source_filename TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_owner_idx ON documents(owner_id);

CREATE TABLE IF NOT EXISTS document_shares (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, user_id)
);
CREATE INDEX IF NOT EXISTS document_shares_user_idx ON document_shares(user_id);
`;

export const SEED_PASSWORD = "password123";

export const SEED_USERS = [
  { email: "alice@ajaia.dev", name: "Alice Chen" },
  { email: "bob@ajaia.dev", name: "Bob Patel" },
  { email: "carol@ajaia.dev", name: "Carol Diaz" },
] as const;

/** Idempotent: only seeds when there are no users yet. */
export async function seed(db: Db) {
  const [{ count }] = await db.query<{ count: number }>("SELECT count(*)::int AS count FROM users");
  if (count > 0) return;

  const hash = await bcrypt.hash(SEED_PASSWORD, 10);
  const ids: number[] = [];
  for (const u of SEED_USERS) {
    const [row] = await db.query<{ id: number }>(
      "INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING id",
      [u.email, u.name, hash],
    );
    if (!row) return; // another process seeded concurrently
    ids.push(row.id);
  }
  const [alice, bob] = ids;

  const welcomeId = randomUUID();
  await db.query("INSERT INTO documents (id, owner_id, title, content) VALUES ($1, $2, $3, $4)", [
    welcomeId,
    alice,
    "Q4 Planning Notes",
    `<h1>Q4 Planning Notes</h1><p>This document is <strong>owned by Alice</strong> and shared with <em>Bob</em> as an <u>editor</u>.</p><h2>Priorities</h2><ul><li><p>Ship the editor MVP</p></li><li><p>Collect feedback from two pilot teams</p></li></ul><h2>Open questions</h2><ol><li><p>Do we need comments before real-time editing?</p></li><li><p>Which file types matter most for import?</p></li></ol>`,
  ]);
  await db.query("INSERT INTO document_shares (document_id, user_id, role) VALUES ($1, $2, 'editor')", [welcomeId, bob]);

  const bobDocId = randomUUID();
  await db.query("INSERT INTO documents (id, owner_id, title, content) VALUES ($1, $2, $3, $4)", [
    bobDocId,
    bob,
    "Design Review Checklist",
    `<h2>Design Review Checklist</h2><p>Owned by Bob, shared with Alice as a <strong>viewer</strong> (read-only).</p><ul><li><p>Accessibility pass</p></li><li><p>Empty and error states</p></li><li><p>Mobile layout</p></li></ul>`,
  ]);
  await db.query("INSERT INTO document_shares (document_id, user_id, role) VALUES ($1, $2, 'viewer')", [bobDocId, alice]);
}
