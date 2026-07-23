import { NextResponse } from "next/server";
import type { ProspectoScraped } from "@/lib/types";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

// ─── Extraer place_id de una URL de Google Maps ──────────────────────────────

function extractPlaceIdFromUrl(url: string): string | null {
    let decodedUrl = url;
    try { decodedUrl = decodeURIComponent(url); } catch { /* usar original */ }

    const matchQ = decodedUrl.match(/place_id[=:]([A-Za-z0-9_-]{10,})/);
    if (matchQ) return matchQ[1];

    const match19 = decodedUrl.match(/!19s(ChIJ[A-Za-z0-9_-]+)/);
    if (match19) return match19[1];

    const match1 = decodedUrl.match(/!1s(ChIJ[A-Za-z0-9_-]+)/);
    if (match1) return match1[1];

    const matchGeneric = decodedUrl.match(/\b(ChIJ[A-Za-z0-9_-]{10,})/);
    if (matchGeneric) return matchGeneric[1];

    return null;
}

// ─── Extraer coordenadas de la URL ────────────────────────────────────────────

function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
    // Formato: !3d-26.837!4d-65.220 (en el data parameter)
    const latMatch = url.match(/!3d(-?\d+\.\d+)/);
    const lngMatch = url.match(/!4d(-?\d+\.\d+)/);
    if (latMatch && lngMatch) {
        return { lat: parseFloat(latMatch[1]), lng: parseFloat(lngMatch[1]) };
    }
    // Formato: @-26.837,-65.220,17z
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

// ─── Resolver URL corta (maps.app.goo.gl) ────────────────────────────────────

async function resolveShortUrl(url: string): Promise<string> {
    try {
        const res = await fetch(url, {
            method: "GET",
            redirect: "follow",
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(8000),
        });
        return res.url;
    } catch {
        return url;
    }
}

// ─── Obtener detalles por place_id (Places API legacy) ───────────────────────

async function fetchPlaceDetails(placeId: string): Promise<{ result: Record<string, unknown> | null; apiStatus: string }> {
    const fields = [
        "name", "formatted_address", "formatted_phone_number",
        "international_phone_number", "website", "rating",
        "user_ratings_total", "types", "vicinity",
    ].join(",");

    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&language=es&key=${GOOGLE_API_KEY}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return { result: null, apiStatus: `HTTP ${res.status}` };
        const data = await res.json();
        console.log(`[Places Details] place_id=${placeId} status=${data.status} error=${data.error_message || "none"}`);
        if (data.status === "OK" && data.result) return { result: data.result, apiStatus: "OK" };
        return { result: null, apiStatus: data.error_message || data.status };
    } catch (e) {
        return { result: null, apiStatus: e instanceof Error ? e.message : "timeout" };
    }
}

// ─── Buscar por nombre cerca de coordenadas ──────────────────────────────────

async function searchNearbyByName(
    name: string,
    lat: number,
    lng: number
): Promise<{ placeId: string | null; apiStatus: string }> {
    try {
        const query = encodeURIComponent(name);
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&location=${lat},${lng}&radius=500&language=es&key=${GOOGLE_API_KEY}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return { placeId: null, apiStatus: `HTTP ${res.status}` };
        const data = await res.json();
        console.log(`[Places TextSearch] name="${name}" status=${data.status} error=${data.error_message || "none"}`);
        if (data.status === "OK" && data.results?.length > 0) {
            return { placeId: data.results[0].place_id, apiStatus: "OK" };
        }
        return { placeId: null, apiStatus: data.error_message || data.status };
    } catch (e) {
        return { placeId: null, apiStatus: e instanceof Error ? e.message : "timeout" };
    }
}

// ─── Buscar place_id solo por texto ──────────────────────────────────────────

async function searchByText(query: string): Promise<string | null> {
    try {
        const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name&language=es&key=${GOOGLE_API_KEY}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.status === "OK" && data.candidates?.length > 0) return data.candidates[0].place_id as string;
        return null;
    } catch {
        return null;
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

                // 2. Extraer información de la URL
                let placeId = extractPlaceIdFromUrl(resolvedUrl);
                const coords = extractCoordsFromUrl(resolvedUrl);
                const businessName = extractBusinessNameFromUrl(resolvedUrl);

                console.log(`[Import URL] placeId=${placeId} coords=${JSON.stringify(coords)} name=${businessName}`);

                // 3. Si no hay place_id pero hay coordenadas + nombre, buscar nearby
                if (!placeId && coords && businessName) {
                    const nearbyResult = await searchNearbyByName(businessName, coords.lat, coords.lng);
                    if (nearbyResult.placeId) {
                        placeId = nearbyResult.placeId;
                    } else if (nearbyResult.apiStatus !== "ZERO_RESULTS") {
                        // Si hay error de API (no solo sin resultados), reportar
                        errors.push({ url, error: `API Google: ${nearbyResult.apiStatus}` });
                        continue;
                    }
                }

                // 4. Si no hay place_id y hay nombre, buscar por texto
                if (!placeId && businessName) {
                    placeId = await searchByText(businessName);
                }

                if (!placeId) {
                    errors.push({ url, error: "No se pudo identificar el negocio en esta URL." });
                    continue;
                }

                // 5. Obtener detalles completos
                const { result: details, apiStatus } = await fetchPlaceDetails(placeId);
                if (!details) {
                    // Si la API falla con REQUEST_DENIED, informar al usuario
                    if (apiStatus.includes("REQUEST_DENIED") || apiStatus.includes("API") || apiStatus.includes("not activated")) {
                        errors.push({ url, error: `Places API no habilitada en Google Cloud. Habilita 'Places API' en console.cloud.google.com (status: ${apiStatus})` });
                    } else {
                        errors.push({ url, error: `No se encontraron datos (${apiStatus})` });
                    }
                    continue;
                }

                const phoneRaw =
                    (details.international_phone_number as string) ||
                    (details.formatted_phone_number as string) ||
                    undefined;

                const telefonoClean = formatPhoneForWhatsapp(phoneRaw) || undefined;
                const website = details.website as string | undefined;
                const tieneSitioWeb =
                    !!website &&
                    !website.includes("facebook.com") &&
                    !website.includes("instagram.com");

                const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;
                const instagram = website?.includes("instagram.com") ? website : undefined;
                const facebook = website?.includes("facebook.com") ? website : undefined;

                results.push({
                    id: `gmaps-url-${placeId}`,
                    nombre: (details.name as string) || businessName || "Negocio sin nombre",
                    rubro: ((details.types as string[])?.[0]?.replace(/_/g, " ")) || "Negocio",
                    lugar: ((details.formatted_address as string) || "").split(",").slice(-2).join(",").trim() || "",
                    direccion: (details.formatted_address as string) || (details.vicinity as string) || "",
                    telefono: (details.formatted_phone_number as string) || phoneRaw,
                    telefonoClean,
                    tieneSitioWeb,
                    sitioWebUrl: tieneSitioWeb ? website : undefined,
                    rating: details.rating as number | undefined,
                    reviewsCount: details.user_ratings_total as number | undefined,
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
