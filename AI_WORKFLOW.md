# AI workflow note

## Tools used

- **Claude (Anthropic), agentic coding mode:** scaffolding, first drafts of modules and docs, and running the test, build and browser-check loops.
- **Playwright (headless Chromium):** scripted UI walkthroughs and screenshots to check the UI, not just the API.
- **Vitest:** automated tests run against a real in-memory Postgres.

## Where AI materially sped things up

- **Boilerplate with no design judgment in it:** route handlers, the fetch wrapper, CSS for the dashboard and modal, and the README skeleton.
- **Library surface lookups:** TipTap v3 API details (`useEditorState`, `immediatelyRender: false` for SSR, Underline now bundled in StarterKit), mammoth/marked options, and PGlite's transaction API.
- **Test fixtures:** e.g. building a minimal valid `.docx` in-memory with JSZip, so the importer is tested without binary fixture files in the repo.
- **Verification loops:** typecheck → test → build → scripted browser run → screenshot review, repeated after each change.

## AI output I changed or rejected

- **Autosave closure bug.** The first editor draft scheduled saves through a callback captured when the editor was created, before the TipTap instance existed, so autosave would have silently done nothing. I rewrote the pipeline to call the latest save function through a ref, with one save in flight at a time and follow-up saves for edits made during a save.
- **Over-complicated retry logic.** A draft tracked "is retryable" state in an extra ref synced through an effect. I replaced it with a simple rule: after a successful save, save pending edits; after a failure, wait for the next edit or an explicit Retry, so a failing API never gets hammered.
- **Dependency choices.** `npm install` pulled TypeScript 7 (the new native compiler); I pinned TypeScript 5 for compatibility with Next.js's build-time type checking. I dropped separately installed TipTap Underline/Placeholder packages after confirming v3 bundles or relocates them.
- **`server-only` import.** Removed: it throws when the same modules are imported by the Vitest suite.
- **Sticky header layout.** Screenshot review showed the editor toolbar and the app bar both stuck to `top: 0`, so the toolbar covered the app bar on scroll. Fixed so that only the editor toolbar sticks.
- **Product calls stayed with me:** HTML instead of JSON storage, 404 instead of 403 for inaccessible docs, version-check conflicts instead of last-write-wins, and import-as-new-document instead of attachments.

## How I verified correctness, UX and reliability

- **12 automated tests** (`npm test`) against real Postgres (PGlite), not mocks: owned vs shared listing, viewer/editor/owner permission boundaries, revoke, bad share input, **stale-version conflict (409)**, formatting round-trip with XSS stripping, title validation, login, and .txt/.md/.docx import, including rejection of unsupported, empty, binary and fake files.
- **API smoke test with curl** against the production build: login, import, rename, conflict, share, export, unauthenticated access, unsupported upload.
- **Scripted browser runs** (Playwright): typed a document using keyboard shortcuts *and* toolbar buttons, reloaded and asserted the exact HTML persisted, shared to Carol, signed in as Carol and asserted the editor is read-only, and ran a two-browser Alice/Bob conflict. Console errors were captured (none).
- **Screenshot review** of every screen (in `docs/screenshots/`). That's how the sticky-header bug was caught.
- `tsc --noEmit` and `next build` are clean.
