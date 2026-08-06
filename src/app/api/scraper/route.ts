import { NextResponse } from "next/server";
import type { ProspectoScraped, ScraperBusqueda } from "@/lib/types";
import { telefonoAWhatsapp, normalizar } from "@/lib/prospeccion";

// La paginación de Places necesita esperas entre tokens: sin esto Vercel corta
// la ruta a los 10s por defecto y la búsqueda vuelve truncada.
export const maxDuration = 60;

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";
const PLACES_BASE = "https://places.googleapis.com/v1";

// Google devuelve como máximo 3 páginas de 20 por consulta de texto (60 resultados).
// Para pasar de ahí hay que variar la consulta o barrer el mapa por zonas.
const MAX_PAGINAS = 3;
const PAGE_SIZE = 20;
const PRESUPUESTO_MS = 45_000;

function placesHeaders(fieldMask: string) {
    return {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": fieldMask,
    };
}

interface NewPlace {
    id: string;
    displayName?: { text: string };
    primaryTypeDisplayName?: { text: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    googleMapsUri?: string;
    rating?: number;
    userRatingCount?: number;
    primaryType?: string;
    businessStatus?: string;
    location?: { latitude: number; longitude: number };
    regularOpeningHours?: { weekdayDescriptions?: string[] };
}

// Los teléfonos ya ubican la cuenta en el SKU Enterprise, así que sumar horarios
// y estado no cambia el tramo de facturación y habilita detectar fichas incompletas.
const FIELD_MASK_LUGARES = [
    "nextPageToken",
    "places.id",
    "places.displayName",
    "places.primaryType",
    "places.primaryTypeDisplayName",
    "places.formattedAddress",
    "places.nationalPhoneNumber",
    "places.internationalPhoneNumber",
    "places.websiteUri",
    "places.googleMapsUri",
    "places.rating",
    "places.userRatingCount",
    "places.businessStatus",
    "places.location",
    "places.regularOpeningHours",
].join(",");

// ─── Sinónimos por rubro (claves normalizadas, sin tildes) ────────────────────

const SINONIMOS: Record<string, string[]> = {
    comida: ["restaurantes", "bares", "rotiserías", "comida rápida", "pizzerías", "empanadas", "cafeterías", "casas de comida"],
    restaurantes: ["restaurantes", "parrillas", "bares", "pizzerías", "rotiserías", "cafeterías"],
    gimnasios: ["gimnasios", "crossfit", "centro de fitness", "musculación", "entrenamiento funcional"],
    peluquerias: ["peluquerías", "barberías", "salón de belleza", "estilistas"],
    barberias: ["barberías", "peluquería de hombres", "corte de pelo"],
    dentistas: ["dentistas", "odontólogos", "clínicas odontológicas", "consultorio odontológico", "ortodoncia", "implantes dentales"],
    odontologos: ["odontólogos", "dentistas", "clínicas odontológicas", "ortodoncia"],
    inmobiliarias: ["inmobiliarias", "bienes raíces", "propiedades", "alquileres", "martillero público"],
    abogados: ["abogados", "estudio jurídico", "abogado laboral", "abogado de familia", "sucesiones", "accidentes de tránsito"],
    contadores: ["contadores", "estudio contable", "asesoría impositiva", "monotributo"],
    medicos: ["consultorio médico", "clínica médica", "centro médico", "especialidades médicas"],
    pediatras: ["pediatras", "centro pediátrico", "consultorio pediátrico"],
    kinesiologos: ["kinesiología", "fisioterapia", "rehabilitación"],
    esteticas: ["centro de estética", "cosmetología", "depilación definitiva", "spa"],
    veterinarias: ["veterinarias", "clínica veterinaria", "pet shop"],
    opticas: ["ópticas", "óptica y contactología"],
    indumentaria: ["tiendas de ropa", "indumentaria", "boutique", "local de ropa"],
    talleres: ["talleres mecánicos", "mecánica del automotor", "gomería", "taller de chapa y pintura"],
    hoteles: ["hoteles", "hostels", "aparts", "alojamiento"],
    escribanias: ["escribanías", "escribano público"],
    arquitectos: ["arquitectos", "estudio de arquitectura", "constructoras"],
};

/** Devuelve las consultas a probar: la principal más sus sinónimos, sin repetir. */
function construirConsultas(rubro: string): string[] {
    const clave = normalizar(rubro);
    const directos = SINONIMOS[clave];
    const porInclusion = directos
        ? null
        : Object.entries(SINONIMOS).find(([k]) => clave.includes(k) || k.includes(clave))?.[1];

    const variantes = directos || porInclusion || [];
    const todas = [rubro, ...variantes];
    const vistas = new Set<string>();
    return todas.filter((q) => {
        const n = normalizar(q);
        if (vistas.has(n)) return false;
        vistas.add(n);
        return true;
    });
}

// ─── Geocodificación del lugar para poder sesgar y barrer por zonas ───────────

interface Centro { lat: number; lng: number }

async function ubicarLugar(lugar: string): Promise<Centro | null> {
    try {
        const res = await fetch(`${PLACES_BASE}/places:searchText`, {
            method: "POST",
            headers: placesHeaders("places.location"),
            body: JSON.stringify({ textQuery: lugar, languageCode: "es", regionCode: "AR", pageSize: 1 }),
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const loc = data.places?.[0]?.location;
        if (!loc) return null;
        return { lat: loc.latitude, lng: loc.longitude };
    } catch {
        return null;
    }
}

/** Grilla de 9 puntos (centro + 8 alrededor) para barrer la ciudad por zonas. */
function grilla(centro: Centro, offsetKm: number): Centro[] {
    const dLat = offsetKm / 111;
    const dLng = offsetKm / (111 * Math.cos((centro.lat * Math.PI) / 180));
    const puntos: Centro[] = [centro];
    for (const i of [-1, 0, 1]) {
        for (const j of [-1, 0, 1]) {
            if (i === 0 && j === 0) continue;
            puntos.push({ lat: centro.lat + i * dLat, lng: centro.lng + j * dLng });
        }
    }
    return puntos;
}

// ─── Búsqueda por texto con paginación real ───────────────────────────────────

interface Acumulador {
    lugares: NewPlace[];
    vistos: Set<string>;
    limite: number;
    finEn: number;
}

function agregar(acc: Acumulador, lugares: NewPlace[]): void {
    for (const p of lugares) {
        if (acc.lugares.length >= acc.limite) return;
        if (acc.vistos.has(p.id)) continue;
        // Cerrado permanentemente no sirve ni para prospectar ni para el conteo.
        if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
        acc.vistos.add(p.id);
        acc.lugares.push(p);
    }
}

const sinTiempo = (acc: Acumulador) => Date.now() > acc.finEn || acc.lugares.length >= acc.limite;

async function buscarTexto(textQuery: string, acc: Acumulador, centro: Centro | null, radioM: number) {
    let pageToken: string | undefined;

    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
        if (sinTiempo(acc)) return;

        const body: Record<string, unknown> = {
            textQuery,
            languageCode: "es",
            regionCode: "AR",
            pageSize: PAGE_SIZE,
        };
        // El sesgo por ubicación mejora mucho la pertinencia en ciudades del interior.
        if (centro) {
            body.locationBias = {
                circle: { center: { latitude: centro.lat, longitude: centro.lng }, radius: radioM },
            };
        }
        if (pageToken) body.pageToken = pageToken;

        try {
            const res = await fetch(`${PLACES_BASE}/places:searchText`, {
                method: "POST",
                headers: placesHeaders(FIELD_MASK_LUGARES),
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(12000),
            });
            if (!res.ok) {
                console.error(`[Places searchText] HTTP ${res.status} para "${textQuery}"`);
                return;
            }

            const data = await res.json();
            if (!data.places?.length) return;
            agregar(acc, data.places as NewPlace[]);

            if (!data.nextPageToken || sinTiempo(acc)) return;
            pageToken = data.nextPageToken;
            // El token tarda en activarse del lado de Google.
            await new Promise((r) => setTimeout(r, 1600));
        } catch (e) {
            console.error(`[Places searchText] error en "${textQuery}"`, e);
            return;
        }
    }
}

/** Barrido por zonas: misma consulta, distintos centros. Es lo que rompe el techo de 60. */
async function barrerPorZonas(consulta: string, acc: Acumulador, centro: Centro, radioKm: number) {
    const puntos = grilla(centro, radioKm * 0.75);
    for (const punto of puntos) {
        if (sinTiempo(acc)) return;
        await buscarTexto(consulta, acc, punto, radioKm * 1000 * 0.6);
    }
}

async function recolectar(rubro: string, lugar: string, limite: number): Promise<NewPlace[]> {
    const acc: Acumulador = {
        lugares: [],
        vistos: new Set(),
        limite,
        finEn: Date.now() + PRESUPUESTO_MS,
    };

    const centro = await ubicarLugar(lugar);
    const consultas = construirConsultas(rubro);

    // 1) Consulta principal y sinónimos, en texto libre y con sesgo al centro.
    for (const consulta of consultas) {
        if (sinTiempo(acc)) break;
        await buscarTexto(`${consulta} en ${lugar}`, acc, centro, 15000);
    }

    // 2) Si falta cobertura y sabemos dónde queda la ciudad, barremos por zonas.
    if (centro && !sinTiempo(acc)) {
        for (const consulta of consultas.slice(0, 3)) {
            if (sinTiempo(acc)) break;
            await barrerPorZonas(consulta, acc, centro, 6);
        }
    }

    return acc.lugares;
}

// ─── Puntaje de prioridad ─────────────────────────────────────────────────────

const RUBROS_RESENA_FUERTE = ["odontolog", "dentista", "consultorio", "medic", "clinic", "gastronom", "restaurant", "bar", "cafeter", "pizzer", "comercio", "indumentaria", "optic", "estetic", "peluquer", "barber", "gimnasio", "hotel", "veterinar"];

/**
 * Ordena la lista según el criterio del sistema de prospección:
 * primero Instagram-como-web, después sin nada, al final los que ya tienen web real.
 * Suma señales de que hay dato de personalización esperando (rating bajo con volumen,
 * ficha incompleta) y resta las de descarte rápido (casi sin reseñas).
 */
function puntuar(p: ProspectoScraped, percentilResenas: number | null, pesoResenas: number): number {
    let score = 0;

    if (p.redesSociales.instagram && !p.tieneSitioWeb) score += 30;
    else if (!p.tieneSitioWeb) score += 25;
    else score += 5;

    if (p.telefonoClean) score += 10;
    if (p.sinHorarios) score += 8;

    if (percentilResenas != null) score += Math.round(percentilResenas * 20 * pesoResenas);

    // Rating bajo con volumen = casi seguro hay quejas públicas, el dato más fuerte.
    if (p.rating != null && p.reviewsCount != null && p.reviewsCount >= 10 && p.rating < 4.2) score += 15;

    // Descarte rápido: menos de 5 reseñas es ficha abandonada o negocio sin flujo.
    if (p.reviewsCount != null && p.reviewsCount < 5) score -= 20;

    return Math.max(0, score);
}

function ordenarPorPrioridad(items: ProspectoScraped[], rubro: string): ProspectoScraped[] {
    const r = normalizar(rubro);
    const pesoResenas = RUBROS_RESENA_FUERTE.some((k) => r.includes(k)) ? 1 : 0.4;

    const conResenas = items
        .map((p) => p.reviewsCount)
        .filter((n): n is number => n != null)
        .sort((a, b) => a - b);

    const percentil = (n: number | null | undefined): number | null => {
        if (n == null || conResenas.length < 4) return null;
        const menores = conResenas.filter((v) => v < n).length;
        return menores / conResenas.length;
    };

    return items
        .map((p) => ({ ...p, score: puntuar(p, percentil(p.reviewsCount), pesoResenas) }))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    try {
        const { rubro, lugar, limite } = await req.json();

        if (!rubro || !lugar) {
            return NextResponse.json({ error: "Se requieren los campos 'rubro' y 'lugar'" }, { status: 400 });
        }
        if (!GOOGLE_API_KEY) {
            return NextResponse.json({ error: "Google Places API key no configurada en el servidor." }, { status: 500 });
        }

        // Techo duro: cada resultado se factura, y sin límite una búsqueda se va de precio.
        const limiteSolicitado = Number(limite) || 200;
        const objetivo = Math.min(Math.max(limiteSolicitado, 20), 300);

        const lugares = await recolectar(rubro, lugar, objetivo);

        const items: ProspectoScraped[] = lugares.map((place) => {
            const nombre = place.displayName?.text || "Negocio sin nombre";
            const telefonoRaw = place.internationalPhoneNumber || place.nationalPhoneNumber || "";
            const web = place.websiteUri || "";
            const esRed = /facebook\.com|instagram\.com|linktr\.ee|linktree/.test(web);

            return {
                id: `gmaps-${place.id}`,
                nombre,
                rubro,
                lugar,
                direccion: place.formattedAddress || lugar,
                telefono: place.nationalPhoneNumber || telefonoRaw || null,
                telefonoClean: telefonoAWhatsapp(telefonoRaw) || undefined,
                tieneSitioWeb: !!web && !esRed,
                sitioWebUrl: web && !esRed ? web : undefined,
                rating: place.rating,
                reviewsCount: place.userRatingCount,
                redesSociales: {
                    instagram: web.includes("instagram.com") ? web : undefined,
                    facebook: web.includes("facebook.com") ? web : undefined,
                },
                guardadoEnCrm: false,
                fechaExtraccion: new Date().toISOString(),
                // googleMapsUri es la URL canónica de la ficha; el place_id armado a mano
                // a veces no resuelve bien desde el celular.
                mapsUrl: place.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${place.id}`,
                categoriaGoogle: place.primaryTypeDisplayName?.text || place.primaryType,
                sinHorarios: !place.regularOpeningHours?.weekdayDescriptions?.length,
                lat: place.location?.latitude,
                lng: place.location?.longitude,
            };
        });

        const ordenados = ordenarPorPrioridad(items, rubro);

        const resultado: ScraperBusqueda = {
            id: `search-${Date.now()}`,
            created_at: new Date().toISOString(),
            rubro,
            lugar,
            totalResultados: ordenados.length,
            sinWebCount: ordenados.filter((p) => !p.tieneSitioWeb).length,
            conWhatsappCount: ordenados.filter((p) => !!p.telefonoClean).length,
            prospectos: ordenados,
        };

        return NextResponse.json({ success: true, data: resultado });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error al buscar en Google Maps";
        console.error("[API Scraper]", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
