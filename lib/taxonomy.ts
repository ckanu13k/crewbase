// Taxonomy for Greater Houston craft and hourly work: plants, construction sites, warehouses and homes.
//
// Trades map to O*NET-SOC codes so data can be joined to labor-market sources later.
// Skills are deliberately specific (what a foreman would ask), not O*NET's broad
// "knowledge" categories. The plan calls for 30-50 skills per trade; this is a seed
// list of the most-asked ones. Extend it here; ids are stable keys stored in the DB.
//
// Credential validity defaults are used ONLY to guess an expiry date when the card
// photo doesn't show one. Values marked `estimated: true` should be checked against
// the issuer before launch.

import type { Lang, Sector } from "./types";

type L = Record<Lang, string>;

export interface Trade {
  id: string;
  onet: string;
  onetVerify?: boolean; // true = SOC mapping is a best guess, confirm in O*NET
  label: L;
  keywords: string[]; // lowercase, EN + ES, used by the offline extractor
  sectors: Sector[];
  /** Entry-level: anyone can be considered, whatever their usual trade. */
  entry?: boolean;
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

const IND: Sector[] = ["industrial"];
export const TRADES: Trade[] = [
  // Plants, refineries and fab shops (several also work construction)
  { id: "pipefitter", onet: "47-2152.00", sectors: ["industrial", "construction"], label: { en: "Pipefitter", es: "Tubero" }, keywords: ["pipefitter", "pipe fitter", "fitter", "tubero", "tubería", "tuberia", "pipe"] },
  { id: "welder", onet: "51-4121.00", sectors: ["industrial", "construction"], label: { en: "Welder", es: "Soldador" }, keywords: ["welder", "welding", "soldador", "soldadura", "soldar"] },
  { id: "scaffold", onet: "47-4099.00", onetVerify: true, sectors: ["industrial", "construction"], label: { en: "Scaffold builder", es: "Andamiero" }, keywords: ["scaffold", "scaffolding", "andamio", "andamios", "andamiero"] },
  { id: "rigger", onet: "49-9096.00", sectors: ["industrial", "construction"], label: { en: "Rigger / signal person", es: "Aparejador / señalero" }, keywords: ["rigger", "rigging", "signal person", "signalman", "aparejador", "señalero", "senalero", "maniobras"] },
  { id: "millwright", onet: "49-9044.00", sectors: IND, label: { en: "Millwright", es: "Millwright (mecánico industrial)" }, keywords: ["millwright", "mecánico industrial", "mecanico industrial", "alineación", "alignment"] },
  { id: "electrician", onet: "47-2111.00", sectors: ["industrial", "construction", "residential"], label: { en: "Electrician", es: "Electricista" }, keywords: ["electrician", "electrical", "electricista", "eléctrico", "electrico"] },
  { id: "hvac", onet: "49-9021.00", sectors: ["industrial", "construction", "residential"], label: { en: "HVAC technician", es: "Técnico de HVAC / aire acondicionado" }, keywords: ["hvac", "air conditioning", "a/c", "refrigeration", "aire acondicionado", "refrigeración", "refrigeracion"] },
  { id: "helper", onet: "47-2061.00", sectors: ["industrial", "construction"], entry: true, label: { en: "Helper / laborer", es: "Ayudante / obrero" }, keywords: ["helper", "laborer", "labor", "ayudante", "obrero", "peón", "peon"] },
  // Construction
  { id: "carpenter", onet: "47-2031.00", sectors: ["construction", "residential"], label: { en: "Carpenter / framer", es: "Carpintero / armador" }, keywords: ["carpenter", "carpentry", "framer", "framing", "carpintero", "carpintería", "carpinteria", "armador"] },
  { id: "concrete", onet: "47-2051.00", sectors: ["construction"], label: { en: "Concrete finisher", es: "Acabador de concreto" }, keywords: ["concrete", "finisher", "cement", "concreto", "cemento", "colado"] },
  { id: "drywall", onet: "47-2081.00", sectors: ["construction", "residential"], label: { en: "Drywall installer / finisher", es: "Instalador de tablaroca (drywall)" }, keywords: ["drywall", "sheetrock", "taper", "tablaroca", "panel de yeso"] },
  { id: "painter", onet: "47-2141.00", sectors: ["construction", "residential"], label: { en: "Painter", es: "Pintor" }, keywords: ["painter", "painting", "pintor", "pintura"] },
  { id: "roofer", onet: "47-2181.00", sectors: ["construction", "residential"], label: { en: "Roofer", es: "Techador" }, keywords: ["roofer", "roofing", "shingles", "techador", "techos", "tejas"] },
  { id: "plumber", onet: "47-2152.00", sectors: ["construction", "residential"], label: { en: "Plumber", es: "Plomero" }, keywords: ["plumber", "plumbing", "plomero", "plomería", "plomeria"] },
  { id: "equipment_operator", onet: "47-2073.00", sectors: ["construction"], label: { en: "Heavy equipment operator", es: "Operador de maquinaria pesada" }, keywords: ["equipment operator", "excavator", "skid steer", "bobcat", "operador", "maquinaria", "excavadora"] },
  // Warehouse and logistics
  { id: "warehouse_associate", onet: "53-7062.00", sectors: ["warehouse"], entry: true, label: { en: "Warehouse associate / material handler", es: "Almacenista / manejo de materiales" }, keywords: ["warehouse", "material handler", "almacén", "almacen", "bodega", "almacenista"] },
  { id: "forklift_operator", onet: "53-7051.00", sectors: ["warehouse", "industrial"], label: { en: "Forklift operator", es: "Operador de montacargas" }, keywords: ["forklift operator", "forklift driver", "forklift", "reach truck", "montacargas", "montacarguista", "operador de montacargas"] },
  { id: "picker_packer", onet: "53-7064.00", sectors: ["warehouse"], entry: true, label: { en: "Picker / packer", es: "Surtidor / empacador" }, keywords: ["picker", "packer", "order picker", "packing", "empacador", "surtidor", "empaque"] },
  { id: "driver", onet: "53-3032.00", sectors: ["warehouse", "construction"], label: { en: "CDL truck driver", es: "Chofer con CDL" }, keywords: ["cdl", "truck driver", "driver", "chofer", "trailero", "camionero"] },
  // Homes and apartments
  { id: "maintenance_tech", onet: "49-9071.00", sectors: ["residential"], label: { en: "Maintenance technician / handyman", es: "Técnico de mantenimiento" }, keywords: ["maintenance tech", "maintenance technician", "handyman", "make ready", "mantenimiento", "técnico de mantenimiento"] },
  { id: "landscaper", onet: "37-3011.00", sectors: ["residential"], entry: true, label: { en: "Landscaper", es: "Jardinero / paisajista" }, keywords: ["landscaper", "landscaping", "lawn", "jardinero", "jardinería", "jardineria", "yarda"] },
  { id: "mover", onet: "53-7062.00", onetVerify: true, sectors: ["residential", "warehouse"], entry: true, label: { en: "Mover", es: "Cargador de mudanzas" }, keywords: ["mover", "moving", "mudanza", "mudanzas"] },
  { id: "cleaner", onet: "37-2012.00", sectors: ["residential"], entry: true, label: { en: "House / move-out cleaner", es: "Limpieza de casas" }, keywords: ["cleaner", "cleaning", "housekeeping", "limpieza", "limpiar casas"] },
];

export const SECTORS: { id: Sector; label: L }[] = [
  { id: "industrial", label: { en: "Plants & fab shops", es: "Plantas y talleres" } },
  { id: "construction", label: { en: "Construction", es: "Construcción" } },
  { id: "warehouse", label: { en: "Warehouse", es: "Almacén" } },
  { id: "residential", label: { en: "Homes & apartments", es: "Casas y apartamentos" } },
];
export const sectorLabel = (id: Sector | null | undefined, lang: Lang) => SECTORS.find((x) => x.id === id)?.label[lang] ?? "";

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
  { id: "material_handling", trades: ["helper", "warehouse_associate", "picker_packer", "mover", "landscaper"], label: { en: "Material handling", es: "Manejo de materiales" }, keywords: ["material handling", "materials", "manejo de materiales", "cargar"] },
  { id: "housekeeping", trades: ["helper", "warehouse_associate", "cleaner"], label: { en: "Site housekeeping", es: "Limpieza de obra" }, keywords: ["housekeeping", "cleanup", "clean up", "limpieza"] },
  { id: "flagging", trades: ["helper"], label: { en: "Flagging / traffic control", es: "Banderero / control de tráfico" }, keywords: ["flagger", "flagging", "banderero"] },

  // Cross-trade, homes
  { id: "customer_homes", trades: ["maintenance_tech", "plumber", "electrician", "hvac", "painter", "cleaner", "mover", "landscaper"], label: { en: "Working in customers' homes", es: "Trabajo en casas de clientes" }, keywords: ["customer", "homeowner", "residential", "clientes", "casas"] },
  { id: "fall_protection", trades: ["roofer", "carpenter", "scaffold", "rigger", "helper"], label: { en: "Personal fall arrest (harness) use", es: "Uso de arnés contra caídas" }, keywords: ["harness", "fall protection", "tie off", "arnés", "arnes"] },

  // Carpenter / concrete
  { id: "framing", trades: ["carpenter"], label: { en: "Wall and roof framing", es: "Armado de muros y techos" }, keywords: ["framing", "frame", "studs", "trusses", "armado", "polines"] },
  { id: "layout", trades: ["carpenter", "concrete", "drywall"], label: { en: "Layout (tape, square, chalk line)", es: "Trazo (cinta, escuadra, reventón)" }, keywords: ["layout", "chalk line", "square", "trazo", "reventón", "reventon"] },
  { id: "formwork", trades: ["carpenter", "concrete"], label: { en: "Concrete formwork", es: "Cimbra para concreto" }, keywords: ["formwork", "forms", "forming", "cimbra", "moldes"] },
  { id: "finish_carpentry", trades: ["carpenter", "maintenance_tech"], label: { en: "Trim and finish carpentry", es: "Carpintería de acabados" }, keywords: ["trim", "finish carpentry", "baseboard", "molding", "acabados", "zoclo"] },
  { id: "concrete_finishing", trades: ["concrete"], label: { en: "Placing and finishing concrete", es: "Colado y acabado de concreto" }, keywords: ["finishing", "trowel", "screed", "pour", "llana", "colado"] },
  { id: "rebar", trades: ["concrete", "helper"], label: { en: "Tying rebar", es: "Amarre de varilla" }, keywords: ["rebar", "tie rebar", "varilla", "amarrar varilla"] },
  // Drywall / painter / roofer
  { id: "drywall_hanging", trades: ["drywall", "maintenance_tech"], label: { en: "Hanging drywall", es: "Colocar tablaroca" }, keywords: ["hang drywall", "hanging", "colocar tablaroca"] },
  { id: "drywall_finishing", trades: ["drywall", "painter", "maintenance_tech"], label: { en: "Tape, mud and texture", es: "Cinta, pasta y textura" }, keywords: ["tape", "mud", "texture", "float", "pasta", "textura"] },
  { id: "surface_prep", trades: ["painter"], label: { en: "Surface prep and caulking", es: "Preparación de superficies y sellado" }, keywords: ["prep", "sanding", "caulk", "preparación", "lijar", "sellador"] },
  { id: "spray_painting", trades: ["painter"], label: { en: "Airless spray painting", es: "Pintura con pistola airless" }, keywords: ["spray", "airless", "sprayer", "pistola", "aspersora"] },
  { id: "brush_roll", trades: ["painter", "maintenance_tech"], label: { en: "Brush and roll, cutting in", es: "Brocha y rodillo, recortes" }, keywords: ["brush", "roller", "cut in", "brocha", "rodillo"] },
  { id: "shingle_roofing", trades: ["roofer"], label: { en: "Shingle roofing", es: "Techos de teja asfáltica" }, keywords: ["shingle", "shingles", "tear off", "teja", "tejas"] },
  { id: "low_slope_roofing", trades: ["roofer"], label: { en: "Flat / low-slope roofing (TPO, mod-bit)", es: "Techos planos (TPO, mod-bit)" }, keywords: ["tpo", "flat roof", "mod bit", "modified bitumen", "techo plano"] },
  // Plumber
  { id: "dwv_piping", trades: ["plumber"], label: { en: "Drain-waste-vent piping", es: "Tubería de drenaje y ventilación" }, keywords: ["dwv", "drain", "vent", "pvc", "drenaje"] },
  { id: "water_supply", trades: ["plumber"], label: { en: "Water supply (PEX, copper)", es: "Agua potable (PEX, cobre)" }, keywords: ["pex", "copper", "water line", "supply", "cobre", "agua"] },
  { id: "fixture_install", trades: ["plumber", "maintenance_tech"], label: { en: "Fixture and water heater install", es: "Instalación de muebles de baño y boiler" }, keywords: ["fixture", "toilet", "water heater", "faucet", "boiler", "calentador", "llave"] },
  // Equipment operator / driver
  { id: "skid_steer", trades: ["equipment_operator", "landscaper", "helper"], label: { en: "Skid steer", es: "Minicargador (bobcat)" }, keywords: ["skid steer", "bobcat", "minicargador"] },
  { id: "excavator", trades: ["equipment_operator"], label: { en: "Excavator", es: "Excavadora" }, keywords: ["excavator", "trackhoe", "excavadora"] },
  { id: "pre_trip", trades: ["driver"], label: { en: "Pre-trip inspection and logs", es: "Inspección pre-viaje y bitácoras" }, keywords: ["pre-trip", "pretrip", "eld", "logs", "bitácora", "bitacora"] },
  { id: "tractor_trailer", trades: ["driver"], label: { en: "Tractor-trailer driving", es: "Manejo de tráiler" }, keywords: ["tractor trailer", "18 wheeler", "semi", "tráiler", "trailer"] },
  // Warehouse
  { id: "order_picking", trades: ["warehouse_associate", "picker_packer", "forklift_operator"], label: { en: "Order picking with an RF scanner", es: "Surtido de pedidos con escáner" }, keywords: ["picking", "rf scanner", "scanner", "pick", "surtir", "escáner", "escaner"] },
  { id: "packing", trades: ["picker_packer", "warehouse_associate", "mover"], label: { en: "Packing and labeling", es: "Empaque y etiquetado" }, keywords: ["packing", "labeling", "pack", "empacar", "etiquetar"] },
  { id: "shipping_receiving", trades: ["warehouse_associate", "forklift_operator"], label: { en: "Shipping and receiving", es: "Embarques y recibo" }, keywords: ["shipping", "receiving", "embarques", "recibo"] },
  { id: "pallet_jack", trades: ["warehouse_associate", "picker_packer", "forklift_operator", "mover"], label: { en: "Pallet jack (manual or electric)", es: "Patín hidráulico / eléctrico" }, keywords: ["pallet jack", "patín", "patin", "transpaleta"] },
  { id: "reach_truck", trades: ["forklift_operator"], label: { en: "Reach truck / order picker lift", es: "Montacargas retráctil (reach)" }, keywords: ["reach truck", "order picker", "stand-up forklift", "retráctil"] },
  { id: "trailer_loading", trades: ["forklift_operator", "warehouse_associate", "mover"], label: { en: "Loading and unloading trailers", es: "Carga y descarga de tráilers" }, keywords: ["load trailers", "unload", "dock", "cargar", "descargar", "andén"] },
  // Homes
  { id: "make_ready", trades: ["maintenance_tech", "painter", "cleaner"], label: { en: "Apartment make-readies", es: "Preparación de apartamentos (make-ready)" }, keywords: ["make ready", "make-ready", "turns", "unit turns"] },
  { id: "appliance_repair", trades: ["maintenance_tech"], label: { en: "Appliance repair", es: "Reparación de electrodomésticos" }, keywords: ["appliance", "dishwasher", "washer", "electrodoméstico", "lavadora"] },
  { id: "minor_plumbing", trades: ["maintenance_tech"], label: { en: "Minor plumbing repairs", es: "Reparaciones menores de plomería" }, keywords: ["clog", "leak", "unclog", "fuga", "destapar"] },
  { id: "minor_electrical", trades: ["maintenance_tech"], label: { en: "Minor electrical (outlets, fixtures)", es: "Electricidad menor (contactos, lámparas)" }, keywords: ["outlet", "light fixture", "switch", "contacto", "apagador"] },
  { id: "mowing_equipment", trades: ["landscaper"], label: { en: "Mowers, trimmers and blowers", es: "Podadoras, desbrozadoras y sopladoras" }, keywords: ["mow", "mower", "trimmer", "edger", "podadora", "sopladora"] },
  { id: "irrigation", trades: ["landscaper", "plumber"], label: { en: "Irrigation repair", es: "Reparación de riego" }, keywords: ["irrigation", "sprinkler", "riego", "aspersores"] },
  { id: "furniture_moving", trades: ["mover"], label: { en: "Furniture moving and padding", es: "Mover y proteger muebles" }, keywords: ["furniture", "dolly", "pads", "muebles", "diablito"] },
  { id: "residential_cleaning", trades: ["cleaner"], label: { en: "Residential and move-out cleaning", es: "Limpieza de casas y mudanzas" }, keywords: ["deep clean", "move out", "move-out", "limpieza profunda"] },
  { id: "floor_care", trades: ["cleaner"], label: { en: "Floor care (strip and wax)", es: "Cuidado de pisos (decapar y encerar)" }, keywords: ["strip and wax", "floor care", "buffer", "encerar", "pulidora"] },
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
  { id: "osha10_gi", short: "OSHA 10 GI", label: { en: "OSHA 10-Hour General Industry", es: "OSHA 10 horas (industria general)" }, issuer: "OSHA-authorized trainer", validityMonths: null,
    note: { en: "The general-industry card warehouses and plants ask for; construction sites usually want the construction card.", es: "La tarjeta de industria general que piden almacenes y plantas; las obras suelen pedir la de construcción." },
    verifyHow: "Card shows trainer name and number; call the training provider to confirm.", keywords: ["general industry", "osha 10 gi", "industria general"] },
  { id: "cdl_a", short: "CDL-A", label: { en: "Commercial driver license, Class A", es: "Licencia comercial (CDL) clase A" }, issuer: "Texas DPS", validityMonths: null,
    verifyHow: "Check the printed expiry and run a driving record (MVR) with the driver's written consent.", keywords: ["cdl", "class a", "clase a", "licencia comercial"] },
  { id: "dot_medical", short: "DOT medical", label: { en: "DOT medical examiner's certificate", es: "Certificado médico DOT" }, issuer: "FMCSA-registered medical examiner", validityMonths: 24,
    note: { en: "Good for up to 24 months; the examiner can set a shorter date.", es: "Vale hasta 24 meses; el médico puede poner una fecha más corta." },
    verifyHow: "Check the examiner on the FMCSA National Registry and the date on the certificate.", keywords: ["dot medical", "medical card", "dot physical", "examen dot"] },
  { id: "epa_rrp", short: "EPA RRP", label: { en: "EPA Lead-Safe Renovator (RRP)", es: "Renovador certificado EPA en plomo (RRP)" }, issuer: "EPA-accredited trainer", validityMonths: 60, estimated: true,
    note: { en: "Needed to disturb paint in homes built before 1978. 5 years with a hands-on refresher, 3 without.", es: "Necesaria para trabajos que alteran pintura en casas de antes de 1978. 5 años con repaso práctico, 3 sin él." },
    verifyHow: "Check the certificate number and expiry with the training provider.", keywords: ["rrp", "lead safe", "lead renovator", "plomo"] },
  { id: "flagger", short: "Flagger", label: { en: "Flagger certification", es: "Certificación de banderero" }, issuer: "Training provider (e.g. ATSSA)", validityMonths: 48, estimated: true,
    verifyHow: "Check the card's printed expiry; call the provider if unclear.", keywords: ["flagger", "flagger card", "banderero certificado"] },
  { id: "tsbpe_apprentice", short: "TX Plumb. Appr.", label: { en: "Texas Plumber's Apprentice (TSBPE)", es: "Aprendiz de Plomero de Texas (TSBPE)" }, issuer: "Texas State Board of Plumbing Examiners", validityMonths: 12, estimated: true,
    verifyHow: "TSBPE public license / registration search.", keywords: ["plumber's apprentice", "plumbing apprentice", "aprendiz de plomero", "tsbpe"] },
  { id: "tsbpe_journeyman", short: "TX Journeyman Plumb.", label: { en: "Texas Journeyman Plumber (TSBPE)", es: "Plomero Journeyman de Texas (TSBPE)" }, issuer: "Texas State Board of Plumbing Examiners", validityMonths: 12, estimated: true,
    verifyHow: "TSBPE public license / registration search.", keywords: ["journeyman plumber", "plomero journeyman"] },
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

export const tradeSectors = (id: string | null | undefined): Sector[] => (id && TRADE_BY_ID[id]?.sectors) || [];
export const isEntryTrade = (id: string | null | undefined) => Boolean(id && TRADE_BY_ID[id]?.entry);
/** Default sector for a job in this trade (its first listed sector). */
export const defaultSector = (trade: string): Sector => TRADE_BY_ID[trade]?.sectors[0] ?? "construction";

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
