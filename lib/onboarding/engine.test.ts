import { describe, expect, it } from "vitest";
import { handleInbound, parseChoices, type EngineDeps } from "./engine";
import { rulesExtract } from "../ai/rules";
import type { Store, Table } from "../db";

function fakeStore(): Store {
  const data: Record<string, Record<string, { id: string }>> = {};
  const files: Record<string, Uint8Array> = {};
  return {
    kind: "memory",
    table(name) {
      const rows = (data[name] ??= {});
      const t: Table<{ id: string }> = {
        async list(where) {
          return Object.values(rows).filter((r) => Object.entries(where ?? {}).every(([k, v]) => (r as Record<string, unknown>)[k] === v));
        },
        async get(id) {
          return rows[id] ?? null;
        },
        async upsert(row) {
          rows[row.id] = structuredClone(row);
          return row;
        },
        async remove(id) {
          delete rows[id];
        },
      };
      return t as never;
    },
    async saveFile(p, b) {
      files[p] = b;
      return p;
    },
    async removeFile(p: string) {
      delete files[p];
    },
    async readFile() {
      return null;
    },
  };
}

let ids = 0;
function deps(store: Store, cardType: string | null = "twic"): EngineDeps {
  return {
    store,
    extract: async (text, _lang, hint) => rulesExtract(text, hint),
    readCard: async () => ({ type: cardType, holderName: "X", number: "123", issuedOn: null, expiresOn: "2029-01-01", expiryInferred: false, confidence: 0.95, notes: "", source: "ai" }),
    fetchMedia: async () => ({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" }),
    appUrl: "https://app.test",
    today: "2026-11-13",
    newId: () => `id${++ids}`,
    now: () => "2026-11-13T12:00:00Z",
  };
}

describe("parseChoices", () => {
  it("reads digits and number words in both languages", () => {
    expect(parseChoices("1 3", 4)).toEqual([1, 3]);
    expect(parseChoices("uno y cuatro", 4)).toEqual([1, 4]);
    expect(parseChoices("number two", 4)).toEqual([2]);
    expect(parseChoices("9", 4)).toEqual([]);
  });
});

describe("SMS onboarding", () => {
  it("takes a Spanish speaker from first text to a complete profile", async () => {
    const store = fakeStore();
    const d = deps(store);
    const phone = "+17135550199";
    const send = (text: string, media?: { url: string; contentType: string }[]) => handleInbound(d, { channel: "sms", address: phone, text, media });

    expect((await send("JOBS")).replies[0]).toContain("Reply 1 for English");
    expect((await send("2")).replies[0]).toContain("Responde SÍ");
    expect((await send("si")).replies[0]).toContain("¿Cómo te llamas?");
    expect((await send("Juan Pérez")).replies[0]).toContain("oficio principal");
    expect((await send("1")).replies[0]).toContain("experiencia");

    const confirm = await send("Tengo 7 años de tubero en refinerías, leo isométricos, hago prueba hidrostática. Tengo OSHA 10 y TWIC.");
    expect(confirm.replies[0]).toContain("Tubero, 7 años");
    expect(confirm.replies[0]).toMatch(/OSHA 10.*TWIC|TWIC.*OSHA 10/);

    expect((await send("1")).replies[0]).toContain("código postal");
    expect((await send("77506")).replies[0]).toContain("manejarías");
    expect((await send("2")).replies[0]).toContain("turnos");
    expect((await send("1 4")).replies[0]).toContain("fotos");

    const photo = await send("", [{ url: "https://media.test/1", contentType: "image/jpeg" }]);
    expect(photo.replies[0]).toContain("Tarjeta TWIC");

    const done = await send("listo");
    expect(done.done).toBe(true);
    expect(done.replies[0]).toContain("https://app.test/me");

    const worker = (await store.table("workers").list())[0];
    expect(worker).toMatchObject({ name: "Juan Pérez", lang: "es", trade: "pipefitter", yearsExperience: 7, zip: "77506", radiusMiles: 25, shifts: ["day", "turnaround"], onboardingComplete: true });
    expect(worker.skills).toEqual(expect.arrayContaining(["pipe_isometrics", "hydrotest"]));

    const creds = await store.table("credentials").list();
    const byType = Object.fromEntries(creds.map((c) => [c.type, c.verification]));
    // Self-reported from the text, but the TWIC photo upgrades nothing automatically: both rows exist,
    // the photo one at "document" level for a recruiter to verify.
    expect(byType.osha10).toBe("self");
    expect(creds.filter((c) => c.type === "twic").map((c) => c.verification).sort()).toEqual(["document", "self"]);

    // After signup, the menu answers.
    expect((await send("2")).replies[0]).toContain("Tus tarjetas");
  });

  it("honors STOP and START at any step", async () => {
    const store = fakeStore();
    const d = deps(store);
    const send = (text: string) => handleInbound(d, { channel: "sms", address: "+17135550111", text });
    await send("hi");
    await send("1");
    await send("yes");
    expect((await send("STOP")).replies[0]).toContain("unsubscribed");
    expect((await store.table("workers").list())[0].consentSms).toBe(false);
    await send("START");
    expect((await store.table("workers").list())[0].consentSms).toBe(true);
  });

  it("lets the worker correct the extracted profile", async () => {
    const store = fakeStore();
    const d = deps(store);
    const send = (text: string) => handleInbound(d, { channel: "sms", address: "+17135550122", text });
    for (const m of ["hi", "1", "yes", "Ann Lee", "2"]) await send(m);
    await send("Welder for 4 years, stick and tig");
    const fixed = await send("2 I also do 6G and have OSHA 30");
    expect(fixed.replies[0]).toContain("6G");
    expect(fixed.replies[0]).toContain("OSHA 30");
  });

  it("asks web users for their phone number", async () => {
    const store = fakeStore();
    const d = deps(store);
    const send = (text: string) => handleInbound(d, { channel: "web", address: "browser-1", text });
    await send("start");
    await send("1");
    expect((await send("yes")).replies[0]).toContain("cell number");
    expect((await send("12")).replies[0]).toContain("10-digit");
    expect((await send("(713) 555-0133")).replies[0]).toContain("name");
    expect((await store.table("workers").list())[0].phone).toBe("+17135550133");
  });
});

describe("rulesExtract", () => {
  it("prefers OSHA 30 wording without inventing other cards", () => {
    const r = rulesExtract("Electricista con 5 años, OSHA 30, doblado de conduit y MCC");
    expect(r.trade).toBe("electrician");
    expect(r.yearsExperience).toBe(5);
    expect(r.credentials.map((c) => c.type)).toEqual(["osha30"]);
    expect(r.skills).toEqual(expect.arrayContaining(["conduit_bending", "motor_controls"]));
  });
});
