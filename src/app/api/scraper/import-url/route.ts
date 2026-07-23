import { NextResponse } from "next/server";
import type { ProspectoScraped } from "@/lib/types";

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

// ─── Extraer place_id de una URL de Google Maps ──────────────────────────────

function extractPlaceIdFromUrl(url: string): string | null {
    let decoded = url;
    try { decoded = decodeURIComponent(url); } catch { /* usar original */ }

    const matchQ = decoded.match(/place_id[=:]([A-Za-z0-9_-]{10,})/);
    if (matchQ) return matchQ[1];

    const match19 = decoded.match(/!19s(ChIJ[A-Za-z0-9_-]+)/);
    if (match19) return match19[1];

    const match1 = decoded.match(/!1s(ChIJ[A-Za-z0-9_-]+)/);
    if (match1) return match1[1];

    const matchGeneric = decoded.match(/\b(ChIJ[A-Za-z0-9_-]{10,})/);
    if (matchGeneric) return matchGeneric[1];

    return null;
}

// ─── Extraer coordenadas de la URL ────────────────────────────────────────────

function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
    const latMatch = url.match(/!3d(-?\d+\.\d+)/);
    const lngMatch = url.match(/!4d(-?\d+\.\d+)/);
    if (latMatch && lngMatch) {
        return { lat: parseFloat(latMatch[1]), lng: parseFloat(lngMatch[1]) };
    }
    const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch) {
        return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
    }
    return null;
}

// ─── Extraer nombre del negocio de la URL ────────────────────────────────────

function extractBusinessNameFromUrl(url: string): string | null {
    const match = url.match(/\/maps\/place\/([^/@?]+)/);
    if (match) {
        return decodeURIComponent(match[1].replace(/\+/g, " ")).trim();
    }
    return null;
}

// ─── Resolver URL corta ───────────────────────────────────────────────────────

async function resolveShortUrl(url: string): Promise<string> {
    try {
        const res = await fetch(url, {
            redirect: "follow",
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(8000),
        });
        return res.url;
    } catch {
        return url;
    }
}

// ─── Obtener detalles por place_id (Places API New) ──────────────────────────

async function fetchPlaceDetails(placeId: string): Promise<{ result: Record<string, unknown> | null; apiStatus: string }> {
    const fieldMask = [
        "id", "displayName", "formattedAddress",
        "nationalPhoneNumber", "internationalPhoneNumber",
        "websiteUri", "rating", "userRatingCount", "primaryType",
    ].join(",");

    try {
        const url = `${PLACES_BASE}/places/${placeId}`;
        const res = await fetch(url, {
            method: "GET",
            headers: placesHeaders(fieldMask),
            signal: AbortSignal.timeout(10000),
        });

        const data = await res.json();
        console.log(`[Places Details New] place_id=${placeId} status=${res.status} error=${data.error?.message || "none"}`);

        if (res.ok && data.id) return { result: data, apiStatus: "OK" };
        return { result: null, apiStatus: data.error?.message || `HTTP ${res.status}` };
    } catch (e) {
        return { result: null, apiStatus: e instanceof Error ? e.message : "timeout" };
    }
}

// ─── Buscar por nombre + coordenadas (Places API New) ────────────────────────

async function searchNearbyByName(
    name: string,
    lat: number,
    lng: number
): Promise<{ placeId: string | null; apiStatus: string }> {
    try {
        const body = {
            textQuery: name,
            locationBias: {
                circle: {
                    center: { latitude: lat, longitude: lng },
                    radius: 500,
                },
            },
            languageCode: "es",
            pageSize: 1,
        };

        const res = await fetch(`${PLACES_BASE}/places:searchText`, {
            method: "POST",
            headers: placesHeaders("places.id,places.displayName"),
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10000),
        });

        const data = await res.json();
        console.log(`[Places NearbySearch New] name="${name}" status=${res.status}`);

        if (res.ok && data.places?.length > 0) {
            return { placeId: data.places[0].id, apiStatus: "OK" };
        }
        return { placeId: null, apiStatus: data.error?.message || "ZERO_RESULTS" };
    } catch (e) {
        return { placeId: null, apiStatus: e instanceof Error ? e.message : "timeout" };
    }
}

// ─── Formatear teléfono para WhatsApp ────────────────────────────────────────

function formatPhoneForWhatsapp(phone: string | undefined): string | null {
    if (!phone) return null;
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("549")) return cleaned;
    if (cleaned.startsWith("54")) return "549" + cleaned.slice(2);
    if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
    if (cleaned.length >= 8) return "549" + cleaned;
    return null;
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: Request) {
    try {
        if (!GOOGLE_API_KEY) {
            return NextResponse.json(
                { error: "Google Places API key no configurada en el servidor." },
                { status: 500 }
            );
        }

        const body = await req.json();
        const { urls }: { urls: string[] } = body;

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return NextResponse.json(
                { error: "Se requiere un array de URLs de Google Maps." },
                { status: 400 }
            );
        }

        const results: ProspectoScraped[] = [];
        const errors: { url: string; error: string }[] = [];

        for (const rawUrl of urls) {
            const url = rawUrl.trim();
            if (!url) continue;

            try {
                // 1. Resolver URLs cortas
                let resolvedUrl = url;
                if (url.includes("goo.gl") || url.includes("maps.app")) {
                    resolvedUrl = await resolveShortUrl(url);
                }

                // 2. Extraer info de la URL
                let placeId = extractPlaceIdFromUrl(resolvedUrl);
                const coords = extractCoordsFromUrl(resolvedUrl);
                const businessName = extractBusinessNameFromUrl(resolvedUrl);

                console.log(`[Import URL] placeId=${placeId} coords=${JSON.stringify(coords)} name=${businessName}`);

                // 3. Fallback: buscar nearby si hay coordenadas
                if (!placeId && coords && businessName) {
                    const nearbyResult = await searchNearbyByName(businessName, coords.lat, coords.lng);
                    if (nearbyResult.placeId) {
                        placeId = nearbyResult.placeId;
                    } else {
                        errors.push({ url, error: `No se encontró el negocio cerca de las coordenadas (${nearbyResult.apiStatus})` });
                        continue;
                    }
                }

                if (!placeId) {
                    errors.push({ url, error: "No se pudo identificar el negocio en esta URL." });
                    continue;
                }

                // 4. Obtener detalles
                const { result: details, apiStatus } = await fetchPlaceDetails(placeId);
                if (!details) {
                    errors.push({ url, error: `Error al obtener datos del negocio: ${apiStatus}` });
                    continue;
                }

                const phoneRaw =
                    (details.internationalPhoneNumber as string) ||
                    (details.nationalPhoneNumber as string) ||
                    undefined;

                const telefonoClean = formatPhoneForWhatsapp(phoneRaw) || undefined;
                const website = details.websiteUri as string | undefined;
                const tieneSitioWeb =
                    !!website &&
                    !website.includes("facebook.com") &&
                    !website.includes("instagram.com");

                const nombre = ((details.displayName as { text: string })?.text) || businessName || "Negocio";
                const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;
                const instagram = website?.includes("instagram.com") ? website : undefined;
                const facebook = website?.includes("facebook.com") ? website : undefined;

                results.push({
                    id: `gmaps-url-${placeId}`,
                    nombre,
                    rubro: (details.primaryType as string)?.replace(/_/g, " ") || "Negocio",
                    lugar: (details.formattedAddress as string)?.split(",").slice(-2).join(",").trim() || "",
                    direccion: (details.formattedAddress as string) || "",
                    telefono: details.nationalPhoneNumber as string || phoneRaw,
                    telefonoClean,
                    tieneSitioWeb,
                    sitioWebUrl: tieneSitioWeb ? website : undefined,
                    rating: details.rating as number | undefined,
                    reviewsCount: details.userRatingCount as number | undefined,
                    redesSociales: { instagram, facebook },
                    guardadoEnCrm: false,
                    fechaExtraccion: new Date().toISOString(),
                    mapsUrl,
                });

                await new Promise((r) => setTimeout(r, 300));
            } catch (err) {
                errors.push({
                    url,
                    error: err instanceof Error ? err.message : "Error desconocido",
                });
            }
        }

        return NextResponse.json({
            success: true,
            data: { resultados: results, errores: errors, total: results.length },
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error al importar URLs";
        console.error("Error en importar-urls:", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
