import { importFile, MAX_UPLOAD_BYTES } from "@/lib/content";
import { createDocument } from "@/lib/documents";
import { badRequest } from "@/lib/errors";
import { authedRoute } from "@/lib/server";

// Upload a .txt / .md / .docx file and turn it into a new editable document.
export const POST = authedRoute(async ({ req, db, user }) => {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_UPLOAD_BYTES + 64 * 1024) throw badRequest("File is too large (5 MB limit)");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest("Expected a multipart form upload");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Choose a file to upload");

  const { title, html } = await importFile(file.name, Buffer.from(await file.arrayBuffer()));
  const document = await createDocument(db, user.id, { title, content: html, sourceFilename: file.name });
  return { document };
});
