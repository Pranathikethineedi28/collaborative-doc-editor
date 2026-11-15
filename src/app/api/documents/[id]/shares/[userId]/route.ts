import { unshareDocument } from "@/lib/documents";
import { badRequest } from "@/lib/errors";
import { authedRoute } from "@/lib/server";

export const DELETE = authedRoute<{ id: string; userId: string }>(async ({ db, user, params }) => {
  const target = Number(params.userId);
  if (!Number.isInteger(target)) throw badRequest("Invalid user id");
  return { collaborators: await unshareDocument(db, user.id, params.id, target) };
});
