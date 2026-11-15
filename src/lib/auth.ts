import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { Db } from "./db";
import { unauthorized } from "./errors";

export const SESSION_COOKIE = "ajaia_session";
export const SESSION_TTL_DAYS = 7;

// Real hash used when the email is unknown, so timing is similar either way.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export type User = { id: number; email: string; name: string };

export async function login(db: Db, email: string, password: string): Promise<{ token: string; user: User }> {
  const [row] = await db.query<User & { password_hash: string }>(
    "SELECT id, email, name, password_hash FROM users WHERE email = $1",
    [email.trim().toLowerCase()],
  );
  // Compare even when the user is missing so response timing doesn't reveal valid emails.
  const ok = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) throw unauthorized("Invalid email or password");

  const token = randomBytes(32).toString("hex");
  await db.query(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_TTL_DAYS} days')`,
    [token, row.id],
  );
  return { token, user: { id: row.id, email: row.email, name: row.name } };
}

export async function userForToken(db: Db, token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const [row] = await db.query<User>(
    `SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token],
  );
  return row ?? null;
}

export async function logout(db: Db, token: string | undefined) {
  if (token) await db.query("DELETE FROM sessions WHERE token = $1", [token]);
}

export async function listUsers(db: Db): Promise<User[]> {
  return db.query<User>("SELECT id, email, name FROM users ORDER BY name");
}
