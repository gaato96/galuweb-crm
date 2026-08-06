import { NextResponse } from "next/server";
import type { Prospecto } from "@/lib/types";
import { FALLA_LABELS } from "@/lib/types";
import {
    calcularNivelDato, normalizarEscaneo, generarMensaje, type PasoMensaje,
} from "@/lib/prospeccion";

export const maxDuration = 30;

const PASOS_VALIDOS: PasoMensaje[] = ["m1", "m2", "m3", "fu1", "fu2", "ruteo"];

/**
 * Reescribe el mensaje sobre la MISMA estructura del sistema de contacto en frío.
 * La IA no elige el enfoque: se le pasa el borrador determinístico y las reglas que
 * no puede romper. Si Gemini falla, se devuelve el borrador — nunca se corta el flujo.
 */
export async function POST(req: Request) {
    let borrador = "";
    try {
        const { prospecto, paso } = (await req.json()) as { prospecto: Prospecto; paso: PasoMensaje };

        if (!prospecto?.negocio) {
            return NextResponse.json({ error: "Falta el prospecto" }, { status: 400 });
        }
        if (!PASOS_VALIDOS.includes(paso)) {
            return NextResponse.json({ error: "Paso de mensaje inválido" }, { status: 400 });
        }

        borrador = generarMensaje(paso, prospecto);

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ mensaje: borrador, fuente: "plantilla" });
        }

        const escaneo = normalizarEscaneo(prospecto.escaneo);
        const nivel = calcularNivelDato(escaneo);
        const largo = nivel && nivel <= 2 ? "completa (3 líneas)" : "corta (observación + pregunta, sin diagnóstico)";

        const prompt = `Sos quien escribe los mensajes en frío de Galu, una agencia web de San Miguel de Tucumán.
Te paso un borrador ya armado con la estructura correcta. Tu trabajo es reescribirlo para que suene natural
y específico de ESTE negocio, sin cambiar la estructura ni el pedido.

--- DATOS DEL PROSPECTO ---
Negocio: ${prospecto.negocio}
Rubro: ${prospecto.rubro}${prospecto.especialidad ? ` (${prospecto.especialidad})` : ""}
Ciudad: ${prospecto.ciudad}
Presencia web: ${prospecto.clasificacion_web}
Nivel del dato: ${nivel ?? "sin dato"}
Dato de personalización: ${prospecto.dato_usado || "—"}
${escaneo.tiene_queja_cliente ? `Queja textual de un cliente: "${escaneo.queja_textual}"` : ""}
${escaneo.fallas.length ? `Fallas verificables: ${escaneo.fallas.map((f) => FALLA_LABELS[f]).join(", ")}` : ""}
${escaneo.hito_reciente ? `Hito reciente: ${escaneo.hito_reciente}` : ""}
Canal: ${prospecto.canal === "whatsapp" ? "WhatsApp" : "Instagram DM"}

--- BORRADOR A REESCRIBIR (paso ${paso}) ---
${borrador}

--- REGLAS QUE NO PODÉS ROMPER ---
1. Español rioplatense, voseo, tono de persona real escribiendo desde el celular. Nada de "estimado" ni corporativo.
2. Cero jerga: prohibido "sistema de gestión", "automatización de procesos", "presencia digital", "solución integral",
   "optimizar", "potenciar". Lo lee una secretaria que tiene que entenderlo de una sola pasada y poder reenviarlo.
3. Versión ${largo}. Si es corta, no expliques la consecuencia: observación + una pregunta y listo.
4. El pedido final se tiene que poder contestar con una palabra. No pidas reunión, ni el teléfono del dueño, ni el mail.
5. Prohibido en este mensaje: casos de éxito, precios, links (salvo que el borrador ya traiga uno), emojis más allá de
   uno solo si el borrador lo tiene, y la palabra "presupuesto".
6. Si el dato es una queja de un cliente, encuadrala como problema del sistema y no de la persona que atiende.
7. No inventes datos que no estén arriba. Si algo falta, omitilo en vez de rellenar.
8. Máximo 90 palabras.

Devolvé SOLO el mensaje final, sin comillas, sin encabezado y sin explicaciones.`;

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
