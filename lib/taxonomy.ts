// Starter taxonomy for the Houston industrial / construction wedge.
//
// Trades map to O*NET-SOC codes so data can be joined to labor-market sources later.
// Skills are deliberately specific (what a foreman would ask), not O*NET's broad
// "knowledge" categories. The plan calls for 30-50 skills per trade; this is a seed
// list of the most-asked ones. Extend it here; ids are stable keys stored in the DB.
//
// Credential validity defaults are used ONLY to guess an expiry date when the card
// photo doesn't show one. Values marked `estimated: true` should be checked against
// the issuer before launch.

import type { Lang } from "./types";

type L = Record<Lang, string>;

export interface Trade {
  id: string;
  onet: string;
  onetVerify?: boolean; // true = SOC mapping is a best guess, confirm in O*NET
  label: L;
  keywords: string[]; // lowercase, EN + ES, used by the offline extractor
}

export interface Skill {
  id: string;
  trades: string[]; // [] = cross-trade
  label: L;
  keywords: string[];
}

export interface CredentialType {
  id: string;
  label: L;
  short: string;
  issuer: string;
  validityMonths: number | null; // null = card itself does not expire
  estimated?: boolean;
  note?: L;
  verifyHow: string; // shown to recruiters in the review queue
  keywords: string[];
}

export const TRADES: Trade[] = [
  { id: "pipefitter", onet: "47-2152.00", label: { en: "Pipefitter", es: "Tubero" }, keywords: ["pipefitter", "pipe fitter", "fitter", "tubero", "tubería", "tuberia", "pipe"] },
  { id: "welder", onet: "51-4121.00", label: { en: "Welder", es: "Soldador" }, keywords: ["welder", "welding", "soldador", "soldadura", "soldar"] },
  { id: "scaffold", onet: "47-4099.00", onetVerify: true, label: { en: "Scaffold builder", es: "Andamiero" }, keywords: ["scaffold", "scaffolding", "andamio", "andamios", "andamiero"] },
  { id: "rigger", onet: "49-9096.00", label: { en: "Rigger / signal person", es: "Aparejador / señalero" }, keywords: ["rigger", "rigging", "signal person", "signalman", "aparejador", "señalero", "senalero", "maniobras"] },
  { id: "millwright", onet: "49-9044.00", label: { en: "Millwright", es: "Millwright (mecánico industrial)" }, keywords: ["millwright", "mecánico industrial", "mecanico industrial", "alineación", "alignment"] },
  { id: "electrician", onet: "47-2111.00", label: { en: "Electrician", es: "Electricista" }, keywords: ["electrician", "electrical", "electricista", "eléctrico", "electrico"] },
  { id: "hvac", onet: "49-9021.00", label: { en: "HVAC technician", es: "Técnico de HVAC / aire acondicionado" }, keywords: ["hvac", "air conditioning", "a/c", "refrigeration", "aire acondicionado", "refrigeración", "refrigeracion"] },
  { id: "helper", onet: "47-2061.00", label: { en: "Helper / laborer", es: "Ayudante / obrero" }, keywords: ["helper", "laborer", "labor", "ayudante", "obrero", "peón", "peon"] },
];

export const SKILLS: Skill[] = [
  // Cross-trade
  { id: "blueprint_reading", trades: [], label: { en: "Blueprint reading", es: "Lectura de planos" }, keywords: ["blueprint", "blueprints", "drawings", "prints", "planos"] },
  { id: "forklift", trades: [], label: { en: "Forklift", es: "Montacargas" }, keywords: ["forklift", "montacargas", "fork lift"] },
  { id: "aerial_lift", trades: [], label: { en: "Aerial lift / man lift", es: "Plataforma elevadora" }, keywords: ["man lift", "manlift", "boom lift", "scissor lift", "aerial lift", "mewp", "plataforma", "tijera"] },
  { id: "confined_space", trades: [], label: { en: "Confined space work", es: "Espacios confinados" }, keywords: ["confined space", "espacio confinado", "espacios confinados"] },
  { id: "firewatch", trades: [], label: { en: "Fire watch / hole watch", es: "Vigía de fuego / hole watch" }, keywords: ["fire watch", "firewatch", "hole watch", "vigía", "vigia"] },
  { id: "power_tools", trades: [], label: { en: "Hand and power tools", es: "Herramientas manuales y eléctricas" }, keywords: ["power tools", "hand tools", "herramientas"] },
  { id: "turnaround", trades: [], label: { en: "Plant turnaround / shutdown work", es: "Paros de planta (turnarounds)" }, keywords: ["turnaround", "shutdown", "outage", "paro de planta", "paros"] },

  // Pipefitter
  { id: "pipe_isometrics", trades: ["pipefitter", "welder"], label: { en: "Read piping isometrics", es: "Leer isométricos de tubería" }, keywords: ["isometric", "isometrics", "iso", "isos", "isométrico", "isometrico", "isométricos", "isometricos"] },
  { id: "carbon_steel_pipe", trades: ["pipefitter"], label: { en: "Carbon steel pipe fit-up", es: "Armado de tubería de acero al carbón" }, keywords: ["carbon steel", "acero al carbón", "acero al carbon", "fit-up", "fit up"] },
  { id: "stainless_pipe", trades: ["pipefitter", "welder"], label: { en: "Stainless / alloy pipe", es: "Tubería de acero inoxidable / aleación" }, keywords: ["stainless", "alloy", "chrome", "inoxidable"] },
  { id: "flange_boltup", trades: ["pipefitter", "millwright"], label: { en: "Flange bolt-up and torque", es: "Apriete de bridas y torque" }, keywords: ["flange", "bolt up", "bolt-up", "torque", "bridas", "brida"] },
  { id: "hydrotest", trades: ["pipefitter"], label: { en: "Hydrotest / pressure testing", es: "Prueba hidrostática" }, keywords: ["hydrotest", "hydro test", "pressure test", "prueba hidrostática", "prueba hidrostatica"] },
  { id: "pipe_supports", trades: ["pipefitter"], label: { en: "Pipe supports and hangers", es: "Soportes de tubería" }, keywords: ["pipe support", "hanger", "hangers", "soportes"] },

  // Welder
  { id: "smaw", trades: ["welder"], label: { en: "SMAW (stick)", es: "SMAW (electrodo)" }, keywords: ["smaw", "stick", "7018", "6010", "electrodo"] },
  { id: "gtaw", trades: ["welder"], label: { en: "GTAW (TIG)", es: "GTAW (TIG)" }, keywords: ["gtaw", "tig", "heliarc"] },
  { id: "fcaw", trades: ["welder"], label: { en: "FCAW (flux core)", es: "FCAW (alambre tubular)" }, keywords: ["fcaw", "flux core", "flux-core", "dual shield", "alambre tubular"] },
  { id: "gmaw", trades: ["welder"], label: { en: "GMAW (MIG)", es: "GMAW (MIG)" }, keywords: ["gmaw", "mig"] },
  { id: "pipe_6g", trades: ["welder"], label: { en: "6G pipe position", es: "Posición 6G en tubería" }, keywords: ["6g", "6 g", "6-g"] },
  { id: "structural_welding", trades: ["welder"], label: { en: "Structural welding", es: "Soldadura estructural" }, keywords: ["structural", "estructural", "d1.1"] },
  { id: "torch_cutting", trades: ["welder", "pipefitter", "helper"], label: { en: "Torch cutting / air-arc", es: "Corte con soplete / arco-aire" }, keywords: ["torch", "oxy", "cutting torch", "air arc", "arc gouging", "soplete", "corte"] },
  { id: "weld_symbols", trades: ["welder", "pipefitter"], label: { en: "Read weld symbols", es: "Leer símbolos de soldadura" }, keywords: ["weld symbol", "weld symbols", "símbolos de soldadura", "simbolos de soldadura"] },

  // Scaffold
  { id: "frame_scaffold", trades: ["scaffold"], label: { en: "Frame scaffold", es: "Andamio de marco" }, keywords: ["frame scaffold", "andamio de marco"] },
  { id: "tube_clamp", trades: ["scaffold"], label: { en: "Tube and clamp scaffold", es: "Andamio de tubo y abrazadera" }, keywords: ["tube and clamp", "tube & clamp", "tubo y abrazadera"] },
  { id: "system_scaffold", trades: ["scaffold"], label: { en: "System scaffold", es: "Andamio de sistema" }, keywords: ["system scaffold", "systems scaffold", "andamio de sistema", "cuplock", "ringlock"] },
  { id: "scaffold_tagging", trades: ["scaffold"], label: { en: "Scaffold inspection and tagging", es: "Inspección y etiquetado de andamios" }, keywords: ["tagging", "scaffold tag", "etiquetado"] },

  // Rigger
  { id: "load_calcs", trades: ["rigger"], label: { en: "Load weight and rigging calculations", es: "Cálculo de cargas" }, keywords: ["load chart", "rigging calc", "load weight", "cálculo de carga", "calculo de carga"] },
  { id: "hand_signals", trades: ["rigger"], label: { en: "Crane hand signals", es: "Señales de mano para grúa" }, keywords: ["hand signals", "signals", "señales", "senales"] },
  { id: "sling_inspection", trades: ["rigger"], label: { en: "Sling and hardware inspection", es: "Inspección de eslingas" }, keywords: ["sling", "slings", "shackle", "eslinga", "eslingas", "grillete"] },
  { id: "chain_falls", trades: ["rigger", "millwright", "pipefitter"], label: { en: "Chain falls and come-alongs", es: "Polipastos y tirfors" }, keywords: ["chain fall", "chainfall", "come-along", "come along", "polipasto", "tirfor"] },

  // Millwright
  { id: "laser_alignment", trades: ["millwright"], label: { en: "Shaft / laser alignment", es: "Alineación de ejes / láser" }, keywords: ["alignment", "laser alignment", "alineación", "alineacion"] },
  { id: "pump_repair", trades: ["millwright"], label: { en: "Pump and seal repair", es: "Reparación de bombas y sellos" }, keywords: ["pump", "pumps", "mechanical seal", "bomba", "bombas", "sellos"] },
  { id: "bearings_gearbox", trades: ["millwright"], label: { en: "Bearings and gearboxes", es: "Rodamientos y cajas de engranes" }, keywords: ["bearing", "bearings", "gearbox", "rodamiento", "rodamientos", "baleros", "engranes"] },
  { id: "precision_measuring", trades: ["millwright"], label: { en: "Precision measuring (mics, dial indicators)", es: "Medición de precisión" }, keywords: ["micrometer", "dial indicator", "calipers", "micrómetro", "micrometro", "indicador de carátula"] },

  // Electrician
  { id: "conduit_bending", trades: ["electrician"], label: { en: "Conduit bending", es: "Doblado de tubo conduit" }, keywords: ["conduit", "bending", "rigid", "emt", "doblar tubo"] },
  { id: "wire_pulling", trades: ["electrician"], label: { en: "Wire pulling and terminations", es: "Jalado de cable y terminaciones" }, keywords: ["wire pull", "pulling wire", "terminations", "terminate", "jalar cable", "terminaciones"] },
  { id: "motor_controls", trades: ["electrician"], label: { en: "Motor controls / MCCs", es: "Control de motores / CCM" }, keywords: ["motor control", "mcc", "starter", "vfd", "control de motores"] },
  { id: "cable_tray", trades: ["electrician"], label: { en: "Cable tray", es: "Charola de cables" }, keywords: ["cable tray", "tray", "charola"] },
  { id: "electrical_troubleshooting", trades: ["electrician", "hvac"], label: { en: "Electrical troubleshooting", es: "Diagnóstico eléctrico" }, keywords: ["troubleshoot", "troubleshooting", "meter", "multimeter", "diagnóstico", "diagnostico"] },
  { id: "instrumentation", trades: ["electrician"], label: { en: "Instrumentation basics", es: "Instrumentación básica" }, keywords: ["instrument", "instrumentation", "tubing", "transmitter", "instrumentación", "instrumentacion"] },

  // HVAC
  { id: "refrigerant_handling", trades: ["hvac"], label: { en: "Refrigerant charging and recovery", es: "Carga y recuperación de refrigerante" }, keywords: ["refrigerant", "charging", "recovery", "freon", "refrigerante"] },
  { id: "brazing", trades: ["hvac", "pipefitter"], label: { en: "Brazing", es: "Soldadura fuerte (brazing)" }, keywords: ["brazing", "braze", "silfos"] },
  { id: "rooftop_units", trades: ["hvac"], label: { en: "Rooftop units (RTUs)", es: "Unidades de azotea (RTU)" }, keywords: ["rtu", "rooftop", "package unit", "azotea"] },
  { id: "chillers", trades: ["hvac"], label: { en: "Chillers", es: "Chillers" }, keywords: ["chiller", "chillers"] },
  { id: "ductwork", trades: ["hvac"], label: { en: "Ductwork", es: "Ductos" }, keywords: ["duct", "ductwork", "ductos"] },

  // Helper
  { id: "material_handling", trades: ["helper"], label: { en: "Material handling", es: "Manejo de materiales" }, keywords: ["material handling", "materials", "manejo de materiales", "cargar"] },
  { id: "housekeeping", trades: ["helper"], label: { en: "Site housekeeping", es: "Limpieza de obra" }, keywords: ["housekeeping", "cleanup", "clean up", "limpieza"] },
  { id: "flagging", trades: ["helper"], label: { en: "Flagging / traffic control", es: "Banderero / control de tráfico" }, keywords: ["flagger", "flagging", "banderero"] },
];

export const CREDENTIALS: CredentialType[] = [
  { id: "osha10", short: "OSHA 10", label: { en: "OSHA 10-Hour Construction", es: "OSHA 10 horas (construcción)" }, issuer: "OSHA-authorized trainer", validityMonths: null,
    note: { en: "Card doesn't expire, but many sites want it within 5 years.", es: "La tarjeta no vence, pero muchos sitios la piden de los últimos 5 años." },
    verifyHow: "Card shows trainer name and number; call the training provider to confirm.", keywords: ["osha 10", "osha10", "osha-10", "10 hour", "10 horas"] },
  { id: "osha30", short: "OSHA 30", label: { en: "OSHA 30-Hour Construction", es: "OSHA 30 horas (construcción)" }, issuer: "OSHA-authorized trainer", validityMonths: null,
    verifyHow: "Card shows trainer name and number; call the training provider to confirm.", keywords: ["osha 30", "osha30", "osha-30", "30 hour", "30 horas"] },
  { id: "nccer_core", short: "NCCER Core", label: { en: "NCCER Core Curriculum", es: "NCCER Core (currículo básico)" }, issuer: "NCCER", validityMonths: null,
    verifyHow: "NCCER Online Verification with the card number, or a BuilderFax wallet QR code.", keywords: ["nccer core", "core curriculum"] },
  { id: "nccer_scaffold", short: "NCCER Scaffold", label: { en: "NCCER Scaffold Builder", es: "NCCER Andamiero" }, issuer: "NCCER", validityMonths: null,
    verifyHow: "NCCER Online Verification with the card number, or a BuilderFax wallet QR code.", keywords: ["nccer scaffold", "scaffold builder", "scaffold cert"] },
  { id: "nccer_rigger", short: "NCCER Rigger", label: { en: "NCCER Rigger certification", es: "NCCER Aparejador (Rigger)" }, issuer: "NCCER", validityMonths: 60, estimated: true,
    verifyHow: "NCCER Online Verification with the card number, or a BuilderFax wallet QR code.", keywords: ["nccer rigger", "rigger cert", "rigger level", "qualified rigger"] },
  { id: "nccer_signal", short: "NCCER Signal", label: { en: "NCCER Signal Person certification", es: "NCCER Señalero" }, issuer: "NCCER", validityMonths: 60, estimated: true,
    verifyHow: "NCCER Online Verification with the card number, or a BuilderFax wallet QR code.", keywords: ["signal person", "signalperson", "nccer signal", "señalero certificado"] },
  { id: "aws_welder", short: "AWS CW", label: { en: "AWS Certified Welder", es: "Soldador certificado AWS" }, issuer: "American Welding Society", validityMonths: 6, estimated: true,
    note: { en: "Needs a continuity form every 6 months to stay active.", es: "Necesita formulario de continuidad cada 6 meses." },
    verifyHow: "Check the AWS certification record; confirm the continuity date.", keywords: ["aws", "certified welder", "aws cw", "d1.1 cert"] },
  { id: "weld_test", short: "Weld test", label: { en: "Weld test papers (site or shop)", es: "Prueba de soldadura (papeles)" }, issuer: "Employer / test lab", validityMonths: 6, estimated: true,
    verifyHow: "Call the lab or employer named on the papers; check process and position.", keywords: ["weld test", "test papers", "bend test", "x-ray", "prueba de soldadura"] },
  { id: "twic", short: "TWIC", label: { en: "TWIC card", es: "Tarjeta TWIC" }, issuer: "TSA", validityMonths: 60,
    verifyHow: "Inspect the card and its printed expiry; the site's card reader confirms status.", keywords: ["twic"] },
  { id: "basic_plus", short: "Basic Plus", label: { en: "Basic Orientation Plus (ARSC)", es: "Basic Orientation Plus (ARSC)" }, issuer: "Local safety council", validityMonths: 12, estimated: true,
    verifyHow: "Check the safety council's card lookup or the card's printed expiry.", keywords: ["basic plus", "basic orientation", "bop", "safety council"] },
  { id: "h2s", short: "H2S", label: { en: "H2S awareness", es: "Conciencia de H2S" }, issuer: "Training provider", validityMonths: 12, estimated: true,
    verifyHow: "Check the card's printed expiry; call the provider if unclear.", keywords: ["h2s", "hydrogen sulfide"] },
  { id: "tdlr_apprentice_electrician", short: "TX Appr. Elec.", label: { en: "Texas Apprentice Electrician (TDLR)", es: "Aprendiz de Electricista de Texas (TDLR)" }, issuer: "TDLR", validityMonths: 12, estimated: true,
    verifyHow: "TDLR license search by name or license number.", keywords: ["apprentice electrician", "aprendiz de electricista"] },
  { id: "tdlr_journeyman_electrician", short: "TX Journeyman", label: { en: "Texas Journeyman Electrician (TDLR)", es: "Electricista Journeyman de Texas (TDLR)" }, issuer: "TDLR", validityMonths: 12, estimated: true,
    verifyHow: "TDLR license search by name or license number.", keywords: ["journeyman", "journeyman electrician", "jman"] },
  { id: "tdlr_master_electrician", short: "TX Master Elec.", label: { en: "Texas Master Electrician (TDLR)", es: "Electricista Maestro de Texas (TDLR)" }, issuer: "TDLR", validityMonths: 12, estimated: true,
    verifyHow: "TDLR license search by name or license number.", keywords: ["master electrician", "electricista maestro"] },
  { id: "epa608", short: "EPA 608", label: { en: "EPA Section 608 certification", es: "Certificación EPA 608" }, issuer: "EPA-approved program", validityMonths: null,
    verifyHow: "Call the certifying organization on the card.", keywords: ["epa 608", "608", "epa universal", "universal cert"] },
  { id: "tdlr_acr", short: "TX ACR", label: { en: "Texas ACR technician (TDLR)", es: "Técnico ACR de Texas (TDLR)" }, issuer: "TDLR", validityMonths: 12, estimated: true,
    verifyHow: "TDLR license search by name or license number.", keywords: ["acr", "acr tech", "acr technician", "registered technician"] },
  { id: "forklift_cert", short: "Forklift", label: { en: "Forklift operator evaluation", es: "Evaluación de operador de montacargas" }, issuer: "Employer / trainer", validityMonths: 36,
    note: { en: "OSHA requires a re-evaluation at least every 3 years.", es: "OSHA exige reevaluación al menos cada 3 años." },
    verifyHow: "Call the employer or trainer that signed the evaluation.", keywords: ["forklift cert", "forklift card", "licencia de montacargas", "certificado de montacargas"] },
  { id: "mewp_cert", short: "MEWP", label: { en: "Aerial lift (MEWP) operator", es: "Operador de plataforma (MEWP)" }, issuer: "Trainer", validityMonths: 36, estimated: true,
    verifyHow: "Call the trainer on the card.", keywords: ["mewp", "aerial lift cert", "man lift cert", "jlg"] },
  { id: "cpr_first_aid", short: "CPR/FA", label: { en: "CPR / First Aid", es: "RCP / Primeros auxilios" }, issuer: "Red Cross, AHA or similar", validityMonths: 24,
    verifyHow: "Card has a certificate ID; check on the issuer's site.", keywords: ["cpr", "first aid", "primeros auxilios", "rcp"] },
  { id: "confined_space_cert", short: "Confined space", label: { en: "Confined space entrant / attendant", es: "Espacios confinados (entrante / vigía)" }, issuer: "Training provider", validityMonths: 12, estimated: true,
    verifyHow: "Check the card's printed expiry; call the provider if unclear.", keywords: ["confined space cert", "confined space card", "permit required"] },
];

const byId = <T extends { id: string }>(xs: T[]) => Object.fromEntries(xs.map((x) => [x.id, x])) as Record<string, T>;
export const TRADE_BY_ID = byId(TRADES);
export const SKILL_BY_ID = byId(SKILLS);
export const CREDENTIAL_BY_ID = byId(CREDENTIALS);

export const tradeLabel = (id: string | null | undefined, lang: Lang) => (id && TRADE_BY_ID[id]?.label[lang]) || id || "—";
export const skillLabel = (id: string, lang: Lang) => SKILL_BY_ID[id]?.label[lang] ?? id;
export const credLabel = (id: string, lang: Lang) => CREDENTIAL_BY_ID[id]?.label[lang] ?? id;
export const credShort = (id: string) => CREDENTIAL_BY_ID[id]?.short ?? id;

export const skillsForTrade = (trade: string | null) =>
  SKILLS.filter((s) => s.trades.length === 0 || (trade !== null && s.trades.includes(trade)));

/** Guess an expiry from the issue date when the card doesn't print one. */
export function defaultExpiry(typeId: string, issuedOn: string | null): string | null {
  const t = CREDENTIAL_BY_ID[typeId];
  if (!t || !issuedOn || t.validityMonths == null) return null;
  const d = new Date(issuedOn + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCMonth(d.getUTCMonth() + t.validityMonths);
  return d.toISOString().slice(0, 10);
}
