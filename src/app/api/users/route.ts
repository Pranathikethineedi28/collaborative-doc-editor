import { listUsers } from "@/lib/auth";
import { authedRoute } from "@/lib/server";

// Small directory so the share dialog can suggest teammates.
export const GET = authedRoute(async ({ db }) => ({ users: await listUsers(db) }));
