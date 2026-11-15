"use client";
// Live mode sign-in with Supabase Auth one-time codes. Workers use their phone or email; employers,
// training providers and staff use email.
import { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Lang } from "@/lib/types";

type Mode = "phone" | "workerEmail" | "email";
export function LoginForm({ lang, mode: initial, supabaseUrl, anonKey }: { lang: Lang; mode: Mode; supabaseUrl: string; anonKey: string }) {
  const supabase = useMemo(() => createClient(supabaseUrl, anonKey), [supabaseUrl, anonKey]);
  const [mode, setMode] = useState<Mode>(initial);
  const byEmail = mode !== "phone";
  const intent = mode === "email" ? "employer" : "worker";
  const [id, setId] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const es = lang === "es";
  const phone = () => { const d = id.replace(/\D/g, ""); return d.length === 10 ? "+1" + d : "+" + d; };

  async function sendCode() {
    setErr("");
    try { localStorage.setItem("cp_intent", intent); } catch {}
    const { error } = !byEmail ? await supabase.auth.signInWithOtp({ phone: phone() }) : await supabase.auth.signInWithOtp({ email: id.trim(), options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback` } });
    if (error) setErr(error.message); else setSent(true);
  }
  async function verify() {
    setErr("");
    const { data, error } = !byEmail
      ? await supabase.auth.verifyOtp({ phone: phone(), token: code, type: "sms" })
      : await supabase.auth.verifyOtp({ email: id.trim(), token: code, type: "email" });
    if (error || !data.session) return setErr(error?.message ?? "Invalid code");
    const res = await fetch("/api/auth/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken: data.session.access_token, refreshToken: data.session.refresh_token, intent }) });
    const body = await res.json();
    if (!res.ok) return setErr(body.error ?? "Sign-in failed");
    window.location.href = body.home ?? "/";
  }

  return (
    <div className="card mx-auto mt-6 max-w-md space-y-4 p-6 sm:p-8">
      <div className="text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lift">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4 4L19 7" /></svg>
        </span>
        <h1 className="h1 mt-4">{es ? "Iniciar sesión" : "Sign in"}</h1>
        <p className="muted mt-1">{es ? "Te mandamos un código, sin contraseña." : "We send you a one-time code. No password."}</p>
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-sm">
        {([
          ["phone", es ? "Trabajador · celular" : "Worker · phone"],
          ["workerEmail", es ? "Trabajador · correo" : "Worker · email"],
          ["email", es ? "Empresa / equipo" : "Company / team"],
        ] as [Mode, string][]).map(([m, label]) => (
          <button key={m} className={`rounded-lg px-2 py-2 font-semibold transition ${mode === m ? "bg-white text-brand-dark shadow-card" : "text-slate-500 hover:text-ink"}`} onClick={() => { setMode(m); setSent(false); }}>{label}</button>
        ))}
      </div>
      <input className="input" value={id} onChange={(e) => setId(e.target.value)} placeholder={mode === "phone" ? "713 555 0100" : mode === "workerEmail" ? "you@email.com" : "you@company.com"} inputMode={mode === "phone" ? "tel" : "email"} />
      {sent && <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder={es ? "Código" : "Code"} inputMode="numeric" autoFocus />}
      <button className="btn-primary w-full" onClick={sent ? verify : sendCode}>{sent ? (es ? "Entrar" : "Sign in") : es ? "Mandar código" : "Send code"}</button>
      {sent && byEmail && <p className="text-sm text-slate-600">{es ? "Revisa tu correo: abre el enlace o escribe el código." : "Check your email: open the link, or type the code if there is one."}</p>}
      {err && <p className="text-sm font-semibold text-red-700">{err}</p>}
    </div>
  );
}
