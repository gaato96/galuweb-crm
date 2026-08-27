// ============================================================
// URLs de Google Maps → place_id
//
// Google usa media docena de formatos de URL para la misma ficha, y el place_id
// aparece en un lugar distinto en cada uno. Esto vivía dentro de la ruta de
// importación por URL; se movió acá para que el escaneo automático pueda
// resolver la ficha de un prospecto que ya tiene el maps_url guardado, sin
// duplicar los mismos seis regex.
// ============================================================

/** Devuelve el place_id de una URL de Maps, o null si no hay ninguno reconocible. */
export function extraerPlaceId(url: string): string | null {
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

/** El nombre del negocio tal como viene en el path /maps/place/<nombre>. */
export function extraerNombreDeUrl(url: string): string | null {
    const match = url.match(/\/maps\/place\/([^/@?]+)/);
    if (!match) return null;
    return decodeURIComponent(match[1].replace(/\+/g, " ")).trim();
}

/** Coordenadas del pin, para desempatar una búsqueda por nombre. */
export function extraerCoords(url: string): { lat: number; lng: number } | null {
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
