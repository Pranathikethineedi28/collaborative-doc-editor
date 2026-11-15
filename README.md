# Ajaia Docs: a lightweight collaborative document editor

A small full-stack document editor inspired by Google Docs. Users can create, rename, edit (rich text), import, share and reopen documents.

- **Live app:** `<ADD YOUR DEPLOYED URL>`
- **Stack:** Next.js 15 (App Router) · React 19 · TipTap 3 (ProseMirror) · Postgres (Neon in production, embedded PGlite locally) · Vitest

## Demo accounts

All demo accounts use the password **`password123`**. The login page also has one-click buttons for each.

| User | Email | Seeded state |
|---|---|---|
| Alice Chen | `alice@ajaia.dev` | Owns *Q4 Planning Notes* (shared with Bob as **editor**); has *Design Review Checklist* shared with her as **viewer** |
| Bob Patel | `bob@ajaia.dev` | Owns *Design Review Checklist*; can edit Alice's *Q4 Planning Notes* |
| Carol Diaz | `carol@ajaia.dev` | Nothing yet. Use her to test sharing from scratch |

**Suggested 2-minute review path**
1. Sign in as **Alice** → *+ New document* → type, use the toolbar (headings, B/I/U, lists) → watch "Saved" → refresh. Content and formatting persist.
2. *Share* → `carol@ajaia.dev`, *Can view*. Sign out → sign in as **Carol** → the doc is under **Shared with me** with a *View only* badge, and the editor is read-only.
3. *Import file* on the dashboard with a `.md`, `.txt` or `.docx` file. It becomes a new editable document.
4. Optional conflict demo: open *Q4 Planning Notes* as Alice in one browser and as Bob in another (or a private window). Edit and save in one, then edit in the other. The second save is refused with a "reload latest" banner instead of silently overwriting.

## Features

| Area | What works |
|---|---|
| Documents | Create, rename (inline title), edit, autosave (800 ms debounce, plus Ctrl/Cmd+S), reopen, delete (owner only), unsaved-changes warning on leave |
| Rich text | Bold, italic, underline, strikethrough, Heading 1–3, bulleted and numbered lists, blockquote, undo/redo, plus Markdown-style shortcuts (`# `, `- `, `1. `) |
| File upload | **.txt, .md, .docx → new editable document** (max 5 MB). Other types are rejected with a clear message. Limits are shown in the UI |
| Sharing | Owner shares by email as **editor** or **viewer**, can change roles or revoke access. Dashboard separates **Owned by me** and **Shared with me** with role badges |
| Persistence | Postgres. Documents are stored as sanitized HTML, so formatting round-trips exactly |
| Safety | Sessions in an httpOnly cookie, bcrypt passwords, server-side role checks on every request, HTML sanitized on every write, optimistic-concurrency version checks (409 on stale saves), input validation with friendly errors |
| Stretch | Role-based permissions (viewer vs editor) and **Export to Markdown** |

## Run locally

Requires **Node 20+**. No database setup is needed: without `DATABASE_URL`, the app uses an embedded Postgres (PGlite) stored in `./.data/`, and seeds the demo users on first start.

```bash
npm install
npm run dev            # http://localhost:3000
```

Other commands:

```bash
npm test               # Vitest: access control, concurrency, sanitization, file import (12 tests)
npm run typecheck
npm run build && npm start   # production build
```

To reset local data, stop the server and delete `.data/`.

To use a real Postgres locally, set `DATABASE_URL=postgres://…` in `.env.local`. The schema is created automatically.

## Deploy (free: Vercel + Neon)

1. Create a free Postgres database at [neon.tech](https://neon.tech) and copy its connection string.
2. Push this folder to a GitHub repo and import it in [Vercel](https://vercel.com/new). The framework is detected as Next.js automatically.
3. Add the environment variable `DATABASE_URL` = the Neon connection string, then deploy.

Tables and demo users are created on the first request. The app refuses to start on Vercel without `DATABASE_URL`, because serverless disks are ephemeral and would silently lose data.

## Project layout

```
src/
  lib/            server logic (no React)
    db.ts         Postgres adapter: pg Pool or PGlite, same SQL
    schema.ts     tables + idempotent seed
    auth.ts       login, sessions
    documents.ts  ALL document/sharing rules (roles, versions)
    content.ts    validation, HTML sanitizing, .txt/.md/.docx import
    server.ts     route wrapper: auth + JSON error mapping
  app/            pages + API routes (thin; delegate to lib/)
  components/     DocEditor, Toolbar, ShareDialog, Dashboard, LoginForm
tests/            Vitest suites running against a real in-memory Postgres
docs/screenshots/
```

See **ARCHITECTURE.md** for decisions and tradeoffs, and **AI_WORKFLOW.md** for how AI tools were used.

## Known limitations

- No real-time co-editing. Concurrent edits are *detected* (version check → 409 + reload prompt), not merged.
- Demo auth only: seeded accounts, no sign-up or password reset.
- Import creates a new document. It doesn't merge into an existing one. Images and tables in .docx files are dropped, because the editor schema doesn't support them yet.
