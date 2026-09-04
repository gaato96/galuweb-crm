import { NextResponse } from "next/server";
import type { Prospecto, Sistema } from "@/lib/types";
import { FALLA_LABELS } from "@/lib/types";
import {
    calcularNivelDato, normalizarEscaneo, generarMensaje, type PasoMensaje,
} from "@/lib/prospeccion";
import {
    generarMensajeVivoMenu, type PasoMensajeVivoMenu,
} from "@/lib/vivomenu-mensajes";
import {
    generarMensajeAgencia, type PasoMensajeAgencia, canalSugerido, CANAL_AGENCIA_LABELS,
    type CanalAgencia,
} from "@/lib/agencias-mensajes";
import { senialPrincipal, PATRON_LABELS } from "@/lib/dolores-rubro";

export const maxDuration = 30;

const PASOS_GALU: PasoMensaje[] = ["m1", "m2", "m3", "fu1", "fu2", "fu3", "ruteo", "fu_revision1", "fu_revision2"];
const PASOS_VIVOMENU: PasoMensajeVivoMenu[] = [
    "primer_contacto", "rama_empleado", "rama_dueno", "fu1", "fu2", "fu3", "interes_tibio", "compromiso_visita",
];
const PASOS_AGENCIAS: PasoMensajeAgencia[] = [
    "m1", "fu1", "fu2", "credenciales", "precios", "primer_trabajo", "ruteo",
];

/** Reglas que la IA no puede romper, comunes a los tres sistemas. */
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

function reglasVivoMenu(paso: PasoMensajeVivoMenu, nivel: number | null): string {
    const extra =
        paso === "primer_contacto"
            ? `13. La primera línea tiene que aclarar que NO es un pedido — el que lee está tomando pedidos por ese mismo WhatsApp
   y hay que sacarlo de ese modo antes de cualquier otra cosa.
14. El link va SIN pedir permiso antes. El permiso se pide en la pregunta final, sobre algo que sí tiene costo para el que lee
   (pasar el contacto al dueño), nunca sobre mandar el link.
15. NO toques el link: va tal cual viene en el borrador, completo y sin acortar. Un link mal copiado mata el mensaje entero.`
            : `13. No expliques el producto con palabras si ya se explicó en un paso anterior — mostrás, no contás de nuevo.
15. Si el borrador trae un link, va tal cual, completo y sin acortar.`;

    // Qué tan lejos puede ir la línea 1 depende de con qué dato se cuenta. Sin
    // esto, el modelo escribe la misma frase confiada con un dato de nivel 4
    // (un detalle de su carta) que con una queja textual de un cliente, y en el
    // primer caso queda afirmando cosas que el dueño sabe que no vio.
    const porNivel =
        nivel === 1
            ? `16. Tenés una queja textual de un cliente. Citala con comillas, tal cual, sin corregirle nada, y encuadrala como
   problema de cómo entra el pedido — NUNCA como que en la cocina trabajan mal ni como que quien atiende es lento.
   El dueño quiere a su gente: si lee un reproche a su equipo, no contesta más.`
            : nivel === 2
              ? `16. Tenés una señal que se ve desde afuera. La línea 1 dice SOLO eso, tal como se ve (qué se buscó, qué se vio).
   Lo que eso suele significar va en la línea 2 y en general — "suele pasar que...", "lo que veo seguido es..." —
   nunca afirmado de ESTE local. No sabés cuántos pedidos pierden, ni cuánto tardan: no lo digas como si lo supieras.`
              : nivel === 3 || nivel === 4
                ? `16. El dato que tenés es flojo (algo que publicaron, un detalle de cómo trabajan). Con eso NO alcanza para
   diagnosticar nada: usalo solo como prueba de que miraste el local de verdad, en media línea, y pasá rápido
   al link. Nada de "vi que tenés X, seguro estás perdiendo pedidos" — eso es una suposición disfrazada de dato.`
                : `16. NO tenés ningún dato verificado de este local. Entonces no afirmes NADA sobre cómo trabajan: ni que pierden
   pedidos, ni que tardan, ni que la carta está desactualizada. Presentate, decí en una línea qué hace el link,
   y mandalo. Un mensaje corto y honesto convierte mejor que uno largo apoyado en una observación inventada.`;

    return `${REGLAS_COMUNES}
12. VOCABULARIO. Prohibido: "sistema de gestión", "plataforma", "digitalizar", "solución", "sistema de pedidos", mandar un PDF
   o guía, y dar el precio por chat. Se dice en criollo: "el pedido te llega armado", "el cliente arma el pedido solo",
   "te entra acá ya escrito". El que lee está laburando, no leyendo un folleto.
${extra}
${porNivel}
17. El que atiende ese WhatsApp puede ser el dueño o un empleado en plena hora pico. Escribí para que lo entienda cualquiera
   de los dos en cinco segundos, y que ninguno de los dos se sienta acusado de nada.`;
}

/**
 * Reglas de agencias. Pisan a propósito dos de las comunes:
 *
 *   · El voseo se mantiene (el que escribe es argentino y disimularlo se nota),
 *     pero el modismo local NO. Un "che" o un "tranqui" a una agencia de
 *     Guadalajara o de Medellín se lee como que el mensaje no era para ellos.
 *   · Acá el que lee no es un comerciante en hora pico: es alguien que compra
 *     servicios de desarrollo todas las semanas y detecta a un proveedor flojo
 *     en dos líneas. El registro sube de "vecino que te escribe" a "colega".
 */
function reglasAgencias(paso: PasoMensajeAgencia, canal: CanalAgencia): string {
    const base = `${REGLAS_COMUNES}
12. PISA LA REGLA 10: nada de "che", "tranqui", "bárbaro", "laburo", "posta" ni modismo argentino de barrio.
   El que lee está en México, Colombia, Chile o Miami: el voseo está bien y no hay que disimularlo, pero el
   modismo local hace que el mensaje se lea como reenviado de otro destinatario. Español neutro y directo.
13. El registro es de colega a colega, no de proveedor pidiendo trabajo. El que lee compra desarrollo todas
   las semanas: si el mensaje suena a que estás desesperado, el precio que imagina baja antes de leerlo.
14. PROHIBIDO ABSOLUTO en todos los pasos: la palabra "developer" o "dev full-stack" para describir a quien
   escribe, ofrecer análisis o diagnóstico gratis, mencionar "diagnóstico antes de diseño", hablar de
   estrategia o de posicionamiento, y cualquier cosa que suene a que vas a hablar con SU cliente.
   Se dice "diseñador y desarrollador web", "diseño en Figma y entrego en WordPress". Nada más.
15. Nunca menciones que no tenés clientes, que estás empezando, ni que tenés la agenda libre por falta de
   trabajo. "Tengo disponibilidad este mes" es lo máximo que se dice, y se dice como dato, no como ruego.`;

    if (paso === "m1") {
        return `${base}
16. La observación de por qué se les escribe a ELLOS va en negativo suave y como dato de su página, jamás
   como crítica: "vi que hacen X y no vi desarrollo web entre los servicios". No es un problema de ellos,
   es el motivo por el que les sirve un proveedor. Si suena a que les estás señalando una carencia, se cae.
17. El pedido final se contesta con una palabra y es sobre un hecho de su operación (si tercerizan cuando
   les desborda), no sobre si te dejan mandar algo. No pidas reunión, ni llamada, ni el mail del dueño.
18. CANAL: ${canal === "email" ? "MAIL" : "mensaje directo"}.
${
    canal === "email"
        ? `   PISA LA REGLA 4: en mail no rige el máximo de 90 palabras.
   El borrador viene largo A PROPÓSITO y no hay que acortarlo. No saques la lista de referencias ni la
   de precios, no fusiones los bloques y no resumas: un mail frío que no dice qué entrega, con qué
   respaldo y cuánto sale obliga a un segundo intercambio para decir lo que podía ir de una, y ese
   segundo intercambio casi nunca llega. Dejá la línea "Asunto:" al principio tal cual está, mantené
   los bloques separados por líneas en blanco, y cerrá con la firma sola.`
        : `   Se lee en la previsualización del celular: corto, sin listas y sin firma. Si no entra en cuatro o
   cinco líneas, está largo.`
}`;
    }
    if (paso === "credenciales" || paso === "precios") {
        return `${base}
16. Los links y los precios van TAL CUAL vienen en el borrador: no los redondees, no los reordenes, no les
   cambies el rango. Un precio distinto al que quedó escrito en el CRM es un problema real después.
17. Cero adorno alrededor de la lista. Una agencia lee esto como un catálogo: cuanto más corto, mejor.`;
    }
    return base;
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
        const esAgencias = sistema === "agencias";
        const pasosValidos: string[] = esAgencias
            ? PASOS_AGENCIAS
            : esVivoMenu
              ? PASOS_VIVOMENU
              : PASOS_GALU;
        if (!pasosValidos.includes(paso)) {
            return NextResponse.json({ error: "Paso de mensaje inválido para este sistema" }, { status: 400 });
        }

        borrador = esAgencias
            ? generarMensajeAgencia(paso as PasoMensajeAgencia, prospecto)
            : esVivoMenu
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
Sistema: ${esAgencias ? "Agencias del exterior (Galu como proveedor white label)" : esVivoMenu ? "VivoMenu (menú digital para gastronomía)" : "Galu (agencia web)"}
Negocio: ${prospecto.negocio}
Rubro: ${prospecto.rubro}${prospecto.especialidad ? ` (${prospecto.especialidad})` : ""}
Ciudad: ${prospecto.ciudad}${prospecto.pais ? `, ${prospecto.pais}` : ""}
${
    esAgencias
        ? `Servicios que ofrece (de su propia página): ${prospecto.servicios || "s/d"}
¿Ofrece desarrollo web?: ${
              prospecto.ofrece_desarrollo_web === false
                  ? "NO — ese es el motivo por el que se le escribe. Va en el mensaje como dato de su página, nunca como crítica."
                  : prospecto.ofrece_desarrollo_web === true
                    ? "SÍ — este prospecto no debería estar en la lista. No inventes un ángulo: escribí algo neutro."
                    : "Sin verificar. NO afirmes que no ofrecen desarrollo web: no está confirmado."
          }
Tamaño del equipo: ${prospecto.tam_equipo ?? "s/d"}
Canal: ${CANAL_AGENCIA_LABELS[canalSugerido(prospecto)]}
Contacto: ${prospecto.contacto_nombre || "sin nombre — no inventes uno"}`
        : `Presencia web: ${prospecto.clasificacion_web}`
}
Nivel del dato: ${nivel ?? "sin dato"}
Dato de personalización: ${prospecto.dato_usado || "—"}
${escaneo.tiene_queja_cliente ? `Queja textual de un cliente: "${escaneo.queja_textual}"` : ""}
${escaneo.fallas.length ? `Fallas verificables: ${escaneo.fallas.map((f) => FALLA_LABELS[f]).join(", ")}` : ""}
${escaneo.hito_reciente ? `Hito reciente: ${escaneo.hito_reciente}` : ""}
${senialTitular ? `Señal observada que va de titular: ${senialTitular.label} (apunta al dolor "${PATRON_LABELS[senialTitular.patron]}" — ese dolor es INFERIDO del rubro, no verificado en este negocio)` : ""}
${
    esVivoMenu
        ? `¿Está en apps de delivery?: ${
              escaneo.fallas.includes("en_apps_delivery")
                  ? "SÍ — ya vende online y paga comisión por pedido. Ese es el ángulo, no hay que explicarle que el pedido online sirve."
                  : "No se detectó. NO menciones PedidosYa como si supieras que están: el ángulo es el WhatsApp, no la comisión."
          }
Movimiento del local: ${prospecto.reviews_count ?? "s/d"} reseñas${prospecto.rating != null ? `, ${prospecto.rating}★` : ""}`
        : ""
}
${
    esAgencias
        ? ""
        : `Canal: ${prospecto.canal === "whatsapp" ? "WhatsApp" : "Instagram DM"}${
              esVivoMenu
                  ? `\n¿Quién contestó hasta ahora?: ${prospecto.quien_leyo === "secretaria" ? "empleado" : prospecto.quien_leyo === "dueno" ? "dueño" : "sin definir"}`
                  : ""
          }`
}${
            // La oferta solo existe en Galu y solo a partir del mensaje 2. Va al
            // prompt para que la IA no la reescriba: el precio y la fecha son datos
            // duros, y cambiarlos "para que suene mejor" genera un problema real
            // cuando el prospecto contesta citando un número que nunca se cotizó.
            !esAgencias && !esVivoMenu && ["m2", "m3", "fu_revision1", "fu_revision2"].includes(paso)
                ? `\nOFERTA CERRADA (no se toca, va tal cual): ${prospecto.oferta_titulo || "[sin definir]"} · ${prospecto.oferta_precio || "[sin precio]"} · ${prospecto.oferta_plazo || "[sin plazo]"}`
                : ""
        }`;

        const reglas = esAgencias
            ? reglasAgencias(paso as PasoMensajeAgencia, canalSugerido(prospecto))
            : esVivoMenu
              ? reglasVivoMenu(paso as PasoMensajeVivoMenu, nivel)
              : reglasGalu(
                    nivel && nivel <= 2 ? "completa (3 líneas)" : "corta (observación + pregunta, sin diagnóstico)"
                ) +
                (["m2", "m3", "fu_revision1", "fu_revision2"].includes(paso)
                    ? `
17. LA OFERTA NO SE TOCA. El título, el precio y el plazo van exactamente como vienen en el borrador. No
   redondees el precio, no cambies la fecha, no reformules qué se arregla. Si en el borrador hay un
   marcador entre corchetes, DEJALO entre corchetes: significa que falta completarlo y tiene que verse.
18. Este mensaje entrega el análisis, pero su trabajo real es dejar UNA decisión sobre la mesa. No agregues
   más problemas, no ofrezcas nada gratis además del análisis, y no cierres con una pregunta abierta
   ("cualquier cosa avisame"). Cierra con el pedido concreto que ya trae el borrador.`
                    : "");

        const prompt = `Sos quien escribe los mensajes en frío de ${esAgencias ? "Gastón, diseñador y desarrollador web argentino que trabaja como proveedor de agencias del exterior" : esVivoMenu ? "VivoMenu, un menú digital para gastronomía" : "Galu, una agencia web"}${esAgencias ? "" : " de San Miguel de Tucumán"}.
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
