# Submission: Ajaia AI-Native Full Stack Developer Assignment

**Candidate:** Pranathi Kethineedi
**Live app:** `https://ajaia-docs-rust-six.vercel.app`
**Walkthrough video:** see `VIDEO_URL.txt`

## Test accounts
Password for all: `password123` (one-click buttons on the login page)
- `alice@ajaia.dev`: owns a doc shared with Bob (editor); has Bob's doc as viewer
- `bob@ajaia.dev`: owns a doc shared with Alice (viewer)
- `carol@ajaia.dev`: starts empty; use her to test sharing from scratch

## What's included
| Item | Location |
|---|---|
| Source code | `src/` (app, API routes, components, server logic), config files at the root |
| Automated tests (12) | `tests/documents.test.ts`, `tests/import.test.ts` (`npm test`) |
| Setup and run instructions | `README.md` |
| Architecture note | `ARCHITECTURE.md` |
| AI workflow note | `AI_WORKFLOW.md` |
| Walkthrough video link | `VIDEO_URL.txt` |
| Screenshots | `docs/screenshots/` (login, dashboard, editor, share dialog, shared-user dashboard, view-only editor) |
| Env template | `.env.example` |

## Status
**Working end to end:** auth with seeded users; create, rename, edit, autosave, reopen and delete; rich text (B/I/U/S, H1–H3, bulleted and numbered lists, quote, undo/redo); .txt/.md/.docx import into a new document; sharing as editor or viewer, with role changes and revoke; owned vs shared views; Postgres persistence; conflict detection on concurrent saves; Markdown export.

**Intentionally not built:** real-time co-editing and presence, comments, sign-up and password reset, images, tables and attachments, version history. Reasons are in `ARCHITECTURE.md`.

**Next 2–4 hours:** version history (revisions table and restore), presence and "newer version available" nudges, import into an existing document with drag-and-drop, and a Playwright E2E test in CI.
