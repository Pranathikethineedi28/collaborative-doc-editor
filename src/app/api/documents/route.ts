import { createDocument, listDocuments } from "@/lib/documents";
import { authedRoute, readJson } from "@/lib/server";

export const GET = authedRoute(async ({ db, user }) => listDocuments(db, user.id));

export const POST = authedRoute(async ({ req, db, user }) => {
  const body = await readJson(req).catch(() => ({}) as Record<string, unknown>);
  return { document: await createDocument(db, user.id, { title: body.title, content: body.content }) };
});
