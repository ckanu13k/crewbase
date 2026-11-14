import "server-only";
import { CREDENTIALS, defaultExpiry } from "../taxonomy";
import { jsonCall, nullable } from "./claude";

export interface CardReading {
  type: string | null;
  holderName: string | null;
  number: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  expiryInferred: boolean; // true = computed from issue date + typical validity, not printed on the card
  confidence: number;
  notes: string;
  source: "ai" | "none";
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["type", "holderName", "number", "issuedOn", "expiresOn", "confidence", "notes"],
  properties: {
    type: nullable({ type: "string", enum: CREDENTIALS.map((c) => c.id) }),
    holderName: nullable({ type: "string" }),
    number: nullable({ type: "string", description: "Card, certificate or license number exactly as printed" }),
    issuedOn: nullable({ type: "string", description: "YYYY-MM-DD, only if printed" }),
    expiresOn: nullable({ type: "string", description: "YYYY-MM-DD, only if printed" }),
    confidence: { type: "number", description: "0-1. Lower it for blur, glare, cropping, or a card type you're unsure of." },
    notes: { type: "string", description: "Anything a human reviewer should check, e.g. 'expiry partly covered by glare'." },
  },
};

const SYSTEM = `You read photos of US construction and industrial safety cards, certifications and licenses
(OSHA 10/30, NCCER, TWIC, TDLR licenses, AWS, safety council cards, CPR, forklift, etc.).
Transcribe only what is printed. Never invent a number or a date. If a field isn't visible, return null.
Dates must be YYYY-MM-DD. If the card type is not one of the allowed values, return null for type.`;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function readCardPhoto(bytes: Uint8Array, mediaType: string): Promise<CardReading> {
  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
  const mt = (allowed as readonly string[]).includes(mediaType) ? (mediaType as (typeof allowed)[number]) : null;
  const empty: CardReading = { type: null, holderName: null, number: null, issuedOn: null, expiresOn: null, expiryInferred: false, confidence: 0, notes: "", source: "none" };
  if (!mt) return { ...empty, notes: `Unsupported image type ${mediaType}` };

  const r = await jsonCall<Omit<CardReading, "source" | "expiryInferred">>({
    system: SYSTEM,
    schema: SCHEMA,
    content: [
      { type: "image", source: { type: "base64", media_type: mt, data: Buffer.from(bytes).toString("base64") } },
      { type: "text", text: "Read this card." },
    ],
  });
  if (!r) return empty;

  const issuedOn = r.issuedOn && DATE.test(r.issuedOn) ? r.issuedOn : null;
  let expiresOn = r.expiresOn && DATE.test(r.expiresOn) ? r.expiresOn : null;
  let expiryInferred = false;
  if (!expiresOn && r.type) {
    expiresOn = defaultExpiry(r.type, issuedOn);
    expiryInferred = expiresOn !== null;
  }
  return { ...r, issuedOn, expiresOn, expiryInferred, confidence: Math.max(0, Math.min(1, r.confidence)), source: "ai" };
}
