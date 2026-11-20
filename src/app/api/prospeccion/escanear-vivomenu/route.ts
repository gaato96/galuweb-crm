import { NextResponse } from "next/server";
import type { Prospecto, EscaneoVivo } from "@/lib/types";
import { extraerPlaceId } from "@/lib/places-url";
import { telefonoAWhatsapp, normalizarEscaneo } from "@/lib/prospeccion";

// ============================================================
// Escaneo rápido de VivoMenu — lo justo para escribirle a un local de comida.
//
// Lo usa la pantalla del celular (/prospeccion/vivomenu), que lo corre sola
// sobre los locales del día: Gastón no toca ningún botón de escanear.
//
// Una sola llamada a la ficha de Google por local, sin reseñas ni IA:
//   · el teléfono (para el WhatsApp);
//   · si hace delivery, para llevar o tiene salón (Google lo informa por local:
//     es lo que dice si es el cliente del plan, no la categoría con la que se
//     importó);
//   · las reseñas y el rating (cuánto movimiento tiene);
//   · si cerró, para sacarlo de la cola;
//   · su Instagram si el "sitio web" de la ficha es su Instagram.
// ============================================================

export const maxDuration = 60;

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";
const PLACES_BASE = "https://places.googleapis.com/v1";
const MAX_POR_LOTE = 12;
const EN_PARALELO = 4;

const FIELD_MASK = [
    "id", "nationalPhoneNumber", "internationalPhoneNumber", "websiteUri", "googleMapsUri",
    "rating", "userRatingCount", "primaryTypeDisplayName", "businessStatus",
    "delivery", "takeout", "dineIn",
].join(",");

interface ResultadoVivo {
    prospecto_id: string;
    campos: Partial<Prospecto>;
    error?: string;
}

let errorPlaces = "";

async function placeIdDe(p: Prospecto): Promise<string | null> {
    const id = p.maps_url ? extraerPlaceId(p.maps_url) : null;
    if (id) return id;
    const query = [p.negocio, p.direccion && p.direccion !== "·" ? p.direccion : "", p.ciudad || "Tucumán"].filter(Boolean).join(" ");
    try {
        const res = await fetch(`${PLACES_BASE}/places:searchText`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Goog-Api-Key": GOOGLE_API_KEY, "X-Goog-FieldMask": "places.id" },
            body: JSON.stringify({ textQuery: query, languageCode: "es", pageSize: 1 }),
            signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) {
            errorPlaces = `Google Places respondió ${res.status}`;
            return null;
        }
        return (await res.json()).places?.[0]?.id || null;
    } catch {
        return null;
    }
}

/**
 * Un celular argentino, el único que se puede abrir en WhatsApp: el internacional
 * lleva el 9 (+54 9 381 …) o el nacional lleva el 15 (0381 15-…). Un fijo no.
 */
function pareceCelular(nacional: string, internacional: string): boolean {
    if (/^\+54\s*9/.test(internacional)) return true;
    const d = nacional.replace(/\D/g, "");
    return /^0?\d{2,4}15\d{6,8}$/.test(d);
}

async function escanearUno(p: Prospecto): Promise<ResultadoVivo> {
    const id = await placeIdDe(p);
    if (!id) return { prospecto_id: p.id, campos: {}, error: errorPlaces || "No se encontró la ficha en Google" };
    try {
        const res = await fetch(`${PLACES_BASE}/places/${id}?languageCode=es`, {
            headers: { "X-Goog-Api-Key": GOOGLE_API_KEY, "X-Goog-FieldMask": FIELD_MASK },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
            errorPlaces = `Google Places respondió ${res.status}`;
            return { prospecto_id: p.id, campos: {}, error: errorPlaces };
        }
        const d = await res.json();
        const nacional: string = d.nationalPhoneNumber || "";
        const internacional: string = d.internationalPhoneNumber || "";
        const web: string = d.websiteUri || "";
        const esInstagram = /instagram\.com/i.test(web);
        // telefonoAWhatsapp arma el 549… a partir del número; si es un fijo no
        // se puede abrir en WhatsApp, así que no se guarda como WhatsApp.
        const wa = nacional && pareceCelular(nacional, internacional) ? telefonoAWhatsapp(internacional || nacional) : "";

        const vivo: EscaneoVivo = {
            escaneado_at: new Date().toISOString(),
            delivery: typeof d.delivery === "boolean" ? d.delivery : null,
            para_llevar: typeof d.takeout === "boolean" ? d.takeout : null,
            salon: typeof d.dineIn === "boolean" ? d.dineIn : null,
            categoria: d.primaryTypeDisplayName?.text || "",
            cerrado: d.businessStatus === "CLOSED_PERMANENTLY",
        };

        const campos: Partial<Prospecto> = {
            telefono: nacional || p.telefono,
            telefono_wa: wa || p.telefono_wa,
            whatsapp_publicado: !!(wa || p.telefono_wa),
            canal: wa || p.telefono_wa ? "whatsapp" : "instagram",
            rating: typeof d.rating === "number" ? d.rating : p.rating,
            reviews_count: typeof d.userRatingCount === "number" ? d.userRatingCount : p.reviews_count,
            maps_url: d.googleMapsUri || p.maps_url,
            escaneado_at: vivo.escaneado_at,
            escaneo: { ...normalizarEscaneo(p.escaneo), vivo },
            ...(esInstagram && !p.instagram_url ? { instagram_url: web } : {}),
            ...(!esInstagram && web && !p.sitio_web_url ? { sitio_web_url: web } : {}),
            ...(vivo.cerrado ? { estado: "descartado" as const, motivo_descarte: "Cerrado (según Google)" } : {}),
        };
        return { prospecto_id: p.id, campos };
    } catch (e) {
        return { prospecto_id: p.id, campos: {}, error: e instanceof Error ? e.message : "Error al leer la ficha" };
    }
}

export async function POST(req: Request) {
    if (!GOOGLE_API_KEY) {
        return NextResponse.json({ error: "Falta GOOGLE_PLACES_API_KEY en el servidor" }, { status: 500 });
    }
    errorPlaces = "";
    const { prospectos } = (await req.json()) as { prospectos: Prospecto[] };
    const lote = (prospectos || []).slice(0, MAX_POR_LOTE);
    const resultados: ResultadoVivo[] = [];
    for (let i = 0; i < lote.length; i += EN_PARALELO) {
        resultados.push(...(await Promise.all(lote.slice(i, i + EN_PARALELO).map(escanearUno))));
    }
    const aviso = errorPlaces && resultados.every((r) => r.error) ? `${errorPlaces}: revisá la clave de Google Places` : "";
    return NextResponse.json({ resultados, aviso });
}
