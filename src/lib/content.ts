import sanitizeHtml from "sanitize-html";
import { marked } from "marked";
import { badRequest } from "./errors";

export const MAX_TITLE_LENGTH = 200;
export const MAX_CONTENT_BYTES = 1_000_000; // ~1 MB of HTML per document
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const SUPPORTED_IMPORT_EXTENSIONS = [".txt", ".md", ".docx"] as const;

/**
 * Documents are stored as HTML restricted to the tags the editor can render.
 * Everything that comes in (editor saves AND imported files) goes through this,
 * so the stored HTML is always safe to render and round-trips through TipTap.
 */
export function sanitizeDocumentHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "h1", "h2", "h3", "strong", "em", "u", "s", "ul", "ol", "li", "blockquote", "code", "pre", "hr", "a"],
    allowedAttributes: { a: ["href", "target", "rel"], ol: ["start"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      b: "strong",
      i: "em",
      strike: "s",
      del: "s",
      h4: "h3",
      h5: "h3",
      h6: "h3",
    },
    // Drop dangerous elements entirely rather than keeping their text content.
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe"],
  }).trim();
}

export function validateTitle(raw: unknown): string {
  if (typeof raw !== "string") throw badRequest("Title must be a string");
  const title = raw.replace(/\s+/g, " ").trim();
  if (!title) throw badRequest("Title can't be empty");
  if (title.length > MAX_TITLE_LENGTH) throw badRequest(`Title must be ${MAX_TITLE_LENGTH} characters or fewer`);
  return title;
}

export function validateContent(raw: unknown): string {
  if (typeof raw !== "string") throw badRequest("Content must be a string");
  if (Buffer.byteLength(raw, "utf8") > MAX_CONTENT_BYTES) throw badRequest("Document is too large (1 MB limit)");
  return sanitizeDocumentHtml(raw);
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function textToHtml(text: string): string {
  const paragraphs = text.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  return paragraphs
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function decodeUtf8(buf: Buffer): string {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
    if (text.includes("\u0000")) throw new Error("binary");
    return text.replace(/^﻿/, "");
  } catch {
    throw badRequest("That file doesn't look like UTF-8 text");
  }
}

export type ImportResult = { title: string; html: string };

/** Convert an uploaded file into a title + sanitized editor HTML. */
export async function importFile(filename: string, buf: Buffer): Promise<ImportResult> {
  const name = filename.trim() || "Untitled";
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  const base = (dot > 0 ? name.slice(0, dot) : name).slice(0, MAX_TITLE_LENGTH).trim() || "Untitled";

  if (!SUPPORTED_IMPORT_EXTENSIONS.includes(ext as never)) {
    throw badRequest(`Unsupported file type "${ext || "none"}". Supported: ${SUPPORTED_IMPORT_EXTENSIONS.join(", ")}`);
  }
  if (buf.length === 0) throw badRequest("The file is empty");
  if (buf.length > MAX_UPLOAD_BYTES) throw badRequest("File is too large (5 MB limit)");

  let html: string;
  if (ext === ".txt") {
    html = textToHtml(decodeUtf8(buf));
  } else if (ext === ".md") {
    html = await marked.parse(decodeUtf8(buf), { gfm: true });
  } else {
    // .docx is a zip archive; check the magic bytes before handing it to mammoth.
    if (buf[0] !== 0x50 || buf[1] !== 0x4b) throw badRequest("That file isn't a valid .docx document");
    const mammoth = await import("mammoth");
    try {
      const result = await mammoth.convertToHtml({ buffer: buf });
      html = result.value;
    } catch {
      throw badRequest("Couldn't read that .docx file");
    }
  }

  const clean = sanitizeDocumentHtml(html);
  if (Buffer.byteLength(clean, "utf8") > MAX_CONTENT_BYTES) throw badRequest("Imported document is too large (1 MB limit)");
  return { title: base, html: clean || "<p></p>" };
}
