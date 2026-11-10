// ============================================================
// Sarvo — prospección de negocios con turnos (desde el 2026-11-09)
//
// Reemplaza al guion de odontología y la prueba de la hora. El método está en
// la nota "Sistema de adquisición" del panel de galu-web (02b):
//
//   · El cliente principal es el PROFESIONAL QUE CONTESTA SU PROPIO WHATSAPP
//     (segmento "solo"): lee el mensaje, siente el problema y decide.
//   · Al centro con recepción (segmento "centro") se le escribe al dueño o a la
//     recepcionista como la que lo va a usar, nunca un mensaje genérico.
//   · Lo que se manda es su negocio andando: su página armada (nivel A, el link
//     va en `revision_url`) o la demo de su rubro (nivel B).
//   · Tres mensajes en ocho días: el primero, el día 3 con un recurso, el día 8
//     el cierre. Después se cierra hasta febrero.
//   · Sin "IA", "bot", "agente" ni "automatización" en el primer mensaje.
//
// Este módulo es PURO (sin red, sin Supabase) y no importa de prospeccion.ts,
// que lo importa a él: así no hay ciclo.
// ============================================================

import type { Prospecto, EscaneoSarvo, SegmentoTurnos } from "./types";
import { ESCANEO_SARVO_VACIO } from "./types";

const sinTildes = (s: string) =>
    (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// ─────────────────────────────────────────────────────────────
// Configuración que se decide afuera del código
// ─────────────────────────────────────────────────────────────

/** Dónde viven las páginas de turnos. Cambiarlo acá cuando se compre sarvo.app. */
export const BASE_PAGINAS = "https://sarvo-app.vercel.app";

/** Dónde viven los recursos gratis de Galu. */
export const BASE_RECURSOS = "https://galuweb.com/recursos";

/**
 * El precio del nivel 1 después del mes gratis. Vacío = todavía no se decidió
 * (la dirección del viernes 13/11). Mientras esté vacío, el mensaje de precio
 * sale con un marcador entre corchetes para que no se mande así.
 */
export const PRECIO_NIVEL_1 = "";

/** Cuántos toques nuevos por día pide el sistema (nota 02b, §7). */
export const CUOTA_DIARIA = 12;

/**
 * WhatsApp limitaría las conversaciones nuevas a unas 150 por mes por cuenta
 * (Noticias RCN, 28/9/2026). Se cuenta para avisar antes de llegar.
 */
export const LIMITE_CHATS_NUEVOS_MES = 150;

// ─────────────────────────────────────────────────────────────
// Los rubros
// ─────────────────────────────────────────────────────────────

export interface RubroTurnos {
    id: string;
    label: string;
    /** Qué se busca en Google Maps para traer este rubro. */
    busquedas: string[];
    /** Para detectar el rubro desde el nombre, la categoría de Google o el rubro cargado. */
    claves: string[];
    /** Cuánto suma al score: es el orden de la nota 02b, §2.3. */
    prioridad: number;
    /** La demo del rubro en Sarvo (sin la base). "" = no hay: se arma la suya. */
    demo: string;
    /** El recurso gratis para el seguimiento del día 3. */
    recurso: string;
    /** Cómo se le dice al cliente del negocio. */
    cliente: string;
    /** Cómo se nombra la demo en el mensaje B: "te paso [la de un consultorio de nutrición]". */
    ejemplo: string;
    /** Para quién es la página, en el mensaje B: "hice una página de turnos para [consultorios de nutrición]". */
    para: string;
    /** Si está afuera, por qué. Un rubro excluido nunca entra a la cola. */
    excluido?: string;
}

export const RUBROS_TURNOS: RubroTurnos[] = [
    {
        id: "estetica",
        label: "Estética",
        busquedas: ["cosmetóloga", "centro de estética", "depilación definitiva", "lifting de pestañas"],
        claves: ["estetic", "cosmet", "depilac", "pestan", "facial", "spa", "belleza", "cejas", "lash", "beauty", "skin"],
        prioridad: 14,
        demo: "estetica-luna",
        recurso: "link-de-turnos-consultorio",
        cliente: "clientas",
        ejemplo: "la de un centro de estética",
        para: "centros de estética",
    },
    {
        id: "nutricion",
        label: "Nutrición",
        busquedas: ["nutricionista", "licenciada en nutrición"],
        claves: ["nutric", "dietist"],
        prioridad: 14,
        demo: "nutricion-semilla",
        recurso: "mensajes-precio-consulta-nutricion",
        cliente: "pacientes",
        ejemplo: "la de un consultorio de nutrición",
        para: "consultorios de nutrición",
    },
    {
        id: "kinesiologia",
        label: "Kinesiología",
        busquedas: ["kinesiólogo", "kinesiología", "fisioterapia"],
        claves: ["kinesi", "fisioter", "rehabilit", "osteopat", "quiropr"],
        prioridad: 10,
        demo: "kinesio-movimiento",
        recurso: "link-de-turnos-consultorio",
        cliente: "pacientes",
        ejemplo: "la de un consultorio de kinesiología",
        para: "kinesiólogos",
    },
    {
        id: "odontologia",
        label: "Odontología",
        busquedas: ["odontólogo", "consultorio odontológico", "dentista"],
        claves: ["odontolog", "dentist", "dental", "ortodon", "implant", "endodon"],
        prioridad: 10,
        demo: "odontologia-brisa",
        recurso: "paciente-con-miedo-odontologia",
        cliente: "pacientes",
        ejemplo: "la de un consultorio odontológico",
        para: "consultorios odontológicos",
    },
    {
        id: "podologia",
        label: "Podología",
        busquedas: ["podólogo", "podología"],
        claves: ["podolog", "pedicur"],
        prioridad: 7,
        demo: "",
        recurso: "link-de-turnos-consultorio",
        cliente: "pacientes",
        ejemplo: "una de ejemplo",
        para: "podólogos",
    },
    {
        id: "fonoaudiologia",
        label: "Fonoaudiología y psicopedagogía",
        busquedas: ["fonoaudióloga", "psicopedagoga"],
        claves: ["fonoaud", "psicopedag", "logoped"],
        prioridad: 7,
        demo: "",
        recurso: "link-de-turnos-consultorio",
        cliente: "pacientes",
        ejemplo: "una de ejemplo",
        para: "fonoaudiólogas y psicopedagogas",
    },
    {
        id: "psicologia",
        label: "Psicología",
        busquedas: ["psicóloga", "psicólogo"],
        claves: ["psicolog", "psicoter", "terapia"],
        prioridad: 5,
        demo: "",
        recurso: "mensajes-recordatorio-turno-psicologia",
        cliente: "pacientes",
        ejemplo: "una de ejemplo",
        para: "psicólogos",
    },
    {
        id: "veterinaria",
        label: "Veterinaria",
        busquedas: ["veterinaria", "peluquería canina"],
        claves: ["veterin", "mascota", "canin", "pet "],
        prioridad: 5,
        demo: "veterinaria-patitas",
        recurso: "link-de-turnos-consultorio",
        cliente: "clientes",
        ejemplo: "la de una veterinaria",
        para: "veterinarias",
    },
    {
        id: "medicina",
        label: "Consultorio médico",
        busquedas: ["consultorio médico"],
        claves: ["medic", "clinica", "dermatolog", "pediatr", "ginecolog", "traumatolog", "consultorio"],
        prioridad: 3,
        demo: "",
        recurso: "link-de-turnos-consultorio",
        cliente: "pacientes",
        ejemplo: "una de ejemplo",
        para: "consultorios médicos",
    },
    {
        id: "clases",
        label: "Pilates, yoga y gimnasios",
        busquedas: [],
        claves: ["pilates", "yoga", "gimnas", "gym", "crossfit", "funcional", "fitness", "entrenamiento"],
        prioridad: 0,
        demo: "",
        recurso: "",
        cliente: "alumnos",
        ejemplo: "",
        para: "",
        excluido: "Sarvo da turnos de uno a uno y no maneja clases con cupo",
    },
    {
        id: "peluqueria",
        label: "Peluquerías y barberías",
        busquedas: [],
        claves: ["peluquer", "barber", "estilist", "hair"],
        prioridad: 0,
        demo: "",
        recurso: "",
        cliente: "clientes",
        ejemplo: "",
        para: "",
        excluido: "Fuera del plan, igual que en el contenido",
    },
];

export const RUBROS_ACTIVOS = RUBROS_TURNOS.filter((r) => !r.excluido);

export function rubroPorId(id: string): RubroTurnos | undefined {
    return RUBROS_TURNOS.find((r) => r.id === id);
}

/**
 * De qué rubro es. Mira primero lo que dejó el escaneo, después el texto. Los
 * excluidos se chequean antes que el resto porque "centro de pilates y estética"
 * tiene que salir como excluido, no como estética.
 */
export function rubroTurnosDe(p: Pick<Prospecto, "rubro" | "especialidad" | "negocio"> & { escaneo?: Prospecto["escaneo"] }): RubroTurnos | undefined {
    const guardado = p.escaneo?.sarvo?.rubro;
    if (guardado) {
        const r = rubroPorId(guardado);
        if (r) return r;
    }
    const texto = sinTildes(`${p.rubro} ${p.especialidad} ${p.negocio}`);
    if (!texto) return undefined;
    const excluido = RUBROS_TURNOS.find((r) => r.excluido && r.claves.some((k) => texto.includes(k)));
    if (excluido) return excluido;
    // "medicina" va al final: "consultorio" aparece en casi todos.
    const activos = [...RUBROS_ACTIVOS].sort((a, b) => (a.id === "medicina" ? 1 : 0) - (b.id === "medicina" ? 1 : 0));
    // El rubro cargado al importar ("Nutricionistas") gana sobre el nombre del
    // negocio: "Alicia Sosa Nutrición y Estética" es una nutricionista que salió
    // en esa búsqueda, no un centro de estética.
    const rubroCargado = sinTildes(`${p.rubro} ${p.especialidad}`);
    const porRubro = rubroCargado ? activos.find((r) => r.claves.some((k) => rubroCargado.includes(k))) : undefined;
    return porRubro || activos.find((r) => r.claves.some((k) => texto.includes(k)));
}

// ─────────────────────────────────────────────────────────────
// Segmento y nivel
// ─────────────────────────────────────────────────────────────

export function sarvoDe(p: Pick<Prospecto, "escaneo">): EscaneoSarvo {
    return { ...ESCANEO_SARVO_VACIO, ...(p.escaneo?.sarvo || {}) };
}

/** Sale del escaneo; si no hay, de la cantidad de profesionales cargada. */
export function segmentoDe(p: Pick<Prospecto, "escaneo" | "cant_profesionales">): SegmentoTurnos {
    const s = p.escaneo?.sarvo?.segmento;
    if (s && s !== "sin_definir") return s;
    if (p.cant_profesionales != null) return p.cant_profesionales <= 2 ? "solo" : "centro";
    return "sin_definir";
}

export const SEGMENTO_LABELS: Record<SegmentoTurnos, string> = {
    solo: "Contesta él",
    centro: "Centro con recepción",
    sin_definir: "Sin definir",
};

/** A = tiene su página armada (el link va en revision_url). B = la demo del rubro. */
export function nivelDe(p: Pick<Prospecto, "revision_url">): "A" | "B" {
    return p.revision_url.trim() ? "A" : "B";
}

export function linkDemo(p: Prospecto): string {
    if (p.revision_url.trim()) return p.revision_url.trim();
    const r = rubroTurnosDe(p);
    return r?.demo ? `${BASE_PAGINAS}/${r.demo}` : "";
}

export function linkRecurso(p: Prospecto): string {
    const r = rubroTurnosDe(p);
    return `${BASE_RECURSOS}/${r?.recurso || "link-de-turnos-consultorio"}`;
}

/** Si está afuera de la cola de Sarvo, por qué. null = se puede trabajar. */
export function motivoFueraTurnos(p: Prospecto): string | null {
    const r = rubroTurnosDe(p);
    if (r?.excluido) return r.excluido;
    if (!p.telefono_wa.trim() && !p.instagram_url.trim()) {
        return p.escaneo?.sarvo?.escaneado_at ? "Sin WhatsApp ni Instagram" : "Sin escanear: el escaneo trae el teléfono";
    }
    // Sin escanear pero con canal entra igual: se puede revisar a mano en la
    // tarjeta (o escanear ahí mismo). Queda más abajo porque su score es menor.
    return null;
}

// ─────────────────────────────────────────────────────────────
// El score
// ─────────────────────────────────────────────────────────────

export interface ParteScore { concepto: string; puntos: number }

/**
 * Qué tan probable es que conteste y entre como fundador. El orden de lo que pesa
 * es el de la nota: que lo hayan presentado, que conteste él, el rubro, el canal.
 */
export function scoreTurnos(p: Prospecto): { total: number; partes: ParteScore[] } {
    const partes: ParteScore[] = [];
    const r = rubroTurnosDe(p);
    if (r?.excluido) return { total: 0, partes: [{ concepto: r.excluido, puntos: 0 }] };

    const sarvo = sarvoDe(p);

    if (sarvo.presentado_por.trim()) {
        partes.push({ concepto: `Lo presentó ${sarvo.presentado_por}`, puntos: 25 });
    }

    const seg = segmentoDe(p);
    if (seg === "solo") partes.push({ concepto: "Contesta él: lee, siente el problema y decide", puntos: 30 });
    else if (seg === "centro") partes.push({ concepto: "Centro con recepción: hay que llegar al dueño", puntos: 12 });
    else partes.push({ concepto: "Segmento sin definir", puntos: 8 });

    if (r) partes.push({ concepto: `Rubro: ${r.label}`, puntos: r.prioridad });
    else partes.push({ concepto: "Rubro sin detectar", puntos: 0 });

    if (p.telefono_wa.trim()) partes.push({ concepto: "WhatsApp a la vista", puntos: 15 });
    else if (p.instagram_url.trim()) partes.push({ concepto: "Solo Instagram", puntos: 10 });
    else partes.push({ concepto: "Sin canal cargado", puntos: 0 });

    const rev = p.reviews_count;
    if (rev != null) {
        if (rev >= 50) partes.push({ concepto: `${rev} reseñas: mucho movimiento`, puntos: 10 });
        else if (rev >= 15) partes.push({ concepto: `${rev} reseñas`, puntos: 6 });
        else if (rev < 3) partes.push({ concepto: `${rev} reseñas: poco movimiento`, puntos: -5 });
    }

    if (sarvo.precios_publicados) partes.push({ concepto: "Publica precios: se le puede armar su página", puntos: 8 });
    if (p.revision_url.trim()) partes.push({ concepto: "Su página ya está armada", puntos: 10 });
    if (sarvo.link_turnos.trim()) {
        partes.push({ concepto: `Ya usa un sistema de turnos (${sarvo.link_turnos})`, puntos: -15 });
    }

    const total = Math.max(0, Math.min(100, partes.reduce((s, x) => s + x.puntos, 0)));
    return { total, partes };
}

// ─────────────────────────────────────────────────────────────
// Los mensajes
// ─────────────────────────────────────────────────────────────

export type PasoTurnos =
    | "m1"            // el primero: cambia solo según segmento, canal y nivel
    | "m1_recepcion"  // centro sin dueño a la vista: a la recepcionista
    | "fu1"           // día 3, con el recurso
    | "fu2"           // día 8, el cierre
    | "link"          // dijo "pasame": el link
    | "llamada"       // probó: los 15 minutos
    | "precio"        // preguntó cuánto sale
    | "referido"      // fundador en el día 7 o el 30: dos colegas
    | "no_interesa";  // dijo que no: un nombre

export const PASO_TURNOS_LABELS: Record<PasoTurnos, string> = {
    m1: "Mensaje 1",
    m1_recepcion: "Mensaje 1 — a la recepcionista",
    fu1: "Día 3 — con un recurso",
    fu2: "Día 8 — el cierre",
    link: "Dijo que sí: el link",
    llamada: "Probó: los 15 minutos",
    precio: "Preguntó el precio",
    referido: "Fundador: dos colegas",
    no_interesa: "Dijo que no: un nombre",
};

export type CanalTurnos = "whatsapp" | "instagram";

const TITULO = /^(lic\.?|licenciad[oa]|dra?\.?|od\.?|odont\.?|klgo\.?|klga\.?|kinesi[oó]log[oa]|nutricionista|nutr\.?|psic\.?|psic[oó]log[oa]|cosmet[oó]loga|pod[oó]log[oa]|fonoaudi[oó]log[oa]|prof\.?|en|nutrici[oó]n)\s+/i;
const NO_ES_NOMBRE = /^(consultorio|centro|cl[ií]nica|instituto|estudio|espacio|nutrici[oó]n|salud|integral|deportiva|vida|equipo)$/i;

/**
 * "Nutricionista Lic. Santiago Escobar | Tucumán" → "Santiago Escobar". Solo si
 * el negocio arranca con un título: "Alicia Sosa Nutrición" no se toca (puede
 * ser una marca) y "Nutrición Integral" tampoco.
 */
export function nombreDesdeNegocio(negocio: string): string {
    // "Lic. en Nutrición - Julieta Moreyra", "Nutriform - Licenciada Priscila
    // Aiachini": el nombre puede estar en cualquier tramo del nombre de Google.
    const tramos = (negocio || "").split(/\s[|·–—-]\s|\s?\|\s?|,\s|\s+by\s+/i).map((t) => t.trim()).filter(Boolean);
    for (const t of tramos) {
        const n = nombreDeTramo(t);
        if (n) return n;
    }
    // "Lic. en Nutrición - Julieta Moreyra": el título en un tramo y el nombre en el siguiente.
    for (let i = 0; i + 1 < tramos.length; i++) {
        if (TITULO.test(`${tramos[i]} `) && !nombreDeTramo(tramos[i])) {
            const n = nombreDeTramo(`Lic. ${tramos[i + 1]}`);
            if (n) return n;
        }
    }
    return "";
}

function nombreDeTramo(tramo: string): string {
    let resto = tramo.trim();
    let conTitulo = false;
    for (let i = 0; i < 4 && TITULO.test(resto); i++) {
        resto = resto.replace(TITULO, "").trim();
        conTitulo = true;
    }
    if (!conTitulo) return "";
    const palabras = resto.split(/\s+/).filter(Boolean).slice(0, 3);
    const nombre: string[] = [];
    for (const w of palabras) {
        if (!/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(w) || NO_ES_NOMBRE.test(w)) break;
        nombre.push(w);
    }
    return nombre.join(" ");
}

/** El primer nombre: el cargado y, si no hay, el que se ve en el nombre del negocio. */
export function primerNombre(p: Pick<Prospecto, "contacto_nombre"> & { negocio?: string }): string {
    const limpio = (p.contacto_nombre || nombreDesdeNegocio(p.negocio || ""))
        .replace(/^(lic|lic\.|dra|dra\.|dr|dr\.|od|od\.|klgo|klga|prof|nutr)\.?\s+/i, "")
        .trim();
    const nombre = limpio.split(/\s+/)[0] || "";
    return /^[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}$/.test(nombre) ? nombre : "";
}

/** Los que trae Traer o el importador son de Tucumán: ahí se dice "de acá". */
function soyGaston(p: Prospecto): string {
    return /tucum|yerba buena|taf[ií]|banda del r|concepci|lules|famaill/i.test(`${p.ciudad} ${p.direccion}`)
        ? "Soy Gastón, de acá de Tucumán."
        : "Soy Gastón.";
}

function hola(p: Prospecto): string {
    const n = primerNombre(p);
    return n ? `Hola ${n}, cómo estás?` : "Hola, cómo estás?";
}

/** "como si fueras una clienta" / "un paciente" / "un cliente". */
function comoSiFueras(cliente: string): string {
    if (cliente === "clientas") return "una clienta";
    if (cliente === "clientes") return "un cliente";
    if (cliente === "alumnos") return "un alumno";
    return "un paciente";
}

/**
 * "Vi las 53 reseñas que tenés en Google" la ponía el escaneo cuando no tenía
 * nada mejor: suena a robot que te espía y no dice nada de él. Se ignora.
 */
export function lineaUtil(dato: string): string {
    const t = (dato || "").trim();
    return /^vi las \d+ rese[ñn]as que ten[ée]s en google\.?$/i.test(t) ? "" : t;
}

/** La primera línea: lo que solo es verdad de este negocio. Sin dato, no inventa. */
function primeraLinea(p: Prospecto): string {
    const dato = lineaUtil(p.dato_usado).replace(/\.$/, "");
    return dato ? `${dato}.` : "";
}

export function generarMensajeTurnos(paso: PasoTurnos, p: Prospecto, canal: CanalTurnos = canalTurnos(p)): string {
    const r = rubroTurnosDe(p);
    const sarvo = sarvoDe(p);
    const seg = segmentoDe(p);
    const cliente = r?.cliente || "clientes";
    const demo = linkDemo(p);
    const nivel = nivelDe(p);
    const negocio = nombreCorto(p.negocio);
    const linea = primeraLinea(p);
    const presentado = sarvo.presentado_por.trim();
    const comoCliente = comoSiFueras(cliente);
    const nombre = primerNombre(p);
    const soy = soyGaston(p);
    const para = r?.para || "negocios con turnos";

    // Quién escribe: "Gastón, de Galu" no le dice nada a nadie, y un nombre de
    // empresa que no conocen suena a venta o a estafa. Se presenta como persona
    // y de dónde es, y lo que hace sale en la frase siguiente. El perfil de
    // WhatsApp Business (foto, nombre, descripción) completa el resto.
    //
    // Cómo se escriben: cortos, como desde el celular. Una idea por burbuja, una
    // sola pregunta al final, sin listas de tres, sin guiones largos y sin "no X,
    // sino Y". Si un mensaje empieza a sonar a folleto, está mal.
    switch (paso) {
        case "m1": {
            if (seg === "centro" && !nombre) return generarMensajeTurnos("m1_recepcion", p, canal);

            const apertura = presentado
                ? `${hola(p)} ${soy} ${presentado} me pasó tu contacto.`
                : `${hola(p)} ${soy}${linea ? ` ${linea}` : ""}`;

            if (seg === "centro") {
                return [
                    `${apertura} Te escribo a vos porque es algo que se decide arriba en ${negocio}. Cuando les escriben a la noche o un domingo y no hay nadie en recepción, esa consulta queda esperando hasta el otro día?`,
                    nivel === "A"
                        ? `Les hice una página de turnos con sus servicios. Contesta el precio y los horarios y da el turno con la agenda real, a la hora que sea. A la recepción le saca las preguntas de siempre. Mirala: ${demo}`
                        : `Hice una página de turnos para ${para} que contesta el precio y los horarios y da el turno con la agenda real, a la hora que sea. A la recepción le saca las preguntas de siempre. Si te interesa, la armo con los servicios de ${negocio} y te mando un video de 30 segundos.`,
                ].join("\n\n");
            }

            if (canal === "instagram") {
                return nivel === "A"
                    ? `${apertura} Hice una página de turnos para vos, con tus servicios y tus precios, para que tus ${cliente} saquen turno solos: ${demo}\n\nEste mes la dejo gratis a 6 profesionales de acá. Si te sirve, es tuya.`
                    : `${apertura} Hice una página de turnos para ${para}: tus ${cliente} ven el precio y sacan turno solos, sin tener que escribirte. Te armo la tuya con tus servicios para que la pruebes?`;
            }

            return nivel === "A"
                ? [
                      apertura,
                      `Hice una página de turnos para vos, con tus servicios y tus precios: ${demo}`,
                      `Tus ${cliente} ven el precio y sacan turno solos, aunque sea a la noche. Te ahorrás el ida y vuelta de "tenés lugar el jueves?".`,
                      `Este mes la dejo andando gratis a 6 profesionales de acá. Probala como si fueras ${comoCliente} y decime qué te parece.`,
                  ].join("\n\n")
                : [
                      apertura,
                      `Hice una página de turnos para ${para}: tus ${cliente} ven el precio y sacan turno solos, con tu agenda real. Así no tenés que contestar uno por uno.`,
                      `Este mes la dejo gratis a 6 profesionales de acá. Te paso una de ejemplo así la probás?`,
                  ].join("\n\n");
        }

        case "m1_recepcion":
            return [
                `Hola, cómo estás? Vos sos la que contesta el WhatsApp de ${negocio}? ${soy} Hice una página de turnos para ${para} que responde sola el "cuánto sale" y el "tenés lugar", y deja el turno anotado en la agenda. También a la noche y los domingos.`,
                `Quién decide estas cosas ahí? Le mando un video de 30 segundos y le cuento que lo viste vos primero.`,
            ].join("\n\n");

        case "fu1":
            return `${nombre ? `${nombre}, p` : "P"}udiste verlo? Te dejo algo que armé para ${r ? r.label.toLowerCase() : "negocios con turnos"}, te sirve uses lo mío o no: ${linkRecurso(p)}`;

        case "fu2":
            return `${nombre ? `${nombre}, e` : "E"}s la última vez que te escribo por esto 🙂 Te dejo la página armada o la borro? Cualquiera de las dos me sirve.`;

        case "link":
            return demo
                ? `Acá la tenés: ${demo}\n\nEscribile como si fueras ${comoCliente}, preguntale el precio o pedile un horario. ${nivel === "A" ? "Ya tiene tus servicios y tus precios." : "Si te gusta, hoy te armo la tuya con tus servicios y tus precios."}`
                : `Dale, te la armo y te la mando hoy. Me pasás qué servicios hacés, cuánto sale cada uno y en qué horarios atendés? Si está todo en tu Instagram, lo saco de ahí.`;

        case "llamada":
            return `Buenísimo! Tenés 15 minutos hoy o mañana? La dejo andando con tus horarios y te muestro dónde poner el link para que te empiecen a entrar turnos. La cargo yo, vos no tenés que configurar nada.`;

        case "precio":
            return `El primer mes es gratis y la cargo yo. Después son ${PRECIO_NIVEL_1 || "[PRECIO DEL NIVEL 1 — se decide el 13/11]"} por mes, en pesos, y ese precio te queda fijo seis meses. Si en el mes no te entra ningún turno por la página, la apagamos y no pagás nada.`;

        case "referido":
            return [
                `Tenés un par de colegas a los que les escriban mucho para sacar turno? Si les reenviás esto, les armo la suya:`,
                `"Te paso el contacto de Gastón. Me hizo una página donde mis ${cliente} ven el precio y sacan turno solos. La está dejando gratis un mes a algunos profesionales."`,
            ].join("\n\n");

        case "no_interesa":
            return `Gracias por avisarme! Te pregunto una sola cosa: conocés a algún colega al que le escriban mucho para sacar turno? Si me pasás el contacto, le escribo yo y le digo que vengo de tu parte.`;
    }
}

/** WhatsApp si hay número; si no, Instagram. */
export function canalTurnos(p: Pick<Prospecto, "telefono_wa" | "instagram_url">): CanalTurnos {
    return p.telefono_wa.trim() ? "whatsapp" : "instagram";
}

/** El nombre de Google suele traer SEO pegado ("Lic. X | Nutrición deportiva | Tucumán"). */
export function nombreCorto(negocio: string): string {
    return (negocio || "").split(/\s[|·–—-]\s|\s\|\s?|,\s/)[0].trim() || negocio;
}

// ─────────────────────────────────────────────────────────────
// La ficha para cargarlo en Sarvo
// ─────────────────────────────────────────────────────────────

/** Una dirección de página sugerida a partir del nombre: "Lic. Paz · Nutrición" → "lic-paz-nutricion". */
export function slugSugerido(negocio: string): string {
    return sinTildes(nombreCorto(negocio))
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
}

/** El texto para copiar y armar el negocio en /admin de Sarvo sin volver a buscar nada. */
export function fichaParaSarvo(p: Prospecto): string {
    const r = rubroTurnosDe(p);
    const sarvo = sarvoDe(p);
    return [
        `Negocio: ${nombreCorto(p.negocio)}`,
        `Dirección de la página: ${slugSugerido(p.negocio)}`,
        `Rubro: ${r?.label || p.rubro || "(elegir)"}`,
        p.contacto_nombre ? `Profesional: ${p.contacto_nombre}` : "",
        p.direccion ? `Dirección: ${p.direccion}` : "",
        p.telefono ? `Teléfono: ${p.telefono}` : "",
        p.instagram_url ? `Instagram: ${p.instagram_url}` : "",
        p.sitio_web_url ? `Web: ${p.sitio_web_url}` : "",
        p.maps_url ? `Maps: ${p.maps_url}` : "",
        sarvo.precios_publicados ? "Publica precios: copiarlos de la web o de Instagram." : "No se vieron precios publicados: pedírselos o sacarlos de Instagram.",
        sarvo.evidencias.length ? `Lo que se vio: ${sarvo.evidencias.join(" · ")}` : "",
        `Cuando esté armada, pegá el link en la ficha del CRM ("Su página") y el mensaje pasa solo al nivel A.`,
    ]
        .filter(Boolean)
        .join("\n");
}

// ─────────────────────────────────────────────────────────────
// Contadores del día y del mes
// ─────────────────────────────────────────────────────────────

/**
 * Chats nuevos abiertos este mes desde el WhatsApp de Galu. Solo cuenta Sarvo:
 * las agencias salen de tu WhatsApp personal, que es otra cuenta con su propio límite.
 */
export function chatsNuevosDelMes(universo: Prospecto[], hoy: Date = new Date()): number {
    const mes = hoy.toLocaleDateString("en-CA").slice(0, 7);
    return universo.filter(
        (p) => p.sistema === "odontologia" && p.canal === "whatsapp" && (p.fecha_envio || "").startsWith(mes)
    ).length;
}
