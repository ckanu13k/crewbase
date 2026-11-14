"use client";
// Web version of the SMS signup. It talks to the same engine as Twilio, so what you see here is
// exactly what a worker gets by text.
import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/types";

type Msg = { from: "us" | "them"; text: string; image?: string };

export function ChatOnboarding({ lang: initialLang, smsNumber, voiceNumber }: { lang: Lang; smsNumber: string | null; voiceNumber: string | null }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("lang");
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  async function send(body: string, photo?: File) {
    setBusy(true);
    if (body || photo) setMsgs((m) => [...m, { from: "them", text: body, image: photo ? URL.createObjectURL(photo) : undefined }]);
    const fd = new FormData();
    fd.set("text", body);
    if (photo) fd.set("photo", photo);
    try {
      const res = await fetch("/api/onboard", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      setMsgs((m) => [...m, ...data.replies.map((r: string) => ({ from: "us" as const, text: r }))]);
      setStep(data.step);
      setDone(data.done);
      setLang(data.lang);
    } catch (e) {
      setMsgs((m) => [...m, { from: "us", text: `⚠ ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void send("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  const es = lang === "es";
  const quick: Record<string, string[]> = {
    lang: ["1", "2"],
    consent: [es ? "SÍ" : "YES"],
    confirm: ["1", "2"],
    radius: ["1", "2", "3", "4"],
    cards: [es ? "LISTO" : "DONE"],
    done: ["1", "2", "3"],
  };

  const stepsOrder = ["lang", "consent", "phone", "name", "trade", "experience", "confirm", "zip", "radius", "shifts", "cards", "done"];
  const progress = Math.round((Math.max(0, stepsOrder.indexOf(step === "fix" ? "confirm" : step)) / (stepsOrder.length - 1)) * 100);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <div className="eyebrow">{es ? "Registro gratis" : "Free signup"}</div>
        <h1 className="h1 mt-1">{es ? "Regístrate en 5 minutos" : "Sign up in 5 minutes"}</h1>
        <p className="mt-1 text-[15px] text-slate-500">
          {es ? "Es la misma conversación que por texto." : "It's the same conversation you'd have by text."}
          {smsNumber && <> {es ? "Texto:" : "Text:"} <b className="text-ink">{smsNumber}</b>.</>}
          {voiceNumber && <> {es ? "Llamada:" : "Call:"} <b className="text-ink">{voiceNumber}</b>.</>}
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4 4L19 7" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">CrewPass</div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{es ? "En línea" : "Online"}</div>
          </div>
          <div className="w-24">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${progress}%` }} /></div>
            <div className="mt-1 text-right text-[11px] text-slate-400">{progress}%</div>
          </div>
        </div>
        <div className="flex min-h-[50dvh] flex-col gap-2.5 bg-slate-50/70 p-4">
          {msgs.map((m, i) => (
            <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed ${m.from === "us" ? "self-start rounded-bl-md bg-white text-ink shadow-card ring-1 ring-slate-200/70" : "self-end rounded-br-md bg-brand text-white shadow-sm shadow-blue-600/20"}`}>
              {m.image && <img src={m.image} alt="" className="mb-1.5 max-h-40 rounded-xl" />}
              {m.text}
            </div>
          ))}
          {busy && (
            <div className="flex gap-1 self-start rounded-2xl rounded-bl-md bg-white px-4 py-3.5 shadow-card ring-1 ring-slate-200/70">
              {[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />)}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-slate-100 bg-white p-3">
          {done ? (
            <a href="/me" className="btn-primary w-full">{es ? "Ver mis trabajos y tarjetas" : "See my jobs and cards"} →</a>
          ) : (
            <>
              {quick[step] && (
                <div className="mb-2.5 flex flex-wrap gap-2">
                  {quick[step].map((q) => (
                    <button key={q} className="rounded-full border border-blue-200 bg-brand-soft px-3.5 py-1.5 text-sm font-semibold text-brand-dark transition hover:bg-blue-100 disabled:opacity-50" disabled={busy} onClick={() => send(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!text.trim()) return;
                  const v = text;
                  setText("");
                  void send(v);
                }}
              >
                {step === "cards" && (
                  <>
                    <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && send("", e.target.files[0])} />
                    <button type="button" className="btn-soft px-3" disabled={busy} onClick={() => fileRef.current?.click()} aria-label={es ? "Foto" : "Photo"}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
                    </button>
                  </>
                )}
                <input className="input rounded-full" value={text} onChange={(e) => setText(e.target.value)} placeholder={es ? "Escribe tu respuesta…" : "Type your answer…"} disabled={busy} autoFocus />
                <button className="btn-primary rounded-full px-5" disabled={busy || !text.trim()}>
                  {es ? "Enviar" : "Send"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
