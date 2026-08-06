// ============================================================
// Motor de mensajes — VivoMenu (menú digital para gastronomía)
// ============================================================
// Comparte con Galu la infraestructura de prospeccion.ts (escaneo, niveles,
// score, follow-ups, scraping) pero el guion de mensajes es distinto de raíz:
// el que lee el WhatsApp es un empleado tomando pedidos, no un dueño mirando
// su Instagram, y eso cambia la estructura entera del primer contacto.
//
// Fuente: documento "VivoMenu — Sistema de prospección en frío" v1 (2026-08-06).
// Los pasos fu2 y fu3 (día 7 y día 14) NO vienen citados textualmente en ese
// documento — remite a "mensajes-en-frio.md §2" para el texto exacto, que no
// está disponible acá. Se escribieron en el mismo tono que el resto; conviene
// reemplazarlos por el texto real apenas esté a mano.
// ============================================================

import type { Prospecto, FallaVerificable } from "./types";
import { normalizarEscaneo, diasDesde } from "./prospeccion";

/** Un solo lugar para cambiar quién firma los mensajes. */
export const VIVOMENU_REMITENTE = "Gastón";
export const VIVOMENU_CIUDAD = "Tucumán";

export type PasoMensajeVivoMenu =
    | "primer_contacto"
    | "rama_empleado"
    | "rama_dueno"
    | "fu1"           // día 3 — chequeo de 3 puntos
    | "fu2"           // día 7
    | "fu3"           // día 14 — cierre
    | "interes_tibio"
    | "compromiso_visita";

export const PASO_VIVOMENU_LABELS: Record<PasoMensajeVivoMenu, string> = {
    primer_contacto: "Primer contacto (2 burbujas)",
    rama_empleado: "Contestó el empleado",
    rama_dueno: "Contestó el dueño",
    fu1: "Follow-up día 3 — chequeo de 3 puntos",
    fu2: "Follow-up día 7",
    fu3: "Follow-up día 14 — cierre",
    interes_tibio: "Interés tibio → armarle el menú",
    compromiso_visita: "Compromiso → agendar visita",
};

/** Pasos que no vienen con texto citado del documento original — avisar en la UI. */
export const PASOS_SIN_FUENTE_TEXTUAL: PasoMensajeVivoMenu[] = ["fu2", "fu3"];

function minuscula(txt: string): string {
    const t = (txt || "").trim();
    if (!t) return "";
    return t.charAt(0).toLowerCase() + t.slice(1);
}

/** §5 Peldaño 1 — la señal que abre el mensaje, en minúscula para insertarla en la frase. */
function senialParaMensaje(p: Prospecto): string {
    if (p.dato_usado.trim()) return minuscula(p.dato_usado);
    const escaneo = normalizarEscaneo(p.escaneo);
    if (escaneo.queja_textual.trim()) return minuscula(escaneo.queja_textual);
    return `varias cosas de ${p.negocio || "tu local"} en Google`;
}

/** §3.3 traducido a frases: mismas fallas de prospeccion.ts, fraseadas para pedidos por WhatsApp. */
const FALLA_A_HALLAZGO_VIVOMENU: Record<FallaVerificable, string> = {
    whatsapp_personal: "el WhatsApp es un número personal, sin catálogo ni respuestas rápidas — cada pedido hay que escribirlo de cero",
    ficha_incompleta: "la ficha de Google no tiene el menú ni los horarios cargados",
    horarios_mal: "los horarios de Google no coinciden con los reales, así que a veces escriben y no hay nadie",
    bio_rota: "el link de la bio de Instagram no lleva a ningún lado",
    no_aparece_rubro: "no aparece al buscar el rubro + la zona, solo buscando el nombre exacto",
    web_lenta: "el link que tienen para pedir tarda o no carga bien desde el celular",
    sin_responder_resenas: "hay reseñas sin responder, algunas mencionando demoras",
};

/** §3.4 + §5 rama dueño — clasifica un canal existente para saber cuál mensaje de ruteo mandar. */
export function tieneWhatsappBusiness(p: Prospecto): boolean {
    return p.es_whatsapp_business === true;
}

/**
 * §5 — genera el texto del paso pedido. Los dos primeros bloques del primer
 * contacto se devuelven como un solo string con línea en blanco entre medio,
 * igual que hace generarMensaje() de Galu — la UI ya sabe copiar/enviar así.
 */
export function generarMensajeVivoMenu(paso: PasoMensajeVivoMenu, p: Prospecto): string {
    const escaneo = normalizarEscaneo(p.escaneo);
    const demoUrl = p.revision_url.trim() || "[tu link de demo VivoMenu]";

    if (paso === "primer_contacto") {
        return [
            "Hola. No es un pedido, disculpá — te escribo por otra cosa.",
            "",
            `Soy ${VIVOMENU_REMITENTE}, de acá de ${VIVOMENU_CIUDAD}. Vi que ${senialParaMensaje(p)}. Hago un link donde el cliente ve la carta con fotos, arma el pedido con los agregados, y te llega a este mismo WhatsApp ya escrito y prolijo.`,
            "",
            `Este es uno real, tocalo como si fueras un cliente: ${demoUrl}`,
            "",
            "¿Este WhatsApp lo lleva el dueño, o se lo puedo pasar por acá?",
        ].join("\n");
    }

    if (paso === "rama_empleado") {
        return [
            "Buenísimo, gracias. Y ya que sos vos el que atiende esto: lo que hace es que el pedido te llega armado, con los agregados y la dirección adentro, en vez de tener que ir preguntando de a uno.",
            "",
            "Si se lo pasás y quiere verlo, decile que en dos minutos se lo muestro andando. O pasame vos un horario y voy.",
        ].join("\n");
    }

    if (paso === "rama_dueno") {
        return "Bien. Contame una cosa, para no hacerte perder tiempo: un viernes a la noche, ¿los pedidos te entran más por acá o por PedidosYa?";
    }

    if (paso === "fu1") {
        // §6 — el "chequeo de 3 puntos". Necesita hallazgos reales del escaneo:
        // si no hay suficientes, se avisa en vez de inventar observaciones falsas.
        const hallazgos = escaneo.fallas.map((f) => FALLA_A_HALLAZGO_VIVOMENU[f]).slice(0, 3);
        if (escaneo.queja_textual.trim() && hallazgos.length < 3) {
            hallazgos.unshift(`en las reseñas alguien menciona: "${escaneo.queja_textual.trim()}"`);
        }
        while (hallazgos.length < 3) {
            hallazgos.push("[completar con otro hallazgo real del escaneo — no inventar, la fuerza del mensaje es que todo sea verificable]");
        }

        return [
            "Hice la prueba de pedirte como cliente, para ver dónde se traba. Tres cosas que vi:",
            "",
            ...hallazgos.slice(0, 3).map((h, i) => `${i + 1}. ${h.charAt(0).toUpperCase()}${h.slice(1)}.`),
            "",
            "Ninguna de las tres es grave sola. Juntas son pedidos que se caen antes de empezar.",
        ].join("\n");
    }

    if (paso === "fu2") {
        return [
            `Che, sigo por acá — no quiero insistir de más. ${escaneo.queja_textual.trim() ? "Lo que vi de las reseñas sigue ahí" : "Lo que te comenté sigue vigente"}, y el link de muestra también: ${demoUrl}`,
            "",
            "Si en algún momento querés que te arme el tuyo con tu carta real, avisame. Si no, no hay drama.",
        ].join("\n");
    }

    if (paso === "fu3") {
        return "Última por acá para no ser pesado. Si en algún momento sentís que se te complica el WhatsApp los viernes a la noche, escribime — te lo armo en el momento. Éxitos con el local!";
    }

    if (paso === "interes_tibio") {
        return "Mejor que explicártelo: pasame una foto de tu carta y te armo el tuyo con 5 o 6 productos, para que lo veas con tus precios y no con los de otro. Te lo mando y lo mirás cuando puedas. Sin compromiso, si no te gusta lo bajo.";
    }

    // compromiso_visita
    const { texto1, texto2 } = proximosDiasEnvio();
    return [
        "¿Te parece si paso y te lo dejo funcionando de verdad, con toda la carta y las fotos? Son 40 minutos y lo usás un fin de semana. Si no te sirvió, lo sacamos.",
        "",
        `¿Te va ${texto1} a las 16, o ${texto2} a esa hora?`,
    ].join("\n");
}

/** Los próximos martes y jueves desde hoy, en formato "martes 12" (§4 — el mapa completo). */
export function proximosDiasEnvio(hoy: Date = new Date()): { texto1: string; texto2: string; fecha1: Date; fecha2: Date } {
    const formateador = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric" });
    const buscar = (diaSemana: number) => {
        const d = new Date(hoy);
        const delta = (diaSemana - d.getDay() + 7) % 7 || 7; // siempre el próximo, no hoy
        d.setDate(d.getDate() + delta);
        return d;
    };
    const martes = buscar(2);
    const jueves = buscar(4);
    return { texto1: formateador.format(martes), texto2: formateador.format(jueves), fecha1: martes, fecha2: jueves };
}

// ─────────────────────────────────────────────────────────────
// §7 — Rampa de volumen (calentar el número, evitar el bloqueo de WhatsApp)
// ─────────────────────────────────────────────────────────────

interface TierRampa { semana: number; porDia: number; porSemana: number; esTecho: boolean }

const RAMPA: { porDia: number; porSemana: number }[] = [
    { porDia: 5, porSemana: 10 },   // semana 1
    { porDia: 8, porSemana: 16 },   // semana 2
    { porDia: 10, porSemana: 20 },  // semana 3
];
const TECHO = { porDia: 12, porSemana: 24 }; // semana 4 en adelante

/**
 * §7.2 — el volumen no arranca en el techo: calienta el número y da margen
 * para corregir el mensaje. Se calcula desde el primer envío real registrado
 * con sistema="vivomenu"; si todavía no mandaste nada, arranca en semana 1.
 */
export function calcularRampaVivoMenu(prospectosVivoMenu: Prospecto[], hoy: Date = new Date()): TierRampa {
    const fechas = prospectosVivoMenu
        .map((p) => p.fecha_envio)
        .filter((f): f is string => !!f)
        .sort();

    if (fechas.length === 0) return { semana: 1, ...RAMPA[0], esTecho: false };

    const dias = diasDesde(fechas[0], hoy);
    const semanaIdx = Math.max(0, Math.floor(dias / 7));
    const tier = RAMPA[semanaIdx];
    if (tier) return { semana: semanaIdx + 1, ...tier, esTecho: false };
    return { semana: semanaIdx + 1, ...TECHO, esTecho: true };
}

/** §7.1 — "el sábado es el peor día... no se manda, se prepara." Aviso, no bloqueo. */
export function avisoDiaVivoMenu(hoy: Date = new Date()): string | null {
    const dia = hoy.getDay(); // 0 domingo … 6 sábado
    if (dia === 6) {
        return "Hoy es sábado: el sistema VivoMenu no manda primeros contactos este día — es el peor momento para un local gastronómico. Aprovechá para investigar y dejar preparados los mensajes del martes.";
    }
    if (dia === 0) {
        return "Domingo: tampoco es día de envío. Responder conversaciones abiertas está bien; iniciar en frío, no.";
    }
    return null;
}
