import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server";
import { SEED_PASSWORD, SEED_USERS } from "@/lib/schema";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  return <LoginForm demoUsers={SEED_USERS.map((u) => ({ ...u }))} demoPassword={SEED_PASSWORD} />;
}
