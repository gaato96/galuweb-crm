// ============================================================
// Motor de mensajes — VivoMenu (menú digital y pedidos para gastronomía)
// ============================================================
// Comparte con Galu la infraestructura de prospeccion.ts (estados, follow-ups,
// listados) pero los mensajes son propios.
//
// Rehecho el 2026-11-20 con lo que pidió Gastón después de leer la versión de
// la fase 10 (repo menu-digital, marketing/ventas/mensajes.md):
//   · se habla como se habla en Tucumán: "Hola, cómo están? Me llamo Gastón,
//     soy de acá de Tucumán". Nada de "No es un pedido, disculpá", que hace
//     que no lo lean, ni frases que suenan armadas;
//   · no se da por hecho que tenemos su carta: casi ningún local la publica
//     entera. Se manda la de muestra y se ofrece armar la suya con una foto.
//     Solo si Gastón ya se la armó (revision_url) el primer mensaje la muestra;
//   · tres mensajes en ocho días (el primero, el día 3 y el día 8) y se cierra.
//     fu3 queda para el que pidió que le escriban más adelante.
// Lo usa la pantalla del celular (/prospeccion/vivomenu) y el modal de siempre.
// ============================================================

import type { Prospecto, EscaneoVivo } from "./types";
import { diasDesde } from "./prospeccion";

/** Un solo lugar para cambiar quién firma los mensajes. */
export const VIVOMENU_REMITENTE = "Gastón";
export const VIVOMENU_CIUDAD = "Tucumán";

/** El menú de muestra que se manda cuando todavía no se le armó el suyo. */
export const DEMO_VIVOMENU = "https://vivomenu.com.ar/m/burger-house-tuc";

export type PasoMensajeVivoMenu =
    | "primer_contacto"
    | "rama_empleado"
    | "rama_dueno"
    | "fu1"           // día 3
    | "fu2"           // día 8, el cierre
    | "fu3"           // el que dijo "después"
    | "interes_tibio"
    | "compromiso_visita"
    | "no_interesa";

export const PASO_VIVOMENU_LABELS: Record<PasoMensajeVivoMenu, string> = {
    primer_contacto: "Primer mensaje",
    rama_empleado: "Contestó un empleado",
    rama_dueno: "Contestó el dueño",
    fu1: "Día 3",
    fu2: "Día 8 (cierre)",
    fu3: "Recontacto (dijo «después»)",
    interes_tibio: "Pedirle la foto de la carta",
    compromiso_visita: "Proponer la visita",
    no_interesa: "No le interesa",
};

/** Pasos sin texto de una fuente escrita: avisar en la UI. Hoy, ninguno. */
export const PASOS_SIN_FUENTE_TEXTUAL: PasoMensajeVivoMenu[] = [];

/** §3.4 — clasifica un canal existente. */
export function tieneWhatsappBusiness(p: Prospecto): boolean {
    return p.es_whatsapp_business === true;
}

export type CanalVivo = "whatsapp" | "instagram";

/** Por dónde se le escribe: WhatsApp si hay un número, si no Instagram. */
export function canalVivo(p: Prospecto): CanalVivo {
    if (p.telefono_wa) return "whatsapp";
    return p.instagram_url ? "instagram" : "whatsapp";
}

/** Lo que dijo el escaneo de Google, o null si todavía no se escaneó. */
export function vivoDe(p: Prospecto): EscaneoVivo | null {
    const e = p.escaneo as { vivo?: EscaneoVivo } | null;
    return e?.vivo ?? null;
}

/**
 * El orden de la cola. No es un juicio sobre el local: es a quién conviene
 * escribirle primero según lo que dice Google.
 *   · hace delivery o para llevar → tiene el pedido directo, es el cliente del plan;
 *   · solo salón → va al final (el plan entra por delivery);
 *   · las reseñas dicen cuánto movimiento hay.
 */
export function prioridadVivo(p: Prospecto): number {
    const v = vivoDe(p);
    let puntos = 0;
    if (v?.delivery) puntos += 40;
    if (v?.para_llevar) puntos += 25;
    if (v && !v.delivery && !v.para_llevar && v.salon) puntos -= 30;
    const r = p.reviews_count ?? 0;
    puntos += r >= 300 ? 20 : r >= 100 ? 15 : r >= 30 ? 10 : r >= 10 ? 5 : 0;
    if (p.telefono_wa) puntos += 10;
    return puntos;
}

/**
 * Genera el texto del paso pedido, listo para pegar en WhatsApp o Instagram.
 * Se habla en plural ("les escribo") porque el número de un local lo lee
 * cualquiera; cuando contesta alguien, se pasa al vos.
 */
export function generarMensajeVivoMenu(paso: PasoMensajeVivoMenu, p: Prospecto, canal: CanalVivo = canalVivo(p)): string {
    const suCarta = p.revision_url.trim();
    const link = suCarta || DEMO_VIVOMENU;

    if (paso === "primer_contacto") {
        if (canal === "instagram") {
            return suCarta
                ? `Hola, cómo están? Me llamo ${VIVOMENU_REMITENTE}, soy de ${VIVOMENU_CIUDAD}. Les armé la carta en un link para que los clientes les pidan desde ahí y el pedido les llegue al WhatsApp ya escrito. ¿Se las paso para que la vean?`
                : `Hola, cómo están? Me llamo ${VIVOMENU_REMITENTE}, soy de ${VIVOMENU_CIUDAD}. Hice un sistema para que los clientes les pidan desde un link y el pedido les llegue al WhatsApp ya escrito. Si quieren les paso uno de muestra, y si les sirve les armo el de ustedes gratis.`;
        }
        if (suCarta) {
            return [
                `Hola, cómo están? Me llamo ${VIVOMENU_REMITENTE}, soy de acá de ${VIVOMENU_CIUDAD}.`,
                "",
                `Les armé la carta en un link para que los clientes les pidan desde ahí: ven los productos con fotos, arman el pedido y les llega a este WhatsApp ya escrito, con la dirección y cómo paga.`,
                "",
                `Mírenla como si fueran un cliente: ${link}`,
                "",
                "Si les sirve, se los dejo andando gratis.",
            ].join("\n");
        }
        return [
            `Hola, cómo están? Me llamo ${VIVOMENU_REMITENTE}, soy de acá de ${VIVOMENU_CIUDAD}.`,
            "",
            "Les escribo porque hice un sistema para locales de comida: el cliente entra a un link, ve la carta con fotos, arma su pedido y les llega a este WhatsApp ya escrito, con la dirección y cómo paga.",
            "",
            `Les dejo uno de muestra para que lo vean: ${link}`,
            "",
            "Si les interesa, les armo el de ustedes gratis con su carta.",
        ].join("\n");
    }

    if (paso === "rama_empleado") {
        return "Gracias! Si le podés pasar el mensaje al dueño, te agradezco. A vos también te sirve: los pedidos llegan armados y no hay que preguntar todo de a uno.";
    }

    if (paso === "rama_dueno") {
        return "Buenísimo! Te hago una pregunta: los pedidos te entran más por WhatsApp o por PedidosYa?";
    }

    if (paso === "fu1") {
        return suCarta
            ? `Hola de nuevo! No sé si pudieron ver la carta que les armé: ${link}. Si algún precio está viejo me dicen y lo cambio.`
            : "Hola de nuevo! No sé si pudieron ver el link que les mandé. Si me pasan una foto de la carta les armo la de ustedes y se las mando para que la vean, sin compromiso.";
    }

    if (paso === "fu2") {
        return "Última vez que les escribo por esto, no quiero molestar. Si algún día quieren probarlo, me escriben y se los armo. Éxitos!";
    }

    if (paso === "fu3") {
        return "Hola, cómo andan? Les escribo como habíamos quedado, por lo del link para los pedidos. ¿Les armo la carta esta semana?";
    }

    if (paso === "interes_tibio") {
        return "Dale! Pasame una foto de la carta, con los precios, y te la armo. En un rato te mando el link para que la veas.";
    }

    if (paso === "no_interesa") {
        return "Dale, gracias igual por responder. Éxitos con el local!";
    }

    // compromiso_visita
    const { texto1, texto2 } = proximosDiasEnvio();
    return `Si te parece, paso por el local y te lo dejo andando. La instalación es gratis y lo probás 15 días con tus pedidos. Si no te sirve, lo sacamos. ¿Te queda bien el ${texto1} a las 16, o el ${texto2}?`;
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
