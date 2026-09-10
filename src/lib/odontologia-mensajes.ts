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
//   · **La prueba no tiene una sola lectura, tiene dos.** El plan escribió el
//     guion suponiendo que el consultorio tarda, y ahí el ángulo es la consulta
//     que se pierde. Pero cuando contesta en diez minutos un sábado a las 21:40
//     el dato sigue siendo bueno: prueba que alguien está atado al celular el
//     fin de semana, y ese alguien cobra. Descartar a los que contestan rápido
//     tira a la basura justo a los consultorios que ya entendieron que atender
//     rápido vale — que son los que pagan. Por eso hay dos ángulos (ver abajo)
//     y una sola prueba que alimenta a los dos.
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
    | "m1"        // ángulo demora: la prueba de la hora + permiso para el video
    | "m1_gestion"    // ángulo gestión: contestaron rápido, y eso le cuesta a alguien
    | "m1_sin_prueba" // m1 cuando todavía no se corrió la prueba: usa el escaneo
    | "fu1"       // día 3
    | "fu2"       // día 7
    | "fu3"       // día 14, el último
    | "video"     // dijeron que sí: va el video, sin precio
    | "precio"    // vieron el video: precio y llamada de 30 minutos
    | "ruteo";    // contesta la recepcionista, no el profesional

export const PASO_ODONTOLOGIA_LABELS: Record<PasoMensajeOdontologia, string> = {
    m1: "Mensaje 1 — La prueba de la hora (tardaron)",
    m1_gestion: "Mensaje 1 — Contestaron rápido (gestión y ausentismo)",
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

/**
 * Minutos entre el mensaje de prueba y la respuesta. null si falta el dato.
 *
 * La unidad importa: con horas redondeadas, un consultorio que contestó en ocho
 * minutos daba "0 horas después", que no se puede escribir en ningún mensaje.
 * Y ese caso dejó de ser un descarte —es el ángulo de gestión—, así que ahora
 * hay que poder nombrarlo con precisión.
 */
export function minutosPrueba(p: Prospecto): number | null {
    if (!p.prueba_enviada_at) return null;
    const desde = new Date(p.prueba_enviada_at).getTime();
    const hasta = p.prueba_respondida_at
        ? new Date(p.prueba_respondida_at).getTime()
        : Date.now();
    if (Number.isNaN(desde) || Number.isNaN(hasta)) return null;
    return Math.max(0, Math.round((hasta - desde) / 60_000));
}

/** Horas enteras entre el mensaje de prueba y la respuesta. null si falta el dato. */
export function horasPrueba(p: Prospecto): number | null {
    const min = minutosPrueba(p);
    return min == null ? null : Math.round(min / 60);
}

/** Cómo se dice la demora adentro del mensaje: minutos abajo de hora y media. */
function textoDemora(min: number): string {
    if (min < 90) return `${min} ${min === 1 ? "minuto" : "minutos"} después`;
    const horas = Math.round(min / 60);
    if (horas < 48) return `${horas} horas después`;
    return `${Math.floor(horas / 24)} días después`;
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
    const min = minutosPrueba(p);
    const demora = min != null ? ` ${textoDemora(min)}.` : ".";
    return voz === "rio"
        ? `Les escribí el ${salida} preguntando por un turno y me contestaron el ${vuelta}:${demora}`
        : `Les escribí el ${salida} preguntando por una cita y me respondieron el ${vuelta}:${demora}`;
}

// ─────────────────────────────────────────────────────────────
// Los dos ángulos
// ─────────────────────────────────────────────────────────────

/**
 * Qué le duele a este consultorio, que es lo que decide el mensaje 1.
 *
 *   · `demora`  — tardaron o no contestaron. Duele la consulta que se pierde.
 *   · `gestion` — contestaron rápido, incluso fuera de horario. Ahí la consulta
 *                 perdida NO es el dolor: el dolor es que alguien está atado al
 *                 celular un sábado a la noche, que la agenda se lleva a mano y
 *                 que el que no viene no avisa.
 *
 * El segundo ángulo existe porque el primero, solo, tira a la basura a los
 * consultorios que más rápido pagan: el que ya contesta un sábado a las 22 es
 * el que ya decidió que atender rápido vale plata. No hay que convencerlo de
 * nada, hay que sacarle el costo de encima.
 */
export type AnguloOdontologia = "demora" | "gestion";

export const ANGULO_LABELS: Record<AnguloOdontologia, string> = {
    demora: "Demora — tardaron o no contestaron",
    gestion: "Gestión — contestan rápido, y eso lo hace alguien",
};

/**
 * Corte: hasta dos horas es "contestan rápido".
 *
 * No es un número fino, es el umbral abajo del cual el paciente no se fue a
 * buscar otro consultorio. Arriba de eso la consulta ya se enfrió y el ángulo
 * vuelve a ser la demora.
 */
export const MINUTOS_CONTESTA_RAPIDO = 120;

/**
 * Qué ángulo le toca, mirando primero la prueba y después el escaneo.
 *
 * Sin prueba corrida cae en `demora`, que es el default del plan — pero si el
 * escaneo marcó señales de gestión (varios profesionales en un solo WhatsApp,
 * avisos de ausentismo, sin reserva online) el dolor está ahí, aunque contesten
 * en dos minutos.
 */
export function anguloSugerido(p: Prospecto): AnguloOdontologia {
    const min = minutosPrueba(p);
    if (!p.prueba_sin_respuesta && p.prueba_respondida_at && min != null) {
        return min <= MINUTOS_CONTESTA_RAPIDO ? "gestion" : "demora";
    }
    if (p.prueba_enviada_at) return "demora";

    const fallas = new Set(p.escaneo?.fallas ?? []);
    const senialesDeGestion = ["varios_prof_un_canal", "aviso_ausentismo", "sin_reserva_online"] as const;
    return senialesDeGestion.some((f) => fallas.has(f)) ? "gestion" : "demora";
}

/** El paso de apertura que le corresponde, para no elegirlo a ojo cada vez. */
export function pasoAperturaSugerido(p: Prospecto): PasoMensajeOdontologia {
    if (!tienePrueba(p)) return "m1_sin_prueba";
    return anguloSugerido(p) === "gestion" ? "m1_gestion" : "m1";
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
    voz: Voz = vozDe(p),
    angulo: AnguloOdontologia = anguloSugerido(p)
): string {
    const negocio = comoSeLlama(p);
    const rio = voz === "rio";
    const hola = saludo(p, voz);
    // Los follow-ups no repiten el pitch, pero sí tienen que seguir el hilo del
    // mensaje 1: mandarle "cuántas consultas entran de noche" a alguien que
    // contesta de noche es contarle una película que ya vio.
    const porGestion = angulo === "gestion";

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

        // ── Mensaje 1, ángulo gestión ────────────────────────
        // Mismo pedido y misma estructura que el m1 de demora; cambia la lectura
        // del dato. Acá la prueba dice que SÍ contestan, y eso se dice como
        // elogio antes de nombrar lo que cuesta: que lo hace una persona.
        //
        // Nada de "perdés consultas": el que contesta un sábado a las 22 sabe
        // que no las pierde, y decirle lo contrario tira el mensaje a la basura
        // en la primera línea. Lo que no sabe es cuánto le cuesta sostenerlo.
        case "m1_gestion": {
            const prueba = frasePrueba(p, voz);
            return rio
                ? [
                      hola,
                      `Soy ${REMITENTE}, hago sistemas de atención automática para consultorios.`,
                      "",
                      prueba,
                      "",
                      "Te lo digo como elogio: contestan rápido hasta un fin de semana. Lo que pasa es que eso lo está haciendo una persona, y esa persona después tiene que pasar el turno a la agenda y acordarse de recordárselo al paciente.",
                      "",
                      "Lo que armé contesta igual de rápido a cualquier hora, deja el turno cargado solo y manda el recordatorio del día antes para que no falten.",
                      "",
                      `¿Te mando un video de ${SEGUNDOS_VIDEO} segundos para que veas cómo trabaja?`,
                  ].join("\n")
                : [
                      hola,
                      `Soy ${REMITENTE}, desarrollo sistemas de atención automática para consultorios.`,
                      "",
                      prueba,
                      "",
                      "Se lo digo como elogio: responden rápido incluso en fin de semana. Lo que pasa es que eso lo está haciendo una persona, y esa persona después tiene que pasar la cita a la agenda y acordarse de recordársela al paciente.",
                      "",
                      "Lo que desarrollé responde igual de rápido a cualquier hora, deja la cita agendada sola y envía el recordatorio del día anterior para que no falten.",
                      "",
                      `¿Le mando un video de ${SEGUNDOS_VIDEO} segundos para que vea cómo trabaja?`,
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
        case "fu1": {
            const tema = porGestion
                ? rio
                    ? "por lo de los turnos y los recordatorios"
                    : "por el tema de las citas y los recordatorios"
                : rio
                  ? "por lo de las consultas que entran fuera de horario"
                  : "por las consultas que llegan fuera de horario";
            return rio
                ? `${hola} Te escribí hace unos días ${tema}. ¿Te sirve que te mande el video? Son ${SEGUNDOS_VIDEO} segundos, no te robo más que eso.`
                : `${hola} Le escribí hace unos días ${tema}. ¿Le mando el video? Son ${SEGUNDOS_VIDEO} segundos, nada más.`;
        }

        // El único follow-up que trae algo nuevo. Cada ángulo tiene su dato: al
        // que tarda le sorprende cuántas de esas consultas terminaban en turno;
        // al que contesta rápido le sorprende cuántos pacientes avisan que no
        // vienen cuando les llega el recordatorio, que es plata de la agenda.
        case "fu2": {
            const dato = porGestion
                ? rio
                    ? "El dato que más sorprende a los que lo probaron es cuántos pacientes que iban a faltar sin avisar avisan cuando les llega el recordatorio del día antes. Ese lugar se vuelve a vender."
                    : "El dato que más sorprende a quienes lo probaron es cuántos pacientes que iban a faltar sin avisar avisan cuando les llega el recordatorio del día anterior. Ese espacio se vuelve a vender."
                : rio
                  ? "El dato que más sorprende a los que lo probaron no es la cantidad de consultas que entran de noche: es cuántas de esas terminaban en turno cuando alguien contestaba."
                  : "El dato que más sorprende a quienes lo probaron no es cuántas consultas llegan de noche: es cuántas de esas terminaban en cita cuando alguien respondía.";
            return rio
                ? [`${hola} Última cosa y te dejo tranquilo.`, "", dato, "", "¿Querés que te lo muestre?"].join("\n")
                : [`${hola} Una última cosa y lo dejo.`, "", dato, "", "¿Quiere que se lo muestre?"].join("\n");
        }

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
