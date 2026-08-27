// ============================================================
// Escaneo automático — las señales que no necesitan ojo humano
//
// El escaneo manual (doc 08 §8, pases B y C) es lo que hace que un bloque de 20
// mensajes cueste dos horas: abrir seis pestañas por prospecto, leer reseñas
// buscando una queja usable y marcar los checkboxes a mano.
//
// Una parte de ese trabajo no requiere criterio, solo mirar el mismo campo
// siempre. Este módulo baja a código esa parte:
//
//   · web_es_instagram  → el campo "sitio web" de la ficha apunta a Instagram.
//     Es un string. No hay nada que interpretar.
//   · no_aparece_rubro  → buscar "especialidad en ciudad" y ver si está.
//     Es una búsqueda y una comparación de nombres.
//   · ficha_incompleta / web_lenta → salen de datos que la API ya devuelve.
//
// Las funciones de acá son PURAS: reciben lo que ya se trajo de la red y
// devuelven señales con su evidencia. La orquestación (Places, SERP, fetch del
// sitio, Gemini) vive en app/api/prospeccion/escanear/route.ts, igual que
// prospeccion.ts es puro y las rutas hacen la red.
//
// Regla de oro de todo el módulo: NUNCA se marca una señal sin poder decir
// dónde se vio. Si no hay evidencia mostrable, no se marca. El sistema entero
// se apoya en que la línea 1 del mensaje sea verificable (§5, regla 16 del
// prompt de mensaje-prospecto); una señal marcada de más convierte el mensaje
// en una mentira que el prospecto puede comprobar en diez segundos.
// ============================================================

import type {
    Prospecto,
    EscaneoProspecto,
    FallaVerificable,
    ClasificacionWeb,
    DemandaBusqueda,
} from "./types";
import { FALLA_LABELS } from "./types";
import { normalizar, normalizarEscaneo } from "./prospeccion";
import { detectarRubro } from "./dolores-rubro";
import { pistaDemanda } from "./demanda-busqueda";

// ─────────────────────────────────────────────────────────────
// Lo que el escaneo automático produce
// ─────────────────────────────────────────────────────────────

/** De dónde salió la señal. Se muestra en el modal para poder auditarla. */
export type FuenteSenial = "maps" | "serp" | "web" | "resenas";

export const FUENTE_LABELS: Record<FuenteSenial, string> = {
    maps: "Ficha de Google",
    serp: "Búsqueda de Google",
    web: "Sitio web",
    resenas: "Reseñas",
};

export interface EvidenciaSenial {
    falla: FallaVerificable;
    fuente: FuenteSenial;
    /** Qué se vio exactamente, en una línea. Tiene que alcanzar para verificarlo a mano. */
    detalle: string;
    /** Dónde verificarlo. Vacío solo si la fuente no tiene una URL propia. */
    url?: string;
}

/** Lo que Gemini devuelve tras leer las reseñas. Nada de esto se marca sin revisar. */
export interface LecturaResenas {
    tiene_queja_cliente: boolean;
    /** Textual, tal cual la escribió el cliente. Si viene parafraseada, se descarta. */
    queja_textual: string;
    autor_queja: string;
    fecha_queja: string;
    fallas: FallaVerificable[];
    hito_reciente: string;
    detalle_trabajo: string;
}

export const LECTURA_VACIA: LecturaResenas = {
    tiene_queja_cliente: false,
    queja_textual: "",
    autor_queja: "",
    fecha_queja: "",
    fallas: [],
    hito_reciente: "",
    detalle_trabajo: "",
};

/** El resultado completo de escanear un prospecto. Es una PROPUESTA, no un guardado. */
export interface EscaneoAutomatico {
    prospecto_id: string;
    negocio: string;
    /** El escaneo ya fusionado con lo que había cargado a mano. */
    escaneo: EscaneoProspecto;
    /** Campos de calificación que también se pueden deducir (clasificación web, canal, etc.). */
    campos: Partial<Prospecto>;
    evidencias: EvidenciaSenial[];
    /** Señales que el robot agregó en esta corrida (las que ya estaban no se repiten). */
    agregadas: FallaVerificable[];
    /** Qué no se pudo mirar y por qué. Lo que queda para hacer a mano. */
    pendientes: string[];
    fecha: string;
}

/** Metadato que se persiste con el prospecto, para saber qué miró el robot y cuándo. */
export interface EscaneoAutoMeta {
    fecha: string;
    evidencias: EvidenciaSenial[];
    pendientes: string[];
    /** Pasa a true cuando la persona guarda el escaneo habiéndolo revisado. */
    confirmado: boolean;
}

// ─────────────────────────────────────────────────────────────
// Datos crudos que la orquestación trae de cada fuente
// ─────────────────────────────────────────────────────────────

export interface ResenaMaps {
    autor: string;
    rating: number | null;
    /** Texto tal cual. No se recorta: Gemini necesita la frase entera para citarla. */
    texto: string;
    fecha: string;
}

export interface DetallesMaps {
    sitio_web_url: string;
    telefono: string;
    maps_url: string;
    rating: number | null;
    reviews_count: number | null;
    tiene_horarios: boolean;
    tiene_descripcion: boolean;
    cant_fotos: number;
    resenas: ResenaMaps[];
}

export interface ResultadoSerp {
    termino: string;
    /** null = la búsqueda falló y no se puede afirmar nada. Distinto de false. */
    aparece: boolean | null;
    /** Los dominios de la primera pantalla — sirven para contarle quién sí aparece. */
    dominios: string[];
    proveedor: "cse" | "ddg";
}

export interface ChequeoWeb {
    url: string;
    /** null = no se pudo cargar (timeout, DNS, bloqueo). */
    ok: boolean | null;
    status: number | null;
    ms: number | null;
    tiene_viewport: boolean | null;
}

// ─────────────────────────────────────────────────────────────
// Los términos que se buscan
// ─────────────────────────────────────────────────────────────

/**
 * "abogado laboral en San Miguel de Tucumán" — el término con el que un cliente
 * lo buscaría, no el nombre del negocio. Es exactamente la consulta que la línea 1
 * de la señal no_aparece_rubro le va a citar al prospecto, así que tiene que
 * armarse igual acá y en dolores-rubro.ts.
 */
export function terminoDeRubro(p: Pick<Prospecto, "rubro" | "especialidad" | "ciudad">): string {
    const servicio = (p.especialidad || p.rubro || "").trim();
    const ciudad = (p.ciudad || "").trim();
    if (!servicio) return "";
    return ciudad ? `${servicio} en ${ciudad}` : servicio;
}

/** La búsqueda de control: el nombre exacto. Sin esto la señal no se puede afirmar. */
export function terminoDeNombre(p: Pick<Prospecto, "negocio" | "ciudad">): string {
    const negocio = (p.negocio || "").trim();
    if (!negocio) return "";
    const ciudad = (p.ciudad || "").trim();
    return ciudad ? `${negocio} ${ciudad}` : negocio;
}

// ─────────────────────────────────────────────────────────────
// ¿Está el negocio en estos resultados?
// ─────────────────────────────────────────────────────────────

/** Palabras que aparecen en el nombre de medio Tucumán y no identifican a nadie. */
const PALABRAS_VACIAS = new Set([
    "de", "del", "la", "el", "los", "las", "y", "en", "dr", "dra", "doctor", "doctora",
    "estudio", "centro", "consultorio", "clinica", "instituto", "grupo", "san", "santa",
    "integral", "integrales", "servicios", "asociados", "hnos", "hermanos", "sa", "srl",
]);

function tokensDeNombre(negocio: string): string[] {
    return normalizar(negocio)
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 3 && !PALABRAS_VACIAS.has(t));
}

/**
 * ¿Aparece el negocio en la primera pantalla de resultados?
 *
 * El criterio es deliberadamente GENEROSO: ante la duda, decimos que sí aparece.
 * Un falso negativo acá se convierte en un mensaje que le afirma al prospecto
 * "no aparecés cuando te buscan" siendo mentira — y eso quema el prospecto para
 * siempre. Un falso positivo solo hace que la señal no se marque y el escaneo
 * quede para hacer a mano, que es exactamente donde estábamos antes.
 */
export function apareceEnResultados(
    negocio: string,
    resultados: { titulo: string; url: string; resumen: string }[]
): boolean {
    const tokens = tokensDeNombre(negocio);
    if (tokens.length === 0) return true; // sin nombre distintivo no se puede afirmar nada

    // Con un solo token distintivo alcanza que ese aparezca; con varios, pedimos
    // dos para no confundir "Odontología Norte" con cualquier "norte" suelto.
    const minimo = tokens.length === 1 ? 1 : 2;

    return resultados.some((r) => {
        const heno = normalizar(`${r.titulo} ${r.url} ${r.resumen}`);
        const encontrados = tokens.filter((t) => heno.includes(t)).length;
        return encontrados >= Math.min(minimo, tokens.length);
    });
}

// ─────────────────────────────────────────────────────────────
// Señal 1 — El sitio web de la ficha es el Instagram
// ─────────────────────────────────────────────────────────────

const HOSTS_RED_SOCIAL = ["instagram.com", "facebook.com", "fb.me", "linktr.ee", "linktree.com"];

export function esUrlDeRedSocial(url: string): boolean {
    const u = normalizar(url);
    if (!u) return false;
    return HOSTS_RED_SOCIAL.some((h) => u.includes(h));
}

// ─────────────────────────────────────────────────────────────
// Señales que salen de la ficha de Maps, sin interpretar nada
// ─────────────────────────────────────────────────────────────

export function senialesDeMaps(p: Prospecto, d: DetallesMaps): EvidenciaSenial[] {
    const out: EvidenciaSenial[] = [];
    const sitio = (d.sitio_web_url || p.sitio_web_url || "").trim();

    // web_es_instagram — peso 78 en el catálogo. Es un string comparado con una
    // lista de hosts: no hay margen de error ni criterio que aplicar.
    if (sitio && esUrlDeRedSocial(sitio)) {
        out.push({
            falla: "web_es_instagram",
            fuente: "maps",
            detalle: `El campo "sitio web" de la ficha apunta a ${sitio}`,
            url: d.maps_url || p.maps_url || sitio,
        });
    }

    // ficha_incompleta — solo si faltan HORARIOS. Es lo único que se puede afirmar
    // sin ambigüedad: una ficha sin fotos puede ser una decisión, una sin horarios
    // es siempre un dato que Google le está pidiendo y no está.
    if (!d.tiene_horarios) {
        out.push({
            falla: "ficha_incompleta",
            fuente: "maps",
            detalle: "La ficha de Google no tiene horarios cargados",
            url: d.maps_url || p.maps_url,
        });
    }

    return out;
}

// ─────────────────────────────────────────────────────────────
// Señal 2 — No aparece buscando el rubro + la ciudad
// ─────────────────────────────────────────────────────────────

/**
 * Esta señal es la de mayor peso del catálogo (88) y también la más fácil de
 * afirmar mal, así que tiene tres condiciones y las tres son obligatorias:
 *
 *   1. La demanda de búsqueda NO puede ser baja. Si nadie googlea ese servicio,
 *      "no aparecés cuando te buscan" describe una búsqueda que no existe y el
 *      mensaje se cae solo (§7.2 y la nota del catálogo en dolores-rubro.ts).
 *   2. La búsqueda por rubro tiene que haber funcionado y no traerlo.
 *   3. La búsqueda por NOMBRE tiene que traerlo. Sin este control no se distingue
 *      "no aparece por su rubro" de "no aparece en Google en absoluto", y la
 *      línea 1 del mensaje dice literalmente "sí aparecen buscando el nombre".
 *
 * Si cualquiera de las tres no se cumple, no se marca. En silencio: queda como
 * pendiente para mirar a mano.
 */
export function senialDeSerp(
    p: Prospecto,
    porRubro: ResultadoSerp | null,
    porNombre: ResultadoSerp | null
): { evidencia: EvidenciaSenial | null; pendiente: string | null } {
    const demanda = demandaEfectiva(p);
    if (demanda === "baja") {
        return {
            evidencia: null,
            pendiente:
                'Búsqueda por rubro no evaluada: la demanda de este servicio es baja, así que "no aparecés" no aplica (usá el ángulo de credibilidad).',
        };
    }

    if (!porRubro || porRubro.aparece === null) {
        return { evidencia: null, pendiente: "No se pudo consultar la búsqueda por rubro." };
    }
    if (porRubro.aparece === true) {
        return { evidencia: null, pendiente: null }; // aparece: no hay señal, y está bien
    }
    if (!porNombre || porNombre.aparece === null) {
        return {
            evidencia: null,
            pendiente:
                "No aparece buscando el rubro, pero falló la búsqueda de control por nombre. Sin ese control no se puede afirmar la señal.",
        };
    }
    if (porNombre.aparece === false) {
        return {
            evidencia: null,
            pendiente:
                "No aparece ni buscando el rubro ni buscando el nombre. Puede ser un problema del nombre cargado, no del posicionamiento — revisalo a mano.",
        };
    }

    const falla: FallaVerificable =
        detectarRubro(p) === "gastronomia" ? "no_aparece_comida" : "no_aparece_rubro";

    const quienes = porRubro.dominios.slice(0, 3).join(", ");
    return {
        evidencia: {
            falla,
            fuente: "serp",
            detalle: `Buscando "${porRubro.termino}" no aparece en la primera pantalla; sí aparece buscando el nombre.${
                quienes ? ` Hoy salen: ${quienes}.` : ""
            }`,
            url: `https://www.google.com/search?q=${encodeURIComponent(porRubro.termino)}`,
        },
        pendiente: null,
    };
}

/**
 * La demanda que vale para decidir. Si está sin definir en la planilla, se usa la
 * hipótesis del rubro en vez de asumir que hay demanda: preferimos no marcar la
 * señal antes que afirmarla sobre un servicio que nadie busca.
 */
export function demandaEfectiva(p: Prospecto): DemandaBusqueda {
    if (p.demanda_busqueda && p.demanda_busqueda !== "sin_definir") return p.demanda_busqueda;
    return pistaDemanda(p).sugerencia;
}

// ─────────────────────────────────────────────────────────────
// Señales del sitio web
// ─────────────────────────────────────────────────────────────

/** Arriba de esto, en una conexión de datacenter, en un celular con datos es peor. */
const MS_WEB_LENTA = 4000;

export function senialesDeWeb(p: Prospecto, w: ChequeoWeb | null): EvidenciaSenial[] {
    if (!w || w.ok === null) return [];
    const out: EvidenciaSenial[] = [];

    if (w.ok === false) {
        out.push({
            falla: "web_lenta",
            fuente: "web",
            detalle: `La web no respondió${w.status ? ` (HTTP ${w.status})` : ""}`,
            url: w.url,
        });
        return out;
    }
    if (w.ms != null && w.ms > MS_WEB_LENTA) {
        out.push({
            falla: "web_lenta",
            fuente: "web",
            detalle: `La web tardó ${(w.ms / 1000).toFixed(1)}s en responder desde un servidor. En un celular con datos es peor.`,
            url: w.url,
        });
    }
    if (w.tiene_viewport === false) {
        out.push({
            falla: "web_lenta",
            fuente: "web",
            detalle: "La web no declara viewport para celular: se ve como versión de escritorio achicada.",
            url: w.url,
        });
    }
    return out;
}

/** Clasificación web con el sitio ya chequeado — más fina que mirar solo la URL. */
export function clasificarConChequeo(
    sitio: string,
    w: ChequeoWeb | null
): ClasificacionWeb {
    if (!sitio.trim()) return "sin_web";
    if (esUrlDeRedSocial(sitio)) return "solo_redes";
    if (!w || w.ok === null) return "sin_definir"; // no la pudimos abrir: que la mire una persona
    if (w.ok === false) return "web_debil";
    if (w.tiene_viewport === false) return "web_debil";
    if (w.ms != null && w.ms > MS_WEB_LENTA) return "web_debil";
    // Responde, es responsive y carga rápido. "Buena" hasta que alguien la mire.
    return "web_buena";
}

// ─────────────────────────────────────────────────────────────
// Fusión con lo que ya había cargado a mano
// ─────────────────────────────────────────────────────────────

/**
 * El escaneo automático SUMA, nunca pisa.
 *
 * Lo que una persona marcó o escribió mirando el Instagram vale más que lo que
 * dedujo el robot, y además es lo que el robot no puede ver. Si el prospecto ya
 * tenía una queja textual cargada a mano, la del robot se descarta aunque sea
 * "mejor": la persona ya decidió cuál usar.
 */
export function fusionarEscaneo(
    actual: EscaneoProspecto,
    evidencias: EvidenciaSenial[],
    lectura: LecturaResenas = LECTURA_VACIA
): { escaneo: EscaneoProspecto; agregadas: FallaVerificable[] } {
    const base = normalizarEscaneo(actual);
    const yaEstaban = new Set(base.fallas);

    const candidatas = [
        ...evidencias.map((e) => e.falla),
        ...lectura.fallas,
    ];
    const agregadas = Array.from(new Set(candidatas.filter((f) => !yaEstaban.has(f))));

    return {
        escaneo: {
            tiene_queja_cliente:
                base.tiene_queja_cliente || (lectura.tiene_queja_cliente && !!lectura.queja_textual.trim()),
            queja_textual: base.queja_textual.trim() || lectura.queja_textual.trim(),
            fallas: [...base.fallas, ...agregadas],
            hito_reciente: base.hito_reciente.trim() || lectura.hito_reciente.trim(),
            detalle_trabajo: base.detalle_trabajo.trim() || lectura.detalle_trabajo.trim(),
        },
        agregadas,
    };
}

/**
 * Lo que el robot no puede mirar y sigue siendo trabajo de una persona.
 * Se devuelve explícito para que la pantalla no dé la impresión de que el
 * escaneo terminó: Instagram es donde están varias de las señales más fuertes
 * y no hay API que lo cubra.
 */
export function pendientesManuales(p: Prospecto): string[] {
    const out = [
        "Instagram: último posteo, comentarios sin responder y preguntas de precio. Es lo único que no se puede automatizar, y es donde están las señales más fuertes.",
    ];
    if (!p.instagram_url.trim()) {
        out.push("No hay URL de Instagram cargada: buscala una vez y queda guardada para el follow-up.");
    }
    if (!p.whatsapp_publicado && p.telefono.trim()) {
        out.push(
            "Confirmá si ese teléfono está publicado como WhatsApp por el negocio: define si podés escribir por WhatsApp o va DM obligatorio."
        );
    }
    return out;
}

/** Texto corto para el toast y para el log del lote. */
export function resumenEscaneo(r: EscaneoAutomatico): string {
    if (r.agregadas.length === 0) return `${r.negocio}: sin señales nuevas`;
    return `${r.negocio}: ${r.agregadas.map((f) => FALLA_LABELS[f]).join(" · ")}`;
}
