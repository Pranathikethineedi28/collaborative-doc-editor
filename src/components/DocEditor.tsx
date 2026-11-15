"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import type { Doc } from "@/lib/documents";
import { api, ApiError, timeAgo } from "./api";
import { TopBar } from "./TopBar";
import { Toolbar } from "./Toolbar";
import { ShareDialog } from "./ShareDialog";

type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";
const AUTOSAVE_MS = 800;

export function DocEditor({ initialDoc, user }: { initialDoc: Doc; user: { id: number; name: string; email: string } }) {
  const editable = initialDoc.role !== "viewer";
  const [title, setTitle] = useState(initialDoc.title);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState(initialDoc.updatedAt);
  const [shareOpen, setShareOpen] = useState(false);
  const [, forceTick] = useState(0);

  // Refs hold the save pipeline state so callbacks never see stale values.
  const versionRef = useRef(initialDoc.version);
  const titleRef = useRef(initialDoc.title);
  const savedTitleRef = useRef(initialDoc.title);
  const dirtyRef = useRef(false);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false); // set after a conflict: never overwrite someone else's work
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }),
      Placeholder.configure({ placeholder: editable ? "Start writing…" : "" }),
    ],
    content: initialDoc.content,
    editable,
    immediatelyRender: false, // avoid SSR hydration mismatch
    onUpdate: () => markDirty(),
  });

  /**
   * Save pipeline: at most one PATCH in flight. Edits made while a save is
   * running are picked up by a follow-up save. After a 409 we stop entirely.
   */
  const flush = useCallback(async (): Promise<void> => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (stoppedRef.current || !editor) return;
    if (inFlightRef.current) {
      await inFlightRef.current;
      return flushRef.current();
    }
    if (!dirtyRef.current) return;

    const nextTitle = titleRef.current.trim();
    if (!nextTitle) {
      setSaveState("error");
      setSaveError("Title can't be empty");
      return;
    }

    dirtyRef.current = false;
    setSaveState("saving");
    let ok = false;
    const run = (async () => {
      try {
        const res = await api<{ version: number; updatedAt: string; title: string }>(`/api/documents/${initialDoc.id}`, {
          method: "PATCH",
          json: { title: nextTitle, content: editor.getHTML(), baseVersion: versionRef.current },
        });
        ok = true;
        versionRef.current = res.version;
        savedTitleRef.current = res.title;
        setLastSaved(res.updatedAt);
        setSaveError(null);
        setSaveState(dirtyRef.current ? "dirty" : "saved");
      } catch (err) {
        dirtyRef.current = true;
        if (err instanceof ApiError && err.status === 409) {
          stoppedRef.current = true;
          setSaveState("conflict");
        } else {
          setSaveState("error");
        }
        setSaveError((err as Error).message);
      }
    })();
    inFlightRef.current = run;
    await run;
    inFlightRef.current = null;
    // Edits arrived during a successful save: save them too. After a failure we
    // wait for the next edit or an explicit Retry rather than hammering the API.
    if (ok && dirtyRef.current) scheduleSave();
  }, [editor, initialDoc.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function scheduleSave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flushRef.current(), AUTOSAVE_MS);
  }

  function markDirty() {
    if (stoppedRef.current) return;
    dirtyRef.current = true;
    setSaveState("dirty");
    scheduleSave();
  }

  // onUpdate/timers are created once; always call the latest flush through a ref.
  flushRef.current = flush;

  // Warn before leaving with unsaved changes; Cmd/Ctrl+S saves immediately.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current || inFlightRef.current) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flushRef.current();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKey);
    const tick = setInterval(() => forceTick((n) => n + 1), 30_000); // refresh "saved x min ago"
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKey);
      clearInterval(tick);
    };
  }, []);

  function onTitleChange(value: string) {
    setTitle(value);
    titleRef.current = value;
    if (value.trim()) markDirty();
    else {
      setSaveState("error");
      setSaveError("Title can't be empty");
    }
  }

  function onTitleBlur() {
    if (!titleRef.current.trim()) {
      // Revert an emptied title instead of leaving the doc unsaveable.
      setTitle(savedTitleRef.current);
      titleRef.current = savedTitleRef.current;
      setSaveError(null);
      setSaveState(dirtyRef.current ? "dirty" : "saved");
      if (dirtyRef.current) scheduleSave();
    }
  }

  async function exportMarkdown() {
    await flush();
    window.location.href = `/api/documents/${initialDoc.id}/export`;
  }

  const status = {
    saved: `Saved ${timeAgo(lastSaved)}`,
    dirty: "Unsaved changes…",
    saving: "Saving…",
    error: saveError ?? "Save failed",
    conflict: "Not saved: conflict",
  }[saveState];

  return (
    <>
      <TopBar user={user} />
      <div className="editor-top">
        <div className="editor-head">
          <a href="/" className="btn btn-ghost btn-sm" aria-label="Back to documents">← Docs</a>
          <input
            className="title-input"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={onTitleBlur}
            onKeyDown={(e) => e.key === "Enter" && editor?.commands.focus()}
            disabled={!editable}
            maxLength={200}
            aria-label="Document title"
          />
          {editable && (
            <span className={`save-status ${saveState === "error" || saveState === "conflict" ? "error" : ""}`} aria-live="polite">
              {status}
            </span>
          )}
          {saveState === "error" && saveError !== "Title can't be empty" && (
            <button className="btn btn-sm" onClick={() => void flush()}>Retry</button>
          )}
          <span className="spacer" />
          <span className={`badge badge-${initialDoc.role}`}>
            {initialDoc.role === "owner" ? "Owner" : initialDoc.role === "editor" ? "Can edit" : "View only"}
          </span>
          <button className="btn btn-sm" onClick={exportMarkdown}>Export .md</button>
          <button className={`btn btn-sm ${initialDoc.role === "owner" ? "btn-primary" : ""}`} onClick={() => setShareOpen(true)}>
            {initialDoc.role === "owner" ? "Share" : "People"}
          </button>
        </div>
        {editable && <Toolbar editor={editor} />}
      </div>

      <div className="paper-wrap">
        <div style={{ maxWidth: 816, margin: "0 auto" }}>
          {!editable && (
            <div className="banner banner-info">
              You have view-only access. {initialDoc.owner.name} owns this document.
            </div>
          )}
          {initialDoc.role === "editor" && (
            <div className="banner banner-info">Shared with you by {initialDoc.owner.name}. You can edit.</div>
          )}
          {saveState === "conflict" && (
            <div className="banner banner-warn" role="alert">
              Someone else saved this document while you were editing. Your latest changes were not saved.
              <button className="btn btn-sm" onClick={() => window.location.reload()}>Reload latest</button>
            </div>
          )}
        </div>
        <div className="paper">
          <EditorContent editor={editor} />
        </div>
      </div>

      {shareOpen && (
        <ShareDialog docId={initialDoc.id} isOwner={initialDoc.role === "owner"} onClose={() => setShareOpen(false)} />
      )}
    </>
  );
}
