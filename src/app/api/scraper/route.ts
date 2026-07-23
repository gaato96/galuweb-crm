import { NextResponse } from "next/server";
import type { ProspectoScraped, ScraperBusqueda } from "@/lib/types";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

// ─── Tipos de respuesta de Google Places API ─────────────────────────────────

interface GooglePlaceResult {
    place_id: string;
    name: string;
    formatted_address?: string;
    vicinity?: string;
    geometry?: { location: { lat: number; lng: number } };
    rating?: number;
    user_ratings_total?: number;
    website?: string;
    formatted_phone_number?: string;
    international_phone_number?: string;
    opening_hours?: { open_now?: boolean };
    types?: string[];
    photos?: { photo_reference: string }[];
}

interface GooglePlacesTextSearchResponse {
    results: GooglePlaceResult[];
    next_page_token?: string;
    status: string;
    error_message?: string;
}

interface GooglePlaceDetailsResponse {
    result?: GooglePlaceResult;
    status: string;
}

// ─── Obtener detalles de un lugar (teléfono, website, redes) ────────────────

async function fetchPlaceDetails(placeId: string): Promise<Partial<GooglePlaceResult>> {
    if (!GOOGLE_API_KEY) return {};
    try {
        const fields = "formatted_phone_number,international_phone_number,website,opening_hours,rating,user_ratings_total";
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&language=es&key=${GOOGLE_API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) return {};
        const data: GooglePlaceDetailsResponse = await res.json();
        if (data.status === "OK" && data.result) {
            return data.result;
        }
        return {};
    } catch {
        return {};
    }
}

// ─── Formatear número para WhatsApp Argentina ───────────────────────────────

function formatPhoneForWhatsapp(phone: string | undefined): string | null {
    if (!phone) return null;
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("549")) return cleaned;
    if (cleaned.startsWith("54")) return "549" + cleaned.slice(2);
    if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
    if (cleaned.length >= 8) return "549" + cleaned;
    return null;
}

// ─── Extraer redes sociales del website ────────────────────────────────────

function extractSocialLinks(website?: string): { instagram?: string; facebook?: string } {
    if (!website) return {};
    const ig = website.includes("instagram.com") ? website : undefined;
    const fb = website.includes("facebook.com") ? website : undefined;
    return { instagram: ig, facebook: fb };
}

// ─── Buscar TODOS los resultados con paginación ───────────────────────────

async function fetchAllPlaces(query: string, location: string): Promise<GooglePlaceResult[]> {
    const allResults: GooglePlaceResult[] = [];
    const seenIds = new Set<string>();

    // Text Search: busca por texto libre en una ubicación
    let searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + " en " + location)}&language=es&region=ar&key=${GOOGLE_API_KEY}`;

    let pageCount = 0;
    const MAX_PAGES = 5; // Google Places devuelve hasta 60 resultados (3 páginas de 20)

    while (searchUrl && pageCount < MAX_PAGES) {
        const res = await fetch(searchUrl);
        if (!res.ok) break;

        const data: GooglePlacesTextSearchResponse = await res.json();

        if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
            console.error("Google Places API error:", data.status, data.error_message);
            break;
        }

        for (const place of data.results) {
            if (!seenIds.has(place.place_id)) {
                seenIds.add(place.place_id);
                allResults.push(place);
            }
        }

        // Obtener siguiente página si existe
        if (data.next_page_token) {
            pageCount++;
            // Google requiere un delay antes de usar next_page_token
            await new Promise((r) => setTimeout(r, 2000));
            searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${data.next_page_token}&key=${GOOGLE_API_KEY}`;
        } else {
            break;
        }
    }

    return allResults;
}

// ─── Handler principal ────────────────────────────────────────────────────

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { rubro, lugar } = body;

        if (!rubro || !lugar) {
            return NextResponse.json(
                { error: "Se requieren los campos 'rubro' y 'lugar'" },
                { status: 400 }
            );
        }

        if (!GOOGLE_API_KEY) {
            return NextResponse.json(
                { error: "Google Places API key no configurada en el servidor." },
                { status: 500 }
            );
        }

        // 1. Buscar todos los lugares en Google Maps
        const places = await fetchAllPlaces(rubro, lugar);

        // 2. Para cada resultado, obtener detalles (teléfono, website, etc.)
        //    Procesamos en lotes de 5 para no saturar la API
        const scrapedItems: ProspectoScraped[] = [];

        const BATCH_SIZE = 5;
        for (let i = 0; i < places.length; i += BATCH_SIZE) {
            const batch = places.slice(i, i + BATCH_SIZE);
            const detailsPromises = batch.map((p) => fetchPlaceDetails(p.place_id));
            const batchDetails = await Promise.all(detailsPromises);

            batch.forEach((place, batchIdx) => {
                const details = batchDetails[batchIdx];
                const nombre = place.name;
                const direccion = place.formatted_address || place.vicinity || lugar;

                const phoneRaw =
                    details.international_phone_number ||
                    details.formatted_phone_number ||
                    place.formatted_phone_number ||
                    undefined;

                const telefonoClean = formatPhoneForWhatsapp(phoneRaw) || undefined;
                const website = details.website || place.website;
                const tieneSitioWeb = !!website && !website.includes("facebook.com") && !website.includes("instagram.com");
                const socials = extractSocialLinks(details.website || website);

                // Link directo al place en Google Maps usando el place_id real
                const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${place.place_id}`;

                scrapedItems.push({
                    id: `gmaps-${place.place_id}`,
                    nombre,
                    rubro,
                    lugar,
                    direccion,
                    telefono: details.formatted_phone_number || phoneRaw || undefined,
                    telefonoClean,
                    tieneSitioWeb,
                    sitioWebUrl: tieneSitioWeb ? website : undefined,
                    rating: details.rating ?? place.rating,
                    reviewsCount: details.user_ratings_total ?? place.user_ratings_total,
                    redesSociales: {
                        instagram: socials.instagram,
                        facebook: socials.facebook,
                    },
                    guardadoEnCrm: false,
                    fechaExtraccion: new Date().toISOString(),
                    mapsUrl,
                });
            });

            // Pequeño delay entre lotes
            if (i + BATCH_SIZE < places.length) {
                await new Promise((r) => setTimeout(r, 500));
            }
        }

        const sinWebCount = scrapedItems.filter((p) => !p.tieneSitioWeb).length;
        const conWhatsappCount = scrapedItems.filter((p) => !!p.telefonoClean).length;

        const resultadoBusqueda: ScraperBusqueda = {
            id: `search-${Date.now()}`,
            created_at: new Date().toISOString(),
            rubro,
            lugar,
            totalResultados: scrapedItems.length,
            sinWebCount,
            conWhatsappCount,
            prospectos: scrapedItems,
        };

        return NextResponse.json({ success: true, data: resultadoBusqueda });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error al buscar en Google Maps";
        console.error("Error en API Scraper:", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
