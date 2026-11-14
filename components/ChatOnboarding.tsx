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

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="h1">{es ? "Regístrate en 5 minutos" : "Sign up in 5 minutes"}</h1>
        <p className="muted">
          {es ? "Es la misma conversación que por texto." : "It's the same conversation you'd have by text."}
          {smsNumber && <> {es ? "Texto:" : "Text:"} <b>{smsNumber}</b>.</>}
          {voiceNumber && <> {es ? "Llamada:" : "Call:"} <b>{voiceNumber}</b>.</>}
        </p>
      </div>

      <div className="card flex min-h-[55dvh] flex-col gap-2 bg-stone-50 p-3">
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[15px] leading-snug ${m.from === "us" ? "self-start rounded-bl-sm bg-white shadow-sm" : "self-end rounded-br-sm bg-brand text-white"}`}>
            {m.image && <img src={m.image} alt="" className="mb-1 max-h-40 rounded-lg" />}
            {m.text}
          </div>
        ))}
        {busy && <div className="self-start rounded-2xl bg-white px-3 py-2 text-stone-400 shadow-sm">…</div>}
        <div ref={endRef} />
      </div>

      {done ? (
        <a href="/me" className="btn-primary">{es ? "Ver mis trabajos y tarjetas →" : "See my jobs and cards →"}</a>
      ) : (
        <>
          {quick[step] && (
            <div className="flex flex-wrap gap-2">
              {quick[step].map((q) => (
                <button key={q} className="btn-ghost btn-sm" disabled={busy} onClick={() => send(q)}>
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
                <button type="button" className="btn-ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
                  📷
                </button>
              </>
            )}
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={es ? "Escribe tu respuesta…" : "Type your answer…"} disabled={busy} autoFocus />
            <button className="btn-primary" disabled={busy || !text.trim()}>
              {es ? "Enviar" : "Send"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
