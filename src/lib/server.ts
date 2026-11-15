import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb, type Db } from "./db";
import { SESSION_COOKIE, userForToken, type User } from "./auth";
import { HttpError, unauthorized } from "./errors";

/** Resolve the signed-in user for server components (null if signed out). */
export async function currentUser(): Promise<User | null> {
  const db = await getDb();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return userForToken(db, token);
}

type Ctx<P> = { params: Promise<P> };

/**
 * Wraps an API route: loads the DB and the signed-in user, and turns thrown
 * HttpErrors into JSON error responses ({ error, code }).
 */
export function authedRoute<P = Record<string, string>>(
  handler: (args: { req: Request; db: Db; user: User; params: P }) => Promise<Response | unknown>,
) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const db = await getDb();
      const token = (await cookies()).get(SESSION_COOKIE)?.value;
      const user = await userForToken(db, token);
      if (!user) throw unauthorized();
      const result = await handler({ req, db, user, params: await ctx.params });
      return result instanceof Response ? result : NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json({ error: "Something went wrong. Please try again.", code: "internal" }, { status: 500 });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {}
  throw new HttpError(400, "Request body must be a JSON object", "bad_request");
}
