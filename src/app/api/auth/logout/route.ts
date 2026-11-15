import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { logout, SESSION_COOKIE } from "@/lib/auth";
import { errorResponse } from "@/lib/server";

export async function POST() {
  try {
    const db = await getDb();
    await logout(db, (await cookies()).get(SESSION_COOKIE)?.value);
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
