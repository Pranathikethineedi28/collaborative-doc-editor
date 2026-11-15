import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getDocument } from "@/lib/documents";
import { HttpError } from "@/lib/errors";
import { currentUser } from "@/lib/server";
import { DocEditor } from "@/components/DocEditor";

export const dynamic = "force-dynamic";

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  try {
    const doc = await getDocument(await getDb(), user.id, id);
    return <DocEditor initialDoc={doc} user={user} />;
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  }
}
