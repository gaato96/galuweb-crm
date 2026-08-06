// ============================================================
// Autenticación del panel — Galu CRM
// El CRM es de un solo operador: alcanza con una clave y una cookie
// firmada. Lo que NO puede pasar es lo de antes: el panel abierto en
// internet con accesos de clientes en texto plano.
// ============================================================

export const COOKIE_SESION = "galu_sesion";
const DURACION_SESION_DIAS = 30;

/** Rutas que quedan públicas a propósito (las ve el cliente, no vos). */
export const RUTAS_PUBLICAS = ["/login", "/portal", "/briefs"];

export function esRutaPublica(pathname: string): boolean {
    return RUTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/**
 * Firma HMAC-SHA256 usando Web Crypto: el middleware corre en el Edge
 * Runtime, donde no existe el módulo `crypto` de Node.
 */
async function firmar(mensaje: string, secreto: string): Promise<string> {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(secreto),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(mensaje));
    return Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

/** Token = expiración + firma. Sin estado en el servidor. */
export async function crearToken(secreto: string): Promise<{ valor: string; maxAge: number }> {
    const maxAge = DURACION_SESION_DIAS * 24 * 60 * 60;
    const expira = Date.now() + maxAge * 1000;
    const firma = await firmar(String(expira), secreto);
    return { valor: `${expira}.${firma}`, maxAge };
}

export async function tokenValido(token: string | undefined, secreto: string): Promise<boolean> {
    if (!token) return false;
    const [expiraStr, firma] = token.split(".");
    if (!expiraStr || !firma) return false;

    const expira = Number(expiraStr);
    if (!Number.isFinite(expira) || Date.now() > expira) return false;

    const esperada = await firmar(expiraStr, secreto);
    return comparacionSegura(firma, esperada);
}

/** Comparación en tiempo constante: evita filtrar la firma por timing. */
export function comparacionSegura(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let dif = 0;
    for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return dif === 0;
}
