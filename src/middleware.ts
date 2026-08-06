import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, esRutaPublica, tokenValido } from "@/lib/auth";

/**
 * Cierra el panel completo y todas las APIs. Solo quedan abiertos el login,
 * el portal del cliente y los briefs — que son las páginas que el cliente
 * tiene que poder abrir sin credenciales.
 */
export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (esRutaPublica(pathname)) return NextResponse.next();
    // El endpoint de login tiene que ser alcanzable para poder autenticarse.
    if (pathname === "/api/auth/login") return NextResponse.next();

    const secreto = process.env.CRM_PASSWORD;

    // Sin clave configurada no se puede validar nada: se cierra en vez de abrir.
    if (!secreto) {
        if (pathname.startsWith("/api/")) {
            return NextResponse.json(
                { error: "CRM_PASSWORD no está configurada en el servidor." },
                { status: 503 }
            );
        }
        const url = req.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("motivo", "sin_config");
        return NextResponse.redirect(url);
    }

    const ok = await tokenValido(req.cookies.get(COOKIE_SESION)?.value, secreto);
    if (ok) return NextResponse.next();

    if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("desde", pathname);
    return NextResponse.redirect(url);
}

export const config = {
    // Se excluyen los assets estáticos y los archivos de la PWA.
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*\\.js|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|woff2?)$).*)",
    ],
};
