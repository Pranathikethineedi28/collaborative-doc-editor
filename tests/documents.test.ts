import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryDb, type Db } from "@/lib/db";
import { login } from "@/lib/auth";
import {
  createDocument,
  deleteDocument,
  getDocument,
  listCollaborators,
  listDocuments,
  shareDocument,
  unshareDocument,
  updateDocument,
} from "@/lib/documents";
import { SEED_PASSWORD } from "@/lib/schema";

// Each test gets a fresh, seeded in-memory Postgres (PGlite): real SQL, no mocks.
let db: Db;
let alice: number, bob: number, carol: number;

beforeEach(async () => {
  db = await createMemoryDb();
  const ids = await db.query<{ id: number; email: string }>("SELECT id, email FROM users");
  const byEmail = Object.fromEntries(ids.map((u) => [u.email, u.id]));
  alice = byEmail["alice@ajaia.dev"];
  bob = byEmail["bob@ajaia.dev"];
  carol = byEmail["carol@ajaia.dev"];
});

describe("sharing and access control", () => {
  it("separates owned and shared documents, and shared users see the doc after a share", async () => {
    const doc = await createDocument(db, alice, { title: "Roadmap", content: "<p>hello</p>" });

    expect((await listDocuments(db, alice)).owned.map((d) => d.id)).toContain(doc.id);
    expect((await listDocuments(db, carol)).shared.map((d) => d.id)).not.toContain(doc.id);
    await expect(getDocument(db, carol, doc.id)).rejects.toMatchObject({ status: 404 });

    await shareDocument(db, alice, doc.id, { email: "Carol@Ajaia.dev ", role: "viewer" });

    const carolDocs = await listDocuments(db, carol);
    const shared = carolDocs.shared.find((d) => d.id === doc.id);
    expect(shared).toMatchObject({ role: "viewer", owner: { id: alice } });
    expect(carolDocs.owned.find((d) => d.id === doc.id)).toBeUndefined();
  });

  it("enforces roles: viewers can't edit, editors can edit but not share or delete", async () => {
    const doc = await createDocument(db, alice, { title: "Spec" });
    await shareDocument(db, alice, doc.id, { email: "bob@ajaia.dev", role: "editor" });
    await shareDocument(db, alice, doc.id, { email: "carol@ajaia.dev", role: "viewer" });

    await expect(updateDocument(db, carol, doc.id, { content: "<p>x</p>", baseVersion: 1 })).rejects.toMatchObject({ status: 403 });

    const saved = await updateDocument(db, bob, doc.id, { content: "<p>Bob was here</p>", baseVersion: 1 });
    expect(saved.version).toBe(2);
    expect((await getDocument(db, carol, doc.id)).content).toBe("<p>Bob was here</p>");

    await expect(shareDocument(db, bob, doc.id, { email: "carol@ajaia.dev", role: "editor" })).rejects.toMatchObject({ status: 403 });
    await expect(deleteDocument(db, bob, doc.id)).rejects.toMatchObject({ status: 403 });
  });

  it("revoking access removes the document from the user's list", async () => {
    const doc = await createDocument(db, alice, { title: "Temp" });
    await shareDocument(db, alice, doc.id, { email: "bob@ajaia.dev", role: "editor" });
    await unshareDocument(db, alice, doc.id, bob);
    await expect(getDocument(db, bob, doc.id)).rejects.toMatchObject({ status: 404 });
    expect((await listCollaborators(db, alice, doc.id)).map((c) => c.role)).toEqual(["owner"]);
  });

  it("rejects bad share requests", async () => {
    const doc = await createDocument(db, alice, { title: "X" });
    await expect(shareDocument(db, alice, doc.id, { email: "nobody@ajaia.dev" })).rejects.toMatchObject({ status: 400 });
    await expect(shareDocument(db, alice, doc.id, { email: "alice@ajaia.dev" })).rejects.toMatchObject({ status: 400 });
    await expect(shareDocument(db, alice, doc.id, { email: "bob@ajaia.dev", role: "admin" })).rejects.toMatchObject({ status: 400 });
  });
});

describe("editing and persistence", () => {
  it("detects concurrent edits with version checks instead of overwriting", async () => {
    const doc = await createDocument(db, alice, { title: "Shared notes" });
    await shareDocument(db, alice, doc.id, { email: "bob@ajaia.dev", role: "editor" });

    // Both open version 1. Alice saves first; Bob's save from the stale version is refused.
    await updateDocument(db, alice, doc.id, { content: "<p>Alice</p>", baseVersion: 1 });
    await expect(updateDocument(db, bob, doc.id, { content: "<p>Bob</p>", baseVersion: 1 })).rejects.toMatchObject({ status: 409 });
    expect((await getDocument(db, bob, doc.id)).content).toBe("<p>Alice</p>");
  });

  it("preserves formatting but strips unsafe HTML on save", async () => {
    const doc = await createDocument(db, alice, {});
    expect(doc.title).toBe("Untitled document");
    await updateDocument(db, alice, doc.id, {
      title: "  Formatted   doc ",
      content: '<h2>Head</h2><p><strong>b</strong> <em>i</em> <u>u</u></p><ul><li><p>one</p></li></ul><script>alert(1)</script><p onclick="x()">ok</p>',
      baseVersion: 1,
    });
    const reopened = await getDocument(db, alice, doc.id);
    expect(reopened.title).toBe("Formatted doc");
    expect(reopened.content).toBe("<h2>Head</h2><p><strong>b</strong> <em>i</em> <u>u</u></p><ul><li><p>one</p></li></ul><p>ok</p>");
  });

  it("validates titles and requires a base version", async () => {
    const doc = await createDocument(db, alice, {});
    await expect(updateDocument(db, alice, doc.id, { title: "   ", baseVersion: 1 })).rejects.toMatchObject({ status: 400 });
    await expect(updateDocument(db, alice, doc.id, { title: "x".repeat(201), baseVersion: 1 })).rejects.toMatchObject({ status: 400 });
    await expect(updateDocument(db, alice, doc.id, { title: "ok" })).rejects.toMatchObject({ status: 400 });
  });
});

describe("auth", () => {
  it("logs in seeded users and rejects wrong passwords", async () => {
    const { user, token } = await login(db, "ALICE@ajaia.dev", SEED_PASSWORD);
    expect(user.name).toBe("Alice Chen");
    expect(token).toHaveLength(64);
    await expect(login(db, "alice@ajaia.dev", "wrong")).rejects.toMatchObject({ status: 401 });
    await expect(login(db, "ghost@ajaia.dev", SEED_PASSWORD)).rejects.toMatchObject({ status: 401 });
  });
});
