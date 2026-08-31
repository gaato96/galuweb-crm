import { NextResponse } from "next/server";
import type { Prospecto, Sistema } from "@/lib/types";
import { FALLA_LABELS } from "@/lib/types";
import {
    calcularNivelDato, normalizarEscaneo, generarMensaje, type PasoMensaje,
} from "@/lib/prospeccion";
import {
    generarMensajeVivoMenu, type PasoMensajeVivoMenu,
} from "@/lib/vivomenu-mensajes";
import { senialPrincipal, PATRON_LABELS } from "@/lib/dolores-rubro";

export const maxDuration = 30;

const PASOS_GALU: PasoMensaje[] = ["m1", "m2", "m3", "fu1", "fu2", "fu3", "ruteo", "fu_revision1", "fu_revision2"];
const PASOS_VIVOMENU: PasoMensajeVivoMenu[] = [
    "primer_contacto", "rama_empleado", "rama_dueno", "fu1", "fu2", "fu3", "interes_tibio", "compromiso_visita",
];

/** Reglas que la IA no puede romper, comunes a los dos sistemas. */
const REGLAS_COMUNES = `1. Español rioplatense, voseo, tono de persona real escribiendo desde el celular. Nada de "estimado" ni corporativo.
2. Cero jerga: prohibido "sistema de gestión", "automatización de procesos", "presencia digital", "solución integral",
   "optimizar", "potenciar". Lo tiene que entender alguien sin nada de contexto técnico, de una sola pasada.
3. No inventes datos que no estén en la sección de arriba. Si algo falta, omitilo en vez de rellenar con genérico.
4. Máximo 90 palabras.

QUE NO SE NOTE ESCRITO POR IA (esto es lo que más importa: si se nota, no contestan)
5. NO uses signos de apertura "¿" ni "¡". Nadie los escribe desde el celular. Va "Te lo puedo mandar?", no "¿Te lo mando?".
6. Como mucho UN guion largo (—) en todo el mensaje, y solo si ya venía en el borrador. Dos o más es la marca de IA
   más obvia que hay. Reemplazalos por punto seguido, coma o dos puntos.
7. Nada de comillas curvas (" ") ni puntos suspensivos de un solo carácter (...). Comillas rectas y tres puntos.
8. Nada de enumeraciones de tres cosas por costumbre ("rápido, simple y efectivo"). Si son dos, poné dos.
9. Nada de frases que suenan a cierre publicitario, ni negaciones de contraste tipo "no es X, es Y" repetidas.
10. Dejá las asperezas: contracciones, alguna frase larga al lado de una corta, un "che" o un "tranqui" si cae bien.
    Un mensaje perfectamente parejo se lee escrito por máquina.
11. Hablá en primera persona de lo que viste: "estuve buscando", "vi que", "me fijé". No enunciados impersonales.`;

function reglasGalu(largo: string): string {
    return `${REGLAS_COMUNES}
12. Versión ${largo}. Si es corta, no expliques la consecuencia: observación + una pregunta y listo.
13. El pedido final se tiene que poder contestar con una palabra. No pidas reunión, ni el teléfono del dueño, ni el mail.
14. Prohibido en este mensaje: casos de éxito, precios, links (salvo que el borrador ya traiga uno), emojis más allá de
   uno solo si el borrador lo tiene, y la palabra "presupuesto".
15. Si el dato es una queja de un cliente, encuadrala como problema del sistema y no de la persona que atiende.
16. CRÍTICO — la línea 1 dice SOLO lo que se observó desde afuera, y la línea 2 dice qué SUELE significar eso en el rubro.
   Nunca afirmes como un hecho de este negocio algo que no se puede ver desde afuera (que tienen turnos que no se
   presentan, tratamientos a medio terminar, pacientes que no vuelven). Eso va siempre como lectura general del rubro
   ("en la mayoría de los consultorios...", "suele pasar que..."), jamás como acusación. Si lo afirmás, el mensaje se
   vuelve mentira verificable y se cae todo.`;
}

function reglasVivoMenu(paso: PasoMensajeVivoMenu): string {
    const extra =
        paso === "primer_contacto"
            ? `13. La primera línea tiene que aclarar que NO es un pedido — el que lee está tomando pedidos por ese mismo WhatsApp
   y hay que sacarlo de ese modo antes de cualquier otra cosa.
14. El link va SIN pedir permiso antes. El permiso se pide en la pregunta final, sobre algo que sí tiene costo para el que lee
   (pasar el contacto al dueño), nunca sobre mandar el link.`
            : `13. No expliques el producto con palabras si ya se explicó en un paso anterior — mostrás, no contás de nuevo.`;

    return `${REGLAS_COMUNES}
12. Prohibido: mandar un PDF o guía, dar el precio por chat, y la frase "sistema de pedidos" (decí "el pedido te llega armado").
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
        const senialTitular = senialPrincipal(escaneo.fallas);

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
${!esVivoMenu && senialTitular ? `Señal observada que va de titular: ${senialTitular.label} (apunta al dolor "${PATRON_LABELS[senialTitular.patron]}" — ese dolor es INFERIDO del rubro, no verificado en este negocio)` : ""}
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
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 800,
                        // Sin esto, el modelo gasta el presupuesto de tokens "pensando" antes de
                        // escribir y la respuesta llega cortada — no hace falta razonamiento extra
                        // para reescribir un mensaje corto sobre una estructura ya dada.
                        thinkingConfig: { thinkingBudget: 0 },
                    },
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

        // Si se cortó por límite de tokens y no alcanza a ser un mensaje real, mejor la plantilla
        // que un mensaje roto a mitad de frase.
        const cortado = data.candidates?.[0]?.finishReason === "MAX_TOKENS";
        if (cortado && texto.split(/\s+/).length < 15) {
            return NextResponse.json({ mensaje: borrador, fuente: "plantilla" });
        }

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
