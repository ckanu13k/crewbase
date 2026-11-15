"use client";
// Landing page for email magic links: supabase-js reads the session from the URL, then we hand the
// tokens to the server exactly as the code-entry sign-in does.
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export function AuthCallback({ supabaseUrl, anonKey }: { supabaseUrl: string; anonKey: string }) {
  const [msg, setMsg] = useState("Signing you in…");
  useEffect(() => {
    const supabase = createClient(supabaseUrl, anonKey, { auth: { detectSessionInUrl: true, persistSession: false } });
    (async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      const { data, error } = code ? await supabase.auth.exchangeCodeForSession(code) : await supabase.auth.getSession();
      const session = data.session;
      if (error || !session) return setMsg("This sign-in link is invalid or expired. Go back and request a new one.");
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: session.access_token, refreshToken: session.refresh_token, intent: (() => { try { return localStorage.getItem("cp_intent") ?? undefined; } catch { return undefined; } })() }),
      });
      const body = await res.json();
      if (!res.ok) return setMsg(body.error ?? "Sign-in failed");
      window.location.replace(body.home ?? "/");
    })();
  }, [supabaseUrl, anonKey]);
  return <p className="p-8 text-center text-slate-600">{msg}</p>;
}
