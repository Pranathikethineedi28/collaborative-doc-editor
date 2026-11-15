import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { importFile } from "@/lib/content";

async function makeDocx(bodyXml: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("file import", () => {
  it("turns a .txt file into paragraphs, escaping HTML", async () => {
    const r = await importFile("meeting notes.txt", Buffer.from("Line one\nline two\n\n<b>not bold</b>"));
    expect(r.title).toBe("meeting notes");
    expect(r.html).toBe("<p>Line one<br />line two</p><p>&lt;b&gt;not bold&lt;/b&gt;</p>");
  });

  it("converts Markdown formatting and drops raw script tags", async () => {
    const md = "# Title\n\nSome **bold** and _italic_.\n\n- a\n- b\n\n1. one\n\n<script>alert(1)</script>";
    const r = await importFile("README.md", Buffer.from(md));
    expect(r.html).toContain("<h1>Title</h1>");
    expect(r.html).toContain("<strong>bold</strong>");
    expect(r.html).toContain("<em>italic</em>");
    expect(r.html).toMatch(/<ul>\s*<li>a<\/li>/);
    expect(r.html).toMatch(/<ol>\s*<li>one<\/li>/);
    expect(r.html).not.toContain("script");
  });

  it("converts a .docx file, keeping bold text", async () => {
    const buf = await makeDocx(`<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Hello</w:t></w:r><w:r><w:t xml:space="preserve"> world</w:t></w:r></w:p>`);
    const r = await importFile("Brief.docx", buf);
    expect(r.title).toBe("Brief");
    expect(r.html).toBe("<p><strong>Hello</strong> world</p>");
  });

  it("rejects unsupported, empty, binary and fake .docx files", async () => {
    await expect(importFile("photo.png", Buffer.from("x"))).rejects.toMatchObject({ status: 400 });
    await expect(importFile("empty.txt", Buffer.alloc(0))).rejects.toMatchObject({ status: 400 });
    await expect(importFile("bin.txt", Buffer.from([0xff, 0xfe, 0x00, 0x01]))).rejects.toMatchObject({ status: 400 });
    await expect(importFile("fake.docx", Buffer.from("not a zip"))).rejects.toMatchObject({ status: 400 });
  });
});
