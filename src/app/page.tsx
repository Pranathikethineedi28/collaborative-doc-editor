import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { listDocuments } from "@/lib/documents";
import { currentUser } from "@/lib/server";
import { Dashboard } from "@/components/Dashboard";
import { TopBar } from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { owned, shared } = await listDocuments(await getDb(), user.id);
  return (
    <>
      <TopBar user={user} />
      <Dashboard owned={owned} shared={shared} />
    </>
  );
}
