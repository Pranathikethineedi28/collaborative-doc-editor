import { listCollaborators, shareDocument } from "@/lib/documents";
import { authedRoute, readJson } from "@/lib/server";

type P = { id: string };

export const GET = authedRoute<P>(async ({ db, user, params }) => ({
  collaborators: await listCollaborators(db, user.id, params.id),
}));

export const POST = authedRoute<P>(async ({ req, db, user, params }) => {
  const body = await readJson(req);
  return { collaborators: await shareDocument(db, user.id, params.id, body) };
});
