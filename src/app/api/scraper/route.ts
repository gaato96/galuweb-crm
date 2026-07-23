import { NextResponse } from "next/server";
import type { ProspectoScraped, ScraperBusqueda } from "@/lib/types";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";
const PLACES_BASE = "https://places.googleapis.com/v1";

// ─── Headers para Places API (New) ──────────────────────────────────────────

function placesHeaders(fieldMask: string) {
    return {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": fieldMask,
    };
}

// ─── Tipos de respuesta Places API (New) ─────────────────────────────────────

interface NewPlace {
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    rating?: number;
    userRatingCount?: number;
    primaryType?: string;
}

// ─── Formatear teléfono para WhatsApp Argentina ──────────────────────────────

function formatPhoneForWhatsapp(phone: string | undefined): string | null {
    if (!phone) return null;
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("549")) return cleaned;
    if (cleaned.startsWith("54")) return "549" + cleaned.slice(2);
    if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
    if (cleaned.length >= 8) return "549" + cleaned;
    return null;
}

// ─── Buscar todos los lugares con paginación (Places API New) ────────────────

async function fetchAllPlaces(query: string, location: string): Promise<NewPlace[]> {
    const allPlaces: NewPlace[] = [];
    const seenIds = new Set<string>();

    const fieldMask = [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.nationalPhoneNumber",
        "places.internationalPhoneNumber",
        "places.websiteUri",
        "places.rating",
        "places.userRatingCount",
        "places.primaryType",
    ].join(",");

    let pageToken: string | undefined;
    const MAX_PAGES = 3; // máximo 60 resultados (3 x 20)

    for (let page = 0; page < MAX_PAGES; page++) {
        const body: Record<string, unknown> = {
            textQuery: `${query} en ${location}`,
            languageCode: "es",
            regionCode: "AR",
            pageSize: 20,
        };
        if (pageToken) body.pageToken = pageToken;

        const res = await fetch(`${PLACES_BASE}/places:searchText`, {
            method: "POST",
            headers: placesHeaders(fieldMask),
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
            console.error(`[Places TextSearch] HTTP ${res.status}`);
            break;
        }

        const data = await res.json();
        if (!data.places || data.places.length === 0) break;

        for (const place of data.places as NewPlace[]) {
            if (!seenIds.has(place.id)) {
                seenIds.add(place.id);
                allPlaces.push(place);
            }
        }

        if (data.nextPageToken) {
            pageToken = data.nextPageToken;
            await new Promise((r) => setTimeout(r, 2000));
        } else {
            break;
        }
    }

    return allPlaces;
}

// ─── Handler principal ────────────────────────────────────────────────────────

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

        // Buscar todos los lugares en Google Maps
        const places = await fetchAllPlaces(rubro, lugar);

        const scrapedItems: ProspectoScraped[] = places.map((place) => {
            const nombre = place.displayName?.text || "Negocio sin nombre";
            const direccion = place.formattedAddress || lugar;

            const phoneRaw = place.internationalPhoneNumber || place.nationalPhoneNumber;
            const telefonoClean = formatPhoneForWhatsapp(phoneRaw) || undefined;

            const website = place.websiteUri;
            const tieneSitioWeb =
                !!website &&
                !website.includes("facebook.com") &&
                !website.includes("instagram.com");

            const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${place.id}`;
            const instagram = website?.includes("instagram.com") ? website : undefined;
            const facebook = website?.includes("facebook.com") ? website : undefined;

            return {
                id: `gmaps-${place.id}`,
                nombre,
                rubro,
                lugar,
                direccion,
                telefono: place.nationalPhoneNumber || phoneRaw,
                telefonoClean,
                tieneSitioWeb,
                sitioWebUrl: tieneSitioWeb ? website : undefined,
                rating: place.rating,
                reviewsCount: place.userRatingCount,
                redesSociales: { instagram, facebook },
                guardadoEnCrm: false,
                fechaExtraccion: new Date().toISOString(),
                mapsUrl,
            };
        });

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
