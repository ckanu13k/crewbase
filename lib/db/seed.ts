// Demo seed. Every person, company and training program here is FICTIONAL sample data.
// Dates are relative to "today" so the demo always shows upcoming starts and expiring cards.

import type {
  Credential, Employer, Job, Match, OnboardingSession, OutboxMessage, Placement, Screening, TeamMember, TrainingProgram, Worker, AuditEntry, AppSetting, Task, EmployerUser, Provider,
  Assignment, Timesheet, PayRun, Payout, Rating, CrewMember, AssessmentAttempt, BenefitPlan, Interview, PayReport,
} from "../types";
import { computeWeek, earlyPayAmount, shiftHours, weekStart } from "../payroll";
import { ASSESSMENT_BY_ID } from "../assessments";

const DAY = 86_400_000;
const today = () => new Date(new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" }) + "T00:00:00Z");
const d = (days: number) => new Date(today().getTime() + days * DAY).toISOString().slice(0, 10);
const ts = (days = 0) => new Date(Date.now() + days * DAY).toISOString();

const index = <T extends { id: string }>(xs: T[]) => Object.fromEntries(xs.map((x) => [x.id, x]));

export function seedData() {
  const W = (o: Partial<Worker> & Pick<Worker, "id" | "name" | "trade">): Worker => ({
    // 555-0100…0199 is reserved for fiction, so these numbers can never reach a real person.
    phone: "+17135550" + String(100 + Number(o.id.replace(/\D/g, ""))),
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
    // --- Spread across the region so distance and travel radius matter ---
    W({ id: "w11", name: "Ana López", lang: "es", trade: "pipefitter", zip: "77449", radiusMiles: 20, shifts: ["day"], yearsExperience: 5, nccerLevel: 2,
      skills: ["pipe_isometrics", "carbon_steel_pipe", "flange_boltup", "hydrotest", "blueprint_reading"], summary: "Tubera de taller en Katy, 5 años." }),
    W({ id: "w12", name: "Brandon Mitchell", trade: "pipefitter", zip: "77581", radiusMiles: 35, shifts: ["day", "turnaround"], yearsExperience: 9, nccerLevel: 3,
      skills: ["pipe_isometrics", "carbon_steel_pipe", "stainless_pipe", "flange_boltup", "hydrotest", "pipe_supports", "turnaround"], summary: "Lead fitter, refinery turnarounds." }),
    W({ id: "w13", name: "Héctor Salinas", lang: "es", trade: "pipefitter", zip: "77571", radiusMiles: 25, shifts: ["turnaround", "day"], yearsExperience: 6, nccerLevel: 2,
      skills: ["pipe_isometrics", "carbon_steel_pipe", "flange_boltup", "hydrotest"], summary: "Tubero de paros de planta en La Porte." }),
    W({ id: "w14", name: "Terrence Hall", trade: "welder", zip: "77640", radiusMiles: 30, shifts: ["night", "turnaround"], yearsExperience: 9, nccerLevel: 3,
      skills: ["smaw", "gtaw", "pipe_6g", "weld_symbols", "stainless_pipe"], summary: "Combo pipe welder, Golden Triangle turnarounds.", payoutSpeed: "next_day", payrollStatus: "ready" }),
    W({ id: "w15", name: "Kendra Wallace", trade: "welder", zip: "77701", radiusMiles: 35, shifts: ["night", "turnaround"], yearsExperience: 7, nccerLevel: 2,
      skills: ["smaw", "gtaw", "fcaw", "pipe_6g", "weld_symbols"], summary: "Pipe welder, Beaumont.", payoutSpeed: "next_day", payrollStatus: "ready" }),
    W({ id: "w16", name: "Jamal Price", trade: "welder", zip: "77530", radiusMiles: 30, shifts: ["night", "day"], yearsExperience: 5, nccerLevel: 2,
      skills: ["smaw", "gtaw", "fcaw", "pipe_6g", "weld_symbols"], summary: "6G TIG/stick, Channelview." }),
    W({ id: "w17", name: "Sofía Reyes", lang: "es", trade: "scaffold", zip: "77506", radiusMiles: 20, shifts: ["day"], yearsExperience: 3, nccerLevel: 1,
      skills: ["frame_scaffold", "tube_clamp", "system_scaffold", "scaffold_tagging"], summary: "Andamiera en Pasadena." }),
    W({ id: "w18", name: "Pedro Castillo", lang: "es", trade: "scaffold", zip: "77547", radiusMiles: 25, shifts: ["day", "turnaround"], yearsExperience: 2, nccerLevel: 1,
      skills: ["frame_scaffold", "tube_clamp", "scaffold_tagging"], summary: "Andamiero, Galena Park." }),
    W({ id: "w19", name: "Andre Thomas", trade: "helper", zip: "77017", radiusMiles: 35, shifts: ["day", "night"], yearsExperience: 2,
      skills: ["material_handling", "power_tools", "forklift", "housekeeping", "trailer_loading"], summary: "Shop helper, forklift certified.", payoutSpeed: "weekly", payrollStatus: "ready" }),
    W({ id: "w20", name: "María Delgado", lang: "es", trade: "helper", zip: "77084", radiusMiles: 15, shifts: ["day"], yearsExperience: 1,
      skills: ["material_handling", "power_tools", "housekeeping"], summary: "Ayudante en el oeste de Houston." }),
    W({ id: "w21", name: "Ryan Cooper", trade: "electrician", zip: "77301", radiusMiles: 30, shifts: ["day"], yearsExperience: 6, nccerLevel: 3,
      skills: ["conduit_bending", "wire_pulling", "motor_controls", "electrical_troubleshooting", "cable_tray"], summary: "Journeyman, industrial, Conroe." }),
    W({ id: "w22", name: "Daniel Okafor", trade: "electrician", zip: "77373", radiusMiles: 25, shifts: ["day"], yearsExperience: 2, nccerLevel: 1,
      skills: ["conduit_bending", "wire_pulling"], summary: "Apprentice electrician, Spring." }),
    W({ id: "w23", name: "Lupe Navarro", lang: "es", trade: "helper", zip: "77449", radiusMiles: 10, shifts: ["day", "night"], yearsExperience: 0,
      skills: ["material_handling", "housekeeping", "power_tools"], summary: "Nueva en la construcción; quiere trabajo en Katy." }),
    W({ id: "w25", name: "Marco Ruiz", lang: "es", trade: "electrician", zip: "77338", radiusMiles: 50, shifts: ["day"], yearsExperience: 8, nccerLevel: 3,
      skills: ["conduit_bending", "wire_pulling", "motor_controls", "electrical_troubleshooting", "cable_tray"], summary: "Electricista journeyman, Humble; viaja por toda el área." }),
    // --- Construction, warehouse and residential ---
    W({ id: "w26", name: "Darnell Wright", trade: "forklift_operator", zip: "77494", radiusMiles: 20, shifts: ["night", "day"], yearsExperience: 4,
      skills: ["forklift", "reach_truck", "trailer_loading", "shipping_receiving", "order_picking", "pallet_jack"], summary: "Forklift and reach-truck operator, Katy distribution centers.",
      payoutSpeed: "instant", payrollStatus: "ready" }),
    W({ id: "w27", name: "Yesenia Flores", lang: "es", trade: "warehouse_associate", zip: "77449", radiusMiles: 15, shifts: ["day", "night"], yearsExperience: 2,
      skills: ["order_picking", "packing", "pallet_jack", "material_handling", "shipping_receiving"], summary: "Almacenista, surtido con escáner y empaque." }),
    W({ id: "w28", name: "Brian Kowalski", trade: "carpenter", zip: "77433", radiusMiles: 30, shifts: ["day"], yearsExperience: 6,
      skills: ["framing", "layout", "formwork", "finish_carpentry", "power_tools", "fall_protection"], summary: "Framing carpenter, production homes in Cypress and Katy." }),
    W({ id: "w29", name: "Guadalupe Sánchez", lang: "es", trade: "painter", zip: "77478", radiusMiles: 25, shifts: ["day"], yearsExperience: 5,
      skills: ["surface_prep", "brush_roll", "spray_painting", "drywall_finishing", "make_ready", "customer_homes"], summary: "Pintora residencial y de apartamentos, 5 años." }),
    W({ id: "w30", name: "Michael Okoye", trade: "maintenance_tech", zip: "77477", radiusMiles: 20, shifts: ["day"], yearsExperience: 4,
      skills: ["make_ready", "appliance_repair", "minor_plumbing", "minor_electrical", "fixture_install", "customer_homes"], summary: "Apartment maintenance tech; make-readies, appliances, small HVAC." }),
    W({ id: "w31", name: "Juan Morales", lang: "es", trade: "concrete", zip: "77095", radiusMiles: 30, shifts: ["day"], yearsExperience: 7,
      skills: ["concrete_finishing", "rebar", "formwork", "layout"], summary: "Acabador de concreto, losas y banquetas." }),
    W({ id: "w32", name: "Keisha Dunn", trade: "picker_packer", zip: "77494", radiusMiles: 15, shifts: ["day", "night"], yearsExperience: 1,
      skills: ["order_picking", "packing", "pallet_jack"], summary: "Picker/packer, peak season at e-commerce warehouses." }),
    W({ id: "w33", name: "Alicia Moore", trade: "driver", zip: "77064", radiusMiles: 40, shifts: ["day"], yearsExperience: 8,
      skills: ["tractor_trailer", "pre_trip", "trailer_loading"], summary: "CDL-A driver, regional and local delivery." }),
    W({ id: "w24", name: "Chris Tran", trade: "hvac", zip: "77477", radiusMiles: 20, shifts: ["day"], yearsExperience: 4, nccerLevel: 2,
      skills: ["refrigerant_handling", "rooftop_units", "electrical_troubleshooting", "brazing"], summary: "Commercial HVAC tech, Stafford." }),
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
    C("w11", "osha10"), C("w11", "twic", { expiresOn: d(800) }),
    C("w12", "osha30"), C("w12", "twic", { expiresOn: d(1000) }), C("w12", "basic_plus", { expiresOn: d(200) }), C("w12", "h2s", { expiresOn: d(100) }),
    C("w13", "osha10"), C("w13", "twic", { expiresOn: d(600) }), C("w13", "basic_plus", { expiresOn: d(-20), verification: "document", verifiedBy: null }),
    C("w14", "osha10"), C("w14", "twic", { expiresOn: d(900) }), C("w14", "weld_test", { issuedOn: d(-80), expiresOn: d(100) }),
    C("w14", "basic_plus", { expiresOn: d(150) }), C("w14", "h2s", { expiresOn: d(200) }),
    C("w15", "osha10"), C("w15", "twic", { expiresOn: d(500) }), C("w15", "weld_test", { issuedOn: d(-120), expiresOn: d(60) }), C("w15", "basic_plus", { expiresOn: d(90) }),
    C("w16", "osha10"), C("w16", "twic", { expiresOn: d(700) }), C("w16", "weld_test", { issuedOn: d(-30), expiresOn: d(150) }),
    C("w17", "nccer_scaffold"), C("w17", "osha10"), C("w17", "basic_plus", { expiresOn: d(120) }),
    C("w18", "nccer_scaffold"), C("w18", "osha10", { verification: "self", verifiedBy: null }), C("w18", "basic_plus", { expiresOn: d(60) }),
    C("w19", "osha10"), C("w19", "forklift_cert", { expiresOn: d(500) }),
    C("w20", "osha10", { verification: "self", verifiedBy: null }),
    C("w21", "tdlr_journeyman_electrician", { expiresOn: d(300) }), C("w21", "osha10"),
    C("w22", "tdlr_apprentice_electrician", { expiresOn: d(200) }), C("w22", "osha10"),
    C("w25", "tdlr_journeyman_electrician", { expiresOn: d(330) }), C("w25", "osha30"), C("w25", "twic", { expiresOn: d(900) }),
    C("w24", "epa608"), C("w24", "tdlr_acr", { expiresOn: d(250) }),
    C("w26", "forklift_cert", { issuedOn: d(-400), expiresOn: d(695), verifiedMethod: "Called the employer that signed the evaluation" }), C("w26", "osha10_gi"),
    C("w27", "osha10_gi", { verification: "document", verifiedBy: null }),
    C("w28", "osha10"), C("w28", "cpr_first_aid", { expiresOn: d(300) }),
    C("w29", "epa_rrp", { expiresOn: d(900), verifiedMethod: "Called the training provider" }), C("w29", "osha10", { verification: "self", verifiedBy: null }),
    C("w30", "epa608"), C("w30", "osha10"),
    C("w31", "osha10"),
    C("w32", "forklift_cert", { expiresOn: d(20), verification: "document", verifiedBy: null }),
    C("w33", "cdl_a", { expiresOn: d(1500), verifiedMethod: "License inspected" }), C("w33", "dot_medical", { expiresOn: d(200) }),
  ];

  const employers: Employer[] = [
    { id: "e1", recruiterId: "tm2", name: "Example Industrial Services (demo)", contactName: "Pat Moreno", email: "pat@example.com", phone: "+17135550151", zip: "77536", createdAt: ts(-60) },
    { id: "e2", recruiterId: "tm2", name: "Sample Mechanical Co. (demo)", contactName: "Dana Lee", email: "dana@example.com", phone: "+17135550152", zip: "77017", createdAt: ts(-50) },
    { id: "e3", recruiterId: "tm3", name: "Demo Scaffold & Access (demo)", contactName: "Ray Ortiz", email: "ray@example.com", phone: "+17135550153", zip: "77506", createdAt: ts(-45) },
    { id: "e4", recruiterId: "tm3", name: "Westside Fabrication (demo)", contactName: "Kim Alvarez", email: "kim@example.com", phone: "+17135550154", zip: "77449", createdAt: ts(-30) },
    { id: "e5", recruiterId: "tm2", name: "Golden Triangle Turnarounds (demo)", contactName: "Lee Broussard", email: "lee@example.com", phone: "+14095550155", zip: "77640", createdAt: ts(-25) },
    { id: "e6", recruiterId: "tm3", name: "Northside Electrical (demo)", contactName: "Sam Patel", email: "sam@example.com", phone: "+19365550156", zip: "77301", sector: "construction", createdAt: ts(-20) },
    { id: "e7", recruiterId: "tm2", name: "Bayou Distribution Center (demo)", contactName: "Toni Greer", email: "toni@example.com", phone: "+12815550157", zip: "77494", sector: "warehouse", createdAt: ts(-30) },
    { id: "e8", recruiterId: "tm3", name: "Cypress Creek Homebuilders (demo)", contactName: "Greg Holt", email: "greg@example.com", phone: "+12815550158", zip: "77433", sector: "construction", createdAt: ts(-18) },
    { id: "e9", recruiterId: "tm3", name: "Fort Bend Home Services (demo)", contactName: "Nia Brooks", email: "nia@example.com", phone: "+12815550159", zip: "77478", sector: "residential", createdAt: ts(-12) },
  ];
  for (const e of employers) e.sector ??= "industrial";

  const J = (o: Partial<Job> & Pick<Job, "id" | "employerId" | "title" | "trade">): Job => ({
    requiredCredentials: [], preferredCredentials: [], requiredSkills: [], minNccerLevel: 0, minYears: 0, payMin: 20, payMax: 25,
    shift: "day", zip: "77002", startDate: d(14), headcount: 1, placementFee: 3000, status: "open", description: "", createdAt: ts(-5), ...o,
  });

  const jobs: Job[] = [
    J({ id: "j1", employerId: "e1", title: "Turnaround pipefitter", trade: "pipefitter", requiredCredentials: ["osha10", "twic", "basic_plus"], preferredCredentials: ["h2s"],
      requiredSkills: ["pipe_isometrics", "carbon_steel_pipe", "flange_boltup", "hydrotest"], minNccerLevel: 2, minYears: 4, payMin: 30, payMax: 36, shift: "turnaround",
      zip: "77536", startDate: d(21), headcount: 4, placementFee: 0, requiresBackground: true, requiresDrug: true,
      hireType: "temp", perDiem: 75, endDate: d(49), workOrder: "WO-DP-2026-118",
      description: "Spring turnaround at a Deer Park unit. 6x12s, about four weeks. $75/day per diem. Background check and drug screen before day one." }),
    J({ id: "j2", employerId: "e1", title: "Combo pipe welder (TIG/stick, 6G)", trade: "welder", requiredCredentials: ["osha10", "twic", "weld_test"], preferredCredentials: ["aws_welder"],
      requiredSkills: ["gtaw", "smaw", "pipe_6g", "weld_symbols"], minNccerLevel: 2, minYears: 5, payMin: 34, payMax: 40, shift: "night", zip: "77536", startDate: d(30),
      headcount: 2, placementFee: 5000, requiresDrug: true, description: "Carbon and chrome pipe. Must pass site weld test and a drug screen." }),
    J({ id: "j3", employerId: "e3", title: "Scaffold builder", trade: "scaffold", requiredCredentials: ["nccer_scaffold", "osha10", "basic_plus"], requiredSkills: ["frame_scaffold", "tube_clamp", "scaffold_tagging"],
      minNccerLevel: 1, minYears: 2, payMin: 24, payMax: 28, zip: "77506", startDate: d(14), headcount: 6, placementFee: 3000, requiresDrug: true,
      description: "Maintenance scaffolding, Pasadena plants. Drug screen before day one." }),
    J({ id: "j4", employerId: "e2", title: "Industrial electrician (journeyman)", trade: "electrician", requiredCredentials: ["tdlr_journeyman_electrician", "osha10"], preferredCredentials: ["twic"],
      requiredSkills: ["conduit_bending", "wire_pulling", "motor_controls", "electrical_troubleshooting"], minNccerLevel: 2, minYears: 4, payMin: 33, payMax: 38, zip: "77017",
      startDate: d(28), headcount: 1, placementFee: 5000, description: "New construction, chemical plant expansion." }),
    J({ id: "j5", employerId: "e2", title: "General helper — fab shop", trade: "helper", requiredCredentials: ["osha10"], requiredSkills: ["material_handling", "power_tools"],
      payMin: 17, payMax: 19, zip: "77017", startDate: d(7), headcount: 3, placementFee: 2500, description: "Shop helper; path to fitter helper." }),
    J({ id: "j6", employerId: "e1", title: "Rigger / signal person", trade: "rigger", requiredCredentials: ["nccer_rigger", "nccer_signal", "osha10"], requiredSkills: ["load_calcs", "hand_signals"],
      minNccerLevel: 1, minYears: 3, payMin: 30, payMax: 34, shift: "day", zip: "77536", startDate: d(-35), headcount: 1, placementFee: 4000, status: "filled", createdAt: ts(-50) }),
    J({ id: "j7", employerId: "e4", title: "Fab shop helper", trade: "helper", requiredCredentials: ["osha10"], preferredCredentials: ["forklift_cert"], requiredSkills: ["material_handling", "power_tools"],
      payMin: 17, payMax: 20, zip: "77449", startDate: d(10), headcount: 2, placementFee: 2500, description: "Katy fab shop. Forklift a plus." }),
    J({ id: "j8", employerId: "e4", title: "Shop pipefitter", trade: "pipefitter", requiredCredentials: ["osha10"], requiredSkills: ["pipe_isometrics", "carbon_steel_pipe"],
      minNccerLevel: 1, minYears: 3, payMin: 26, payMax: 31, zip: "77449", startDate: d(17), headcount: 2, placementFee: 3500, description: "Spool fabrication from isos. No TWIC needed." }),
    J({ id: "j9", employerId: "e5", title: "Turnaround combo welder", trade: "welder", requiredCredentials: ["osha10", "twic", "basic_plus", "weld_test", "h2s"],
      requiredSkills: ["smaw", "gtaw", "pipe_6g"], minNccerLevel: 2, minYears: 4, payMin: 38, payMax: 42, shift: "turnaround", zip: "77640", startDate: d(24), headcount: 3,
      placementFee: 0, requiresBackground: true, requiresDrug: true, hireType: "temp", perDiem: 85, endDate: d(45), workOrder: "PA-TA-0412",
      description: "Port Arthur refinery turnaround, 7x12s, three weeks. $85/day per diem. Background check and drug screen required." }),
    J({ id: "j10", employerId: "e6", title: "Industrial electrician", trade: "electrician", requiredCredentials: ["tdlr_journeyman_electrician", "osha10"],
      requiredSkills: ["conduit_bending", "wire_pulling", "motor_controls"], minNccerLevel: 2, minYears: 3, payMin: 32, payMax: 37, zip: "77301", startDate: d(21), headcount: 2,
      placementFee: 4500, description: "Conroe plant expansion." }),
    J({ id: "j11", employerId: "e2", title: "Commercial HVAC service tech", trade: "hvac", requiredCredentials: ["epa608", "tdlr_acr"],
      requiredSkills: ["refrigerant_handling", "rooftop_units", "electrical_troubleshooting"], minYears: 2, payMin: 27, payMax: 32, zip: "77036", startDate: d(14), headcount: 1,
      placementFee: 3500, description: "Rooftop units and service calls, southwest Houston." }),
    // --- Warehouse, construction and residential ---
    J({ id: "j12", employerId: "e7", sector: "warehouse", hireType: "temp", title: "Forklift operator — nights", trade: "forklift_operator", requiredCredentials: ["forklift_cert"],
      requiredSkills: ["forklift", "trailer_loading"], payMin: 19, payMax: 19, shift: "night", zip: "77494", startDate: d(-14), endDate: d(60), headcount: 4, placementFee: 0,
      workOrder: "BDC-PO-5531", description: "Unload and put away inbound trailers. 6pm–4:30am, Mon–Fri. Weekly pay or same-day pay.", createdAt: ts(-20) }),
    J({ id: "j13", employerId: "e7", sector: "warehouse", hireType: "temp", title: "Picker / packer — peak season", trade: "picker_packer",
      requiredSkills: ["order_picking", "packing"], payMin: 17, payMax: 17, shift: "day", zip: "77494", startDate: d(5), endDate: d(50), headcount: 10, placementFee: 0,
      workOrder: "BDC-PO-5540", description: "RF-scanner picking and packing through the holidays. Steel-toe shoes required." }),
    J({ id: "j14", employerId: "e8", sector: "construction", title: "Framing carpenter", trade: "carpenter", requiredCredentials: ["osha10"],
      requiredSkills: ["framing", "layout"], preferredCredentials: ["cpr_first_aid"], minYears: 3, payMin: 25, payMax: 30, zip: "77433", startDate: d(14), headcount: 2, placementFee: 4000,
      description: "Production homes in Bridgeland. Bring your own hand tools." }),
    J({ id: "j15", employerId: "e8", sector: "construction", hireType: "temp", title: "Construction laborer", trade: "helper", requiredCredentials: ["osha10"],
      requiredSkills: ["material_handling", "housekeeping"], payMin: 18, payMax: 18, zip: "77433", startDate: d(3), endDate: d(45), headcount: 4, placementFee: 0,
      workOrder: "CCH-2211", description: "Site cleanup, material moves and helping framers. 7am–3:30pm." }),
    J({ id: "j16", employerId: "e9", sector: "residential", title: "Apartment maintenance technician", trade: "maintenance_tech", preferredCredentials: ["epa608"],
      requiredSkills: ["make_ready", "minor_plumbing", "minor_electrical", "appliance_repair"], minYears: 2, payMin: 21, payMax: 25, zip: "77478", startDate: d(10), headcount: 1,
      placementFee: 3000, requiresBackground: true, description: "Sugar Land communities. On-call one weekend a month. Background check before day one (you'll be in residents' homes)." }),
    J({ id: "j17", employerId: "e9", sector: "residential", hireType: "temp", title: "Residential painter", trade: "painter", preferredCredentials: ["epa_rrp"],
      requiredSkills: ["surface_prep", "brush_roll"], minYears: 1, payMin: 20, payMax: 20, zip: "77478", startDate: d(7), endDate: d(35), headcount: 2, placementFee: 0,
      requiresBackground: true, workOrder: "FBHS-118", description: "Interior repaints and make-readies. Lead-safe (RRP) card preferred for pre-1978 homes." }),
    J({ id: "j18", employerId: "e5", sector: "industrial", hireType: "temp", title: "Fall turnaround welder", trade: "welder", requiredCredentials: ["osha10", "twic", "weld_test"],
      requiredSkills: ["smaw", "gtaw"], minYears: 3, payMin: 38, payMax: 38, shift: "turnaround", zip: "77640", startDate: d(-60), endDate: d(-30), headcount: 2, placementFee: 0,
      perDiem: 85, workOrder: "PA-TA-0388", status: "closed", description: "Completed turnaround.", createdAt: ts(-75) }),
  ];
  for (const j of jobs) {
    j.sector ??= j.employerId === "e6" ? "construction" : "industrial";
    j.hireType ??= "direct";
  }

  const matches: Match[] = [
    { id: "m1", jobId: "j3", workerId: "w3", stage: "interview", score: 88, notes: "Interview Tue 7am at the yard.", createdAt: ts(-3), updatedAt: ts(-1) },
    { id: "m2", jobId: "j2", workerId: "w2", stage: "shortlisted", score: 81, notes: "", createdAt: ts(-2), updatedAt: ts(-2) },
    { id: "m3", jobId: "j6", workerId: "w7", stage: "hired", score: 92, notes: "Started on time.", createdAt: ts(-45), updatedAt: ts(-36) },
    { id: "m4", jobId: "j9", workerId: "w14", stage: "interview", score: 100, notes: "Employer wants him for the turnaround.", createdAt: ts(-6), updatedAt: ts(-4) },
    { id: "m5", jobId: "j12", workerId: "w26", stage: "hired", score: 96, notes: "", createdAt: ts(-18), updatedAt: ts(-15) },
    { id: "m6", jobId: "j12", workerId: "w19", stage: "hired", score: 74, notes: "", createdAt: ts(-12), updatedAt: ts(-10) },
    { id: "m7", jobId: "j14", workerId: "w28", stage: "sent", score: 95, notes: "", createdAt: ts(-2), updatedAt: ts(-1) },
    { id: "m8", jobId: "j16", workerId: "w30", stage: "interview", score: 92, notes: "Employer offered interview times.", createdAt: ts(-3), updatedAt: ts(-1) },
    { id: "m9", jobId: "j18", workerId: "w15", stage: "hired", score: 90, notes: "", createdAt: ts(-70), updatedAt: ts(-62) },
    { id: "m10", jobId: "j18", workerId: "w14", stage: "hired", score: 94, notes: "", createdAt: ts(-70), updatedAt: ts(-62) },
  ];

  // Screenings: outcome and dates only (reports stay with the provider). Prices are estimates.
  const S = (o: Partial<Screening> & Pick<Screening, "id" | "workerId" | "employerId" | "jobId" | "kind" | "status">): Screening => ({
    matchId: null, provider: "manual", providerRef: null, consentUrl: null, consentAt: ts(-5), consentName: null, orderedAt: ts(-5),
    completedAt: null, expiresOn: null, reviewedNote: null, preAdverseAt: null, reportCopySent: false, finalAdverseAt: null,
    priceUsd: o.kind === "background" ? 65 : 75, invoiceId: null, createdAt: ts(-5), updatedAt: ts(-2), ...o,
  });
  const screenings: Screening[] = [
    S({ id: "s1", workerId: "w3", employerId: "e3", jobId: "j3", matchId: "m1", kind: "drug", status: "clear", consentName: "Rosa Martínez", completedAt: ts(-2), expiresOn: d(28) }),
    S({ id: "s2", workerId: "w14", employerId: "e5", jobId: "j9", matchId: "m4", kind: "background", status: "clear", consentName: "Terrence Hall", completedAt: ts(-2), expiresOn: d(363) }),
    S({ id: "s3", workerId: "w14", employerId: "e5", jobId: "j9", matchId: "m4", kind: "drug", status: "needs_review", consentName: "Terrence Hall", completedAt: ts(-1) }),
  ];

  const placements: Placement[] = [
    { id: "p1", matchId: "m3", jobId: "j6", workerId: "w7", employerId: "e1", startDate: d(-35), day30Date: d(-5), guaranteeEndsOn: d(55),
      fee: 4000, status: "active", invoiceId: null, invoiceUrl: null, createdAt: ts(-36) },
  ];

  const P = (o: Partial<TrainingProgram> & Pick<TrainingProgram, "id" | "provider" | "name">): TrainingProgram => ({
    trade: null, coversCredentials: [], coversSkills: [], nccerLevel: null, city: "Houston", zip: "77002", nextStart: null, weeks: null,
    clockHours: null, costUsd: null, funding: ["self"], languages: ["en"], url: null, sample: true, reviewedOn: d(-3), requirementNote: null, ...o,
  });

  // The 10 programs that unlock the most local openings. Providers are fictional; requirement notes
  // describe what Gulf Coast employers commonly ask for and are edited by staff when that changes.
  const training_programs: TrainingProgram[] = [
    P({ id: "t1", providerId: "pr1", provider: "Ship Channel Safety Council (demo)", name: "OSHA 10-Hour Construction", coversCredentials: ["osha10"], city: "Pasadena", zip: "77506",
      nextStart: d(5), weeks: 0.4, clockHours: 10, costUsd: 95, funding: ["self", "employer"], languages: ["en", "es"],
      requirementNote: "Required on day one by nearly every industrial and construction site. The DOL card does not expire, but some owners ask for a class within the last 5 years." }),
    P({ id: "t2", provider: "Bay Area Safety Training (demo)", name: "OSHA 30-Hour Construction", coversCredentials: ["osha30", "osha10"], city: "Pearland", zip: "77581",
      nextStart: d(12), weeks: 1, clockHours: 30, costUsd: 295, funding: ["self", "employer", "sdf"], languages: ["en", "es"],
      requirementNote: "Counts wherever OSHA 10 is required; often asked of leads and foremen." }),
    P({ id: "t3", provider: "Baytown Safety Council (demo)", name: "Basic Orientation Plus (ARSC)", coversCredentials: ["basic_plus"], city: "Baytown", zip: "77520",
      nextStart: d(3), weeks: 0.2, clockHours: 8, costUsd: 90, funding: ["self", "employer"], languages: ["en", "es"],
      requirementNote: "Plant owners along the Ship Channel ask for a current card; most treat it as good for 12 months. Check the expiry before a turnaround starts." }),
    P({ id: "t4", provider: "Deer Park Safety Training (demo)", name: "H2S Awareness", coversCredentials: ["h2s"], city: "Deer Park", zip: "77536",
      nextStart: d(3), weeks: 0.1, clockHours: 4, costUsd: 75, funding: ["self", "employer"], languages: ["en", "es"],
      requirementNote: "Required at refineries and sour-gas units; usually refreshed every year." }),
    P({ id: "t5", provider: "San Jacinto Craft College (demo)", name: "Pipefitting — NCCER Levels 1–2", trade: "pipefitter", nccerLevel: 2, city: "Pasadena", zip: "77506",
      coversSkills: ["pipe_isometrics", "carbon_steel_pipe", "hydrotest", "pipe_supports", "flange_boltup"], coversCredentials: ["nccer_core"],
      nextStart: d(40), weeks: 12, clockHours: 300, costUsd: 3200, funding: ["wioa", "workforce_pell", "self"], languages: ["en", "es"],
      requirementNote: "Turnaround contractors ask for NCCER Level 2 or 4+ years for fitter roles." }),
    P({ id: "t6", provider: "Channelview Welding Institute (demo)", name: "Pipe welding 6G prep (TIG/stick)", trade: "welder", city: "Channelview", zip: "77530",
      coversSkills: ["gtaw", "smaw", "pipe_6g", "weld_symbols"], coversCredentials: ["weld_test"],
      nextStart: d(25), weeks: 10, clockHours: 240, costUsd: 4500, funding: ["wioa", "workforce_pell", "sdf"], languages: ["en", "es"],
      requirementNote: "Most sites retest welders on arrival; papers older than 6 months usually need a continuity log or a new test." }),
    P({ id: "t7", provider: "La Porte Access Training (demo)", name: "Scaffold Builder (NCCER)", trade: "scaffold", city: "La Porte", zip: "77571",
      coversCredentials: ["nccer_scaffold"], coversSkills: ["frame_scaffold", "tube_clamp", "system_scaffold", "scaffold_tagging"],
      nextStart: d(10), weeks: 2, clockHours: 80, costUsd: 1200, funding: ["employer", "sdf"], languages: ["en", "es"],
      requirementNote: "Plant scaffold contractors require the NCCER builder card before you build or tag." }),
    P({ id: "t8", provider: "Baytown Lifting Academy (demo)", name: "Rigger & Signal Person certification prep", trade: "rigger", city: "Baytown", zip: "77520",
      coversCredentials: ["nccer_rigger", "nccer_signal"], coversSkills: ["load_calcs", "hand_signals", "sling_inspection"],
      nextStart: d(18), weeks: 1, clockHours: 40, costUsd: 950, funding: ["employer", "self"], languages: ["en", "es"],
      requirementNote: "OSHA 1926 Subpart CC requires qualified riggers and signal persons; most owners accept the NCCER cards (renew every 5 years)." }),
    P({ id: "t9", provider: "North Houston Electrical Training (demo)", name: "Electrical Level 1 + TDLR apprentice registration", trade: "electrician", nccerLevel: 1, city: "Spring", zip: "77373",
      coversSkills: ["conduit_bending", "wire_pulling", "motor_controls", "electrical_troubleshooting"], coversCredentials: ["tdlr_apprentice_electrician"],
      nextStart: d(30), weeks: 16, clockHours: 160, costUsd: 1800, funding: ["wioa", "apprenticeship", "self"], languages: ["en"],
      requirementNote: "Texas requires a TDLR license to do electrical work; journeyman jobs need 8,000 supervised hours plus the exam." }),
    P({ id: "t10", provider: "Katy Equipment Training (demo)", name: "Forklift & aerial lift (MEWP) operator", city: "Katy", zip: "77449",
      coversCredentials: ["forklift_cert", "mewp_cert"], coversSkills: ["forklift", "aerial_lift"],
      nextStart: d(6), weeks: 0.2, clockHours: 8, costUsd: 175, funding: ["self", "employer"], languages: ["en", "es"],
      requirementNote: "OSHA requires an operator evaluation at least every 3 years; fab shops and warehouses ask for it up front." }),
    // Construction, warehouse and residential
    P({ id: "t11", provider: "West Houston Safety Training (demo)", name: "OSHA 10-Hour General Industry", coversCredentials: ["osha10_gi"], city: "Katy", zip: "77494",
      nextStart: d(4), weeks: 0.4, clockHours: 10, costUsd: 85, funding: ["self", "employer"], languages: ["en", "es"],
      requirementNote: "Warehouses and distribution centers along I-10 and the Grand Parkway ask for the general-industry card; construction sites want the construction card instead." }),
    P({ id: "t12", provider: "Northwest Construction Academy (demo)", name: "Carpentry — NCCER Level 1 (framing)", trade: "carpenter", nccerLevel: 1, city: "Cypress", zip: "77433",
      coversSkills: ["framing", "layout", "formwork", "fall_protection"], coversCredentials: ["nccer_core"],
      nextStart: d(21), weeks: 8, clockHours: 160, costUsd: 1900, funding: ["wioa", "workforce_pell", "self"], languages: ["en", "es"],
      requirementNote: "Homebuilders and framing subs hire helpers with Core and promote to carpenter after Level 1 or 2+ years." }),
    P({ id: "t13", provider: "Fort Bend Renovation Training (demo)", name: "EPA Lead-Safe Renovator (RRP) initial", coversCredentials: ["epa_rrp"], city: "Sugar Land", zip: "77478",
      nextStart: d(9), weeks: 0.2, clockHours: 8, costUsd: 250, funding: ["self", "employer"], languages: ["en", "es"],
      requirementNote: "Required for paint, drywall or window work that disturbs paint in homes built before 1978." }),
    P({ id: "t14", provider: "Gulf Coast Truck Driving School (demo)", name: "CDL Class A training", trade: "driver", coversCredentials: ["cdl_a"], coversSkills: ["pre_trip", "tractor_trailer"], city: "Houston", zip: "77064",
      nextStart: d(14), weeks: 4, clockHours: 160, costUsd: 4800, funding: ["wioa", "self", "employer"], languages: ["en", "es"],
      requirementNote: "FMCSA entry-level driver training from a registered provider is required before the CDL skills test; you also need a current DOT medical card." }),
    P({ id: "t15", provider: "Ship Channel Safety Council (demo)", providerId: "pr1", name: "Flagger certification", coversCredentials: ["flagger"], coversSkills: ["flagging"], city: "Pasadena", zip: "77506",
      nextStart: d(7), weeks: 0.1, clockHours: 4, costUsd: 65, funding: ["self", "employer"], languages: ["en", "es"],
      requirementNote: "Road and site contractors need certified flaggers for lane closures; most cards are good for about 4 years." }),
  ];

  // ---------------- Temp crews ----------------
  const dow = (today().getUTCDay() + 6) % 7; // Monday = 0
  const lastMon = -dow - 7;
  const thisMon = -dow;
  const A = (o: Partial<Assignment> & Pick<Assignment, "id" | "jobId" | "workerId" | "employerId" | "payRate" | "billRate">): Assignment => ({
    matchId: null, startDate: d(-14), endDate: null, perDiem: 0, workOrder: null, status: "active", endedReason: null, createdAt: ts(-15), ...o,
  });
  const assignments: Assignment[] = [
    A({ id: "as1", jobId: "j12", workerId: "w26", employerId: "e7", matchId: "m5", startDate: d(lastMon - 7), endDate: d(60), payRate: 19, billRate: 27.55, workOrder: "BDC-PO-5531" }),
    A({ id: "as2", jobId: "j12", workerId: "w19", employerId: "e7", matchId: "m6", startDate: d(lastMon + 2), endDate: d(60), payRate: 19, billRate: 27.55, workOrder: "BDC-PO-5531" }),
    A({ id: "as3", jobId: "j18", workerId: "w15", employerId: "e5", matchId: "m9", startDate: d(-60), endDate: d(-30), payRate: 38, billRate: 55.1, perDiem: 85, workOrder: "PA-TA-0388", status: "ended", endedReason: "Turnaround finished", createdAt: ts(-62) }),
    A({ id: "as4", jobId: "j18", workerId: "w14", employerId: "e5", matchId: "m10", startDate: d(-60), endDate: d(-30), payRate: 38, billRate: 55.1, perDiem: 85, workOrder: "PA-TA-0388", status: "ended", endedReason: "Turnaround finished", createdAt: ts(-62) }),
  ];
  let tn = 0;
  const TS = (a: Assignment, day: number, o: Partial<Timesheet> = {}): Timesheet => {
    const clockIn = o.clockIn !== undefined ? o.clockIn : a.jobId === "j12" ? "18:00" : "06:00";
    const clockOut = o.clockOut !== undefined ? o.clockOut : a.jobId === "j12" ? "04:30" : "18:30";
    const attendance = o.attendance ?? "worked";
    const hours = attendance === "no_show" || attendance === "called_off" ? 0 : shiftHours(clockIn, clockOut, 30);
    return {
      id: `ts${++tn}`, assignmentId: a.id, workerId: a.workerId, employerId: a.employerId, jobId: a.jobId, date: d(day), clockIn: attendance === "no_show" ? null : clockIn,
      clockOut: attendance === "no_show" ? null : clockOut, breakMinutes: 30, attendance, perDiem: a.perDiem > 0 && hours > 0, status: "approved", note: "",
      approvedBy: a.employerId === "e7" ? "toni@example.com" : "lee@example.com", approvedAt: ts(day + 1), payRunId: null, payoutId: null, createdAt: ts(day), updatedAt: ts(day + 1), ...o, hours: o.hours ?? hours,
    };
  };
  const [as1, as2, as3, as4] = assignments;
  const timesheets: Timesheet[] = [
    ...[0, 1, 2, 3, 4].map((i) => TS(as1, lastMon + i)),
    TS(as2, lastMon + 2), TS(as2, lastMon + 3, { attendance: "late", clockIn: "18:40", note: "Arrived 40 minutes late (traffic on I-10)." }), TS(as2, lastMon + 4, { attendance: "no_show", note: "No call, no show." }),
    // The latest shifts are waiting for the employer to approve: this week so far, or the weekend just past on a Monday.
    ...(dow >= 1
      ? Array.from({ length: dow }, (_, i) => TS(as1, thisMon + i, { status: "submitted", approvedBy: null, approvedAt: null }))
      : [5, 6].map((i) => TS(as1, lastMon + i, { status: "submitted", approvedBy: null, approvedAt: null }))),
    TS(as2, dow >= 1 ? thisMon : lastMon + 5, { status: "submitted", approvedBy: null, approvedAt: null }),
  ];
  // The finished turnaround: one 6x12 week, already paid.
  const taMon = Number(((Date.parse(weekStart(d(-50)) + "T00:00:00Z") - today().getTime()) / DAY).toFixed(0));
  const taSheets = [as3, as4].flatMap((a) => [0, 1, 2, 3, 4, 5].map((i) => TS(a, taMon + i, { clockIn: "06:00", clockOut: "18:30", payRunId: "pr0" })));
  timesheets.push(...taSheets);
  const taWeek = computeWeek(taSheets, assignments);
  const pay_runs: PayRun[] = [{
    id: "pr0", periodStart: d(taMon), periodEnd: d(taMon + 6), status: "paid", lines: taWeek.lines,
    invoices: taWeek.invoices.map((i) => ({ ...i, invoiceId: "demo_tmp_pr0" })), timesheetIds: taSheets.map((t) => t.id),
    createdBy: "founder (demo)", createdAt: ts(taMon + 8), approvedAt: ts(taMon + 8), paidAt: ts(taMon + 10),
  }];
  // Darnell takes instant pay: each approved shift from last week was paid within minutes.
  const payouts: Payout[] = timesheets.filter((t) => t.workerId === "w26" && t.status === "approved" && !t.payRunId).map((t, i) => ({
    id: `po${i + 1}`, workerId: "w26", timesheetId: t.id, amount: earlyPayAmount(t, as1), speed: "instant", status: "sent", providerRef: `demo_pay_${i + 1}`, createdAt: t.approvedAt!, sentAt: t.approvedAt!,
  }));
  for (const p of payouts) timesheets.find((t) => t.id === p.timesheetId)!.payoutId = p.id;

  const ratings: Rating[] = [
    { id: "r1", workerId: "w15", employerId: "e5", jobId: "j18", assignmentId: "as3", placementId: null, quality: 5, safety: 5, rehire: true, comment: "Clean X-rays, first in the gate every day.", by: "lee@example.com", createdAt: ts(-29) },
    { id: "r2", workerId: "w14", employerId: "e5", jobId: "j18", assignmentId: "as4", placementId: null, quality: 4, safety: 5, rehire: true, comment: "Solid. Want him back for spring.", by: "lee@example.com", createdAt: ts(-29) },
    { id: "r3", workerId: "w7", employerId: "e1", jobId: "j6", assignmentId: null, placementId: "p1", quality: 5, safety: 5, rehire: true, comment: "", by: "pat@example.com", createdAt: ts(-6) },
  ];
  const CR = (id: string, employerId: string, workerId: string, note = ""): CrewMember => ({ id, employerId, workerId, note, addedBy: "demo", createdAt: ts(-20) });
  const crew_roster = [CR("cr1", "e5", "w14", "Combo welder, 6G"), CR("cr2", "e5", "w15", "Pipe welder"), CR("cr3", "e1", "w7", "Rigger"), CR("cr4", "e7", "w26", "Night-shift lead")];

  const firstIds = (id: string) => ASSESSMENT_BY_ID[id].questions.slice(0, 8).map((q) => q.id);
  const AA = (o: Partial<AssessmentAttempt> & Pick<AssessmentAttempt, "id" | "workerId" | "assessmentId" | "kind" | "score">): AssessmentAttempt => ({
    questionIds: o.kind === "knowledge" ? firstIds(o.assessmentId) : [], answers: null, startedAt: ts(-10), completedAt: ts(-10), passed: (o.score ?? 0) >= 70, proctored: o.kind === "hands_on",
    assessor: null, note: null, ...o,
  });
  const assessment_attempts: AssessmentAttempt[] = [
    AA({ id: "aa1", workerId: "w26", assessmentId: "forklift-warehouse", kind: "knowledge", score: 88 }),
    AA({ id: "aa2", workerId: "w26", assessmentId: "forklift-warehouse", kind: "hands_on", score: 100, assessor: "maria@example.com", note: "Pre-shift check, stacked 3 high, reversed through the course cleanly." }),
    AA({ id: "aa3", workerId: "w2", assessmentId: "jobsite-safety", kind: "knowledge", score: 75 }),
    AA({ id: "aa4", workerId: "w28", assessmentId: "carpentry-fundamentals", kind: "knowledge", score: 88 }),
  ];

  const BP = (o: Partial<BenefitPlan> & Pick<BenefitPlan, "id" | "kind" | "name">): BenefitPlan => ({ carrier: "Sample carrier (demo)", status: "active", eligibility: "", workerCost: "$0", url: null, createdAt: ts(-60), ...o });
  const benefit_plans: BenefitPlan[] = [
    BP({ id: "bp1", kind: "workers_comp", name: "Workers' compensation", eligibility: "Every temp assignment, from your first hour. Report any injury the same day.", workerCost: "$0" }),
    BP({ id: "bp2", kind: "health", name: "Health plan (minimum essential coverage)", eligibility: "Offered once you average 30+ hours a week (130 a month) on assignment.", workerCost: "About $25/week (demo figure)" }),
    BP({ id: "bp3", kind: "paid_time_off", name: "Paid time off", eligibility: "1 hour earned for every 30 hours worked; usable after 90 days.", workerCost: "$0" }),
    BP({ id: "bp4", kind: "dental_vision", name: "Dental and vision", status: "planned", eligibility: "Coming in 2027.", workerCost: "TBD" }),
  ];

  const IV = (o: Partial<Interview> & Pick<Interview, "id" | "matchId" | "jobId" | "workerId" | "employerId" | "slots">): Interview => ({
    chosenSlot: null, mode: "in_person", location: "", status: "proposed", createdBy: "demo", createdAt: ts(-1), updatedAt: ts(-1), ...o,
  });
  const interviews: Interview[] = [
    IV({ id: "i1", matchId: "m1", jobId: "j3", workerId: "w3", employerId: "e3", slots: [`${d(2)}T07:00`], chosenSlot: `${d(2)}T07:00`, status: "booked", location: "Demo Scaffold yard, Pasadena" }),
    IV({ id: "i2", matchId: "m8", jobId: "j16", workerId: "w30", employerId: "e9", slots: [`${d(2)}T10:00`, `${d(3)}T14:00`], location: "Leasing office, Sugar Land" }),
  ];

  const PR = (id: string, trade: string, zip: string, hourly: number): PayReport => ({ id, workerId: null, trade, zip, hourly, createdAt: ts(-20) });
  const pay_reports: PayReport[] = [
    PR("pp1", "welder", "77530", 36), PR("pp2", "welder", "77640", 40), PR("pp3", "pipefitter", "77506", 33), PR("pp4", "pipefitter", "77571", 31),
    PR("pp5", "forklift_operator", "77494", 18.5), PR("pp6", "forklift_operator", "77449", 19.5), PR("pp7", "forklift_operator", "77084", 18),
    PR("pp8", "picker_packer", "77494", 16), PR("pp9", "picker_packer", "77449", 16.5), PR("pp10", "carpenter", "77433", 27), PR("pp11", "painter", "77478", 21),
    PR("pp12", "helper", "77017", 18), PR("pp13", "helper", "77433", 17.5), PR("pp14", "electrician", "77301", 35),
  ];

  return {
    assignments: index(assignments),
    timesheets: index(timesheets),
    pay_runs: index(pay_runs),
    payouts: index(payouts),
    ratings: index(ratings),
    crew_roster: index(crew_roster),
    assessment_attempts: index(assessment_attempts),
    benefit_plans: index(benefit_plans),
    interviews: index(interviews),
    pay_reports: index(pay_reports),
    workers: index(workers),
    credentials: index(credentials),
    employers: index(employers),
    jobs: index(jobs),
    matches: index(matches),
    placements: index(placements),
    training_programs: index(training_programs),
    screenings: index(screenings),
    employer_users: index([
      { id: "eu1", employerId: "e1", email: "sam@example.com", name: "Sam Ruiz (demo hiring manager)", role: "hiring_manager", createdAt: ts(-20) },
    ] satisfies EmployerUser[]),
    providers: index([
      { id: "pr1", name: "Ship Channel Safety Council (demo)", contactEmail: "classes@example.com", website: null, createdAt: ts(-40) },
    ] satisfies Provider[]),
    tasks: index([
      { id: "tk1", ownerId: "tm2", title: "Call Example Industrial about turnaround headcount", dueOn: d(1), link: "/recruiter/jobs/j1", done: false, createdAt: ts(-1) },
      { id: "tk2", ownerId: "tm2", title: "Ask Héctor to renew Basic Plus (Baytown class on Monday)", dueOn: d(2), link: "/recruiter/workers/w13", done: false, createdAt: ts(-1) },
    ] satisfies Task[]),
    audit_log: index([
      { id: "a1", at: ts(-2), actorRole: "recruiter", actor: "maria@example.com", action: "screening.result", entityType: "screening", entityId: "s1", summary: "Drug screen recorded clear for Rosa Martínez (Scaffold builder)" },
      { id: "a2", at: ts(-1), actorRole: "recruiter", actor: "maria@example.com", action: "screening.result", entityType: "screening", entityId: "s3", summary: "Drug screen flagged for review for Terrence Hall (Turnaround combo welder)" },
    ] satisfies AuditEntry[]),
    app_settings: {} as Record<string, AppSetting>,
    team_members: index([
      { id: "tm2", email: "maria@example.com", name: "María López (demo recruiter)", role: "recruiter", createdAt: ts(-60) },
      { id: "tm3", email: "james@example.com", name: "James Carter (demo recruiter)", role: "recruiter", createdAt: ts(-30) },
    ] satisfies TeamMember[]),
    onboarding_sessions: {} as Record<string, OnboardingSession>,
    outbox: {} as Record<string, OutboxMessage>,
  };
}
