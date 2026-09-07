// ============================================================
// Guion de prospección a consultorios odontológicos — Sarvo
// Baja a código la Etapa 3 de notas/10-plan.md.
// ============================================================
//
// Por qué este guion no se parece a ninguno de los otros tres:
//
//   · No hay análisis gratis. Ese fue el error del sistema "galu": el análisis
//     entregaba todo el valor antes de que hubiera una decisión sobre la mesa.
//     45 mandados, 5 pedidos, 0 clientes.
//   · No se vende una web. Se vende que el consultorio deje de perder consultas
//     fuera de horario. El odontólogo no compra "presencia digital", compra
//     sacarse de encima un costo o un problema que ya tiene.
//   · La personalización no sale de mirar: sale de escribirle. Se le escribe
//     como paciente un sábado a la noche preguntando el precio de una limpieza,
//     y se anota la hora exacta de la respuesta. Ese dato ES el mensaje, y por
//     eso vive en el prospecto (prueba_enviada_at / prueba_respondida_at) y no
//     en un papel.
//   · El primer pedido no es una reunión ni un presupuesto: es permiso para
//     mandar un video de 40 segundos. Es lo más barato que puede decir que sí.
//
// Sobre la voz: el plan §4 fijó neutro para los mensajes en frío, pero eso se
// escribió cuando odontólogos era solo México. La primera tanda es Tucumán, y a
// un tucumano el neutro lo delata como plantilla o como extranjero. Así que la
// voz la decide el país del prospecto, no el sistema.

import type { Prospecto } from "./types";

export const REMITENTE = "Gastón";

/** Dónde verifica que el producto existe. Landing propia de Sarvo, no galuweb. */
export const SITIO = "sarvo.app";

/** Cuánto dura el video que se ofrece. Es el número del pedido, va literal. */
export const SEGUNDOS_VIDEO = 40;

export type Voz = "rio" | "neutro";

/**
 * Rioplatense en Argentina y Uruguay, neutro en todo el resto.
 *
 * No es una preferencia estética: en Tucumán el voseo es la forma normal de
 * hablarle a alguien y escribir en neutro suena a call center. En Guadalajara
 * pasa exactamente lo contrario.
 */
export function vozDe(p: Pick<Prospecto, "pais">): Voz {
    const pais = (p.pais || "").trim().toLowerCase();
    if (!pais) return "neutro";
    if (pais.startsWith("arg") || pais.startsWith("uru")) return "rio";
    return "neutro";
}

export type PasoMensajeOdontologia =
    | "m1"        // la prueba de la hora + permiso para mandar el video
    | "m1_sin_prueba" // m1 cuando todavía no se corrió la prueba: usa el escaneo
    | "fu1"       // día 3
    | "fu2"       // día 7
    | "fu3"       // día 14, el último
    | "video"     // dijeron que sí: va el video, sin precio
    | "precio"    // vieron el video: precio y llamada de 30 minutos
    | "ruteo";    // contesta la recepcionista, no el profesional

export const PASO_ODONTOLOGIA_LABELS: Record<PasoMensajeOdontologia, string> = {
    m1: "Mensaje 1 — La prueba de la hora",
    m1_sin_prueba: "Mensaje 1 — Sin prueba corrida (usa el escaneo)",
    fu1: "Follow-up 1 (3 días)",
    fu2: "Follow-up 2 (7 días)",
    fu3: "Follow-up 3 (14 días, el último)",
    video: `Mandar el video de ${SEGUNDOS_VIDEO} segundos`,
    precio: "Precio y llamada de 30 minutos",
    ruteo: "Línea de ruteo al profesional",
};

// ─────────────────────────────────────────────────────────────
// La prueba de la hora
// ─────────────────────────────────────────────────────────────

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function fechaHora(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${DIAS[d.getDay()]} ${hh}:${mm}`;
}

/** Horas enteras entre el mensaje de prueba y la respuesta. null si falta el dato. */
export function horasPrueba(p: Prospecto): number | null {
    if (!p.prueba_enviada_at) return null;
    const desde = new Date(p.prueba_enviada_at).getTime();
    const hasta = p.prueba_respondida_at
        ? new Date(p.prueba_respondida_at).getTime()
        : Date.now();
    if (Number.isNaN(desde) || Number.isNaN(hasta)) return null;
    return Math.max(0, Math.round((hasta - desde) / 3_600_000));
}

/** ¿Se puede usar el mensaje 1 con la prueba, o hay que ir por el escaneo? */
export function tienePrueba(p: Prospecto): boolean {
    if (!p.prueba_enviada_at) return false;
    return Boolean(p.prueba_respondida_at) || p.prueba_sin_respuesta;
}

/**
 * La frase que hace todo el trabajo. Es un hecho verificable por el que la
 * recibe —lo tiene en su propio WhatsApp— y por eso no se puede discutir ni se
 * lee como plantilla.
 */
export function frasePrueba(p: Prospecto, voz: Voz = vozDe(p)): string {
    if (!p.prueba_enviada_at) return "";
    const salida = fechaHora(p.prueba_enviada_at);
    const horas = horasPrueba(p);

    if (p.prueba_sin_respuesta || !p.prueba_respondida_at) {
        const cuanto = horas != null && horas >= 24 ? ` Pasaron ${Math.floor(horas / 24)} días.` : "";
        return voz === "rio"
            ? `Les escribí el ${salida} preguntando por un turno y no me contestaron.${cuanto}`
            : `Les escribí el ${salida} preguntando por una cita y no recibí respuesta.${cuanto}`;
    }

    const vuelta = fechaHora(p.prueba_respondida_at);
    const demora = horas != null ? ` ${horas} horas después.` : ".";
    return voz === "rio"
        ? `Les escribí el ${salida} preguntando por un turno y me contestaron el ${vuelta}:${demora}`
        : `Les escribí el ${salida} preguntando por una cita y me respondieron el ${vuelta}:${demora}`;
}

// ─────────────────────────────────────────────────────────────
// El guion
// ─────────────────────────────────────────────────────────────

function saludo(p: Prospecto, voz: Voz): string {
    const nombre = p.contacto_nombre.trim().split(" ")[0];
    if (voz === "rio") return nombre ? `Hola ${nombre}, ¿cómo andás?` : "Hola, ¿cómo andás?";
    return nombre ? `Hola ${nombre}, ¿qué tal?` : "Hola, buenas.";
}

/** Cómo se nombra al consultorio sin que suene a base de datos. */
function comoSeLlama(p: Prospecto): string {
    return p.negocio.trim() || (vozDe(p) === "rio" ? "el consultorio" : "el consultorio");
}

/**
 * El guion completo. Igual que en los otros tres sistemas, devuelve un borrador
 * determinístico: la IA lo reescribe para que suene natural, pero no elige el
 * enfoque, no agrega funciones y no cambia el pedido.
 */
export function generarMensajeOdontologia(
    paso: PasoMensajeOdontologia,
    p: Prospecto,
    voz: Voz = vozDe(p)
): string {
    const negocio = comoSeLlama(p);
    const rio = voz === "rio";
    const hola = saludo(p, voz);

    switch (paso) {
        // ── Mensaje 1 ────────────────────────────────────────
        // Tres movimientos y nada más: quién soy en media línea, el hecho, y una
        // pregunta de sí o no que cuesta nada contestar. No hay precio, no hay
        // reunión, no hay explicación de qué es un agente de IA. Todo eso llega
        // después del video, cuando ya vieron para qué sirve.
        case "m1": {
            const prueba = frasePrueba(p, voz);
            return rio
                ? [
                      hola,
                      `Soy ${REMITENTE}, hago sistemas de atención automática para consultorios.`,
                      "",
                      prueba,
                      "",
                      `No es una crítica: pasa en todos lados, porque nadie puede estar con el celular un sábado a la noche. Lo que armé contesta esas consultas y agenda el turno solo, sin que vos toques nada.`,
                      "",
                      `¿Te mando un video de ${SEGUNDOS_VIDEO} segundos para que veas cómo responde?`,
                  ].join("\n")
                : [
                      hola,
                      `Soy ${REMITENTE}, desarrollo sistemas de atención automática para consultorios.`,
                      "",
                      prueba,
                      "",
                      `No es una crítica: pasa en todos lados, porque nadie puede estar pendiente del celular un sábado por la noche. Lo que desarrollé responde esas consultas y agenda la cita solo, sin que usted tenga que hacer nada.`,
                      "",
                      `¿Le mando un video de ${SEGUNDOS_VIDEO} segundos para que vea cómo responde?`,
                  ].join("\n");
        }

        // Variante para cuando la prueba no se corrió. Es peor mensaje —el dato
        // observado es más débil que el vivido— pero es mejor que no escribir.
        // Si se usa mucho esta variante, el problema no es el guion: es que no
        // se está corriendo la prueba del sábado.
        case "m1_sin_prueba": {
            const dato =
                p.dato_usado.trim() ||
                (rio
                    ? `vi que la gente pregunta precios y turnos por los comentarios de ${negocio}`
                    : `vi que hay personas preguntando precios y citas en los comentarios de ${negocio}`);
            return rio
                ? [
                      hola,
                      `Soy ${REMITENTE}, hago sistemas de atención automática para consultorios.`,
                      "",
                      `${dato[0].toUpperCase()}${dato.slice(1)}.`,
                      "",
                      "Esas consultas que llegan fuera de horario son turnos que se pierden. Lo que armé las contesta y agenda solo.",
                      "",
                      `¿Te mando un video de ${SEGUNDOS_VIDEO} segundos?`,
                  ].join("\n")
                : [
                      hola,
                      `Soy ${REMITENTE}, desarrollo sistemas de atención automática para consultorios.`,
                      "",
                      `${dato[0].toUpperCase()}${dato.slice(1)}.`,
                      "",
                      "Esas consultas que llegan fuera de horario son citas que se pierden. Lo que desarrollé las responde y agenda solo.",
                      "",
                      `¿Le mando un video de ${SEGUNDOS_VIDEO} segundos?`,
                  ].join("\n");
        }

        // ── Follow-ups ───────────────────────────────────────
        // Ninguno repite el pitch. Cada uno agrega una sola cosa nueva y sigue
        // pidiendo lo mismo, que es lo más barato de conceder.
        case "fu1":
            return rio
                ? `${hola} Te escribí hace unos días por lo de las consultas que entran fuera de horario. ¿Te sirve que te mande el video? Son ${SEGUNDOS_VIDEO} segundos, no te robo más que eso.`
                : `${hola} Le escribí hace unos días por las consultas que llegan fuera de horario. ¿Le mando el video? Son ${SEGUNDOS_VIDEO} segundos, nada más.`;

        case "fu2":
            return rio
                ? [
                      `${hola} Última cosa y te dejo tranquilo.`,
                      "",
                      "El dato que más sorprende a los que lo probaron no es la cantidad de consultas que entran de noche: es cuántas de esas terminaban en turno cuando alguien contestaba.",
                      "",
                      "¿Querés que te lo muestre?",
                  ].join("\n")
                : [
                      `${hola} Una última cosa y lo dejo.`,
                      "",
                      "El dato que más sorprende a quienes lo probaron no es cuántas consultas llegan de noche: es cuántas de esas terminaban en cita cuando alguien respondía.",
                      "",
                      "¿Quiere que se lo muestre?",
                  ].join("\n");

        case "fu3":
            return rio
                ? `${hola} No te escribo más por este tema. Si en algún momento te interesa ver cómo queda, está todo en ${SITIO}. Éxitos con el consultorio.`
                : `${hola} No le escribo más por este tema. Si en algún momento quiere ver cómo funciona, está todo en ${SITIO}. Éxitos con el consultorio.`;

        // ── Dijeron que sí ───────────────────────────────────
        // Va el video y NADA más. Sin precio, sin plan, sin lista de funciones.
        // El precio después del video es una conversación; el precio junto con
        // el video es una cotización que se compara con cualquier otra cosa.
        case "video":
            return rio
                ? [
                      "Acá va. Son 40 segundos de una conversación real: el paciente pregunta, el sistema le ofrece horarios y le deja el turno agendado.",
                      "",
                      "[VIDEO]",
                      "",
                      "Fijate el minuto en que confirma: eso queda cargado en la agenda solo, no lo toca nadie.",
                  ].join("\n")
                : [
                      "Aquí va. Son 40 segundos de una conversación real: el paciente pregunta, el sistema le ofrece horarios y le deja la cita agendada.",
                      "",
                      "[VIDEO]",
                      "",
                      "Fíjese en el momento en que confirma: eso queda cargado en la agenda solo, nadie lo toca.",
                  ].join("\n");

        // ── Después del video ────────────────────────────────
        // Recién acá aparece el número, y aparece con el "+ consumos" dicho de
        // entrada. Ver §3 del plan: el consumo de WhatsApp lo paga el cliente en
        // su cuenta, y eso se dice en la venta, no después.
        case "precio": {
            const consumo = rio
                ? "Aparte de eso, WhatsApp te cobra a vos los mensajes, directo a tu cuenta: los primeros 1.000 de cada mes son gratis y del 1.001 en adelante son 2,6 centavos de dólar. Para un consultorio de un profesional son unos USD 28 al mes."
                : "Aparte de eso, WhatsApp le cobra a usted los mensajes, directo a su cuenta: los primeros 1,000 de cada mes son gratis y del 1,001 en adelante son menos de un centavo de dólar. Para un consultorio de un profesional son unos USD 9 al mes.";
            return rio
                ? [
                      "Te paso los números, así los tenés antes de hablar.",
                      "",
                      "El plan de un profesional sale USD 49 por mes, más USD 190 de puesta en marcha por única vez. Incluye el agente, la agenda, los recordatorios automáticos de 24 horas y el pedido de reseña de Google.",
                      "",
                      consumo,
                      "",
                      "Yo no te cobro por mensaje. Lo que cobro es el sistema.",
                      "",
                      "¿Tenés 30 minutos esta semana para que te lo muestre andando con los datos de tu consultorio?",
                  ].join("\n")
                : [
                      "Le paso los números, para que los tenga antes de hablar.",
                      "",
                      "El plan de un profesional cuesta USD 49 al mes, más USD 190 de puesta en marcha por única vez. Incluye el agente, la agenda, los recordatorios automáticos de 24 horas y la solicitud de reseña de Google.",
                      "",
                      consumo,
                      "",
                      "Yo no le cobro por mensaje. Lo que cobro es el sistema.",
                      "",
                      "¿Tiene 30 minutos esta semana para que se lo muestre funcionando con los datos de su consultorio?",
                  ].join("\n");
        }

        // ── El que contesta no decide ────────────────────────
        // En un consultorio esto pasa casi siempre: atiende la recepcionista, y
        // es justamente a quien el producto puede sonarle a amenaza. No se le
        // discute ni se le vende: se le pide el puente.
        case "ruteo":
            return rio
                ? `Gracias por contestar. ¿Con quién puedo hablar del tema de los turnos? No es para venderte nada a vos: es una decisión del profesional y prefiero no hacerte perder tiempo.`
                : `Gracias por responder. ¿Con quién puedo hablar sobre el tema de las citas? No es para venderle nada a usted: es una decisión del profesional y prefiero no hacerle perder el tiempo.`;
    }
}
