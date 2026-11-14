// Practice quizzes. PREP ONLY: they do not replace an OSHA-authorized course or issue any card.
// Each safety answer cites the federal construction rule (29 CFR 1926) it comes from.
import type { Lang } from "./types";

type L = Record<Lang, string>;
export interface Question {
  q: L;
  options: L[];
  answer: number;
  why: L;
}
export interface Quiz {
  id: string;
  title: L;
  blurb: L;
  questions: Question[];
}

const o = (en: string, es: string): L => ({ en, es });

export const QUIZZES: Quiz[] = [
  {
    id: "osha-construction",
    title: o("OSHA construction safety basics", "Seguridad OSHA en construcción: lo básico"),
    blurb: o("Falls, ladders, trenches, scaffolds and lockout. 10 questions.", "Caídas, escaleras, zanjas, andamios y bloqueo. 10 preguntas."),
    questions: [
      {
        q: o("In construction, at what height does OSHA generally require fall protection?", "En construcción, ¿a qué altura exige OSHA en general protección contra caídas?"),
        options: [o("4 feet", "4 pies"), o("6 feet", "6 pies"), o("10 feet", "10 pies"), o("15 feet", "15 pies")],
        answer: 1,
        why: o("6 feet or more above a lower level (29 CFR 1926.501(b)(1)).", "6 pies o más sobre un nivel inferior (29 CFR 1926.501(b)(1))."),
      },
      {
        q: o("Workers on a scaffold need fall protection starting at what height?", "En un andamio, ¿a partir de qué altura se necesita protección contra caídas?"),
        options: [o("6 feet", "6 pies"), o("8 feet", "8 pies"), o("10 feet", "10 pies"), o("20 feet", "20 pies")],
        answer: 2,
        why: o("More than 10 feet above a lower level (29 CFR 1926.451(g)(1)).", "Más de 10 pies sobre un nivel inferior (29 CFR 1926.451(g)(1))."),
      },
      {
        q: o("How far must a portable ladder's side rails extend above the landing you're climbing onto?", "¿Cuánto deben sobresalir los rieles de una escalera portátil arriba del punto donde vas a subir?"),
        options: [o("1 foot", "1 pie"), o("2 feet", "2 pies"), o("3 feet", "3 pies"), o("5 feet", "5 pies")],
        answer: 2,
        why: o("At least 3 feet above the upper landing (29 CFR 1926.1053(b)(1)).", "Al menos 3 pies arriba del punto de llegada (29 CFR 1926.1053(b)(1))."),
      },
      {
        q: o("Setting up an extension ladder: how far out should the base be for a 20-foot working length?", "Al poner una escalera de extensión con 20 pies de altura de trabajo, ¿qué tan separada debe estar la base?"),
        options: [o("2 feet", "2 pies"), o("5 feet", "5 pies"), o("8 feet", "8 pies"), o("10 feet", "10 pies")],
        answer: 1,
        why: o("The 4-to-1 rule: 1 foot out for every 4 feet up (29 CFR 1926.1053(b)(5)(i)).", "La regla 4 a 1: 1 pie hacia afuera por cada 4 de altura (29 CFR 1926.1053(b)(5)(i))."),
      },
      {
        q: o("A trench needs a protective system (sloping, shoring or a trench box) once it is how deep?", "¿A partir de qué profundidad necesita una zanja un sistema de protección (talud, apuntalamiento o caja)?"),
        options: [o("3 feet", "3 pies"), o("4 feet", "4 pies"), o("5 feet", "5 pies"), o("8 feet", "8 pies")],
        answer: 2,
        why: o("5 feet or more, unless it is entirely in stable rock (29 CFR 1926.652(a)(1)).", "5 pies o más, a menos que sea totalmente en roca estable (29 CFR 1926.652(a)(1))."),
      },
      {
        q: o("In a trench 4 feet deep or more, a ladder or other way out must be within how far of every worker?", "En una zanja de 4 pies o más, ¿a qué distancia máxima debe haber una escalera u otra salida?"),
        options: [o("10 feet", "10 pies"), o("25 feet", "25 pies"), o("50 feet", "50 pies"), o("100 feet", "100 pies")],
        answer: 1,
        why: o("No more than 25 feet of lateral travel (29 CFR 1926.651(c)(2)).", "No más de 25 pies de recorrido lateral (29 CFR 1926.651(c)(2))."),
      },
      {
        q: o("What is the required height of a guardrail's top rail?", "¿Qué altura debe tener el pasamanos superior de una baranda?"),
        options: [o("36 inches, ±3", "36 pulgadas, ±3"), o("42 inches, ±3", "42 pulgadas, ±3"), o("48 inches, ±3", "48 pulgadas, ±3"), o("Any height", "Cualquier altura")],
        answer: 1,
        why: o("39 to 45 inches above the walking surface (29 CFR 1926.502(b)(1)).", "Entre 39 y 45 pulgadas sobre la superficie (29 CFR 1926.502(b)(1))."),
      },
      {
        q: o("Who may remove your lockout lock?", "¿Quién puede quitar tu candado de bloqueo (lockout)?"),
        options: [o("Any supervisor", "Cualquier supervisor"), o("The operator of the machine", "El operador de la máquina"), o("Only the person who put it on, except under a special written procedure", "Solo quien lo puso, salvo un procedimiento especial por escrito"), o("Anyone with a key", "Cualquiera que tenga llave")],
        answer: 2,
        why: o("Lockout protects the person working on the equipment; only they remove it except under the employer's documented removal procedure.", "El bloqueo protege a quien trabaja en el equipo; solo esa persona lo quita, salvo el procedimiento documentado del empleador."),
      },
      {
        q: o("Who must inspect a trench before work starts each day?", "¿Quién debe inspeccionar una zanja cada día antes de empezar?"),
        options: [o("Any worker", "Cualquier trabajador"), o("A competent person", "Una persona competente"), o("An OSHA inspector", "Un inspector de OSHA"), o("The owner", "El dueño")],
        answer: 1,
        why: o("Daily inspections by a competent person before work starts (29 CFR 1926.651(k)(1)).", "Inspección diaria por una persona competente antes de empezar (29 CFR 1926.651(k)(1))."),
      },
      {
        q: o("How many sections does a Safety Data Sheet (SDS) have?", "¿Cuántas secciones tiene una Hoja de Datos de Seguridad (SDS)?"),
        options: [o("8", "8"), o("12", "12"), o("16", "16"), o("20", "20")],
        answer: 2,
        why: o("SDSs use a standard 16-section format: hazards, first aid, handling, PPE and more.", "Las SDS tienen un formato estándar de 16 secciones: peligros, primeros auxilios, manejo, EPP y más."),
      },
    ],
  },
  {
    id: "blueprint-basics",
    title: o("Blueprint and isometric reading", "Lectura de planos e isométricos"),
    blurb: o("Scales, line types, views and common abbreviations. 8 questions.", "Escalas, tipos de línea, vistas y abreviaturas. 8 preguntas."),
    questions: [
      {
        q: o("At a scale of 1/4\" = 1'-0\", a line 3 inches long on the drawing is how long in the field?", "En escala 1/4\" = 1'-0\", una línea de 3 pulgadas en el plano mide cuánto en campo?"),
        options: [o("3 feet", "3 pies"), o("6 feet", "6 pies"), o("12 feet", "12 pies"), o("16 feet", "16 pies")],
        answer: 2,
        why: o("Each 1/4 inch is 1 foot, so 3 inches = 12 quarter-inches = 12 feet.", "Cada 1/4 de pulgada es 1 pie: 3 pulgadas = 12 cuartos = 12 pies."),
      },
      {
        q: o("Short evenly spaced dashes on a drawing usually show…", "Rayas cortas y parejas en un plano normalmente indican…"),
        options: [o("A center line", "Una línea de centro"), o("A hidden edge", "Un borde oculto"), o("A cutting plane", "Un plano de corte"), o("A dimension", "Una dimensión")],
        answer: 1,
        why: o("Hidden lines are short dashes; they show edges you can't see from that view.", "Las líneas ocultas son rayas cortas; muestran bordes que no se ven desde esa vista."),
      },
      {
        q: o("A line of alternating long and short dashes is a…", "Una línea de rayas largas y cortas alternadas es una…"),
        options: [o("Center line", "Línea de centro"), o("Hidden line", "Línea oculta"), o("Break line", "Línea de corte"), o("Leader", "Línea de referencia")],
        answer: 0,
        why: o("Center lines mark the center of holes, pipes and symmetric parts.", "Las líneas de centro marcan el centro de agujeros, tubos y piezas simétricas."),
      },
      {
        q: o("A plan view shows the object as seen from…", "Una vista de planta muestra el objeto visto desde…"),
        options: [o("The front", "El frente"), o("The side", "El lado"), o("Directly above", "Directamente arriba"), o("Below", "Abajo")],
        answer: 2,
        why: o("Plan = looking straight down. Elevations show the sides.", "Planta = viendo hacia abajo. Las elevaciones muestran los lados."),
      },
      {
        q: o("On a drawing, a cloud drawn around something usually means…", "En un plano, una nube dibujada alrededor de algo normalmente significa…"),
        options: [o("It's optional", "Es opcional"), o("It was changed in a revision", "Se cambió en una revisión"), o("It's been demolished", "Fue demolido"), o("It's not to scale", "No está a escala")],
        answer: 1,
        why: o("Revision clouds flag changes; check the revision block for what changed.", "Las nubes marcan cambios; revisa el cuadro de revisiones para ver qué cambió."),
      },
      {
        q: o("Where do you find the drawing number, scale and revision?", "¿Dónde encuentras el número de plano, la escala y la revisión?"),
        options: [o("The title block", "El cuadro de título"), o("The legend only", "Solo la leyenda"), o("The bill of materials", "La lista de materiales"), o("The north arrow", "La flecha del norte")],
        answer: 0,
        why: o("The title block, usually bottom right, holds the drawing number, scale, date and revision.", "El cuadro de título, normalmente abajo a la derecha, tiene número, escala, fecha y revisión."),
      },
      {
        q: o("On a piping isometric, \"BOP\" means…", "En un isométrico de tubería, \"BOP\" significa…"),
        options: [o("Bolt on plate", "Placa atornillada"), o("Bottom of pipe", "Fondo del tubo (parte inferior)"), o("Blow-off pressure", "Presión de purga"), o("Beginning of piping", "Inicio de la tubería")],
        answer: 1,
        why: o("BOP = bottom of pipe elevation; TOS = top of steel.", "BOP = elevación del fondo del tubo; TOS = parte superior del acero."),
      },
      {
        q: o("In an isometric drawing, the three main axes are drawn how many degrees apart?", "En un dibujo isométrico, ¿cuántos grados hay entre los tres ejes principales?"),
        options: [o("45°", "45°"), o("90°", "90°"), o("120°", "120°"), o("180°", "180°")],
        answer: 2,
        why: o("Isometric axes are 120° apart, so vertical lines stay vertical and the others run at 30°.", "Los ejes isométricos están a 120°; las verticales quedan verticales y las otras van a 30°."),
      },
    ],
  },
];

export const QUIZ_BY_ID = Object.fromEntries(QUIZZES.map((q) => [q.id, q]));
