import { NextResponse } from "next/server";
import type { Prospecto, EscaneoSarvo, SegmentoTurnos } from "@/lib/types";
import { ESCANEO_SARVO_VACIO } from "@/lib/types";
import { extraerPlaceId } from "@/lib/places-url";
import { telefonoAWhatsapp, normalizarEscaneo } from "@/lib/prospeccion";
import { RUBROS_TURNOS, rubroTurnosDe } from "@/lib/turnos";

// ============================================================
// Escaneo rápido de Sarvo — lo que hace falta para escribirle a un negocio
// con turnos, y nada más.
//
// El escaneo viejo (/api/prospeccion/escanear) estaba hecho para vender webs:
// buscaba si el negocio aparece en Google, abría su sitio para medir la
// velocidad y leía las reseñas buscando una queja para citar. De a uno, en
// serie. Para Sarvo no sirve: lo que importa es otra cosa.
//
//   1. ¿Contesta él o hay recepción?   → el segmento, que decide el mensaje.
//   2. ¿Cómo se llama el profesional?  → el "Hola [nombre]".
//   3. ¿Publica precios?               → si se le puede armar su página.
//   4. ¿Ya tiene un sistema de turnos? → si ya lo resolvió.
//   5. ¿Tiene WhatsApp o Instagram?    → por dónde se le escribe.
//   6. La primera línea del mensaje, con algo que solo es verdad de él.
//
// Una llamada a Places (la ficha con reseñas), una lectura de su web si tiene,
// y UNA llamada a Gemini que decide todo junto. Varios negocios en paralelo.
//
// Regla que no se rompe: todo lo que dice la primera línea tiene que estar en
// lo que se le pasó a la IA. Si nombra un número o un nombre que no está, se
// descarta y se usa la línea de respaldo, que sale de datos duros.
// ============================================================

export const maxDuration = 60;

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const PLACES_BASE = "https://places.googleapis.com/v1";
const MAX_POR_LOTE = 8;
const EN_PARALELO = 4;
const UA = "Mozilla/5.0 (compatible; GaluCRM/1.0)";

const FIELD_MASK = [
    "id", "displayName", "formattedAddress", "nationalPhoneNumber", "internationalPhoneNumber",
    "websiteUri", "googleMapsUri", "rating", "userRatingCount", "reviews",
    "primaryTypeDisplayName", "businessStatus", "editorialSummary",
].join(",");

/** Sistemas de turnos conocidos: si la web lleva a uno, ya lo resolvió. */
const SISTEMAS_TURNOS: [RegExp, string][] = [
    [/agendapro/i, "AgendaPro"],
    [/doctoralia/i, "Doctoralia"],
    [/calendly/i, "Calendly"],
    [/turnito/i, "Turnito"],
    [/reservo\.(cl|com)/i, "Reservo"],
    [/simplybook/i, "SimplyBook"],
    [/setmore/i, "Setmore"],
    [/booksy/i, "Booksy"],
    [/fresha/i, "Fresha"],
    [/weibook/i, "Weibook"],
    [/docturno/i, "Docturno"],
    [/miturno|turnosweb|turnonet|turnoexpress/i, "un sistema de turnos online"],
    [/sarvo-app|sarvo\.app/i, "Sarvo"],
];

interface Ficha {
    nombre: string;
    categoria: string;
    direccion: string;
    telefono: string;
    sitio: string;
    maps_url: string;
    rating: number | null;
    reviews_count: number | null;
    resenas: { autor: string; texto: string }[];
    descripcion: string;
    cerrado: boolean;
}

interface Web {
    instagram: string;
    sistema_turnos: string;
    precios: boolean;
    texto: string;
}

interface Lectura {
    segmento: SegmentoTurnos;
    cant_profesionales: number | null;
    profesional: string;
    rubro: string;
    precios_publicados: boolean | null;
    primera_linea: string;
    evidencias: string[];
}

export interface ResultadoTurnos {
    prospecto_id: string;
    negocio: string;
    campos: Partial<Prospecto>;
    resumen: string;
    error?: string;
}

// ─── Places ──────────────────────────────────────────────────

async function fichaDe(p: Prospecto): Promise<Ficha | null> {
    if (!GOOGLE_API_KEY) return null;
    let id = p.maps_url ? extraerPlaceId(p.maps_url) : null;
    if (!id) {
        const query = [p.negocio, p.direccion || p.ciudad].filter(Boolean).join(" ");
        if (!query.trim()) return null;
        try {
            const res = await fetch(`${PLACES_BASE}/places:searchText`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "X-Goog-Api-Key": GOOGLE_API_KEY, "X-Goog-FieldMask": "places.id" },
                body: JSON.stringify({ textQuery: query, languageCode: "es", pageSize: 1 }),
                signal: AbortSignal.timeout(6000),
            });
            if (res.ok) id = (await res.json()).places?.[0]?.id || null;
        } catch { /* sin ficha */ }
    }
    if (!id) return null;

    try {
        const res = await fetch(`${PLACES_BASE}/places/${id}?languageCode=es`, {
            headers: { "X-Goog-Api-Key": GOOGLE_API_KEY, "X-Goog-FieldMask": FIELD_MASK },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return null;
        const d = await res.json();
        return {
            nombre: d.displayName?.text || p.negocio,
            categoria: d.primaryTypeDisplayName?.text || "",
            direccion: d.formattedAddress || "",
            telefono: d.internationalPhoneNumber || d.nationalPhoneNumber || "",
            sitio: d.websiteUri || "",
            maps_url: d.googleMapsUri || "",
            rating: typeof d.rating === "number" ? d.rating : null,
            reviews_count: typeof d.userRatingCount === "number" ? d.userRatingCount : null,
            resenas: (d.reviews || [])
                .map((r: { authorAttribution?: { displayName?: string }; originalText?: { text?: string }; text?: { text?: string } }) => ({
                    autor: r.authorAttribution?.displayName || "",
                    texto: (r.originalText?.text || r.text?.text || "").trim().slice(0, 400),
                }))
                .filter((r: { texto: string }) => r.texto),
            descripcion: d.editorialSummary?.text || "",
            cerrado: !!d.businessStatus && d.businessStatus !== "OPERATIONAL",
        };
    } catch {
        return null;
    }
}

// ─── La web ──────────────────────────────────────────────────

const esRed = (u: string) => /instagram\.com|facebook\.com|linktr\.ee|wa\.me|whatsapp\.com/i.test(u);

async function webDe(url: string): Promise<Web | null> {
    if (!url) return null;
    // Un link a un sistema de turnos en el campo "sitio web" ya dice todo.
    const directo = SISTEMAS_TURNOS.find(([re]) => re.test(url));
    if (directo) return { instagram: "", sistema_turnos: directo[1], precios: false, texto: "" };
    if (/instagram\.com/i.test(url)) return { instagram: url, sistema_turnos: "", precios: false, texto: "" };
    if (esRed(url)) return null;

    try {
        const res = await fetch(url.startsWith("http") ? url : `https://${url}`, {
            headers: { "User-Agent": UA },
            signal: AbortSignal.timeout(6000),
            redirect: "follow",
        });
        if (!res.ok) return null;
        const html = (await res.text()).slice(0, 400_000);
        const ig = html.match(/https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{2,30})\/?/i);
        const igHandle = ig && !/^(p|reel|explore|accounts|stories)$/i.test(ig[1]) ? `https://instagram.com/${ig[1]}` : "";
        const sistema = SISTEMAS_TURNOS.find(([re]) => re.test(html))?.[1] || "";
        const texto = html
            .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        // "$ 25.000", "$25000", "ARS 25.000": dos o más precios = publica su lista.
        const precios = (texto.match(/(\$|ars)\s?\d{1,3}(\.\d{3})+|\$\s?\d{4,6}/gi) || []).length >= 2;
        return { instagram: igHandle, sistema_turnos: sistema, precios, texto: texto.slice(0, 2500) };
    } catch {
        return null;
    }
}

// ─── La lectura con IA ───────────────────────────────────────

const PATRON_PERSONA = /^(lic\.?|lic\.? en|dra?\.?|od\.?|odont\.?|klgo\.?|klga\.?|kinesiolog[oa]|nutricionista|psic[oó]log[oa]|cosmet[oó]loga|pod[oó]log[oa]|fonoaudi[oó]log[oa]|prof\.?)\s/i;
const PATRON_CENTRO = /\b(centro|cl[ií]nica|instituto|consultorios|policonsultorio|sanatorio|spa|est[eé]tica integral|equipo|grupo)\b/i;

/** Sin IA (o si falla): lo que se puede decidir solo con el nombre y los números. */
function lecturaDeRespaldo(p: Prospecto, f: Ficha | null, w: Web | null): Lectura {
    const nombre = f?.nombre || p.negocio;
    const evidencias: string[] = [];
    let segmento: SegmentoTurnos = "sin_definir";
    if (PATRON_PERSONA.test(nombre)) {
        segmento = "solo";
        evidencias.push(`El negocio figura con el nombre de una persona ("${nombre}")`);
    } else if (PATRON_CENTRO.test(nombre)) {
        segmento = "centro";
        evidencias.push(`El nombre es de un centro ("${nombre}")`);
    }
    const rev = f?.reviews_count ?? p.reviews_count;
    return {
        segmento,
        cant_profesionales: null,
        profesional: "",
        rubro: rubroTurnosDe({ ...p, especialidad: f?.categoria || p.especialidad, escaneo: undefined })?.id || "",
        precios_publicados: w?.precios ?? null,
        primera_linea: lineaDeRespaldo(rev, w),
        evidencias,
    };
}

function lineaDeRespaldo(rev: number | null | undefined, w: Web | null): string {
    if (w?.precios) return "Vi que tenés los precios publicados en tu web";
    if (rev != null && rev >= 15) return `Vi las ${rev} reseñas que tenés en Google`;
    return "";
}

async function leerConIA(p: Prospecto, f: Ficha | null, w: Web | null): Promise<Lectura> {
    const respaldo = lecturaDeRespaldo(p, f, w);
    if (!GEMINI_API_KEY || (!f && !w)) return respaldo;

    const rubros = RUBROS_TURNOS.map((r) => `${r.id} (${r.label})`).join(", ");
    const datos = [
        `Nombre en Google: ${f?.nombre || p.negocio}`,
        `Categoría de Google: ${f?.categoria || p.rubro || "s/d"}`,
        `Dirección: ${f?.direccion || p.direccion || "s/d"}`,
        `Reseñas: ${f?.reviews_count ?? p.reviews_count ?? "s/d"}${f?.rating != null ? `, ${f.rating} estrellas` : ""}`,
        f?.descripcion ? `Descripción de Google: ${f.descripcion}` : "",
        w?.texto ? `Texto de su web (recortado): ${w.texto}` : "",
        w?.precios ? "Su web publica precios con montos." : "",
        f?.resenas.length ? `Reseñas (textuales):\n${f.resenas.map((r, i) => `${i + 1}. ${r.texto}`).join("\n")}` : "",
    ].filter(Boolean).join("\n");

    const prompt = `Clasificás un negocio con turnos de Argentina para saber cómo escribirle. Usá SOLO los datos de abajo.

${datos}

Decidí:
- segmento: "solo" si atiende una o dos personas y contesta el mismo profesional (el negocio tiene nombre de persona, las reseñas nombran a una sola persona, "la doctora me respondió"); "centro" si hay varios profesionales o una recepción/secretaria ("la secretaria", "las chicas de recepción", varios nombres de profesionales); "sin_definir" si no se puede saber.
- cant_profesionales: cuántos profesionales distintos se nombran, o null.
- profesional: el nombre de la persona que atiende o es dueña, SOLO si aparece escrito en los datos (en el nombre del negocio o en las reseñas). Si no aparece, "".
- rubro: uno de estos ids: ${rubros}. "" si no encaja.
- precios_publicados: true si los datos muestran precios con montos, false si no, null si no hay web.
- primera_linea: UNA frase de hasta 20 palabras que empiece con "Vi que" o "Vi tus", dirigida al profesional (voseo rioplatense), con un dato concreto y verificable de los de arriba que muestre que se lo miró de verdad. Ejemplos de forma: "Vi que tus pacientes te nombran en casi todas las reseñas", "Vi que en tu web tenés los precios de cada tratamiento". NO afirmes problemas que no están escritos, NO inventes números ni nombres, NO menciones la IA. Nada de elogios de folleto ("excelente trabajo", "gran reputación", "increíbles reseñas", "se nota tu dedicación"): el dato solo, dicho como lo diría alguien al pasar. Sin guiones largos. Si no hay un dato bueno, "".
- evidencias: hasta 3 frases cortas con lo que viste para decidir el segmento.

Devolvé SOLO este JSON:
{"segmento":"","cant_profesionales":null,"profesional":"","rubro":"","precios_publicados":null,"primera_linea":"","evidencias":[]}`;

    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 500,
                        responseMimeType: "application/json",
                        thinkingConfig: { thinkingBudget: 0 },
                    },
                }),
                signal: AbortSignal.timeout(15000),
            }
        );
        if (!res.ok) return respaldo;
        const data = await res.json();
        const texto: string = (data.candidates?.[0]?.content?.parts || []).map((x: { text?: string }) => x.text || "").join("");
        const crudo = JSON.parse(texto.replace(/^```(?:json)?|```$/g, "").trim()) as Record<string, unknown>;
        return validar(crudo, datos, respaldo);
    } catch {
        return respaldo;
    }
}

const plano = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** La red contra la invención: lo que no está en los datos, no entra. */
function validar(c: Record<string, unknown>, datos: string, respaldo: Lectura): Lectura {
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const corpus = plano(datos);

    const segmento = (["solo", "centro", "sin_definir"] as const).find((s) => s === c.segmento) || respaldo.segmento;

    let profesional = str(c.profesional);
    if (profesional && !profesional.split(/\s+/).every((parte) => parte.length < 3 || corpus.includes(plano(parte)))) {
        profesional = "";
    }

    let linea = str(c.primera_linea).replace(/\.$/, "");
    const numeros = linea.match(/\d+/g) || [];
    const inventa = numeros.some((n) => !corpus.includes(n)) || /\b(ia|bot|inteligencia artificial|automatiz)/i.test(linea);
    if (!linea || inventa || linea.split(/\s+/).length > 24) linea = respaldo.primera_linea;

    const rubro = RUBROS_TURNOS.some((r) => r.id === c.rubro) ? String(c.rubro) : respaldo.rubro;
    const cant = typeof c.cant_profesionales === "number" && c.cant_profesionales > 0 && c.cant_profesionales < 50 ? c.cant_profesionales : null;
    const precios = typeof c.precios_publicados === "boolean" ? c.precios_publicados : respaldo.precios_publicados;
    const evidencias = Array.isArray(c.evidencias) ? (c.evidencias as unknown[]).map(str).filter(Boolean).slice(0, 3) : respaldo.evidencias;

    return { segmento, cant_profesionales: cant, profesional, rubro, precios_publicados: precios, primera_linea: linea, evidencias };
}

// ─── Un negocio, de punta a punta ────────────────────────────

async function escanear(p: Prospecto): Promise<ResultadoTurnos> {
    const ficha = await fichaDe(p);
    const sitio = (ficha?.sitio || p.sitio_web_url || "").trim();
    const web = await webDe(sitio);
    const lectura = await leerConIA(p, ficha, web);

    const campos: Partial<Prospecto> = {};
    const anterior = normalizarEscaneo(p.escaneo);
    const previo = { ...ESCANEO_SARVO_VACIO, ...(anterior.sarvo || {}) };

    if (ficha) {
        if (ficha.maps_url && !p.maps_url) campos.maps_url = ficha.maps_url;
        if (ficha.direccion && !p.direccion) campos.direccion = ficha.direccion;
        if (ficha.categoria && !p.especialidad) campos.especialidad = ficha.categoria;
        if (ficha.rating != null) campos.rating = ficha.rating;
        if (ficha.reviews_count != null) campos.reviews_count = ficha.reviews_count;
        if (ficha.telefono && !p.telefono_wa) {
            const wa = telefonoAWhatsapp(ficha.telefono);
            if (wa) {
                campos.telefono = p.telefono || ficha.telefono;
                campos.telefono_wa = wa;
                campos.canal = "whatsapp";
            }
        }
        if (sitio && !p.sitio_web_url && !esRed(sitio)) campos.sitio_web_url = sitio;
    }
    const ig = web?.instagram || (/instagram\.com/i.test(sitio) ? sitio : "");
    if (ig && !p.instagram_url) {
        campos.instagram_url = ig;
        if (!p.telefono_wa && !campos.telefono_wa) campos.canal = "instagram";
    }

    if (lectura.profesional && !p.contacto_nombre) campos.contacto_nombre = lectura.profesional;
    if (lectura.cant_profesionales != null && p.cant_profesionales == null) campos.cant_profesionales = lectura.cant_profesionales;
    // La primera línea se escribe solo si está vacía: si ya la editaste a mano, gana la tuya.
    if (lectura.primera_linea && !p.dato_usado.trim()) campos.dato_usado = lectura.primera_linea;

    const sarvo: EscaneoSarvo = {
        ...previo,
        // Lo que ya marcaste a mano no lo pisa el robot.
        segmento: previo.segmento !== "sin_definir" ? previo.segmento : lectura.segmento,
        rubro: previo.rubro || lectura.rubro,
        precios_publicados: previo.precios_publicados ?? lectura.precios_publicados,
        link_turnos: previo.link_turnos || web?.sistema_turnos || "",
        evidencias: lectura.evidencias.length ? lectura.evidencias : previo.evidencias,
        escaneado_at: new Date().toISOString(),
    };
    campos.escaneo = { ...anterior, sarvo };
    campos.escaneado_at = sarvo.escaneado_at;

    if (ficha?.cerrado) {
        campos.estado = "descartado";
        campos.motivo_descarte = "Google lo marca como cerrado";
    } else if (p.estado === "sin_calificar") {
        campos.estado = "calificado";
    }

    const partes = [
        sarvo.segmento === "solo" ? "contesta él" : sarvo.segmento === "centro" ? "centro con recepción" : "segmento sin definir",
        sarvo.rubro || "rubro sin detectar",
        campos.telefono_wa || p.telefono_wa ? "WhatsApp" : ig || p.instagram_url ? "Instagram" : "sin canal",
        sarvo.link_turnos ? `ya usa ${sarvo.link_turnos}` : "",
        ficha ? "" : "sin ficha de Google",
    ].filter(Boolean);

    return { prospecto_id: p.id, negocio: p.negocio, campos, resumen: partes.join(" · ") };
}

// ─── Handler ─────────────────────────────────────────────────

export async function POST(req: Request) {
    try {
        const { prospectos } = (await req.json()) as { prospectos?: Prospecto[] };
        if (!Array.isArray(prospectos) || prospectos.length === 0) {
            return NextResponse.json({ error: "Falta la lista de prospectos" }, { status: 400 });
        }
        if (prospectos.length > MAX_POR_LOTE) {
            return NextResponse.json({ error: `Máximo ${MAX_POR_LOTE} por llamada` }, { status: 400 });
        }
        if (!GOOGLE_API_KEY) {
            return NextResponse.json({ error: "Falta GOOGLE_PLACES_API_KEY en el servidor" }, { status: 500 });
        }

        // De a cuatro a la vez: más rápido que en serie y sin disparar un 429.
        const resultados: ResultadoTurnos[] = new Array(prospectos.length);
        let siguiente = 0;
        const trabajador = async () => {
            while (siguiente < prospectos.length) {
                const i = siguiente++;
                const p = prospectos[i];
                try {
                    resultados[i] = await escanear(p);
                } catch (e) {
                    resultados[i] = {
                        prospecto_id: p.id,
                        negocio: p.negocio,
                        campos: {},
                        resumen: "",
                        error: e instanceof Error ? e.message : "error desconocido",
                    };
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(EN_PARALELO, prospectos.length) }, trabajador));

        return NextResponse.json({ resultados, con_ia: !!GEMINI_API_KEY });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Error al escanear" },
            { status: 500 }
        );
    }
}
