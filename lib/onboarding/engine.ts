// One onboarding conversation for every channel: web chat, SMS, WhatsApp and voice.
// Each inbound message advances a small state machine stored in onboarding_sessions.
// Target: a usable profile in about five minutes, with no app download.

import type { Store } from "../db";
import type { Channel, Credential, Lang, OnboardingSession, Shift, Worker } from "../types";
import { CREDENTIAL_BY_ID, SECTORS, TRADES, credShort, skillLabel, tradeLabel } from "../taxonomy";
import { credentialStatus, evaluateMatch } from "../matching";
import { zipToPoint } from "../geo";
import type { ProfileExtraction } from "../ai/rules";
import type { CardReading } from "../ai/credential";

export interface EngineDeps {
  store: Store;
  extract(text: string, lang: Lang, tradeHint: string | null): Promise<ProfileExtraction>;
  readCard(bytes: Uint8Array, mediaType: string): Promise<CardReading>;
  fetchMedia(url: string): Promise<{ bytes: Uint8Array; contentType: string }>;
  appUrl: string;
  today: string;
  newId(): string;
  now(): string;
}

export interface Inbound {
  channel: Channel;
  address: string; // phone (sms/whatsapp/voice) or a browser key (web)
  text?: string;
  media?: { url?: string; bytes?: Uint8Array; contentType: string }[];
  knownPhone?: string | null; // signed-in phone (live web mode)
  knownWorkerId?: string | null; // signed-in worker without a phone yet (email sign-in)
}

export interface EngineResult {
  replies: string[];
  session: OnboardingSession;
  workerId: string | null;
  done: boolean;
}

type Step = "lang" | "consent" | "phone" | "name" | "sector" | "trade" | "experience" | "confirm" | "fix" | "zip" | "radius" | "shifts" | "cards" | "done";

const STOP_WORDS = ["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "alto", "parar"];
const START_WORDS = ["start", "unstop", "yes start"];
const HELP_WORDS = ["help", "info", "ayuda"];
const YES = ["yes", "y", "yeah", "yep", "ok", "okay", "si", "sí", "claro", "1"];
const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
};

const clean = (s: string) => s.trim().toLowerCase().normalize("NFC").replace(/[.!¡¿?]/g, "");

/** All option numbers mentioned: "1 3", "1,3", "uno y tres", "number two". */
export function parseChoices(text: string, max: number): number[] {
  const out = new Set<number>();
  for (const tok of clean(text).split(/[^\p{L}\p{N}]+/u)) {
    const n = /^\d+$/.test(tok) ? Number(tok) : NUMBER_WORDS[tok];
    if (n && n >= 1 && n <= max) out.add(n);
  }
  return [...out];
}

const RADII = [10, 25, 50, 0];
const SHIFTS: Shift[] = ["day", "night", "rotating", "turnaround"];

function msg(lang: Lang, key: string, v: Record<string, string | number> = {}): string {
  const M: Record<string, Record<Lang, string>> = {
    lang: { en: "CrewPass: find craft work and keep your cards current. Reply 1 for English. Responde 2 para Español.", es: "" },
    consent: {
      en: "We'll text you about jobs and training that fit you. Msg & data rates may apply; frequency varies. Reply STOP anytime to opt out, HELP for help. Reply YES to continue.",
      es: "Te mandaremos textos sobre trabajos y capacitación para ti. Pueden aplicar tarifas de mensajes y datos; la frecuencia varía. Responde STOP para salir o AYUDA para ayuda. Responde SÍ para continuar.",
    },
    consentRetry: { en: "Reply YES to continue, or STOP to opt out.", es: "Responde SÍ para continuar, o STOP para salir." },
    phone: { en: "What's your cell number? We'll text job matches there.", es: "¿Cuál es tu número de celular? Ahí te mandamos los trabajos." },
    phoneRetry: { en: "Please send a 10-digit US cell number, like 713 555 0100.", es: "Manda un número de 10 dígitos, por ejemplo 713 555 0100." },
    name: { en: "What's your name?", es: "¿Cómo te llamas?" },
    // Two short menus instead of one long one: a 23-line trade list is ~10 SMS segments in Spanish.
    sector: { en: "Thanks, {name}. What kind of work? Reply with a number:\n{list}\nOr describe your trade in your own words.", es: "Gracias, {name}. ¿Qué tipo de trabajo? Responde con un número:\n{list}\nO describe tu oficio con tus palabras." },
    trade: { en: "What's your main trade? Reply with a number:\n{list}\nOr describe it in your own words.", es: "¿Cuál es tu oficio principal? Responde con un número:\n{list}\nO descríbelo con tus palabras." },
    experience: {
      en: "Tell us about your experience in your own words: years in the trade, the work you've done (plants, construction sites, warehouses, homes), tools and equipment you use, and any cards (OSHA, NCCER, TWIC, forklift, CDL, licenses).",
      es: "Cuéntanos tu experiencia con tus palabras: años en el oficio, qué trabajos has hecho (plantas, obras, almacenes, casas), herramientas y equipo, y tus tarjetas (OSHA, NCCER, TWIC, montacargas, CDL, licencias).",
    },
    confirm: { en: "Here's what we got:\n{summary}\nIs that right? Reply 1 for yes, or 2 and tell us what to fix.", es: "Esto es lo que entendimos:\n{summary}\n¿Está bien? Responde 1 para sí, o 2 y dinos qué corregir." },
    fix: { en: "What should we fix or add?", es: "¿Qué corregimos o agregamos?" },
    zip: { en: "What ZIP code do you live in?", es: "¿En qué código postal (ZIP) vives?" },
    zipRetry: { en: "Please send a 5-digit ZIP code, like 77506.", es: "Manda un código postal de 5 dígitos, por ejemplo 77506." },
    zipUnknown: { en: "Got it. (We don't have that ZIP on our map yet, so distances may be missing.)", es: "Listo. (Todavía no tenemos ese ZIP en el mapa; puede faltar la distancia.)" },
    radius: { en: "How far will you drive to work?\n1) 10 miles\n2) 25 miles\n3) 50 miles\n4) Any distance", es: "¿Qué tan lejos manejarías para trabajar?\n1) 10 millas\n2) 25 millas\n3) 50 millas\n4) Cualquier distancia" },
    shifts: { en: "Which shifts work for you? Reply all that fit, like 1 3:\n1) Days\n2) Nights\n3) Rotating\n4) Turnarounds / shutdowns", es: "¿Qué turnos te sirven? Responde todos los que apliquen, por ejemplo 1 3:\n1) Día\n2) Noche\n3) Rotativo\n4) Paros de planta" },
    pickNumber: { en: "Please reply with a number from the list.", es: "Responde con un número de la lista." },
    cards: {
      en: "Last step: send photos of your cards (OSHA, NCCER, TWIC, forklift, CDL, licenses), front side, one at a time. Reply DONE when finished, or SKIP.",
      es: "Último paso: manda fotos de tus tarjetas (OSHA, NCCER, TWIC, montacargas, CDL, licencias), del frente, una por una. Responde LISTO cuando termines, o SALTAR.",
    },
    cardsVoice: { en: "We'll text you a link to add photos of your cards.", es: "Te mandaremos un enlace por texto para agregar fotos de tus tarjetas." },
    cardGot: { en: "Got it: {card}{exp}. Send another photo or reply DONE.", es: "Recibida: {card}{exp}. Manda otra foto o responde LISTO." },
    cardUnknown: { en: "Got the photo. A recruiter will check which card it is. Send another or reply DONE.", es: "Recibimos la foto. Un reclutador revisará qué tarjeta es. Manda otra o responde LISTO." },
    cardWaiting: { en: "Send a photo of a card, or reply DONE.", es: "Manda una foto de una tarjeta, o responde LISTO." },
    done: {
      en: "You're all set{name}! See jobs that fit you and your cards: {url}\nWe'll text you when a job fits. Reply 1 for jobs, 2 for your cards, 3 for training.",
      es: "¡Listo{name}! Ve los trabajos para ti y tus tarjetas: {url}\nTe mandamos texto cuando haya un trabajo. Responde 1 para trabajos, 2 para tus tarjetas, 3 para capacitación.",
    },
    menu: { en: "Reply 1 for jobs, 2 for your cards, 3 for training. Send a card photo anytime.", es: "Responde 1 para trabajos, 2 para tus tarjetas, 3 para capacitación. Manda foto de una tarjeta cuando quieras." },
    noJobs: { en: "No open jobs fit you right now. We'll text you when one does.", es: "Ahorita no hay trabajos para ti. Te mandamos texto cuando haya." },
    jobsHeader: { en: "Jobs that fit you:", es: "Trabajos para ti:" },
    jobsMore: { en: "Details and what you're missing: {url}", es: "Detalles y lo que te falta: {url}" },
    cardsHeader: { en: "Your cards:", es: "Tus tarjetas:" },
    noCards: { en: "No cards yet. Send a photo of one anytime.", es: "Aún no hay tarjetas. Manda una foto cuando quieras." },
    training: { en: "Training near you, with start dates and ways to pay: {url}", es: "Capacitación cerca de ti, con fechas y formas de pago: {url}" },
    help: { en: "CrewPass: free job matching for craft workers. Reply STOP to opt out. Questions? Reply here and a recruiter will answer.", es: "CrewPass: trabajos gratis para gente de oficio. Responde STOP para salir. ¿Preguntas? Responde aquí y un reclutador te contesta." },
    stopped: { en: "You're unsubscribed from CrewPass texts. Reply START to come back.", es: "Ya no recibirás textos de CrewPass. Responde START para volver." },
    started: { en: "Welcome back! Texts are on again.", es: "¡Bienvenido de nuevo! Los textos están activos." },
  };
  let s = M[key]?.[lang] || M[key]?.en || key;
  for (const [k, val] of Object.entries(v)) s = s.replaceAll(`{${k}}`, String(val));
  return s;
}

const sectorList = (lang: Lang) => SECTORS.map((x, i) => `${i + 1}) ${x.label[lang]}`).join("\n");
/** Trades offered after a sector is picked; all trades if none was. */
const tradesIn = (sector: unknown) => (typeof sector === "string" ? TRADES.filter((t) => t.sectors.includes(sector as never)) : TRADES);
const tradeList = (lang: Lang, sector: unknown) => tradesIn(sector).map((t, i) => `${i + 1}) ${t.label[lang]}`).join("\n");

function summaryText(w: Worker, creds: string[], lang: Lang): string {
  const es = lang === "es";
  const lines = [
    `${tradeLabel(w.trade, lang)}${w.yearsExperience !== null ? `, ${w.yearsExperience} ${es ? "años" : "yrs"}` : ""}${w.nccerLevel ? `, NCCER ${es ? "nivel" : "level"} ${w.nccerLevel}` : ""}`,
    `${es ? "Habilidades" : "Skills"}: ${w.skills.length ? w.skills.slice(0, 8).map((s) => skillLabel(s, lang)).join(", ") : "—"}`,
    `${es ? "Tarjetas" : "Cards"}: ${creds.length ? creds.map(credShort).join(", ") : "—"}`,
  ];
  return lines.join("\n");
}

function normalizePhone(text: string): string | null {
  const digits = text.replace(/\D/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return null;
}

export async function handleInbound(deps: EngineDeps, inb: Inbound): Promise<EngineResult> {
  const { store } = deps;
  const sessions = store.table("onboarding_sessions");
  const workers = store.table("workers");
  const credentials = store.table("credentials");

  const sessionId = `${inb.channel}:${inb.address}`;
  let session: OnboardingSession =
    (await sessions.get(sessionId)) ?? { id: sessionId, channel: inb.channel, address: inb.address, workerId: null, step: "lang", lang: "en", answers: {}, updatedAt: deps.now() };

  const isPhoneChannel = inb.channel !== "web";
  const phone = isPhoneChannel ? inb.address : inb.knownPhone ?? null;

  if (!session.workerId && inb.knownWorkerId) session.workerId = inb.knownWorkerId;
  // A returning texter who already has a profile skips straight to the menu.
  if (!session.workerId && phone) {
    const existing = (await workers.list({ phone } as Partial<Worker>))[0];
    if (existing) {
      session = { ...session, workerId: existing.id, lang: existing.lang, step: existing.onboardingComplete ? "done" : session.step };
    }
  }

  let worker: Worker | null = session.workerId ? await workers.get(session.workerId) : null;
  const lang = (): Lang => worker?.lang ?? session.lang;
  const text = (inb.text ?? "").trim();
  const word = clean(text);
  const replies: string[] = [];
  const say = (key: string, v?: Record<string, string | number>) => replies.push(msg(lang(), key, v));

  const saveWorker = async (patch: Partial<Worker>) => {
    if (!worker) return;
    worker = { ...worker, ...patch };
    await workers.upsert(worker);
  };
  const go = (step: Step) => {
    session.step = step;
  };

  // --- Carrier keywords work at any step ---
  if (isPhoneChannel && STOP_WORDS.includes(word)) {
    await saveWorker({ consentSms: false });
    say("stopped");
    return finish();
  }
  if (isPhoneChannel && START_WORDS.includes(word)) {
    await saveWorker({ consentSms: true });
    say("started");
    return finish();
  }
  if (HELP_WORDS.includes(word)) {
    say("help");
    return finish();
  }

  // --- Card photos are accepted at any point once we have a worker ---
  if (inb.media?.length && worker) {
    for (const m of inb.media) {
      const file = m.bytes ? { bytes: m.bytes, contentType: m.contentType } : await deps.fetchMedia(m.url!);
      const reading = await deps.readCard(file.bytes, file.contentType);
      const id = deps.newId();
      const ext = file.contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
      const photoPath = await store.saveFile(`${worker.id}/${id}.${ext}`, file.bytes, file.contentType);
      const cred: Credential = {
        id, workerId: worker.id, type: reading.type ?? "unknown", number: reading.number, holderName: reading.holderName,
        issuedOn: reading.issuedOn, expiresOn: reading.expiresOn, photoPath, verification: "document", verifiedBy: null,
        verifiedMethod: null, extractionConfidence: reading.confidence,
        needsReview: reading.type === null || reading.confidence < 0.85 || reading.expiryInferred, createdAt: deps.now(),
      };
      await credentials.upsert(cred);
      if (reading.type) {
        const exp = reading.expiresOn ? (lang() === "es" ? `, vence ${reading.expiresOn}` : `, expires ${reading.expiresOn}`) : "";
        say("cardGot", { card: CREDENTIAL_BY_ID[reading.type]?.label[lang()] ?? reading.type, exp });
      } else {
        say("cardUnknown");
      }
    }
    if (session.step !== "cards" && session.step !== "done") {
      replies.push(msg(lang(), session.step === "lang" ? "lang" : promptKey(session.step as Step)));
    }
    return finish();
  }

  switch (session.step as Step) {
    case "lang": {
      const c = parseChoices(text, 2)[0];
      if (!c) {
        if (/espa|spanish/i.test(text)) session.lang = "es";
        else if (/english|ingl/i.test(text)) session.lang = "en";
        else {
          replies.push(msg("en", "lang"));
          break;
        }
      } else session.lang = c === 2 ? "es" : "en";
      go("consent");
      say("consent");
      break;
    }
    case "consent": {
      if (!YES.includes(word)) {
        say("consentRetry");
        break;
      }
      session.answers.consentAt = deps.now();
      if (phone) {
        worker = await ensureWorker(phone);
        go("name");
        say("name");
      } else {
        go("phone");
        say("phone");
      }
      break;
    }
    case "phone": {
      const p = normalizePhone(text);
      if (!p) {
        say("phoneRetry");
        break;
      }
      const existing = (await workers.list({ phone: p } as Partial<Worker>))[0];
      if (worker && !existing) {
        // Signed in by email: attach the phone to this account instead of creating another one.
        worker = { ...worker, phone: p, consentSms: true };
        await workers.upsert(worker);
      } else worker = existing ?? (await ensureWorker(p));
      if (existing?.onboardingComplete) {
        go("done");
        say("done", { name: existing.name ? ", " + existing.name.split(" ")[0] : "", url: `${deps.appUrl}/me` });
      } else {
        go("name");
        say("name");
      }
      break;
    }
    case "name": {
      if (text.length < 2) {
        say("name");
        break;
      }
      await saveWorker({ name: text.slice(0, 80) });
      go("sector");
      say("sector", { name: text.split(" ")[0], list: sectorList(lang()) });
      break;
    }
    case "sector": {
      const c = parseChoices(text, SECTORS.length)[0];
      if (c) {
        session.answers.sector = SECTORS[c - 1].id;
        go("trade");
        say("trade", { list: tradeList(lang(), session.answers.sector) });
      } else if (text.length > 2) {
        await absorbExperience(text, null);
      } else {
        say("pickNumber");
      }
      break;
    }
    case "trade": {
      const options = tradesIn(session.answers.sector);
      const c = parseChoices(text, options.length)[0];
      if (c) {
        await saveWorker({ trade: options[c - 1].id });
        go("experience");
        say("experience");
      } else if (text.length > 2) {
        // They described it: let the extractor pick the trade, and use the text as experience too.
        await absorbExperience(text, null);
      } else {
        say("pickNumber");
      }
      break;
    }
    case "experience": {
      if (text.length < 3) {
        say("experience");
        break;
      }
      await absorbExperience(text, worker?.trade ?? null);
      break;
    }
    case "confirm": {
      const c = parseChoices(text.split(/\s+/)[0] ?? "", 2)[0];
      if (c === 1 || (YES.includes(word) && c !== 2)) {
        await commitSelfReportedCards();
        go("zip");
        say("zip");
      } else {
        const correction = text.replace(/^\s*(2|no|dos|two)\b[\s,.:-]*/i, "").trim();
        if (correction.length > 2) await absorbExperience(`${String(session.answers.experienceText ?? "")}\nCorrection: ${correction}`, worker?.trade ?? null);
        else {
          go("fix");
          say("fix");
        }
      }
      break;
    }
    case "fix": {
      await absorbExperience(`${String(session.answers.experienceText ?? "")}\nCorrection: ${text}`, worker?.trade ?? null);
      break;
    }
    case "zip": {
      const z = text.match(/\b\d{5}\b/)?.[0];
      if (!z) {
        say("zipRetry");
        break;
      }
      await saveWorker({ zip: z });
      if (!zipToPoint(z)) say("zipUnknown");
      go("radius");
      say("radius");
      break;
    }
    case "radius": {
      const c = parseChoices(text, 4)[0];
      if (!c) {
        say("pickNumber");
        break;
      }
      await saveWorker({ radiusMiles: RADII[c - 1] });
      go("shifts");
      say("shifts");
      break;
    }
    case "shifts": {
      const cs = parseChoices(text, 4);
      if (!cs.length) {
        say("pickNumber");
        break;
      }
      await saveWorker({ shifts: cs.map((c) => SHIFTS[c - 1]) });
      if (inb.channel === "voice") {
        say("cardsVoice");
        await complete();
      } else {
        go("cards");
        say("cards");
      }
      break;
    }
    case "cards": {
      if (["done", "listo", "skip", "saltar", "no", "ya"].includes(word)) await complete();
      else say("cardWaiting");
      break;
    }
    case "done":
    default: {
      await menu();
    }
  }

  return finish();

  // ---------- helpers ----------

  async function finish(): Promise<EngineResult> {
    session.updatedAt = deps.now();
    session.workerId = worker?.id ?? session.workerId;
    await sessions.upsert(session);
    return { replies, session, workerId: session.workerId, done: session.step === "done" };
  }

  async function ensureWorker(p: string): Promise<Worker> {
    const existing = (await workers.list({ phone: p } as Partial<Worker>))[0];
    if (existing) return existing;
    const w: Worker = {
      id: deps.newId(), phone: p, name: "", lang: session.lang, zip: null, radiusMiles: 30, shifts: [], trade: null,
      yearsExperience: null, nccerLevel: 0, skills: [], summary: "", consentSms: true, onboardingComplete: false, createdAt: deps.now(),
    };
    await workers.upsert(w);
    session.workerId = w.id;
    return w;
  }

  async function absorbExperience(t: string, tradeHint: string | null) {
    const ex = await deps.extract(t, lang(), tradeHint);
    session.answers.experienceText = t;
    session.answers.extraction = ex;
    await saveWorker({
      trade: ex.trade ?? worker?.trade ?? null,
      yearsExperience: ex.yearsExperience ?? worker?.yearsExperience ?? null,
      nccerLevel: ex.nccerLevel ?? worker?.nccerLevel ?? 0,
      skills: ex.skills,
      summary: ex.summary,
    });
    go("confirm");
    say("confirm", { summary: summaryText(worker!, ex.credentials.map((c) => c.type), lang()) });
  }

  async function commitSelfReportedCards() {
    if (!worker) return;
    const ex = session.answers.extraction as ProfileExtraction | undefined;
    const have = await credentials.list({ workerId: worker.id } as Partial<Credential>);
    for (const c of ex?.credentials ?? []) {
      if (have.some((h) => h.type === c.type)) continue;
      await credentials.upsert({
        id: deps.newId(), workerId: worker.id, type: c.type, number: null, holderName: worker.name, issuedOn: null, expiresOn: c.expiresOn,
        photoPath: null, verification: "self", verifiedBy: null, verifiedMethod: null, extractionConfidence: ex?.confidence ?? null,
        needsReview: false, createdAt: deps.now(),
      });
    }
  }

  async function complete() {
    await saveWorker({ onboardingComplete: true });
    go("done");
    say("done", { name: worker?.name ? ", " + worker.name.split(" ")[0] : "", url: `${deps.appUrl}/me` });
  }

  async function menu() {
    if (!worker) {
      go("lang");
      replies.push(msg("en", "lang"));
      return;
    }
    const c = parseChoices(text, 3)[0];
    if (c === 1) {
      const jobs = await store.table("jobs").list({ status: "open" } as never);
      const creds = await credentials.list({ workerId: worker.id } as Partial<Credential>);
      const fits = jobs
        .map((j) => ({ j, r: evaluateMatch(worker!, creds, j, deps.today) }))
        .filter((x) => x.r.eligible)
        .sort((a, b) => b.r.score - a.r.score)
        .slice(0, 3);
      if (!fits.length) say("noJobs");
      else {
        replies.push(
          [msg(lang(), "jobsHeader"), ...fits.map(({ j, r }) => `• ${j.title} — $${j.payMin}-${j.payMax}/hr${r.distanceMiles !== null ? `, ${Math.round(r.distanceMiles)} mi` : ""}`), msg(lang(), "jobsMore", { url: `${deps.appUrl}/me` })].join("\n"),
        );
      }
    } else if (c === 2) {
      const creds = await credentials.list({ workerId: worker.id } as Partial<Credential>);
      if (!creds.length) say("noCards");
      else {
        const es = lang() === "es";
        const lines = creds.map((cr) => {
          const st = credentialStatus(cr, deps.today);
          const tag = st === "expired" ? (es ? "VENCIDA" : "EXPIRED") : st === "expiring" ? (es ? "vence pronto" : "expires soon") : "";
          return `• ${credShort(cr.type)}${cr.expiresOn ? ` (${cr.expiresOn})` : ""}${tag ? " — " + tag : ""}`;
        });
        replies.push([msg(lang(), "cardsHeader"), ...lines].join("\n"));
      }
    } else if (c === 3) {
      say("training", { url: `${deps.appUrl}/training` });
    } else {
      say("menu");
    }
  }
}

function promptKey(step: Step): string {
  const map: Partial<Record<Step, string>> = { consent: "consent", phone: "phone", name: "name", sector: "pickNumber", trade: "pickNumber", experience: "experience", confirm: "fix", fix: "fix", zip: "zip", radius: "radius", shifts: "shifts" };
  return map[step] ?? "menu";
}
