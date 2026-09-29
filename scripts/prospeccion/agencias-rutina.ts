// ============================================================
// Rutina diaria de agencias — la parte que toca la base
// ============================================================
//
// La corre una tarea programada de Claude (lunes a viernes, 15:00 AR). Claude
// pone el Gmail —buscar respuestas y rebotes, mandar los mails— y este script
// pone todo lo demás, para que la rutina haga lo mismo todos los días y no
// dependa de cómo se interprete un prompt:
//
//   plan               Qué toca hoy: seguimientos vencidos, agencias nuevas y
//                      todo lo que está en curso (para cruzar respuestas).
//   aplicar <archivo>  Guarda en el CRM lo que se hizo (JSON, ver Accion).
//
// Uso:
//   npx jiti scripts/prospeccion/agencias-rutina.ts plan --nuevas 10
//   npx jiti scripts/prospeccion/agencias-rutina.ts aplicar acciones.json
//
// Los mensajes salen de los mismos generadores que usa el CRM, y los días de
// seguimiento de proximaAccion(): si se cambia el guion o la cadencia en el
// CRM, la rutina lo toma sola.

import fs from "fs";
import path from "path";
import { generarMensajeAgencia, nombreCorto } from "../../src/lib/agencias-mensajes";
import { proximaAccion } from "../../src/lib/prospeccion";
import type { Prospecto } from "../../src/lib/types";

const RAIZ = path.resolve(__dirname, "../..");

function env(): Record<string, string> {
    const txt = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
    return Object.fromEntries(
        txt
            .split(/\r?\n/)
            .filter((l) => /^[A-Z_]+=/.test(l))
            .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
    );
}

const E = env();
const URL_SB = E.NEXT_PUBLIC_SUPABASE_URL;
const KEY = E.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_SB || !KEY) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local");
    process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function sb<T>(ruta: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${URL_SB}/rest/v1/${ruta}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return (res.status === 204 ? null : await res.json()) as T;
}

/** Fecha local (Argentina), no UTC: a las 21 h en UTC ya es mañana. */
function hoyISO(): string {
    return new Date().toLocaleDateString("en-CA");
}

const EN_CURSO = ["enviado", "fu1", "fu2"];
const SIN_CONTACTAR = ["sin_calificar", "calificado"];

/** Buzones que no son el nombre de nadie. */
const GENERICOS = /^(hola|hello|hi|info|contacto|contact|ventas|sales|comercial|admin|marketing|mkt|agencia|studio|estudio|office|oficina|team|equipo|prensa|rrhh|soporte|support|proyectos|direccion|gerencia|mktleads|leads)$/;
const PROVEEDORES = /@(gmail|hotmail|outlook|live|yahoo|icloud|protonmail)\./;

/**
 * "freddy@la-agencia.com.mx" → Freddy. Solo cuando el buzón es claramente un
 * nombre de pila: una palabra, no genérica, que no sea el nombre de la agencia
 * ("kaleff@kaleff.net") y no en una casilla de Gmail ("adenomkt@gmail.com").
 */
function nombreDesdeMail(mail: string): string {
    const [local, dominio = ""] = mail.toLowerCase().split("@");
    if (PROVEEDORES.test(mail.toLowerCase())) return "";
    if (!/^[a-záéíóúñ]{3,12}$/.test(local) || GENERICOS.test(local)) return "";
    if (dominio.replace(/[^a-z]/g, "").includes(local)) return "";
    return local.charAt(0).toUpperCase() + local.slice(1);
}

function conNombre(p: Prospecto): Prospecto {
    if (p.contacto_nombre.trim() || !p.email) return p;
    return { ...p, contacto_nombre: nombreDesdeMail(p.email) };
}

async function plan(nuevas: number) {
    const agencias = await sb<Prospecto[]>("prospectos?sistema=eq.agencias&select=*&limit=2000");
    const hoy = new Date();

    const seguimientos = agencias
        .filter((p) => p.email && EN_CURSO.includes(p.estado))
        .map((p) => ({ p, accion: proximaAccion(p, hoy) }))
        .filter((x) => x.accion?.vencido && (x.accion.paso === "fu1" || x.accion.paso === "fu2"))
        .map(({ p, accion }) => ({
            id: p.id,
            negocio: nombreCorto(p.negocio),
            email: p.email,
            paso: accion!.paso as "fu1" | "fu2",
            dias: accion!.dias,
            texto: generarMensajeAgencia(accion!.paso as "fu1" | "fu2", conNombre(p), "email"),
        }));

    // Lista A primero y por score: es la que valida el carril (ver agencias-mensajes.ts).
    // Cuando se agota, sigue la lista B (venden web y la tercerizan), que lleva
    // su propio mensaje. Las "sin verificar" no salen nunca solas: afirmarles
    // cualquiera de las dos cosas sin haber mirado su web quema el contacto.
    const porScore = (a: Prospecto, b: Prospecto) => b.score - a.score;
    const disponibles = agencias.filter((p) => SIN_CONTACTAR.includes(p.estado) && p.email.trim());
    const candidatas = [
        ...disponibles.filter((p) => p.ofrece_desarrollo_web === false).sort(porScore),
        ...disponibles.filter((p) => p.ofrece_desarrollo_web === true).sort(porScore),
    ];

    const nuevasHoy = candidatas.slice(0, nuevas).map((p) => {
        const txt = generarMensajeAgencia("m1", conNombre(p), "email");
        const [primera, , ...cuerpo] = txt.split("\n");
        return {
            id: p.id,
            negocio: nombreCorto(p.negocio),
            lista: p.ofrece_desarrollo_web === false ? "A" : "B",
            email: p.email.trim(),
            asunto: primera.replace(/^Asunto:\s*/, ""),
            cuerpo: cuerpo.join("\n"),
        };
    });

    const enCurso = agencias
        .filter((p) => p.email && EN_CURSO.includes(p.estado))
        .map((p) => ({ id: p.id, negocio: nombreCorto(p.negocio), email: p.email, estado: p.estado }));

    // El toque de vigencia NO se manda solo: lleva una línea sobre un trabajo
    // terminado que solo puede escribir Gastón. Se avisa en el resumen.
    const vigencia = agencias
        .filter((p) => p.estado === "acordado")
        .map((p) => ({ p, accion: proximaAccion(p, hoy) }))
        .filter((x) => x.accion?.vencido)
        .map(({ p, accion }) => ({ negocio: nombreCorto(p.negocio), email: p.email, dias: accion!.dias }));

    const quedanConMail = candidatas.length - nuevasHoy.length;
    const sinVerificarConMail = disponibles.filter((p) => p.ofrece_desarrollo_web == null).length;
    const listaASinMail = agencias.filter(
        (p) => SIN_CONTACTAR.includes(p.estado) && !p.email.trim() && p.ofrece_desarrollo_web === false
    ).length;

    console.log(
        JSON.stringify(
            { hoy: hoyISO(), seguimientos, nuevas: nuevasHoy, en_curso: enCurso, vigencia, quedan_con_mail: quedanConMail, lista_a_sin_mail: listaASinMail, sin_verificar_con_mail: sinVerificarConMail },
            null,
            1
        )
    );
}

/**
 * Lo que la rutina hizo, una línea por prospecto.
 *
 *   enviado    salió el mensaje 1 (texto = asunto + cuerpo)
 *   fu1 / fu2  salió ese seguimiento
 *   respondio  contestó una persona: se frena todo y lo toma Gastón
 *   rebote     el mail no existe: se saca, se anota y el mensaje 1 se da por no
 *              enviado, para que no le sigan seguimientos a una casilla muerta
 */
type Accion =
    | { id: string; accion: "enviado"; texto: string }
    | { id: string; accion: "fu1" | "fu2" | "respondio" }
    | { id: string; accion: "rebote"; email: string };

async function aplicar(archivo: string) {
    const acciones = JSON.parse(fs.readFileSync(archivo, "utf8")) as Accion[];
    const hoy = hoyISO();
    const resultado: string[] = [];

    for (const a of acciones) {
        let cambios: Partial<Prospecto>;
        if (a.accion === "enviado") cambios = { estado: "enviado", fecha_envio: hoy, mensaje_enviado: a.texto };
        else if (a.accion === "fu1") cambios = { estado: "fu1", fecha_fu1: hoy };
        else if (a.accion === "fu2") cambios = { estado: "fu2", fecha_fu2: hoy };
        else if (a.accion === "respondio") cambios = { estado: "respondio", fecha_respuesta: hoy };
        else if (a.accion === "rebote") {
            const [actual] = await sb<Prospecto[]>(`prospectos?id=eq.${a.id}&select=notas`);
            const [d, m, y] = [hoy.slice(8, 10), hoy.slice(5, 7), hoy.slice(0, 4)];
            // "Rebotó <mail>" es lo que lee mailsRebotados() en el escaneo para no
            // volver a cargarlo. No cambiar el formato sin cambiar esa función.
            const nota = `Rebotó ${a.email} (${d}/${m}/${y}, la casilla no existe).`;
            cambios = {
                email: "",
                estado: "sin_calificar",
                fecha_envio: null,
                fecha_fu1: null,
                fecha_fu2: null,
                notas: [actual?.notas, nota].filter(Boolean).join("\n"),
            } as Partial<Prospecto>;
        } else {
            resultado.push(`? acción desconocida: ${JSON.stringify(a)}`);
            continue;
        }
        try {
            await sb(`prospectos?id=eq.${a.id}`, {
                method: "PATCH",
                headers: { Prefer: "return=minimal" },
                body: JSON.stringify(cambios),
            });
            resultado.push(`ok ${a.accion} ${a.id}`);
        } catch (e) {
            resultado.push(`ERROR ${a.accion} ${a.id}: ${(e as Error).message}`);
        }
    }
    console.log(resultado.join("\n"));
}

const [cmd, ...args] = process.argv.slice(2);
const opcion = (n: string, def: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

(async () => {
    if (cmd === "plan") await plan(Number(opcion("nuevas", "10")));
    else if (cmd === "aplicar" && args[0]) await aplicar(args[0]);
    else {
        console.error("Uso: plan [--nuevas N] | aplicar <acciones.json>");
        process.exit(1);
    }
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
