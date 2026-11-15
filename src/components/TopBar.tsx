"use client";

import Link from "next/link";
import { api, initials } from "./api";

export function TopBar({ user, children }: { user: { name: string; email: string }; children?: React.ReactNode }) {
  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }
  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <span className="brand-mark">A</span> Ajaia Docs
      </Link>
      {children}
      <div className="user-chip">
        <span className="avatar" title={user.email}>{initials(user.name)}</span>
        <span>{user.name}</span>
        <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
      </div>
    </header>
  );
}
