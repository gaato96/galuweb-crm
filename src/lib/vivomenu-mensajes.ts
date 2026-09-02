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
import { SENIALES_POR_ID, senialPrincipal, hizoPruebaDePedido } from "./dolores-rubro";

/** Un solo lugar para cambiar quién firma los mensajes. */
export const VIVOMENU_REMITENTE = "Gastón";
export const VIVOMENU_CIUDAD = "Tucumán";

/**
 * El menú de muestra que se manda en frío. Es el mismo para todos: sirve para
 * que lo toquen como cliente, no para mostrarles su carta.
 *
 * El personalizado (§5 "interés tibio") se guarda por prospecto en revision_url
 * y, cuando existe, reemplaza a este en todos los pasos: mostrarle su propia
 * carta con sus precios es otra conversación que mostrarle la de un tercero.
 */
export const DEMO_VIVOMENU = "https://vivomenu.com.ar/m/burger-house-tuc/catalogo";

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

/**
 * §5 Peldaño 1 — la observación que abre el mensaje, ya como oración completa.
 *
 * Devuelve la frase entera y no un fragmento para pegar después de "Vi que",
 * porque así estaba y producía dos mensajes rotos:
 *
 *   · Con una queja de cliente (nivel 1, el dato más fuerte que hay) salía
 *     "Vi que pedí dos rolls y me llegó uno solo" — la queja quedaba en primera
 *     persona, como si el que escribe hubiera sido el que pidió. Una queja se
 *     CITA, no se cuenta.
 *   · Sin ningún dato salía "Vi que varias cosas de Don José en Google", que ni
 *     siquiera es una oración.
 *
 * Devuelve null cuando no hay nada verificado: en ese caso el mensaje no abre
 * con una observación en vez de abrir con una inventada.
 */
function observacionParaMensaje(p: Prospecto): string | null {
    const escaneo = normalizarEscaneo(p.escaneo);

    // Nivel 1 gana siempre (§4). Va antes que dato_usado porque para un nivel 1
    // dato_usado ES la queja (lo autocompleta sugerirDatoUsado), y por ese
    // camino volvía a colarse sin comillas y en primera persona.
    if (escaneo.tiene_queja_cliente && escaneo.queja_textual.trim()) {
        return `Estuve leyendo las reseñas y vi que alguien puso: "${escaneo.queja_textual.trim()}".`;
    }
    if (p.dato_usado.trim()) return `Vi que ${minuscula(p.dato_usado)}.`;

    const senial = senialPrincipal(escaneo.fallas);
    if (senial?.hallazgo) return `Vi que ${senial.hallazgo}.`;

    return null;
}

/** Los hallazgos salen del catálogo de gastronomía (dolores-rubro.ts), ordenados por peso. */
function hallazgosDelEscaneo(fallas: FallaVerificable[]): string[] {
    return fallas
        .map((f) => SENIALES_POR_ID[f])
        .filter((s) => !!s?.hallazgo)
        .sort((a, b) => b.peso - a.peso)
        .map((s) => s.hallazgo as string);
}

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
    const demoUrl = p.revision_url.trim() || DEMO_VIVOMENU;
    const enApps = escaneo.fallas.includes("en_apps_delivery");

    if (paso === "primer_contacto") {
        // Dos ángulos, y la diferencia no es de tono: es qué problema tienen.
        //
        // Al que ya está en PedidosYa no hay que explicarle que el pedido online
        // sirve — lo está usando. Lo que le duele es la comisión, así que la
        // línea 2 va directo ahí. Al que no está en ninguna app, la comisión no
        // le dice nada todavía; lo que le duele es el WhatsApp del viernes.
        // Sin observación verificada el mensaje NO abre inventando una: se
        // presenta y muestra el link. Es más corto y más honesto, y el link
        // sigue siendo lo que hace el trabajo.
        const observacion = observacionParaMensaje(p);
        const presentacion = `Soy ${VIVOMENU_REMITENTE}, de acá de ${VIVOMENU_CIUDAD}.${observacion ? ` ${observacion}` : ""}`;
        const queHace = enApps
            ? "Hago un link propio donde el cliente ve la carta con fotos, arma el pedido solo y te entra directo a este WhatsApp. Lo mismo que hacés hoy, pero sin dejar la comisión de cada pedido."
            : "Hago un link donde el cliente ve la carta con fotos, arma el pedido con los agregados y te llega acá ya escrito, en vez de tener que ir preguntándole de a uno.";
        const linea2 = `${presentacion} ${queHace}`;

        return [
            "Hola. No es un pedido, disculpá — te escribo por otra cosa.",
            "",
            linea2,
            "",
            `Este es uno real, tocalo como si fueras un cliente: ${demoUrl}`,
            "",
            "Este WhatsApp lo lleva el dueño, o se lo puedo pasar por acá?",
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
        // La pregunta abre el tema de la comisión sin nombrarla, y la respuesta
        // dice cuál de los dos productos entra después: si contesta "PedidosYa",
        // el argumento es lo que deja ahí; si contesta "por acá", es el quilombo
        // de tomar todo a mano y ahí entra la parte de gestión.
        return enApps
            ? "Bien. Contame una cosa, para no hacerte perder tiempo: de lo que vendés por PedidosYa, tenés idea de cuánto se te va en comisión por mes?"
            : "Bien. Contame una cosa, para no hacerte perder tiempo: un viernes a la noche, los pedidos te entran más por acá o por PedidosYa?";
    }

    if (paso === "fu1") {
        // §6 — el "chequeo de 3 puntos". Necesita hallazgos reales del escaneo:
        // si no hay suficientes, se avisa en vez de inventar observaciones falsas.
        const hallazgos = hallazgosDelEscaneo(escaneo.fallas).slice(0, 3);
        if (escaneo.queja_textual.trim() && hallazgos.length < 3) {
            hallazgos.unshift(`en las reseñas alguien menciona: "${escaneo.queja_textual.trim()}"`);
        }

        // El mensaje se adapta a cuántos hallazgos REALES hay, en vez de pedir
        // siempre tres y rellenar con placeholders. Con dos hallazgos buenos el
        // mensaje funciona igual; con uno bueno y dos "[completar]" no se puede
        // mandar, y al arrancar a prospectar ese es el caso más común.
        if (hallazgos.length === 0) {
            return "[Sin hallazgos cargados: este follow-up no se puede armar sin al menos uno real. Completá el Escaneo — con uno solo alcanza.]";
        }

        const cuantos = hallazgos.length === 1 ? "Una cosa que vi" : hallazgos.length === 2 ? "Dos cosas que vi" : "Tres cosas que vi";

        // "Te pedí como cliente" solo se puede decir si de verdad se hizo la prueba.
        // Si el escaneo fue únicamente frío, la apertura cambia y no afirma nada falso.
        const apertura = hizoPruebaDePedido(escaneo.fallas)
            ? `Hice la prueba de pedirte como cliente, para ver dónde se traba. ${cuantos}:`
            : `Estuve mirando cómo se pide desde afuera, como lo ve alguien que todavía no te conoce. ${cuantos}:`;

        const cierre =
            hallazgos.length === 1
                ? "No es grave, pero es justo el momento en el que alguien que todavía no te conoce se va a otro lado."
                : `Ninguna de las ${hallazgos.length === 2 ? "dos" : "tres"} es grave sola. Juntas son pedidos que se caen antes de empezar.`;

        return [
            apertura,
            "",
            ...hallazgos.map((h, i) => `${i + 1}. ${h.charAt(0).toUpperCase()}${h.slice(1)}.`),
            "",
            cierre,
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

    // compromiso_visita — el único paso donde entra la parte de gestión.
    // Antes no se nombra: en frío, "sistema de gestión" es una palabra que
    // cierra la conversación. Acá ya vio su propia carta andando y la pregunta
    // que sigue naturalmente es qué pasa con el pedido una vez que entra.
    const { texto1, texto2 } = proximosDiasEnvio();
    return [
        "Te parece si paso y te lo dejo funcionando de verdad, con toda la carta y las fotos? Son 40 minutos y lo usás un fin de semana. Si no te sirvió, lo sacamos.",
        "",
        "Ahí te muestro también la otra parte, que es donde se ve de verdad: los pedidos entran a una pantalla en orden, con la hora y el estado de cada uno, y queda el registro de lo que más sale y de lo que se te termina. Eso es lo que hoy vive en papelitos y en la cabeza del que atiende.",
        "",
        `Te va ${texto1} a las 16, o ${texto2} a esa hora?`,
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
    // En orden cronológico, no siempre martes primero. Un miércoles, "el próximo
    // martes" cae recién a los seis días y el jueves a los dos, y el mensaje
    // terminaba ofreciendo "te va martes 8, o jueves 3?" — al revés, y se lee
    // como que uno no miró el calendario antes de escribir.
    const [primero, segundo] = [buscar(2), buscar(4)].sort((a, b) => a.getTime() - b.getTime());
    return {
        texto1: formateador.format(primero),
        texto2: formateador.format(segundo),
        fecha1: primero,
        fecha2: segundo,
    };
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
