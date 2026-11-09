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
    const orden = [...RUBROS_TURNOS.filter((r) => r.excluido), ...RUBROS_TURNOS.filter((r) => !r.excluido)];
    // "medicina" va al final: "consultorio" aparece en casi todos.
    orden.sort((a, b) => (a.id === "medicina" ? 1 : 0) - (b.id === "medicina" ? 1 : 0));
    return orden.find((r) => r.claves.some((k) => texto.includes(k)));
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
    const sarvo = sarvoDe(p);
    if (!sarvo.escaneado_at) return "Sin escanear";
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

/** El primer nombre, si hay uno cargado que parezca de persona. */
export function primerNombre(p: Pick<Prospecto, "contacto_nombre">): string {
    const limpio = (p.contacto_nombre || "")
        .replace(/^(lic|lic\.|dra|dra\.|dr|dr\.|od|od\.|klgo|klga|prof|nutr)\.?\s+/i, "")
        .trim();
    const nombre = limpio.split(/\s+/)[0] || "";
    return /^[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}$/.test(nombre) ? nombre : "";
}

function hola(p: Prospecto): string {
    const n = primerNombre(p);
    return n ? `Hola ${n}!` : "Hola!";
}

/** La primera línea: lo que solo es verdad de este negocio. Sin dato, no inventa. */
function primeraLinea(p: Prospecto): string {
    const dato = (p.dato_usado || "").trim().replace(/\.$/, "");
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

    switch (paso) {
        case "m1": {
            if (seg === "centro" && !primerNombre(p)) return generarMensajeTurnos("m1_recepcion", p, canal);

            const apertura = presentado
                ? `${hola(p)} Soy Gastón, de Galu. Me pasó tu contacto ${presentado}.`
                : `${hola(p)} Soy Gastón, de Galu.${linea ? ` ${linea}` : ""}`;

            if (seg === "centro") {
                return [
                    `${apertura} Te escribo a vos y no al WhatsApp de ${negocio} porque es una pregunta para quien decide: qué pasa con los mensajes que les llegan a la noche, los domingos y en enero, cuando no hay nadie en recepción?`,
                    nivel === "A"
                        ? `Armé la página de turnos de ${negocio} con sus servicios: contesta precio y horarios y da el turno con la agenda real, a cualquier hora. A tu recepcionista le saca lo repetitivo, no la reemplaza. Mirala: ${demo}`
                        : `Armé una página de turnos que contesta precio y horarios y da el turno con la agenda real, a cualquier hora. A la recepcionista le saca lo repetitivo, no la reemplaza. Te la armo con los servicios de ${negocio} y te mando un video de 30 segundos?`,
                ].join("\n\n");
            }

            if (canal === "instagram") {
                return nivel === "A"
                    ? `${apertura} Te armé una página de turnos con tus servicios y tus precios, que le contesta a tus ${cliente} y les da el turno sola, a cualquier hora. Mirala: ${demo}\n\nLa estoy dejando gratis un mes a 6 profesionales de acá. Si te sirve, es tuya.`
                    : `${apertura} Armé una página de turnos que le contesta a tus ${cliente} el precio y los horarios y les da el turno sola, a cualquier hora. Te la armo con tus servicios para que la pruebes?`;
            }

            return nivel === "A"
                ? [
                      apertura,
                      `Te armé esto con tus servicios y tus precios: ${demo}`,
                      `Es tu página de turnos: le contesta a tus ${cliente} el precio y los horarios a cualquier hora, mira tu agenda y les da el turno. Vos les mandás el link en vez de ir y venir con horarios.`,
                      `La estoy dejando andando gratis un mes a 6 profesionales de acá. La probás como si fueras ${cliente === "clientas" ? "una clienta" : "un paciente"}?`,
                  ].join("\n\n")
                : [
                      apertura,
                      `Armé una página de turnos que le contesta a tus ${cliente} el precio y los horarios a cualquier hora, mira tu agenda real y les da el turno. Vos les mandás el link en vez de ir y venir con horarios.`,
                      `La estoy dejando gratis un mes a 6 profesionales de acá. Te paso ${r?.ejemplo || "una de ejemplo"} para que la pruebes como si fueras ${cliente === "clientas" ? "una clienta" : "un paciente"}? Es un minuto.`,
                  ].join("\n\n");
        }

        case "m1_recepcion":
            return [
                `Hola! Sos vos la que contesta el WhatsApp de ${negocio}? Te escribo a vos porque esto te saca trabajo a vos: armé una página de turnos que contesta sola el "cuánto sale" y el "tenés lugar", y deja el turno en la agenda. A la noche y los domingos también.`,
                `Me decís quién lo decide ahí? Le mando a esa persona un video de 30 segundos y le digo que vos lo viste primero.`,
            ].join("\n\n");

        case "fu1":
            return `${primerNombre(p) ? `${primerNombre(p)}, l` : "L"}legaste a verlo? Te dejo esto que armé para ${r ? r.label.toLowerCase() : "negocios con turnos"}, sirve aunque no uses nada mío: ${linkRecurso(p)}`;

        case "fu2":
            return `${primerNombre(p) ? `${primerNombre(p)}, n` : "N"}o te escribo más por esto 🙂 Te dejo la página armada o la borro? Cualquiera de las dos está perfecto.`;

        case "link":
            return demo
                ? `Acá está: ${demo}\n\nEscribile como si fueras ${cliente === "clientas" ? "una clienta" : "un paciente"}: preguntale el precio, un horario, lo que quieras. ${nivel === "A" ? "Tiene tus servicios y tus precios." : "Si te gusta, te armo la tuya con tus servicios y tus precios hoy mismo."}`
                : `Te la armo con tus servicios y tus precios y te la mando hoy. Me pasás qué servicios hacés, cuánto sale cada uno y tus horarios? (o te los saco de tu Instagram si están ahí)`;

        case "llamada":
            return `Buenísimo! Tenés 15 minutos hoy o mañana? Te lo dejo andando con tus horarios y te muestro dónde poner el link para que te empiecen a entrar los turnos. No tenés que configurar nada: lo cargo yo.`;

        case "precio":
            return `El primer mes es gratis, y te lo cargo yo. Después son ${PRECIO_NIVEL_1 || "[PRECIO DEL NIVEL 1 — se decide el 13/11]"} por mes, en pesos y con el precio congelado seis meses. Y si en el mes no te entran turnos por la página, lo apagamos y no pagás nada.`;

        case "referido":
            return [
                `Tenés dos colegas a los que les pase lo mismo con los mensajes? Si les mandás esto, les armo la suya:`,
                `"Te paso el contacto de Gastón, de Galu. Me armó una página de turnos que le contesta a mis ${cliente} el precio y los horarios y les da el turno sola. La está dejando gratis un mes a algunos profesionales."`,
            ].join("\n\n");

        case "no_interesa":
            return `Gracias por decírmelo! Una sola cosa: conocés a algún colega al que le escriban mucho por turnos? Si me pasás el contacto, le escribo yo de tu parte.`;
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
