# Architecture note

## What I optimized for

The brief rewards *depth in a few areas* and *a build reviewers can actually test*. So I ranked the work like this:

1. **A trustworthy core loop:** create → edit with formatting → autosave → reopen. If saving is flaky, nothing else matters.
2. **Access control that's actually enforced** on the server, not just hidden in the UI.
3. **Zero-friction review:** seeded users with one-click login, no local DB install, free deploy.
4. Only then, stretch work that deepens the core (viewer/editor roles, Markdown export) rather than broadens it.

## Shape of the system

```
Browser (React + TipTap)
   │  JSON over fetch, httpOnly session cookie
   ▼
Next.js route handlers  ──►  lib/documents.ts  (all permission + versioning rules)
   (thin: parse, auth)        lib/content.ts    (validation, sanitizing, import)
                              lib/auth.ts       (sessions)
                                   │  plain SQL ($1 params)
                                   ▼
                              lib/db.ts ── pg Pool (Neon)   in production
                                        └─ PGlite (WASM PG) locally and in tests
```

A single Next.js app holds the UI and API, so there's one deploy and one repo. Pages are server components that load data directly through the same `lib/` functions the API uses, so the first paint is never an empty loading state. Interactive parts (editor, dialogs) are client components.

## Key decisions and tradeoffs

**Postgres everywhere, via PGlite locally.** I wanted the reviewer's `npm run dev` to need nothing installed, and the deployed app to have durable storage. PGlite is real Postgres compiled to WASM, so local, test and production all run *the same SQL*. That's why there's no ORM: a 60-line adapter wraps `pg` and PGlite behind one `query()` interface. Tradeoff: no generated types or migrations tooling. The schema is one idempotent `CREATE TABLE IF NOT EXISTS` script, which is fine at this size, but I'd add a migration tool before the schema changes twice.

**Store documents as sanitized HTML, not ProseMirror JSON.** HTML is what importers produce (marked, mammoth), what export consumes, and what TipTap loads natively, so one format serves all of them. Every write (editor saves *and* imports) goes through an allowlist sanitizer limited to the tags the editor can render, so stored content is always safe and round-trips exactly (a test asserts this). Tradeoff: JSON would make structural queries or CRDT migration easier later.

**Optimistic concurrency instead of real-time collaboration.** Real-time co-editing (Yjs + a websocket server) is a project in itself and would have crowded out the basics. Silent last-write-wins, though, is a data-loss bug in a *shared* editor. So each document has a `version`. A save must cite the version it was based on, and the `UPDATE … WHERE version = $n` is atomic. A stale save gets a 409, and the UI stops autosaving and shows "Reload latest". That's cheap, honest and testable, and it's the right base for adding presence or merging later.

**Permissions live in one module.** `lib/documents.ts` is the only place that decides who can do what (`owner` > `editor` > `viewer`). Routes are thin wrappers. Documents you can't access return **404, not 403**, so IDs don't reveal that a document exists. The UI mirrors the rules (read-only editor, hidden share controls), but the server is the authority. Tests call this module against a real database.

**Mocked-but-real auth.** Seeded users with bcrypt-hashed passwords and DB-backed random session tokens in an httpOnly cookie. There's no sign-up, which the brief allowed, but the session mechanics are production-shaped, so swapping in OAuth later only changes `login()`.

**Upload = import into a new document.** Of the suggested options this is the most product-relevant: people already have notes in .md, .txt and Word files. Validation covers extension allowlist, a 5 MB size cap, UTF-8 checks for text, and zip magic bytes for .docx before mammoth parses it. I chose not to build attachment storage, which needs blob storage on a serverless host.

**Autosave pipeline.** Debounced at 800 ms, with one request in flight at a time. Edits made during a save trigger a follow-up save. Failures surface inline with Retry instead of retrying in a loop. Ctrl/Cmd+S forces a save, and leaving with unsaved changes prompts a warning. Save state is always visible, because users trust an editor that tells them where their work is.

## Deliberately not built

| Cut | Why |
|---|---|
| Real-time co-editing, presence cursors | Biggest scope item; conflict *detection* covers the safety need |
| Comments / suggestion mode | Valuable, but a second product surface; roles + export added more depth per hour |
| Sign-up, password reset, OAuth | Seeded accounts let reviewers test sharing immediately |
| Images, tables, attachments | Need blob storage and a larger editor schema |
| Version history | The `version` column is the start of it; a `document_revisions` table is the next step |

## With another 2–4 hours

1. **Version history:** snapshot into `document_revisions` on each save (throttled), with a restore UI. It builds directly on the version column.
2. **Presence indicators:** a lightweight "Bob is viewing" heartbeat via polling, plus a "newer version available" nudge *before* a conflict happens.
3. **Import into the current document** (append or replace), and drag-and-drop upload.
4. **Playwright E2E test** of the share flow in CI, alongside the unit and integration tests.
