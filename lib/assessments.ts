// Skills tests employers can rely on more than a practice quiz.
//
// How they differ from practice quizzes (lib/quizzes.ts):
// - Separate question banks, so practice answers can't be memorized for the test.
// - A random draw of QUESTIONS_PER_TEST from the bank, a time limit, no feedback during the test, and
//   grading on the server against the questions that were drawn.
// - One attempt per retake period (Admin → Settings).
// - Labeled honestly: an in-app test is unproctored. A hands-on check is recorded by a recruiter or
//   assessor who watched the worker do the task; that is the stronger signal.
// Facts cite OSHA (29 CFR 1910 / 1926), the NEC, ASME or standard trade practice.

import type { AssessmentAttempt, Lang } from "./types";

type L = Record<Lang, string>;
const o = (en: string, es: string): L => ({ en, es });

export interface TestQuestion {
  id: string;
  q: L;
  options: L[];
  answer: number;
}
export interface Assessment {
  id: string;
  title: L;
  trades: string[];
  handsOn: L; // what a hands-on check covers
  questions: TestQuestion[];
}

export const QUESTIONS_PER_TEST = 8;
export const TIME_LIMIT_MIN = 12;
const GRACE_SEC = 60;

export const ASSESSMENTS: Assessment[] = [
  {
    id: "jobsite-safety",
    title: o("Jobsite safety", "Seguridad en la obra"),
    trades: ["helper", "pipefitter", "welder", "scaffold", "rigger", "millwright", "electrician", "hvac", "carpenter", "concrete", "drywall", "painter", "roofer", "plumber", "equipment_operator", "landscaper"],
    handsOn: o("Inspects a harness and lanyard, sets up a ladder, identifies hazards on a walk-through.", "Inspecciona arnés y línea, coloca una escalera, identifica peligros en un recorrido."),
    questions: [
      { id: "js1", q: o("A personal fall arrest system must keep a free fall to no more than…", "Un sistema personal de detención de caídas debe limitar la caída libre a no más de…"), options: [o("2 feet", "2 pies"), o("4 feet", "4 pies"), o("6 feet", "6 pies"), o("10 feet", "10 pies")], answer: 2 },
      { id: "js2", q: o("An anchor for a personal fall arrest system must hold at least how much per worker attached (unless designed by a qualified person)?", "¿Cuánto debe aguantar como mínimo un anclaje por cada trabajador conectado (salvo diseño de una persona calificada)?"), options: [o("1,000 lb", "1,000 lb"), o("2,500 lb", "2,500 lb"), o("5,000 lb", "5,000 lb"), o("10,000 lb", "10,000 lb")], answer: 2 },
      { id: "js3", q: o("A cover over a floor hole must support at least…", "Una tapa sobre un hueco en el piso debe aguantar al menos…"), options: [o("The weight of one worker", "El peso de un trabajador"), o("Twice the weight of the workers, equipment and materials on it", "El doble del peso de trabajadores, equipo y materiales"), o("500 lb", "500 lb"), o("Whatever the plywood is rated for", "Lo que aguante el triplay")], answer: 1 },
      { id: "js4", q: o("Excavated dirt (spoil) must be kept at least how far from the edge of a trench?", "¿A qué distancia mínima del borde de una zanja debe quedar la tierra excavada?"), options: [o("6 inches", "6 pulgadas"), o("1 foot", "1 pie"), o("2 feet", "2 pies"), o("5 feet", "5 pies")], answer: 2 },
      { id: "js5", q: o("Which section of a Safety Data Sheet (SDS) gives first-aid measures?", "¿Qué sección de la Hoja de Datos de Seguridad (SDS) tiene los primeros auxilios?"), options: [o("Section 2", "Sección 2"), o("Section 4", "Sección 4"), o("Section 8", "Sección 8"), o("Section 11", "Sección 11")], answer: 1 },
      { id: "js6", q: o("On a construction site, what protects you from shock when using a temporary extension cord and power tool?", "En la obra, ¿qué te protege de una descarga al usar una extensión temporal y una herramienta eléctrica?"), options: [o("A GFCI (ground-fault circuit interrupter)", "Un GFCI (interruptor de falla a tierra)"), o("Rubber-soled boots alone", "Solo botas con suela de hule"), o("A longer cord", "Una extensión más larga"), o("Taping the plug", "Ponerle cinta a la clavija")], answer: 0 },
      { id: "js7", q: o("OSHA's construction noise limit for an 8-hour day is…", "El límite de ruido de OSHA en construcción para 8 horas es…"), options: [o("75 dBA", "75 dBA"), o("80 dBA", "80 dBA"), o("90 dBA", "90 dBA"), o("110 dBA", "110 dBA")], answer: 2 },
      { id: "js8", q: o("Without special precautions, how close may you bring a ladder or tool to an overhead power line of 50 kV or less?", "Sin precauciones especiales, ¿qué tan cerca puedes acercar una escalera o herramienta a una línea aérea de 50 kV o menos?"), options: [o("3 feet", "3 pies"), o("5 feet", "5 pies"), o("No closer than 10 feet", "No más cerca de 10 pies"), o("Any distance if it's fiberglass", "Cualquier distancia si es de fibra de vidrio")], answer: 2 },
      { id: "js9", q: o("Your hard hat has a crack in the shell. What do you do?", "Tu casco tiene una grieta. ¿Qué haces?"), options: [o("Tape it", "Le pones cinta"), o("Keep using it until the job ends", "Lo sigues usando hasta que acabe el trabajo"), o("Take it out of service and get a new one", "Lo sacas de uso y pides uno nuevo"), o("Wear it backwards", "Lo usas al revés")], answer: 2 },
      { id: "js10", q: o("When climbing a ladder, how many points of contact should you keep?", "Al subir una escalera, ¿cuántos puntos de apoyo debes mantener?"), options: [o("1", "1"), o("2", "2"), o("3", "3"), o("4", "4")], answer: 2 },
    ],
  },
  {
    id: "forklift-warehouse",
    title: o("Forklift and warehouse safety", "Montacargas y seguridad en almacén"),
    trades: ["forklift_operator", "warehouse_associate", "picker_packer", "mover", "helper", "driver"],
    handsOn: o("Pre-shift inspection, picks and stacks a pallet, drives a course in reverse, parks correctly.", "Inspección antes del turno, levanta y estiba una tarima, maneja en reversa, estaciona correctamente."),
    questions: [
      { id: "fw1", q: o("Who may operate a forklift at work?", "¿Quién puede operar un montacargas en el trabajo?"), options: [o("Anyone with a driver's license", "Cualquiera con licencia de manejo"), o("Only operators trained and evaluated by the employer", "Solo operadores capacitados y evaluados por el empleador"), o("Anyone supervised for a day", "Cualquiera supervisado por un día"), o("Only CDL holders", "Solo quienes tienen CDL")], answer: 1 },
      { id: "fw2", q: o("A forklift operator's performance must be re-evaluated at least every…", "El desempeño del operador de montacargas debe reevaluarse al menos cada…"), options: [o("6 months", "6 meses"), o("1 year", "1 año"), o("3 years", "3 años"), o("5 years", "5 años")], answer: 2 },
      { id: "fw3", q: o("The load blocks your view going forward. You should…", "La carga no te deja ver hacia adelante. Debes…"), options: [o("Drive forward slowly", "Avanzar despacio"), o("Raise the load to see under it", "Subir la carga para ver por debajo"), o("Drive in reverse", "Manejar en reversa"), o("Have someone ride on the forks", "Que alguien vaya en las uñas")], answer: 2 },
      { id: "fw4", q: o("Driving a loaded forklift up or down a steep ramp, the load should face…", "Al subir o bajar una rampa empinada con carga, la carga debe ir…"), options: [o("Downhill", "Hacia abajo"), o("Uphill", "Hacia arriba"), o("Either way", "Como sea"), o("Sideways", "De lado")], answer: 1 },
      { id: "fw5", q: o("Before leaving a forklift unattended you must…", "Antes de dejar un montacargas solo debes…"), options: [o("Leave the forks raised so no one trips", "Dejar las uñas arriba para que nadie tropiece"), o("Lower the forks, put controls in neutral, shut it off and set the brake", "Bajar las uñas, poner en neutral, apagar y poner el freno"), o("Just set the brake", "Solo poner el freno"), o("Leave it running if you'll be back soon", "Dejarlo prendido si regresas pronto")], answer: 1 },
      { id: "fw6", q: o("How often must a forklift be checked for defects?", "¿Cada cuándo se revisa un montacargas por fallas?"), options: [o("Once a month", "Una vez al mes"), o("Before it's used each day (each shift if used around the clock)", "Antes de usarlo cada día (cada turno si se usa todo el día)"), o("Once a year", "Una vez al año"), o("Only after an accident", "Solo después de un accidente")], answer: 1 },
      { id: "fw7", q: o("May a coworker ride on the forklift with you?", "¿Puede un compañero ir montado en el montacargas contigo?"), options: [o("Yes, on the forks", "Sí, en las uñas"), o("Yes, standing on the step", "Sí, parado en el escalón"), o("No, no riders", "No, nadie puede ir montado"), o("Only for short trips", "Solo en distancias cortas")], answer: 2 },
      { id: "fw8", q: o("Before driving into a trailer at a dock, you make sure…", "Antes de entrar a una caja de tráiler en el andén, te aseguras de que…"), options: [o("The trailer's brakes are set and the wheels are chocked or it's locked to the dock", "Los frenos del tráiler estén puestos y las llantas calzadas o esté asegurado al andén"), o("The dock light is on", "La luz del andén esté prendida"), o("The driver is in the cab", "El chofer esté en la cabina"), o("The trailer is empty", "El tráiler esté vacío")], answer: 0 },
      { id: "fw9", q: o("Traveling with a load, carry it…", "Al avanzar con carga, llévala…"), options: [o("Raised high for visibility", "Alta para ver mejor"), o("As low as practical, tilted back", "Lo más baja posible, inclinada hacia atrás"), o("Tilted forward", "Inclinada hacia adelante"), o("At shoulder height", "A la altura del hombro")], answer: 1 },
      { id: "fw10", q: o("A forklift stays stable as long as the combined center of gravity stays…", "Un montacargas es estable mientras el centro de gravedad combinado se mantenga…"), options: [o("Inside the stability triangle", "Dentro del triángulo de estabilidad"), o("Over the forks", "Sobre las uñas"), o("Behind the counterweight", "Detrás del contrapeso"), o("Above the mast", "Arriba del mástil")], answer: 0 },
    ],
  },
  {
    id: "electrical-fundamentals",
    title: o("Electrical fundamentals", "Fundamentos de electricidad"),
    trades: ["electrician", "hvac", "maintenance_tech"],
    handsOn: o("Verifies a circuit is dead (live-dead-live), wires a receptacle and a switch, bends a 90 and an offset.", "Comprueba que un circuito no tenga energía (vivo-muerto-vivo), conecta un contacto y un apagador, dobla un 90 y un desvío."),
    questions: [
      { id: "el1", q: o("A 120-volt circuit has 10 ohms of resistance. How much current flows?", "Un circuito de 120 V tiene 10 ohmios de resistencia. ¿Cuánta corriente pasa?"), options: [o("1.2 A", "1.2 A"), o("12 A", "12 A"), o("130 A", "130 A"), o("1,200 A", "1,200 A")], answer: 1 },
      { id: "el2", q: o("A 240-volt heater draws 20 amps. About how much power does it use?", "Un calentador de 240 V consume 20 A. ¿Cuánta potencia usa aproximadamente?"), options: [o("12 W", "12 W"), o("260 W", "260 W"), o("2,400 W", "2,400 W"), o("4,800 W", "4,800 W")], answer: 3 },
      { id: "el3", q: o("Which color may an equipment grounding conductor be?", "¿De qué color puede ser el conductor de puesta a tierra del equipo?"), options: [o("White", "Blanco"), o("Green, green with yellow stripes, or bare", "Verde, verde con franjas amarillas o desnudo"), o("Black", "Negro"), o("Red", "Rojo")], answer: 1 },
      { id: "el4", q: o("The grounded (neutral) conductor is identified by which color?", "El conductor puesto a tierra (neutro) se identifica con qué color?"), options: [o("White or gray", "Blanco o gris"), o("Green", "Verde"), o("Blue", "Azul"), o("Black", "Negro")], answer: 0 },
      { id: "el5", q: o("Copper 12 AWG building wire is normally protected by a breaker no larger than…", "El cable de cobre calibre 12 AWG normalmente se protege con un interruptor de no más de…"), options: [o("15 A", "15 A"), o("20 A", "20 A"), o("30 A", "30 A"), o("40 A", "40 A")], answer: 1 },
      { id: "el6", q: o("Copper 14 AWG building wire is normally protected by a breaker no larger than…", "El cable de cobre calibre 14 AWG normalmente se protege con un interruptor de no más de…"), options: [o("15 A", "15 A"), o("20 A", "20 A"), o("25 A", "25 A"), o("30 A", "30 A")], answer: 0 },
      { id: "el7", q: o("Before touching conductors you've locked out, you…", "Antes de tocar conductores que bloqueaste, tú…"), options: [o("Trust the lock", "Confías en el candado"), o("Test with a meter you've just checked on a known live source", "Pruebas con un medidor que acabas de comprobar en una fuente con energía"), o("Touch them quickly with the back of your hand", "Los tocas rápido con el dorso de la mano"), o("Ask a coworker", "Le preguntas a un compañero")], answer: 1 },
      { id: "el8", q: o("In a series circuit, what is the same through every component?", "En un circuito en serie, ¿qué es igual en todos los componentes?"), options: [o("Voltage", "Voltaje"), o("Current", "Corriente"), o("Resistance", "Resistencia"), o("Power", "Potencia")], answer: 1 },
      { id: "el9", q: o("In a parallel circuit, what is the same across every branch?", "En un circuito en paralelo, ¿qué es igual en todas las ramas?"), options: [o("Voltage", "Voltaje"), o("Current", "Corriente"), o("Resistance", "Resistencia"), o("Wire size", "Calibre del cable")], answer: 0 },
      { id: "el10", q: o("Bending a conduit offset with 30° bends, the distance between bends is the offset depth times…", "Para un desvío en tubo con dobleces de 30°, la distancia entre dobleces es la profundidad del desvío por…"), options: [o("1.414", "1.414"), o("2", "2"), o("2.6", "2.6"), o("6", "6")], answer: 1 },
    ],
  },
  {
    id: "pipe-math",
    title: o("Pipe math and layout", "Matemáticas y trazo de tubería"),
    trades: ["pipefitter", "plumber", "welder", "hvac"],
    handsOn: o("Cuts and fits a 45° offset to a drawing within 1/16\", reads an isometric, sets slope with a level.", "Corta y arma un desvío a 45° según plano con 1/16\" de tolerancia, lee un isométrico, da pendiente con nivel."),
    questions: [
      { id: "pm1", q: o("For a 45° offset, the travel equals the offset times…", "En un desvío a 45°, el recorrido es igual al desvío por…"), options: [o("1.155", "1.155"), o("1.414", "1.414"), o("2.000", "2.000"), o("0.707", "0.707")], answer: 1 },
      { id: "pm2", q: o("A 10-inch offset made with 45° fittings: about how long is the travel (center to center)?", "Un desvío de 10 pulgadas con codos de 45°: ¿cuánto mide el recorrido (centro a centro)?"), options: [o("7.07\"", "7.07\""), o("11.55\"", "11.55\""), o("14.14\"", "14.14\""), o("20\"", "20\"")], answer: 2 },
      { id: "pm3", q: o("For a 60° offset, the travel equals the offset times…", "En un desvío a 60°, el recorrido es igual al desvío por…"), options: [o("1.155", "1.155"), o("1.414", "1.414"), o("2.000", "2.000"), o("2.613", "2.613")], answer: 0 },
      { id: "pm4", q: o("A drain runs 20 feet at 1/4 inch per foot. How much does it drop?", "Un drenaje corre 20 pies con pendiente de 1/4 de pulgada por pie. ¿Cuánto baja?"), options: [o("2.5\"", "2.5\""), o("4\"", "4\""), o("5\"", "5\""), o("8\"", "8\"")], answer: 2 },
      { id: "pm5", q: o("Center-to-end of a 2\" long-radius 90° butt-weld elbow is…", "El centro a cara de un codo de 90° radio largo de 2\" para soldar a tope es…"), options: [o("2\"", "2\""), o("3\"", "3\""), o("4\"", "4\""), o("1-1/2\"", "1-1/2\"")], answer: 1 },
      { id: "pm6", q: o("Center-to-end of a 4\" short-radius 90° butt-weld elbow is…", "El centro a cara de un codo de 90° radio corto de 4\" para soldar a tope es…"), options: [o("4\"", "4\""), o("6\"", "6\""), o("2\"", "2\""), o("8\"", "8\"")], answer: 0 },
      { id: "pm7", q: o("What is the outside diameter of 2\" NPS steel pipe?", "¿Cuál es el diámetro exterior de un tubo de acero de 2\" NPS?"), options: [o("2.000\"", "2.000\""), o("2.067\"", "2.067\""), o("2.375\"", "2.375\""), o("2.875\"", "2.875\"")], answer: 2 },
      { id: "pm8", q: o("Center to center is 24\". Each end has a 2\" long-radius 90 (3\" take-out) and a 1/8\" root gap. Cut length?", "Centro a centro mide 24\". Cada extremo lleva un codo de 90 radio largo de 2\" (3\" de descuento) y 1/8\" de abertura de raíz. ¿Largo de corte?"), options: [o("18\"", "18\""), o("17-3/4\"", "17-3/4\""), o("17-7/8\"", "17-7/8\""), o("21-3/4\"", "21-3/4\"")], answer: 1 },
      { id: "pm9", q: o("A hydrostatic test on process piping (ASME B31.3) is normally at least…", "Una prueba hidrostática en tubería de proceso (ASME B31.3) normalmente es de al menos…"), options: [o("The design pressure", "La presión de diseño"), o("1.1 × design pressure", "1.1 × la presión de diseño"), o("1.5 × design pressure", "1.5 × la presión de diseño"), o("3 × design pressure", "3 × la presión de diseño")], answer: 2 },
      { id: "pm10", q: o("About how long is the circumference of a pipe with a 2.375\" outside diameter?", "¿Cuánto mide aproximadamente la circunferencia de un tubo de 2.375\" de diámetro exterior?"), options: [o("4.75\"", "4.75\""), o("6.28\"", "6.28\""), o("7.46\"", "7.46\""), o("9.50\"", "9.50\"")], answer: 2 },
    ],
  },
  {
    id: "carpentry-fundamentals",
    title: o("Carpentry fundamentals", "Fundamentos de carpintería"),
    trades: ["carpenter", "drywall", "concrete", "maintenance_tech", "helper"],
    handsOn: o("Lays out and frames a wall section with an opening, checks square with 3-4-5, hangs a door.", "Traza y arma una sección de muro con abertura, revisa escuadra con 3-4-5, cuelga una puerta."),
    questions: [
      { id: "cp1", q: o("What is the actual size of a 2×4?", "¿Cuál es la medida real de un 2×4?"), options: [o("2\" × 4\"", "2\" × 4\""), o("1-3/4\" × 3-3/4\"", "1-3/4\" × 3-3/4\""), o("1-1/2\" × 3-1/2\"", "1-1/2\" × 3-1/2\""), o("1-1/4\" × 3-1/4\"", "1-1/4\" × 3-1/4\"")], answer: 2 },
      { id: "cp2", q: o("Most interior wall studs are spaced…", "La mayoría de los polines de muros interiores van a…"), options: [o("12\" on center", "12\" a centro"), o("16\" on center", "16\" a centro"), o("20\" on center", "20\" a centro"), o("32\" on center", "32\" a centro")], answer: 1 },
      { id: "cp3", q: o("Checking a corner with the 3-4-5 method: one side is 6 ft and the other 8 ft. The diagonal should be…", "Revisando una esquina con el método 3-4-5: un lado mide 6 pies y el otro 8. La diagonal debe medir…"), options: [o("9 ft", "9 pies"), o("10 ft", "10 pies"), o("12 ft", "12 pies"), o("14 ft", "14 pies")], answer: 1 },
      { id: "cp4", q: o("A full sheet of plywood or drywall is usually…", "Una hoja completa de triplay o tablaroca normalmente mide…"), options: [o("3 × 6 ft", "3 × 6 pies"), o("4 × 8 ft", "4 × 8 pies"), o("4 × 10 ft only", "Solo 4 × 10 pies"), o("5 × 10 ft", "5 × 10 pies")], answer: 1 },
      { id: "cp5", q: o("How many studs for a 12-foot wall at 16\" on center (not counting extra corner or opening studs)?", "¿Cuántos polines lleva un muro de 12 pies a 16\" a centro (sin contar extras de esquinas o aberturas)?"), options: [o("8", "8"), o("9", "9"), o("10", "10"), o("12", "12")], answer: 2 },
      { id: "cp6", q: o("What does a header do?", "¿Para qué sirve un cabezal (header)?"), options: [o("Holds insulation", "Sostiene el aislante"), o("Carries the load over a door or window opening", "Carga el peso sobre la abertura de una puerta o ventana"), o("Ties the wall to the slab", "Une el muro a la losa"), o("Covers the top of drywall", "Tapa la parte de arriba de la tablaroca")], answer: 1 },
      { id: "cp7", q: o("A common rough-opening width for a 36\" prehung door is…", "Un ancho común de vano para una puerta premontada de 36\" es…"), options: [o("36\"", "36\""), o("37\"", "37\""), o("38\"", "38\""), o("40\"", "40\"")], answer: 2 },
      { id: "cp8", q: o("Floor joists and rafters with a crown (slight bow) are installed…", "Las vigas y cabios con corona (curva ligera) se instalan…"), options: [o("Crown up", "Con la corona hacia arriba"), o("Crown down", "Con la corona hacia abajo"), o("Crown sideways", "Con la corona de lado"), o("It doesn't matter", "No importa")], answer: 0 },
      { id: "cp9", q: o("How many board feet are in a 2×6 that is 12 feet long?", "¿Cuántos pies tablares tiene un 2×6 de 12 pies?"), options: [o("6", "6"), o("8", "8"), o("12", "12"), o("24", "24")], answer: 2 },
      { id: "cp10", q: o("A roof pitch of 6/12 means…", "Una pendiente de techo de 6/12 significa…"), options: [o("6 inches of rise for every 12 inches of run", "6 pulgadas de subida por cada 12 de avance"), o("6 feet tall, 12 feet wide", "6 pies de alto y 12 de ancho"), o("A 6° slope", "Una pendiente de 6°"), o("6 rafters every 12 feet", "6 cabios cada 12 pies")], answer: 0 },
    ],
  },
];

export const ASSESSMENT_BY_ID = Object.fromEntries(ASSESSMENTS.map((a) => [a.id, a]));

export const assessmentsForTrade = (trade: string | null) => ASSESSMENTS.filter((a) => trade !== null && a.trades.includes(trade));

/** Draw questions for a new attempt. `rand` is injectable for tests. */
export function drawQuestions(a: Assessment, rand: () => number = Math.random, n = QUESTIONS_PER_TEST): string[] {
  const ids = a.questions.map((q) => q.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, Math.min(n, ids.length));
}

export interface GradeResult {
  score: number;
  passed: boolean;
  late: boolean;
  correct: number;
  total: number;
}

/** Grade on the server. Answers after the time limit (plus a short grace) count as a fail. */
export function gradeAttempt(attempt: Pick<AssessmentAttempt, "assessmentId" | "questionIds" | "startedAt">, answers: number[], now: Date, passPct: number): GradeResult {
  const a = ASSESSMENT_BY_ID[attempt.assessmentId];
  if (!a) throw new Error("Unknown test");
  const byId = Object.fromEntries(a.questions.map((q) => [q.id, q]));
  const total = attempt.questionIds.length;
  const correct = attempt.questionIds.reduce((s, id, i) => s + (byId[id] && answers[i] === byId[id].answer ? 1 : 0), 0);
  const elapsed = (now.getTime() - Date.parse(attempt.startedAt)) / 1000;
  const late = elapsed > TIME_LIMIT_MIN * 60 + GRACE_SEC;
  const score = total ? Math.round((100 * correct) / total) : 0;
  return { score: late ? 0 : score, passed: !late && score >= passPct, late, correct, total };
}

/** When can this worker start this test again? null = now. */
export function nextAttemptAt(attempts: Pick<AssessmentAttempt, "assessmentId" | "kind" | "startedAt" | "completedAt">[], assessmentId: string, retakeDays: number, now: Date): Date | null {
  const mine = attempts.filter((x) => x.assessmentId === assessmentId && x.kind === "knowledge").sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const last = mine[0];
  if (!last) return null;
  // An unfinished attempt still inside its time window can be resumed, not restarted.
  const next = new Date(Date.parse(last.startedAt) + retakeDays * 86_400_000);
  return next > now ? next : null;
}

/** Best result per test, for employer-facing badges. Hands-on passes outrank in-app scores. */
export function bestResults(attempts: AssessmentAttempt[]) {
  const out: Record<string, { knowledge: AssessmentAttempt | null; handsOn: AssessmentAttempt | null }> = {};
  for (const a of attempts) {
    if (a.completedAt === null || a.score === null) continue;
    const slot = (out[a.assessmentId] ??= { knowledge: null, handsOn: null });
    const key = a.kind === "hands_on" ? "handsOn" : "knowledge";
    const cur = slot[key];
    if (!cur || (a.passed && !cur.passed) || (Boolean(a.passed) === Boolean(cur.passed) && (a.completedAt ?? "") > (cur.completedAt ?? ""))) slot[key] = a;
  }
  return out;
}
