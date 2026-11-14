// Demo seed. Every person, company and training program here is FICTIONAL sample data.
// Dates are relative to "today" so the demo always shows upcoming starts and expiring cards.

import type {
  Credential, Employer, Job, Match, OnboardingSession, OutboxMessage, Placement, TrainingProgram, Worker,
} from "../types";

const DAY = 86_400_000;
const today = () => new Date(new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" }) + "T00:00:00Z");
const d = (days: number) => new Date(today().getTime() + days * DAY).toISOString().slice(0, 10);
const ts = (days = 0) => new Date(Date.now() + days * DAY).toISOString();

const index = <T extends { id: string }>(xs: T[]) => Object.fromEntries(xs.map((x) => [x.id, x]));

export function seedData() {
  const W = (o: Partial<Worker> & Pick<Worker, "id" | "name" | "trade">): Worker => ({
    phone: "+1713555" + String(1000 + Number(o.id.replace(/\D/g, "")) * 7).slice(-4),
    lang: "en", zip: null, radiusMiles: 30, shifts: ["day"], yearsExperience: 0, nccerLevel: 0, skills: [],
    summary: "", consentSms: true, onboardingComplete: true, createdAt: ts(-40), ...o,
  });

  const workers: Worker[] = [
    W({ id: "w1", name: "Luis Hernández", lang: "es", trade: "pipefitter", zip: "77506", shifts: ["day", "turnaround"], yearsExperience: 8, nccerLevel: 3,
      skills: ["pipe_isometrics", "carbon_steel_pipe", "stainless_pipe", "flange_boltup", "hydrotest", "pipe_supports", "turnaround", "blueprint_reading"],
      summary: "Tubero con 8 años en refinerías del Ship Channel; paros de planta." }),
    W({ id: "w2", name: "Marcus Johnson", trade: "welder", zip: "77015", radiusMiles: 40, shifts: ["day", "night"], yearsExperience: 6, nccerLevel: 2,
      skills: ["smaw", "gtaw", "fcaw", "pipe_6g", "torch_cutting", "weld_symbols", "pipe_isometrics"], summary: "Pipe welder, TIG root / stick cap, 6G." }),
    W({ id: "w3", name: "Rosa Martínez", lang: "es", trade: "scaffold", zip: "77587", radiusMiles: 25, shifts: ["day", "turnaround"], yearsExperience: 4, nccerLevel: 1,
      skills: ["frame_scaffold", "tube_clamp", "system_scaffold", "scaffold_tagging", "aerial_lift"], summary: "Andamiera, 4 años, tubo y abrazadera y andamio de sistema." }),
    W({ id: "w4", name: "DeShawn Carter", trade: "electrician", zip: "77029", shifts: ["day"], yearsExperience: 5, nccerLevel: 2,
      skills: ["conduit_bending", "wire_pulling", "motor_controls", "cable_tray", "electrical_troubleshooting"], summary: "Journeyman, industrial new construction and MCC work." }),
    W({ id: "w5", name: "José Ramírez", lang: "es", trade: "helper", zip: "77072", radiusMiles: 20, shifts: ["day", "night", "rotating"], yearsExperience: 1, nccerLevel: 0,
      skills: ["material_handling", "housekeeping", "firewatch", "power_tools"], summary: "Ayudante general, 1 año. Quiere aprender soldadura." }),
    W({ id: "w6", name: "Tran Nguyen", trade: "millwright", zip: "77084", radiusMiles: 50, shifts: ["day", "rotating"], yearsExperience: 10, nccerLevel: 4,
      skills: ["laser_alignment", "pump_repair", "bearings_gearbox", "precision_measuring", "chain_falls", "flange_boltup"], summary: "Rotating equipment millwright, pumps and compressors." }),
    W({ id: "w7", name: "Carlos Gutiérrez", lang: "es", trade: "rigger", zip: "77530", shifts: ["turnaround", "day"], yearsExperience: 7, nccerLevel: 2,
      skills: ["load_calcs", "hand_signals", "sling_inspection", "chain_falls", "turnaround"], summary: "Aparejador y señalero, grúas de hasta 200 toneladas." }),
    W({ id: "w8", name: "Aaliyah Brooks", trade: "hvac", zip: "77036", radiusMiles: 25, shifts: ["day"], yearsExperience: 3, nccerLevel: 1,
      skills: ["refrigerant_handling", "brazing", "rooftop_units", "ductwork", "electrical_troubleshooting"], summary: "Commercial HVAC service tech." }),
    W({ id: "w9", name: "Miguel Torres", lang: "es", trade: "pipefitter", zip: "77449", radiusMiles: 15, shifts: ["day"], yearsExperience: 3, nccerLevel: 1,
      skills: ["pipe_isometrics", "carbon_steel_pipe", "blueprint_reading"], summary: "Tubero, 3 años en talleres de fabricación en Katy." }),
    W({ id: "w10", name: "Kevin Walsh", trade: "welder", zip: "77520", shifts: ["turnaround", "night"], yearsExperience: 12, nccerLevel: 4,
      skills: ["smaw", "gtaw", "pipe_6g", "stainless_pipe", "structural_welding", "weld_symbols"], summary: "Alloy pipe welder, 12 years, turnarounds." }),
  ];

  let n = 0;
  const C = (workerId: string, type: string, o: Partial<Credential> = {}): Credential => ({
    id: `c${++n}`, workerId, type, number: null, holderName: null, issuedOn: null, expiresOn: null, photoPath: null,
    verification: "verified", verifiedBy: o.verification && o.verification !== "verified" ? null : "Demo recruiter",
    verifiedMethod: null, extractionConfidence: null, needsReview: false, createdAt: ts(-30), ...o,
  });

  const credentials: Credential[] = [
    C("w1", "osha10", { verifiedMethod: "Called training provider" }),
    C("w1", "twic", { expiresOn: d(1100), verifiedMethod: "Card inspected" }),
    C("w1", "basic_plus", { expiresOn: d(28), verification: "document", verifiedBy: null }),
    C("w1", "h2s", { expiresOn: d(-10), verification: "self", verifiedBy: null }),
    C("w2", "osha10", { verification: "document", verifiedBy: null }),
    C("w2", "weld_test", { issuedOn: d(-60), expiresOn: d(120), verifiedMethod: "Called test lab" }),
    C("w2", "twic", { expiresOn: d(400) }),
    C("w3", "nccer_scaffold", { number: "NCCER-DEMO-3301", verifiedMethod: "NCCER online verification" }),
    C("w3", "osha10", { verification: "self", verifiedBy: null }),
    C("w3", "basic_plus", { expiresOn: d(180) }),
    C("w4", "tdlr_journeyman_electrician", { expiresOn: d(240), verifiedMethod: "TDLR license search" }),
    C("w4", "osha30"),
    C("w5", "osha10", { verification: "self", verifiedBy: null }),
    C("w6", "osha10"), C("w6", "twic", { expiresOn: d(900) }), C("w6", "h2s", { expiresOn: d(150), verification: "document", verifiedBy: null }),
    C("w7", "nccer_rigger", { expiresOn: d(700), verifiedMethod: "NCCER online verification" }),
    C("w7", "nccer_signal", { expiresOn: d(700), verifiedMethod: "NCCER online verification" }),
    C("w7", "osha10"), C("w7", "twic", { expiresOn: d(45) }),
    C("w8", "epa608"), C("w8", "tdlr_acr", { expiresOn: d(90), verification: "document", verifiedBy: null }),
    C("w9", "osha10", { verification: "document", verifiedBy: null, needsReview: true, extractionConfidence: 0.62 }),
    C("w10", "aws_welder", { expiresOn: d(60), verification: "self", verifiedBy: null }),
    C("w10", "twic", { expiresOn: d(1400) }), C("w10", "osha30"),
    C("w10", "basic_plus", { expiresOn: d(-5), verification: "document", verifiedBy: null }),
  ];

  const employers: Employer[] = [
    { id: "e1", name: "Example Industrial Services (demo)", contactName: "Pat Moreno", email: "pat@example.com", phone: "+17135550201", zip: "77536", createdAt: ts(-60) },
    { id: "e2", name: "Sample Mechanical Co. (demo)", contactName: "Dana Lee", email: "dana@example.com", phone: "+17135550202", zip: "77017", createdAt: ts(-50) },
    { id: "e3", name: "Demo Scaffold & Access (demo)", contactName: "Ray Ortiz", email: "ray@example.com", phone: "+17135550203", zip: "77506", createdAt: ts(-45) },
  ];

  const J = (o: Partial<Job> & Pick<Job, "id" | "employerId" | "title" | "trade">): Job => ({
    requiredCredentials: [], preferredCredentials: [], requiredSkills: [], minNccerLevel: 0, minYears: 0, payMin: 20, payMax: 25,
    shift: "day", zip: "77002", startDate: d(14), headcount: 1, placementFee: 3000, status: "open", description: "", createdAt: ts(-5), ...o,
  });

  const jobs: Job[] = [
    J({ id: "j1", employerId: "e1", title: "Turnaround pipefitter", trade: "pipefitter", requiredCredentials: ["osha10", "twic", "basic_plus"], preferredCredentials: ["h2s"],
      requiredSkills: ["pipe_isometrics", "carbon_steel_pipe", "flange_boltup", "hydrotest"], minNccerLevel: 2, minYears: 4, payMin: 30, payMax: 36, shift: "turnaround",
      zip: "77536", startDate: d(21), headcount: 4, placementFee: 4000, description: "Spring turnaround at a Deer Park unit. 6x12s. Per diem available." }),
    J({ id: "j2", employerId: "e1", title: "Combo pipe welder (TIG/stick, 6G)", trade: "welder", requiredCredentials: ["osha10", "twic", "weld_test"], preferredCredentials: ["aws_welder"],
      requiredSkills: ["gtaw", "smaw", "pipe_6g", "weld_symbols"], minNccerLevel: 2, minYears: 5, payMin: 34, payMax: 40, shift: "night", zip: "77536", startDate: d(30),
      headcount: 2, placementFee: 5000, description: "Carbon and chrome pipe. Must pass site weld test." }),
    J({ id: "j3", employerId: "e3", title: "Scaffold builder", trade: "scaffold", requiredCredentials: ["nccer_scaffold", "osha10", "basic_plus"], requiredSkills: ["frame_scaffold", "tube_clamp", "scaffold_tagging"],
      minNccerLevel: 1, minYears: 2, payMin: 24, payMax: 28, zip: "77506", startDate: d(14), headcount: 6, placementFee: 3000, description: "Maintenance scaffolding, Pasadena plants." }),
    J({ id: "j4", employerId: "e2", title: "Industrial electrician (journeyman)", trade: "electrician", requiredCredentials: ["tdlr_journeyman_electrician", "osha10"], preferredCredentials: ["twic"],
      requiredSkills: ["conduit_bending", "wire_pulling", "motor_controls", "electrical_troubleshooting"], minNccerLevel: 2, minYears: 4, payMin: 33, payMax: 38, zip: "77017",
      startDate: d(28), headcount: 2, placementFee: 5000, description: "New construction, chemical plant expansion." }),
    J({ id: "j5", employerId: "e2", title: "General helper — fab shop", trade: "helper", requiredCredentials: ["osha10"], requiredSkills: ["material_handling", "power_tools"],
      payMin: 17, payMax: 19, zip: "77017", startDate: d(7), headcount: 3, placementFee: 2500, description: "Shop helper; path to fitter helper." }),
    J({ id: "j6", employerId: "e1", title: "Rigger / signal person", trade: "rigger", requiredCredentials: ["nccer_rigger", "nccer_signal", "osha10"], requiredSkills: ["load_calcs", "hand_signals"],
      minNccerLevel: 1, minYears: 3, payMin: 30, payMax: 34, shift: "day", zip: "77536", startDate: d(-35), headcount: 1, placementFee: 4000, status: "filled", createdAt: ts(-50) }),
  ];

  const matches: Match[] = [
    { id: "m1", jobId: "j3", workerId: "w3", stage: "interview", score: 88, notes: "Interview Tue 7am at the yard.", createdAt: ts(-3), updatedAt: ts(-1) },
    { id: "m2", jobId: "j2", workerId: "w2", stage: "shortlisted", score: 81, notes: "", createdAt: ts(-2), updatedAt: ts(-2) },
    { id: "m3", jobId: "j6", workerId: "w7", stage: "hired", score: 92, notes: "Started on time.", createdAt: ts(-45), updatedAt: ts(-36) },
  ];

  const placements: Placement[] = [
    { id: "p1", matchId: "m3", jobId: "j6", workerId: "w7", employerId: "e1", startDate: d(-35), day30Date: d(-5), guaranteeEndsOn: d(55),
      fee: 4000, status: "active", invoiceId: null, invoiceUrl: null, createdAt: ts(-36) },
  ];

  const P = (o: Partial<TrainingProgram> & Pick<TrainingProgram, "id" | "provider" | "name">): TrainingProgram => ({
    trade: null, coversCredentials: [], coversSkills: [], nccerLevel: null, city: "Houston", zip: "77002", nextStart: null, weeks: null,
    clockHours: null, costUsd: null, funding: ["self"], languages: ["en"], url: null, sample: true, ...o,
  });

  const training_programs: TrainingProgram[] = [
    P({ id: "t1", provider: "Demo Safety Council", name: "OSHA 10-Hour Construction", coversCredentials: ["osha10"], zip: "77506", city: "Pasadena", nextStart: d(5), weeks: 0.4, clockHours: 10, costUsd: 95, funding: ["self", "employer"], languages: ["en", "es"] }),
    P({ id: "t2", provider: "Demo Safety Council", name: "OSHA 30-Hour Construction", coversCredentials: ["osha30", "osha10"], zip: "77506", city: "Pasadena", nextStart: d(12), weeks: 1, clockHours: 30, costUsd: 295, funding: ["self", "employer", "sdf"], languages: ["en", "es"] }),
    P({ id: "t3", provider: "Demo Safety Council", name: "Basic Orientation Plus", coversCredentials: ["basic_plus"], zip: "77506", city: "Pasadena", nextStart: d(3), weeks: 0.2, clockHours: 8, costUsd: 90, funding: ["self", "employer"], languages: ["en", "es"] }),
    P({ id: "t4", provider: "Demo Safety Council", name: "H2S Awareness", coversCredentials: ["h2s"], zip: "77506", city: "Pasadena", nextStart: d(3), weeks: 0.1, clockHours: 4, costUsd: 75, funding: ["self", "employer"], languages: ["en", "es"] }),
    P({ id: "t5", provider: "Sample Community College (demo)", name: "Pipefitting — NCCER Levels 1–2", trade: "pipefitter", nccerLevel: 2, coversSkills: ["pipe_isometrics", "carbon_steel_pipe", "hydrotest", "pipe_supports", "flange_boltup"], coversCredentials: ["nccer_core"],
      zip: "77002", nextStart: d(40), weeks: 12, clockHours: 300, costUsd: 3200, funding: ["wioa", "workforce_pell", "self"], languages: ["en", "es"] }),
    P({ id: "t6", provider: "Example Craft Training Center", name: "Pipe welding 6G prep (TIG/stick)", trade: "welder", coversSkills: ["gtaw", "smaw", "pipe_6g", "weld_symbols"], coversCredentials: ["weld_test"],
      zip: "77015", nextStart: d(25), weeks: 10, clockHours: 240, costUsd: 4500, funding: ["wioa", "workforce_pell", "sdf"], languages: ["en", "es"] }),
    P({ id: "t7", provider: "Example Craft Training Center", name: "Scaffold Builder (NCCER)", trade: "scaffold", coversCredentials: ["nccer_scaffold"], coversSkills: ["frame_scaffold", "tube_clamp", "system_scaffold", "scaffold_tagging"],
      zip: "77015", nextStart: d(10), weeks: 2, clockHours: 80, costUsd: 1200, funding: ["employer", "sdf"], languages: ["en", "es"] }),
    P({ id: "t8", provider: "Example Craft Training Center", name: "Rigger & Signal Person certification prep", trade: "rigger", coversCredentials: ["nccer_rigger", "nccer_signal"], coversSkills: ["load_calcs", "hand_signals", "sling_inspection"],
      zip: "77015", nextStart: d(18), weeks: 1, clockHours: 40, costUsd: 950, funding: ["employer", "self"], languages: ["en"] }),
    P({ id: "t9", provider: "Sample Electrical JATC (demo)", name: "Registered electrical apprenticeship", trade: "electrician", nccerLevel: 4, coversSkills: ["conduit_bending", "wire_pulling", "motor_controls", "electrical_troubleshooting"],
      coversCredentials: ["tdlr_apprentice_electrician"], zip: "77029", nextStart: d(60), weeks: 208, costUsd: 0, funding: ["apprenticeship"], languages: ["en"] }),
    P({ id: "t10", provider: "Sample Community College (demo)", name: "EPA 608 exam prep", trade: "hvac", coversCredentials: ["epa608"], coversSkills: ["refrigerant_handling"], nextStart: d(9), weeks: 0.2, clockHours: 8, costUsd: 150, funding: ["self"], languages: ["en", "es"] }),
    P({ id: "t11", provider: "Demo Safety Council", name: "Forklift operator training and evaluation", coversCredentials: ["forklift_cert"], coversSkills: ["forklift"], zip: "77506", city: "Pasadena", nextStart: d(6), weeks: 0.2, clockHours: 8, costUsd: 150, funding: ["self", "employer"], languages: ["en", "es"] }),
    P({ id: "t12", provider: "Sample Community College (demo)", name: "Blueprint and isometric reading for the trades", coversSkills: ["blueprint_reading", "pipe_isometrics", "weld_symbols"], nextStart: d(15), weeks: 6, clockHours: 36, costUsd: 400, funding: ["self", "employer"], languages: ["en", "es"] }),
    P({ id: "t13", provider: "TSA enrollment center", name: "TWIC card application (not training — book an enrollment appointment)", coversCredentials: ["twic"], nextStart: null, costUsd: null, funding: ["self", "employer"], languages: ["en", "es"], url: "https://www.tsa.gov/twic", sample: false }),
  ];

  return {
    workers: index(workers),
    credentials: index(credentials),
    employers: index(employers),
    jobs: index(jobs),
    matches: index(matches),
    placements: index(placements),
    training_programs: index(training_programs),
    onboarding_sessions: {} as Record<string, OnboardingSession>,
    outbox: {} as Record<string, OutboxMessage>,
  };
}
