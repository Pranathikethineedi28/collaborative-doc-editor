import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { login, SESSION_COOKIE, SESSION_TTL_DAYS } from "@/lib/auth";
import { badRequest } from "@/lib/errors";
import { errorResponse, readJson } from "@/lib/server";

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    if (typeof body.email !== "string" || typeof body.password !== "string" || !body.email || !body.password) {
      throw badRequest("Email and password are required");
    }
    const db = await getDb();
    const { token, user } = await login(db, body.email, body.password);
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    });
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
