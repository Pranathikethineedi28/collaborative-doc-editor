import { deleteDocument, getDocument, updateDocument } from "@/lib/documents";
import { authedRoute, readJson } from "@/lib/server";

type P = { id: string };

export const GET = authedRoute<P>(async ({ db, user, params }) => ({ document: await getDocument(db, user.id, params.id) }));

export const PATCH = authedRoute<P>(async ({ req, db, user, params }) => {
  const body = await readJson(req);
  return updateDocument(db, user.id, params.id, body);
});

export const DELETE = authedRoute<P>(async ({ db, user, params }) => {
  await deleteDocument(db, user.id, params.id);
  return { ok: true };
});
