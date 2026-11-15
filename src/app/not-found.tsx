import Link from "next/link";

export default function NotFound() {
  return (
    <div className="login-wrap">
      <div className="login-card" style={{ textAlign: "center" }}>
        <h1>Document not found</h1>
        <p className="hint">It may have been deleted, or it hasn&apos;t been shared with you.</p>
        <Link href="/" className="btn btn-primary" style={{ marginTop: 12 }}>
          Back to documents
        </Link>
      </div>
    </div>
  );
}
