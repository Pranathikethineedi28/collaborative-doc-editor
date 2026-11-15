"use client";

import { useEditorState, type Editor } from "@tiptap/react";

export function Toolbar({ editor }: { editor: Editor | null }) {
  // Subscribe only to the bits of state the toolbar renders.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            strike: e.isActive("strike"),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            quote: e.isActive("blockquote"),
            block: e.isActive("heading", { level: 1 })
              ? "h1"
              : e.isActive("heading", { level: 2 })
                ? "h2"
                : e.isActive("heading", { level: 3 })
                  ? "h3"
                  : "p",
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
          }
        : null,
  });

  if (!editor || !s) return <div className="toolbar" style={{ height: 43 }} />;
  const chain = () => editor.chain().focus();

  function setBlock(v: string) {
    if (v === "p") chain().setParagraph().run();
    else chain().setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
  }

  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      <Btn label="↶" title="Undo (Ctrl+Z)" disabled={!s.canUndo} onClick={() => chain().undo().run()} />
      <Btn label="↷" title="Redo (Ctrl+Shift+Z)" disabled={!s.canRedo} onClick={() => chain().redo().run()} />
      <span className="tb-sep" />
      <select className="select" value={s.block} onChange={(e) => setBlock(e.target.value)} aria-label="Text style">
        <option value="p">Normal text</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <span className="tb-sep" />
      <Btn label="B" title="Bold (Ctrl+B)" active={s.bold} onClick={() => chain().toggleBold().run()} style={{ fontWeight: 700 }} />
      <Btn label="I" title="Italic (Ctrl+I)" active={s.italic} onClick={() => chain().toggleItalic().run()} style={{ fontStyle: "italic", fontFamily: "Georgia, serif" }} />
      <Btn label="U" title="Underline (Ctrl+U)" active={s.underline} onClick={() => chain().toggleUnderline().run()} style={{ textDecoration: "underline" }} />
      <Btn label="S" title="Strikethrough" active={s.strike} onClick={() => chain().toggleStrike().run()} style={{ textDecoration: "line-through" }} />
      <span className="tb-sep" />
      <Btn label="• List" title="Bulleted list" active={s.bullet} onClick={() => chain().toggleBulletList().run()} />
      <Btn label="1. List" title="Numbered list" active={s.ordered} onClick={() => chain().toggleOrderedList().run()} />
      <Btn label="❝" title="Quote" active={s.quote} onClick={() => chain().toggleBlockquote().run()} />
    </div>
  );
}

type BtnProps = { label: string; title: string; active?: boolean; disabled?: boolean; onClick: () => void; style?: React.CSSProperties };

function Btn(p: BtnProps) {
  return (
    <button
      type="button"
      className={`tb-btn ${p.active ? "active" : ""}`}
      title={p.title}
      aria-label={p.title}
      aria-pressed={p.active}
      disabled={p.disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the editor selection
      onClick={p.onClick}
      style={p.style}
    >
      {p.label}
    </button>
  );
}
