// ============================================================
// Escaneo automático de prospectos — la orquestación
//
// Junta en una sola llamada lo que hoy son seis pestañas abiertas a mano por
// prospecto (doc 08 §8, pases B y C):
//
//   1. Ficha de Google (Places Details, CON el texto de las reseñas)
//   2. "especialidad en ciudad" + el control por nombre exacto  → no_aparece_rubro
//   3. Un GET al sitio web                                      → web_lenta / clasificación
//   4. Gemini leyendo SOLO el texto de las reseñas              → queja de nivel 1
//
// La detección vive en lib/escaneo-auto.ts y es pura; acá está únicamente la
// red. Todo lo que falla degrada a "pendiente" en vez de romper: un escaneo
// incompleto sigue siendo mucho mejor que ninguno, y lo que no se pudo mirar
// se muestra explícito para hacerlo a mano.
//
// Se procesan pocos por llamada a propósito. El lote de 20 lo maneja la
// pantalla mandando tandas: así se ve el progreso y lo ya escaneado no se
// pierde si una tanda falla o si Vercel corta la función.
// ============================================================

import { NextResponse } from "next/server";
import type { Prospecto, FallaVerificable } from "@/lib/types";
import { telefonoAWhatsapp, normalizar } from "@/lib/prospeccion";
import { extraerPlaceId } from "@/lib/places-url";
import {
    senialesDeMaps, senialDeSerp, senialesDeWeb, clasificarConChequeo,
    fusionarEscaneo, pendientesManuales, terminoDeRubro, terminoDeNombre,
    apareceEnResultados, demandaEfectiva, esUrlDeRedSocial,
    LECTURA_VACIA,
    type EscaneoAutomatico, type EvidenciaSenial, type DetallesMaps,
    type ResultadoSerp, type ChequeoWeb, type LecturaResenas, type ResenaMaps,
} from "@/lib/escaneo-auto";

export const maxDuration = 60;

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const CSE_ID = process.env.GOOGLE_CSE_ID || "";
const CSE_KEY = process.env.GOOGLE_CSE_API_KEY || GOOGLE_API_KEY;
const PLACES_BASE = "https://places.googleapis.com/v1";

/** Tope por request. La pantalla manda tandas de este tamaño hasta terminar la cola. */
const MAX_POR_LOTE = 5;

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ─────────────────────────────────────────────────────────────
// 1. Ficha de Google, con el texto de las reseñas
// ─────────────────────────────────────────────────────────────

// El scraper de listas ya pide teléfonos, así que la cuenta está en el tramo
// Enterprise de Places. Sumar reviews y horarios no cambia el tramo de
// facturación y es justo lo que hace falta para el dato de nivel 1.
const FIELD_MASK_DETALLE = [
    "id", "displayName", "formattedAddress", "nationalPhoneNumber",
    "websiteUri", "googleMapsUri", "rating", "userRatingCount",
    "regularOpeningHours", "editorialSummary", "photos", "reviews",
].join(",");

interface PlaceReview {
    authorAttribution?: { displayName?: string };
    rating?: number;
    text?: { text?: string };
    originalText?: { text?: string };
    relativePublishTimeDescription?: string;
    publishTime?: string;
}

async function detallesDeFicha(p: Prospecto): Promise<DetallesMaps | null> {
    if (!GOOGLE_API_KEY) return null;

    const placeId = p.maps_url ? extraerPlaceId(p.maps_url) : null;
    const id = placeId || (await buscarPlaceId(p));
    if (!id) return null;

    try {
        const res = await fetch(`${PLACES_BASE}/places/${id}?languageCode=es`, {
            headers: { "X-Goog-Api-Key": GOOGLE_API_KEY, "X-Goog-FieldMask": FIELD_MASK_DETALLE },
            signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.warn("[escanear] Places Details falló:", err?.error?.message || res.status);
            return null;
        }
        const d = await res.json();

        const resenas: ResenaMaps[] = (d.reviews || [])
            .map((r: PlaceReview) => ({
                autor: r.authorAttribution?.displayName || "Anónimo",
                rating: typeof r.rating === "number" ? r.rating : null,
                // originalText es el idioma en que se escribió; text puede venir traducido
                // por Google. Para citar textualmente hay que usar el original.
                texto: (r.originalText?.text || r.text?.text || "").trim(),
                fecha: r.relativePublishTimeDescription || (r.publishTime || "").slice(0, 10),
            }))
            .filter((r: ResenaMaps) => r.texto.length > 0);

        return {
            sitio_web_url: d.websiteUri || "",
            telefono: d.nationalPhoneNumber || "",
            maps_url: d.googleMapsUri || p.maps_url || "",
            rating: typeof d.rating === "number" ? d.rating : null,
            reviews_count: typeof d.userRatingCount === "number" ? d.userRatingCount : null,
            tiene_horarios: Array.isArray(d.regularOpeningHours?.weekdayDescriptions)
                && d.regularOpeningHours.weekdayDescriptions.length > 0,
            tiene_descripcion: !!d.editorialSummary?.text,
            cant_fotos: Array.isArray(d.photos) ? d.photos.length : 0,
            resenas,
        };
    } catch (e) {
        console.warn("[escanear] Places Details error:", e instanceof Error ? e.message : e);
        return null;
    }
}

/** Sin maps_url guardado, se resuelve la ficha por nombre + ciudad. */
async function buscarPlaceId(p: Prospecto): Promise<string | null> {
    const query = [p.negocio, p.direccion || p.ciudad].filter(Boolean).join(" ");
    if (!query.trim()) return null;
    try {
        const res = await fetch(`${PLACES_BASE}/places:searchText`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_API_KEY,
                "X-Goog-FieldMask": "places.id",
            },
            body: JSON.stringify({ textQuery: query, languageCode: "es", pageSize: 1 }),
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return null;
        const d = await res.json();
        return d.places?.[0]?.id || null;
    } catch {
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
// 2. La búsqueda: ¿aparece cuando lo buscan por lo que hace?
// ─────────────────────────────────────────────────────────────

interface ItemSerp { titulo: string; url: string; resumen: string }

/**
 * Custom Search si está configurado (es el índice de Google, que es sobre el que
 * habla el mensaje), y DuckDuckGo si no. DDG es otro índice: cuando se usa, la
 * evidencia lo dice y deja el link de Google para confirmarlo de un vistazo
 * antes de mandar. Preferimos avisar que redondear.
 */
async function buscar(termino: string): Promise<{ items: ItemSerp[]; proveedor: "cse" | "ddg" } | null> {
    if (!termino.trim()) return null;

    if (CSE_ID && CSE_KEY) {
        const items = await buscarCSE(termino);
        if (items) return { items, proveedor: "cse" };
    }
    const items = await buscarDDG(termino);
    return items ? { items, proveedor: "ddg" } : null;
}

async function buscarCSE(termino: string): Promise<ItemSerp[] | null> {
    try {
        const url =
            `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(CSE_KEY)}` +
            `&cx=${encodeURIComponent(CSE_ID)}&q=${encodeURIComponent(termino)}` +
            // Sin filtro de idioma a propósito: si Google no le detecta idioma al
            // sitio del prospecto, lr=lang_es lo saca de los resultados y el
            // negocio "no aparece" por culpa del filtro, no de su posicionamiento.
            `&num=10&gl=ar&hl=es`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.warn("[escanear] CSE falló:", err?.error?.message || res.status);
            return null;
        }
        const d = await res.json();
        return (d.items || []).map((i: { title?: string; link?: string; snippet?: string }) => ({
            titulo: i.title || "",
            url: i.link || "",
            resumen: i.snippet || "",
        }));
    } catch {
        return null;
    }
}

async function buscarDDG(termino: string): Promise<ItemSerp[] | null> {
    try {
        const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(termino)}&kl=ar-es`, {
            headers: { "User-Agent": UA },
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return null;
        const html = await res.text();

        const items: ItemSerp[] = [];
        const bloque = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]{0,600}?)(?=<a[^>]+class="result__a"|<\/div>\s*<\/div>\s*<\/div>)/g;
        let m: RegExpExecArray | null;
        while ((m = bloque.exec(html)) !== null && items.length < 10) {
            let url = m[1];
            if (url.includes("uddg=")) {
                const partes = url.split("uddg=");
                if (partes[1]) url = decodeURIComponent(partes[1].split("&")[0]);
            }
            items.push({
                titulo: sinHtml(m[2]),
                url,
                resumen: sinHtml(m[3]),
            });
        }

        // DDG devuelve HTTP 200 tanto para una búsqueda real como para la página
        // de "detectamos tráfico automatizado" que le muestra a IPs de datacenter
        // (que es lo que es Vercel). Las dos cosas dan 0 matches acá. Sin esta
        // distinción, "0 resultados" se leía como "confirmado: no aparece en
        // ningún lado" y terminaba marcando no_aparece_rubro en negocios que sí
        // aparecen — es exactamente el falso positivo que el resto del código se
        // cuida de no cometer. Cero parseados es "no se pudo buscar", no un cero real.
        if (items.length === 0) return null;

        return items;
    } catch {
        return null;
    }
}

/**
 * Entidades con nombre que aparecen en cualquier resultado en español. Sin
 * decodificarlas, "Tucumán" llega como "Tucum&aacute;n" y al comparar nombres
 * el token "tucuman" no matchea nunca: el negocio parece no estar en los
 * resultados cuando sí está, y eso se convierte en una señal no_aparece_rubro
 * afirmada de más. Vale la pena la tabla.
 */
const ENTIDADES: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", uuml: "ü",
    Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Uuml: "Ü",
    ntilde: "ñ", Ntilde: "Ñ", ccedil: "ç", Ccedil: "Ç",
    ordf: "ª", ordm: "º", deg: "°", middot: "·", bull: "·",
    ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»",
    lsquo: "'", rsquo: "'", ldquo: '"', rdquo: '"', euro: "€", pound: "£",
};

function decodificarEntidades(s: string): string {
    return s
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
        .replace(/&([a-zA-Z]+);/g, (todo, nombre) => ENTIDADES[nombre] ?? todo);
}

function sinHtml(s: string): string {
    return decodificarEntidades(s.replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
}

function dominiosDe(items: ItemSerp[]): string[] {
    const out: string[] = [];
    for (const i of items) {
        try {
            const h = new URL(i.url).hostname.replace(/^www\./, "");
            if (!out.includes(h)) out.push(h);
        } catch { /* url basura, se saltea */ }
    }
    return out;
}

async function chequearSerp(p: Prospecto): Promise<{ porRubro: ResultadoSerp | null; porNombre: ResultadoSerp | null }> {
    // Si la demanda es baja la señal no aplica (§7.2): no se gasta la consulta.
    if (demandaEfectiva(p) === "baja") return { porRubro: null, porNombre: null };

    const tRubro = terminoDeRubro(p);
    const tNombre = terminoDeNombre(p);
    if (!tRubro || !tNombre) return { porRubro: null, porNombre: null };

    const rubro = await buscar(tRubro);
    const porRubro: ResultadoSerp | null = rubro
        ? {
              termino: tRubro,
              aparece: apareceEnResultados(p.negocio, rubro.items),
              dominios: dominiosDe(rubro.items),
              proveedor: rubro.proveedor,
          }
        : null;

    // El control por nombre solo hace falta si NO apareció por rubro: es la
    // consulta que distingue "no te encuentran por lo que hacés" de "no estás
    // en el índice". Si apareció, nos la ahorramos (y ahorramos cuota de CSE).
    if (!porRubro || porRubro.aparece !== false) return { porRubro, porNombre: null };

    const nombre = await buscar(tNombre);
    const porNombre: ResultadoSerp | null = nombre
        ? {
              termino: tNombre,
              aparece: apareceEnResultados(p.negocio, nombre.items),
              dominios: dominiosDe(nombre.items),
              proveedor: nombre.proveedor,
          }
        : null;

    return { porRubro, porNombre };
}

// ─────────────────────────────────────────────────────────────
// 3. El sitio web
// ─────────────────────────────────────────────────────────────

async function chequearWeb(url: string): Promise<ChequeoWeb | null> {
    const limpia = (url || "").trim();
    if (!limpia || esUrlDeRedSocial(limpia)) return null;
    const final = limpia.startsWith("http") ? limpia : `https://${limpia}`;

    const t0 = Date.now();
    try {
        const res = await fetch(final, {
            headers: { "User-Agent": UA },
            redirect: "follow",
            signal: AbortSignal.timeout(12000),
        });
        const ms = Date.now() - t0;
        // Solo la cabecera del HTML: alcanza para el viewport y evita bajar megas.
        const html = (await res.text()).slice(0, 40_000);
        return {
            url: final,
            ok: res.ok,
            status: res.status,
            ms,
            tiene_viewport: /<meta[^>]+name=["']viewport["']/i.test(html),
        };
    } catch {
        return { url: final, ok: null, status: null, ms: null, tiene_viewport: null };
    }
}

// ─────────────────────────────────────────────────────────────
// 4. Gemini leyendo las reseñas — el único paso donde hace falta criterio
// ─────────────────────────────────────────────────────────────

/**
 * Las únicas señales que una reseña puede evidenciar por sí sola. La lista es
 * corta a propósito: cuanto más chico el menú, menos margen para que el modelo
 * marque algo que no está.
 */
const FALLAS_DE_RESENAS: FallaVerificable[] = [
    "demora_en_contestar",
    "resenas_pedido_errado",
    "sin_reserva_online",
];

async function leerResenas(p: Prospecto, resenas: ResenaMaps[]): Promise<LecturaResenas> {
    if (!GEMINI_API_KEY || resenas.length === 0) return LECTURA_VACIA;

    const listado = resenas
        .map((r, i) => `[${i + 1}] ${r.autor} · ${r.rating ?? "?"}★ · ${r.fecha}\n${r.texto}`)
        .join("\n\n");

    const prompt = `Sos quien prepara los datos para escribir un mensaje en frío de una agencia web de Tucumán.
Te paso las reseñas de Google de un negocio. Tu único trabajo es EXTRAER, no redactar.

--- NEGOCIO ---
${p.negocio} — ${p.especialidad || p.rubro} en ${p.ciudad}

--- RESEÑAS ---
${listado}

--- QUÉ BUSCAR ---
Buscás una queja de un cliente sobre un problema que se resuelve con una web o un sistema de turnos:
no contestan los mensajes, no se puede sacar turno, hay que llamar muchas veces, tardan días en responder,
no hay forma de reservar, no se sabe el precio, no encontraban información.

NO sirve, y no lo devuelvas: quejas sobre la calidad del servicio, sobre el trato de una persona,
sobre el resultado de un tratamiento, sobre precios caros, ni nada que una web no arregle.

--- REGLAS ---
1. queja_textual va TEXTUAL, copiada carácter por carácter de una reseña. No la resumas, no la corrijas,
   no le arregles la ortografía, no la traduzcas. Si no podés copiarla exacta, devolvé "".
2. Si ninguna reseña tiene una queja del tipo que se busca, devolvé tiene_queja_cliente: false y queja_textual: "".
   Es un resultado perfectamente válido y es mejor que forzar una.
3. hito_reciente solo si alguna reseña menciona algo nuevo y datable (mudanza, sucursal, servicio nuevo).
4. detalle_trabajo solo si hay algo concreto y específico de cómo trabajan. Si no, "".
5. fallas: elegí solo de esta lista, y solo si alguna reseña lo dice explícitamente:
${FALLAS_DE_RESENAS.map((f) => `   - ${f}`).join("\n")}
6. No inventes nada. Un campo vacío no es un error.

Devolvé SOLO este JSON, sin markdown ni explicaciones:
{"tiene_queja_cliente":bool,"queja_textual":"","autor_queja":"","fecha_queja":"","fallas":[],"hito_reciente":"","detalle_trabajo":""}`;

    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.1, // extracción, no redacción: cuanto menos invente, mejor
                        maxOutputTokens: 700,
                        responseMimeType: "application/json",
                        thinkingConfig: { thinkingBudget: 0 },
                    },
                }),
                signal: AbortSignal.timeout(20000),
            }
        );
        if (!res.ok) return LECTURA_VACIA;

        const data = await res.json();
        const texto: string = (data.candidates?.[0]?.content?.parts || [])
            .filter((x: { text?: string }) => typeof x.text === "string")
            .map((x: { text: string }) => x.text)
            .join("")
            .trim();

        const crudo = parsearJSON(texto);
        if (!crudo) return LECTURA_VACIA;
        return validarLectura(crudo, resenas);
    } catch (e) {
        console.warn("[escanear] Gemini reseñas:", e instanceof Error ? e.message : e);
        return LECTURA_VACIA;
    }
}

function parsearJSON(raw: string): Record<string, unknown> | null {
    try { return JSON.parse(raw.trim()); } catch { /* seguir */ }
    const fence = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fence) { try { return JSON.parse(fence[1].trim()); } catch { /* seguir */ } }
    const llaves = raw.match(/\{[\s\S]*\}/);
    if (llaves) { try { return JSON.parse(llaves[0]); } catch { /* seguir */ } }
    return null;
}

/**
 * La red de seguridad contra la alucinación, y el motivo por el que se puede
 * confiar en la cita: la queja tiene que estar LITERALMENTE en alguna de las
 * reseñas que le pasamos. Si el modelo la parafraseó, la mejoró o la inventó,
 * no va a coincidir y se descarta.
 *
 * Esto no es paranoia: la línea 1 del mensaje cita esa frase, y una cita que el
 * prospecto no encuentra en sus propias reseñas quema el contacto para siempre.
 */
function validarLectura(crudo: Record<string, unknown>, resenas: ResenaMaps[]): LecturaResenas {
    const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
    const queja = texto(crudo.queja_textual);

    const corpus = resenas.map((r) => aplanar(r.texto));
    const citaReal = queja.length > 0 && corpus.some((c) => c.includes(aplanar(queja)));
    if (queja && !citaReal) {
        console.warn("[escanear] Se descartó una cita que no está textual en las reseñas.");
    }

    const fallas = Array.isArray(crudo.fallas)
        ? (crudo.fallas as unknown[])
              .filter((f): f is FallaVerificable =>
                  typeof f === "string" && (FALLAS_DE_RESENAS as string[]).includes(f))
        : [];

    return {
        tiene_queja_cliente: citaReal,
        queja_textual: citaReal ? queja : "",
        autor_queja: citaReal ? texto(crudo.autor_queja) : "",
        fecha_queja: citaReal ? texto(crudo.fecha_queja) : "",
        fallas: Array.from(new Set(fallas)),
        hito_reciente: texto(crudo.hito_reciente),
        detalle_trabajo: texto(crudo.detalle_trabajo),
    };
}

/** Para comparar citas: sin acentos, sin puntuación y con los espacios colapsados. */
function aplanar(s: string): string {
    return normalizar(s).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// ─────────────────────────────────────────────────────────────
// El escaneo de un prospecto, de punta a punta
// ─────────────────────────────────────────────────────────────

async function escanear(p: Prospecto): Promise<EscaneoAutomatico> {
    const pendientes: string[] = [];
    const evidencias: EvidenciaSenial[] = [];
    const campos: Partial<Prospecto> = {};

    const detalles = await detallesDeFicha(p);
    if (!detalles) {
        pendientes.push(
            GOOGLE_API_KEY
                ? "No se pudo resolver la ficha de Google. Pegá el link de Maps en la pestaña Datos y volvé a escanear."
                : "Falta GOOGLE_PLACES_API_KEY: sin eso no se leen la ficha ni las reseñas."
        );
    }

    const sitio = (detalles?.sitio_web_url || p.sitio_web_url || "").trim();

    // Las tres consultas que no dependen entre sí, en paralelo.
    const [serp, web, lectura] = await Promise.all([
        chequearSerp(p),
        chequearWeb(sitio),
        detalles?.resenas.length ? leerResenas(p, detalles.resenas) : Promise.resolve(LECTURA_VACIA),
    ]);

    if (detalles) {
        evidencias.push(...senialesDeMaps(p, detalles));

        // Datos de la ficha que además refrescan la planilla.
        if (detalles.sitio_web_url && !p.sitio_web_url) campos.sitio_web_url = detalles.sitio_web_url;
        if (detalles.maps_url && !p.maps_url) campos.maps_url = detalles.maps_url;
        if (detalles.rating != null) campos.rating = detalles.rating;
        if (detalles.reviews_count != null) campos.reviews_count = detalles.reviews_count;
        if (detalles.telefono && !p.telefono.trim()) {
            campos.telefono = detalles.telefono;
            const wa = telefonoAWhatsapp(detalles.telefono);
            if (wa) campos.telefono_wa = wa;
        }
        if (esUrlDeRedSocial(detalles.sitio_web_url) && !p.instagram_url.trim()) {
            campos.instagram_url = detalles.sitio_web_url;
        }
        if (!detalles.resenas.length) {
            pendientes.push("La ficha no devolvió reseñas con texto: el dato de nivel 1 hay que buscarlo a mano.");
        }
    }

    const { evidencia: evSerp, pendiente: pendSerp } = senialDeSerp(p, serp.porRubro, serp.porNombre);
    if (evSerp) {
        // DuckDuckGo es otro índice que el de Google. La señal se marca igual
        // porque casi siempre coincide, pero se dice de dónde salió: el mensaje
        // le va a afirmar al prospecto algo sobre Google.
        const porDDG = serp.porRubro?.proveedor === "ddg";
        evidencias.push(
            porDDG
                ? { ...evSerp, detalle: `${evSerp.detalle} (verificado en DuckDuckGo — confirmá en el link antes de mandar)` }
                : evSerp
        );
    }
    if (pendSerp) {
        const sinProveedor = !(CSE_ID && CSE_KEY) && serp.porRubro === null;
        pendientes.push(
            sinProveedor
                ? `${pendSerp} Configurá GOOGLE_CSE_ID y GOOGLE_CSE_API_KEY para que esta señal se detecte sola: es la de mayor peso del catálogo.`
                : pendSerp
        );
    }

    evidencias.push(...senialesDeWeb(p, web));

    // La clasificación web solo se pisa si hoy está sin definir o si la ficha
    // trajo un sitio que la planilla no tenía. Si una persona ya la clasificó
    // mirando la web, su criterio gana.
    if (sitio && (p.clasificacion_web === "sin_definir" || !p.sitio_web_url)) {
        const clasif = clasificarConChequeo(sitio, web);
        if (clasif !== "sin_definir") campos.clasificacion_web = clasif;
    } else if (!sitio && p.clasificacion_web === "sin_definir") {
        campos.clasificacion_web = "sin_web";
    }

    // La demanda estimada se guarda como punto de partida, nunca pisando una
    // decisión ya tomada: es una hipótesis del rubro, no una medición.
    if (p.demanda_busqueda === "sin_definir") {
        const estimada = demandaEfectiva(p);
        if (estimada !== "sin_definir") campos.demanda_busqueda = estimada;
    }

    const { escaneo, agregadas } = fusionarEscaneo(p.escaneo, evidencias, lectura);

    return {
        prospecto_id: p.id,
        negocio: p.negocio,
        escaneo,
        campos,
        evidencias,
        agregadas,
        pendientes: [...pendientes, ...pendientesManuales(p)],
        fecha: new Date().toISOString(),
    };
}

// ─────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    try {
        const { prospectos } = (await req.json()) as { prospectos?: Prospecto[] };

        if (!Array.isArray(prospectos) || prospectos.length === 0) {
            return NextResponse.json({ error: "Falta la lista de prospectos" }, { status: 400 });
        }
        if (prospectos.length > MAX_POR_LOTE) {
            return NextResponse.json(
                { error: `Máximo ${MAX_POR_LOTE} por llamada. Mandá el lote en tandas.` },
                { status: 400 }
            );
        }
        if (!GOOGLE_API_KEY) {
            return NextResponse.json(
                { error: "Falta GOOGLE_PLACES_API_KEY en el servidor: el escaneo automático no puede leer la ficha." },
                { status: 500 }
            );
        }

        // En serie: son pocos y así no se dispara un pico de llamadas a Places,
        // CSE y Gemini a la vez que termine en 429 para todo el lote.
        const resultados: EscaneoAutomatico[] = [];
        for (const p of prospectos) {
            try {
                resultados.push(await escanear(p));
            } catch (e) {
                console.error(`[escanear] ${p.negocio}:`, e);
                resultados.push({
                    prospecto_id: p.id,
                    negocio: p.negocio,
                    escaneo: p.escaneo,
                    campos: {},
                    evidencias: [],
                    agregadas: [],
                    pendientes: [
                        `No se pudo escanear: ${e instanceof Error ? e.message : "error desconocido"}`,
                        ...pendientesManuales(p),
                    ],
                    fecha: new Date().toISOString(),
                });
            }
        }

        return NextResponse.json({
            resultados,
            proveedor_busqueda: CSE_ID && CSE_KEY ? "cse" : "ddg",
        });
    } catch (error) {
        console.error("[escanear]", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Error al escanear" },
            { status: 500 }
        );
    }
}
