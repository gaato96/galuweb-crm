import { NextResponse } from "next/server";
import type { Prospecto, Sistema } from "@/lib/types";
import { FALLA_LABELS } from "@/lib/types";
import {
    calcularNivelDato, normalizarEscaneo, generarMensaje, type PasoMensaje,
} from "@/lib/prospeccion";
import {
    generarMensajeVivoMenu, type PasoMensajeVivoMenu,
} from "@/lib/vivomenu-mensajes";

export const maxDuration = 30;

const PASOS_GALU: PasoMensaje[] = ["m1", "m2", "m3", "fu1", "fu2", "fu3", "ruteo"];
const PASOS_VIVOMENU: PasoMensajeVivoMenu[] = [
    "primer_contacto", "rama_empleado", "rama_dueno", "fu1", "fu2", "fu3", "interes_tibio", "compromiso_visita",
];

/** Reglas que la IA no puede romper, comunes a los dos sistemas. */
const REGLAS_COMUNES = `1. Español rioplatense, voseo, tono de persona real escribiendo desde el celular. Nada de "estimado" ni corporativo.
2. Cero jerga: prohibido "sistema de gestión", "automatización de procesos", "presencia digital", "solución integral",
   "optimizar", "potenciar". Lo tiene que entender alguien sin nada de contexto técnico, de una sola pasada.
3. No inventes datos que no estén en la sección de arriba. Si algo falta, omitilo en vez de rellenar con genérico.
4. Máximo 90 palabras.`;

function reglasGalu(largo: string): string {
    return `${REGLAS_COMUNES}
5. Versión ${largo}. Si es corta, no expliques la consecuencia: observación + una pregunta y listo.
6. El pedido final se tiene que poder contestar con una palabra. No pidas reunión, ni el teléfono del dueño, ni el mail.
7. Prohibido en este mensaje: casos de éxito, precios, links (salvo que el borrador ya traiga uno), emojis más allá de
   uno solo si el borrador lo tiene, y la palabra "presupuesto".
8. Si el dato es una queja de un cliente, encuadrala como problema del sistema y no de la persona que atiende.`;
}

function reglasVivoMenu(paso: PasoMensajeVivoMenu): string {
    const extra =
        paso === "primer_contacto"
            ? `6. La primera línea tiene que aclarar que NO es un pedido — el que lee está tomando pedidos por ese mismo WhatsApp
   y hay que sacarlo de ese modo antes de cualquier otra cosa.
7. El link va SIN pedir permiso antes. El permiso se pide en la pregunta final, sobre algo que sí tiene costo para el que lee
   (pasar el contacto al dueño), nunca sobre mandar el link.`
            : `6. No expliques el producto con palabras si ya se explicó en un paso anterior — mostrás, no contás de nuevo.`;

    return `${REGLAS_COMUNES}
5. Prohibido: mandar un PDF o guía, dar el precio por chat, y la frase "sistema de pedidos" (decí "el pedido te llega armado").
${extra}`;
}

interface Body {
    prospecto: Prospecto;
    paso: string;
    sistema?: Sistema;
}

/**
 * Reescribe el mensaje sobre la MISMA estructura de guion (Galu o VivoMenu, según el
 * prospecto). La IA no elige el enfoque: recibe el borrador determinístico del motor
 * correspondiente y las reglas que no puede romper. Si Gemini falla, se devuelve el
 * borrador — nunca se corta el flujo de trabajo.
 */
export async function POST(req: Request) {
    let borrador = "";
    try {
        const { prospecto, paso, sistema: sistemaBody } = (await req.json()) as Body;
        const sistema: Sistema = sistemaBody || prospecto?.sistema || "galu";

        if (!prospecto?.negocio) {
            return NextResponse.json({ error: "Falta el prospecto" }, { status: 400 });
        }

        const esVivoMenu = sistema === "vivomenu";
        const pasosValidos: string[] = esVivoMenu ? PASOS_VIVOMENU : PASOS_GALU;
        if (!pasosValidos.includes(paso)) {
            return NextResponse.json({ error: "Paso de mensaje inválido para este sistema" }, { status: 400 });
        }

        borrador = esVivoMenu
            ? generarMensajeVivoMenu(paso as PasoMensajeVivoMenu, prospecto)
            : generarMensaje(paso as PasoMensaje, prospecto);

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ mensaje: borrador, fuente: "plantilla" });
        }

        const escaneo = normalizarEscaneo(prospecto.escaneo);
        const nivel = calcularNivelDato(escaneo);

        const contextoDatos = `--- DATOS DEL PROSPECTO ---
Sistema: ${esVivoMenu ? "VivoMenu (menú digital para gastronomía)" : "Galu (agencia web)"}
Negocio: ${prospecto.negocio}
Rubro: ${prospecto.rubro}${prospecto.especialidad ? ` (${prospecto.especialidad})` : ""}
Ciudad: ${prospecto.ciudad}
Presencia web: ${prospecto.clasificacion_web}
Nivel del dato: ${nivel ?? "sin dato"}
Dato de personalización: ${prospecto.dato_usado || "—"}
${escaneo.tiene_queja_cliente ? `Queja textual de un cliente: "${escaneo.queja_textual}"` : ""}
${escaneo.fallas.length ? `Fallas verificables: ${escaneo.fallas.map((f) => FALLA_LABELS[f]).join(", ")}` : ""}
${escaneo.hito_reciente ? `Hito reciente: ${escaneo.hito_reciente}` : ""}
Canal: ${prospecto.canal === "whatsapp" ? "WhatsApp" : "Instagram DM"}${
    esVivoMenu ? `\n¿Quién contestó hasta ahora?: ${prospecto.quien_leyo === "secretaria" ? "empleado" : prospecto.quien_leyo === "dueno" ? "dueño" : "sin definir"}` : ""
}`;

        const reglas = esVivoMenu
            ? reglasVivoMenu(paso as PasoMensajeVivoMenu)
            : reglasGalu(nivel && nivel <= 2 ? "completa (3 líneas)" : "corta (observación + pregunta, sin diagnóstico)");

        const prompt = `Sos quien escribe los mensajes en frío de ${esVivoMenu ? "VivoMenu, un menú digital para gastronomía" : "Galu, una agencia web"} de San Miguel de Tucumán.
Te paso un borrador ya armado con la estructura correcta. Tu trabajo es reescribirlo para que suene natural
y específico de ESTE negocio, sin cambiar la estructura ni el pedido.

${contextoDatos}

--- BORRADOR A REESCRIBIR (paso ${paso}) ---
${borrador}

--- REGLAS QUE NO PODÉS ROMPER ---
${reglas}

Devolvé SOLO el mensaje final, sin comillas, sin encabezado y sin explicaciones. Si el borrador tiene varios párrafos
separados por una línea en blanco (son burbujas distintas de WhatsApp), mantené esa separación.`;

        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.8, maxOutputTokens: 500 },
                }),
                signal: AbortSignal.timeout(20000),
            }
        );

        if (!res.ok) {
            const detalle = await res.json().catch(() => ({}));
            console.warn("[mensaje-prospecto] Gemini falló:", detalle?.error?.message || res.status);
            return NextResponse.json({ mensaje: borrador, fuente: "plantilla" });
        }

        const data = await res.json();
        const texto: string = (data.candidates?.[0]?.content?.parts || [])
            .filter((p: { text?: string }) => typeof p.text === "string")
            .map((p: { text: string }) => p.text)
            .join("\n")
            .trim();

        return NextResponse.json({ mensaje: texto || borrador, fuente: texto ? "ia" : "plantilla" });
    } catch (error) {
        console.error("[mensaje-prospecto]", error);
        // Degradar a la plantilla en vez de romper el flujo de trabajo.
        if (borrador) return NextResponse.json({ mensaje: borrador, fuente: "plantilla" });
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Error al generar el mensaje" },
            { status: 500 }
        );
    }
}
