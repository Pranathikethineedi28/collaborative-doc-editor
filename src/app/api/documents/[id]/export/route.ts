import TurndownService from "turndown";
import { getDocument } from "@/lib/documents";
import { authedRoute } from "@/lib/server";

// Stretch: export to Markdown. Anyone with read access can export.
export const GET = authedRoute<{ id: string }>(async ({ db, user, params }) => {
  const doc = await getDocument(db, user.id, params.id);
  const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
  td.addRule("underline", { filter: ["u"], replacement: (c) => `<u>${c}</u>` });
  const md = `# ${doc.title}\n\n${td.turndown(doc.content || "")}\n`;
  const filename = doc.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "document";
  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.md"`,
    },
  });
});
