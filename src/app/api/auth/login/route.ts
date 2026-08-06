import { NextResponse } from "next/server";
import { COOKIE_SESION, crearToken, comparacionSegura } from "@/lib/auth";

/** Frena el fuerza bruta desde una misma IP. En memoria: alcanza para un panel de un usuario. */
const intentos = new Map<string, { cantidad: number; hasta: number }>();
const MAX_INTENTOS = 8;
const BLOQUEO_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
    const ahora = Date.now();
    const registro = intentos.get(ip);

    if (registro && registro.hasta > ahora && registro.cantidad >= MAX_INTENTOS) {
        const minutos = Math.ceil((registro.hasta - ahora) / 60000);
        return NextResponse.json(
            { error: `Demasiados intentos. Probá de nuevo en ${minutos} minutos.` },
            { status: 429 }
        );
    }

    const secreto = process.env.CRM_PASSWORD;
    if (!secreto) {
        return NextResponse.json(
            { error: "Falta configurar CRM_PASSWORD en las variables de entorno del servidor." },
            { status: 503 }
        );
    }

    const { password } = await req.json().catch(() => ({ password: "" }));

    if (typeof password !== "string" || !comparacionSegura(password, secreto)) {
        const previo = registro && registro.hasta > ahora ? registro.cantidad : 0;
        intentos.set(ip, { cantidad: previo + 1, hasta: ahora + BLOQUEO_MS });
        return NextResponse.json({ error: "Clave incorrecta" }, { status: 401 });
    }

    intentos.delete(ip);
    const { valor, maxAge } = await crearToken(secreto);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_SESION, valor, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge,
    });
    return res;
}

/** Cierre de sesión. */
export async function DELETE() {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_SESION, "", { httpOnly: true, path: "/", maxAge: 0 });
    return res;
}
