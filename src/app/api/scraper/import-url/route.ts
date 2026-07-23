import { NextResponse } from "next/server";
import type { ProspectoScraped } from "@/lib/types";

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || "";

// ─── Extraer place_id de una URL de Google Maps ──────────────────────────────

function extractPlaceIdFromUrl(url: string): string | null {
    // Formato: ?q=place_id:ChIJ...  o  place_id:ChIJ...
    const matchQ = url.match(/place_id[=:]([A-Za-z0-9_-]+)/);
    if (matchQ) return matchQ[1];

    // Formato data: !1sChIJ... (en URLs largas de Google Maps)
    const matchData = url.match(/!1s(ChIJ[A-Za-z0-9_-]+)/);
    if (matchData) return matchData[1];

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
        return res.url; // URL final después de redirect
    } catch {
        return url;
    }
}

// ─── Obtener detalles de un negocio por place_id ─────────────────────────────

async function fetchPlaceDetails(placeId: string) {
    const fields = [
        "name",
        "formatted_address",
        "formatted_phone_number",
        "international_phone_number",
        "website",
        "rating",
        "user_ratings_total",
        "opening_hours",
        "types",
        "geometry",
        "vicinity",
    ].join(",");

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&language=es&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "OK" || !data.result) return null;
    return data.result;
}

// ─── Buscar lugar por texto cuando no hay place_id ───────────────────────────

async function searchByText(query: string) {
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name&language=es&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "OK" || !data.candidates?.length) return null;
    return data.candidates[0].place_id as string;
}

// ─── Extraer nombre del negocio de la URL de Google Maps ─────────────────────

function extractBusinessNameFromUrl(url: string): string | null {
    // Google Maps URLs tienen formato: /maps/place/NOMBRE/@lat,lon...
    const match = url.match(/\/maps\/place\/([^/@?]+)/);
    if (match) {
        return decodeURIComponent(match[1].replace(/\+/g, " "));
    }
    return null;
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
                // 1. Resolver URLs cortas (maps.app.goo.gl)
                let resolvedUrl = url;
                if (url.includes("goo.gl") || url.includes("maps.app")) {
                    resolvedUrl = await resolveShortUrl(url);
                }

                // 2. Intentar extraer place_id de la URL
                let placeId = extractPlaceIdFromUrl(resolvedUrl);

                // 3. Si no hay place_id, buscar por nombre del negocio en la URL
                if (!placeId) {
                    const businessName = extractBusinessNameFromUrl(resolvedUrl);
                    if (businessName) {
                        placeId = await searchByText(businessName) || null;
                    }
                }

                if (!placeId) {
                    errors.push({ url, error: "No se pudo identificar el negocio en esta URL." });
                    continue;
                }

                // 4. Obtener detalles completos del negocio
                const details = await fetchPlaceDetails(placeId);
                if (!details) {
                    errors.push({ url, error: "No se encontraron datos para este negocio." });
                    continue;
                }

                const phoneRaw =
                    details.international_phone_number ||
                    details.formatted_phone_number ||
                    undefined;

                const telefonoClean = formatPhoneForWhatsapp(phoneRaw) || undefined;
                const website = details.website;
                const tieneSitioWeb =
                    !!website &&
                    !website.includes("facebook.com") &&
                    !website.includes("instagram.com");

                const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${placeId}`;

                // Detectar redes sociales desde el website si aplica
                const instagram = website?.includes("instagram.com") ? website : undefined;
                const facebook = website?.includes("facebook.com") ? website : undefined;

                results.push({
                    id: `gmaps-url-${placeId}`,
                    nombre: details.name || "Negocio sin nombre",
                    rubro: details.types?.[0]?.replace(/_/g, " ") || "Negocio",
                    lugar: details.formatted_address?.split(",").slice(-2).join(",").trim() || "",
                    direccion: details.formatted_address || details.vicinity || "",
                    telefono: details.formatted_phone_number || phoneRaw,
                    telefonoClean,
                    tieneSitioWeb,
                    sitioWebUrl: tieneSitioWeb ? website : undefined,
                    rating: details.rating,
                    reviewsCount: details.user_ratings_total,
                    redesSociales: { instagram, facebook },
                    guardadoEnCrm: false,
                    fechaExtraccion: new Date().toISOString(),
                    mapsUrl,
                });

                // Pequeño delay para no saturar la API
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
            data: {
                resultados: results,
                errores: errors,
                total: results.length,
            },
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error al importar URLs";
        console.error("Error en importar-urls:", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
