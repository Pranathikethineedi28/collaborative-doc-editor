"use client";

import { useState } from "react";
import { api, initials } from "./api";

type DemoUser = { email: string; name: string };

export function LoginForm({ demoUsers, demoPassword }: { demoUsers: DemoUser[]; demoPassword: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: string, p: string) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { method: "POST", json: { email: e, password: p } });
      window.location.href = "/";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand">
          <span className="brand-mark">A</span> Ajaia Docs
        </div>
        <h1>Sign in</h1>
        <p className="hint" style={{ margin: 0 }}>Demo accounts below. Every demo account uses the password <code>{demoPassword}</code>.</p>

        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            signIn(email, password);
          }}
        >
          {error && <div className="banner banner-error" style={{ marginTop: 14, marginBottom: 0 }} role="alert">{error}</div>}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 18, height: 38 }} disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="demo-users">
          <div className="hint" style={{ marginBottom: 6 }}>Or continue as a demo user</div>
          {demoUsers.map((u) => (
            <button key={u.email} type="button" className="demo-user" disabled={busy} onClick={() => signIn(u.email, demoPassword)}>
              <span className="avatar">{initials(u.name)}</span>
              <span>
                <div style={{ fontWeight: 550 }}>{u.name}</div>
                <div className="hint">{u.email}</div>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
