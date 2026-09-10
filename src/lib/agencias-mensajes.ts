// ============================================================
// Guion de prospección a agencias del exterior — Galu como proveedor
// Baja a código el modelo de notas/10-a-quien-le-vendo.md §3.
// ============================================================
//
// Por qué este guion no se parece en nada al de Galu ni al de VivoMenu:
//
//   · No hay análisis gratis. Una agencia no necesita que le expliquen que una
//     web sirve — las vende. Mandarle un diagnóstico la ofende o, peor, la pone
//     en guardia pensando que le vas a robar el cliente.
//   · No hay diagnóstico ni "diagnóstico antes de diseño". Eso es lenguaje para
//     el cliente final. Una agencia quiere saber tres cosas: qué hacés, cuándo
//     podés y cuánto sale.
//   · El pedido no es permiso para mandar algo, es una pregunta de sí o no
//     sobre un hecho de su operación: si tercerizan cuando les desborda.
//   · No se menciona Tucumán como carencia ni se pide disculpas por ser uno
//     solo. Ser chico es la ventaja: no hay overhead y no les competís.
//
// La personalización sale de una sola observación verificable en diez segundos,
// pero no es la misma para todas: depende del segmento.
//
// **Los dos segmentos, y por qué hay dos.** El plan cerró el filtro en "ofrece
// desarrollo web = descartar", y para la lista A eso sigue igual. Pero que una
// agencia liste desarrollo web entre sus servicios no significa que tenga a
// alguien que lo haga: lo normal es venderlo y tercerizarlo, con un freelance
// distinto cada vez. A esa agencia no se le ofrece un servicio que no tiene —se
// le ofrece dejar de buscar proveedor cada vez que vende uno.
//
//   · **Lista A · no ofrece desarrollo web.** La observación es la ausencia:
//     "vi que hacen redes y pauta y no vi desarrollo web entre los servicios".
//     Le entran pedidos que hoy rechaza. Es la lista que valida el carril y se
//     lleva los diez mensajes del día.
//   · **Lista B · sí ofrece desarrollo web.** La observación es su equipo:
//     venden web y no tienen quién la haga adentro. El pedido no cambia —sí o
//     no— pero lo que se ofrece es continuidad y precio de proveedor, no
//     capacidad que les falte. Nunca se les dice que "no hacen web": lo hacen,
//     y decirles lo contrario quema el contacto en la primera línea.

import type { Prospecto } from "./types";

export const REMITENTE = "Gastón";

/** Un solo link, siempre el mismo: el portfolio propio. */
export const SITIO = "galuweb.com";

/**
 * Qué se nombra como respaldo. Van los trabajos, no los dominios.
 *
 * Antes iban las tres URLs sueltas y eso tenía dos costos: un mail frío con
 * varios links afuera dispara filtros de spam antes de que nadie lo lea, y el
 * que sí lo abre se va a tres lugares distintos en vez de al portfolio, que es
 * donde está todo junto y donde se ve cómo trabaja Galu.
 */
export const TRABAJOS = [
    "e-commerce para una empresa del Gran Toronto",
    "landing con ticketing por QR para un evento de 1.000 personas",
    "web institucional en WordPress",
];

/** La línea que reemplaza a la lista de links. Va igual en el mail y en el DM. */
export const LINEA_PORTFOLIO = `Algunos trabajos pueden verlos en ${SITIO}.`;

/**
 * Precios de proveedor en USD (notas/10-a-quien-le-vendo.md §3). Son 50-65% del
 * precio a cliente final: la agencia pone la venta, la gestión y el riesgo.
 */
export const PRECIOS_PROVEEDOR: { item: string; precio: string }[] = [
    { item: "Landing de una página", precio: "USD 250 a 400" },
    { item: "Sitio institucional WordPress (4-6 páginas)", precio: "USD 500 a 900" },
    { item: "E-commerce", precio: "USD 900 a 1.500" },
    { item: "Solo diseño en Figma, sin desarrollo", precio: "USD 300 a 600" },
    { item: "Mantenimiento mensual por sitio", precio: "USD 80 a 150" },
];

/**
 * En qué lista cae la agencia. Lo decide el único filtro que importa, que es si
 * vende desarrollo web o no.
 *
 * `sin_verificar` no es un tercer segmento: es que todavía nadie abrió su página
 * de servicios. Ahí el mensaje va sin observación, porque afirmar cualquiera de
 * las dos cosas sin haberlo mirado es la forma más rápida de que te contesten
 * "sí hacemos webs, mirá nuestro portfolio".
 */
export type SegmentoAgencia = "sin_web" | "con_web" | "sin_verificar";

export const SEGMENTO_AGENCIA_LABELS: Record<SegmentoAgencia, string> = {
    sin_web: "Lista A — no ofrece desarrollo web",
    con_web: "Lista B — ofrece desarrollo web, casi seguro tercerizado",
    sin_verificar: "Sin verificar — falta abrir su página de servicios",
};

export function segmentoAgencia(p: Pick<Prospecto, "ofrece_desarrollo_web">): SegmentoAgencia {
    if (p.ofrece_desarrollo_web === false) return "sin_web";
    if (p.ofrece_desarrollo_web === true) return "con_web";
    return "sin_verificar";
}

export type PasoMensajeAgencia =
    | "m1"            // presentación + oferta de capacidad + pregunta de sí o no
    | "fu1"           // día 3-4
    | "fu2"           // día 7-10, el último
    | "credenciales"  // contestó: referencias, precios y disponibilidad
    | "precios"       // pidió valores sueltos
    | "primer_trabajo" // proponer arrancar por algo chico
    | "ruteo"         // el que contesta no decide
    | "toque_vigencia"; // dijo que sí, no llegó trabajo: se mantiene vigente

export const PASO_AGENCIA_LABELS: Record<PasoMensajeAgencia, string> = {
    m1: "Mensaje 1 — Capacidad disponible",
    fu1: "Follow-up 1 (3-4 días)",
    fu2: "Follow-up 2 (7-10 días)",
    credenciales: "Referencias, precios y disponibilidad",
    precios: "Solo la lista de precios",
    primer_trabajo: "Proponer el primer trabajo chico",
    ruteo: "Línea de ruteo al que decide",
    toque_vigencia: "Toque de vigencia (cada 21 días)",
};

/**
 * Cómo se lo nombra en el mensaje. Una agencia se presenta por lo que vende, y
 * decirle "vi que hacen marketing digital" es tan genérico que se lee plantilla.
 * Si están cargados los servicios reales, se usan esos.
 */
function loQueHacen(p: Prospecto): string {
    const s = p.servicios.trim();
    if (!s) return "redes y campañas";
    // Se toman los dos primeros: la lista entera suena a que se copió la página.
    const items = s
        .split(/[,;·|/]+/)
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean);
    if (items.length === 0) return "redes y campañas";
    if (items.length === 1) return items[0];
    return `${items[0]} y ${items[1]}`;
}

function saludo(p: Prospecto): string {
    const nombre = p.contacto_nombre.trim();
    return nombre ? `Hola ${nombre.split(" ")[0]}, cómo va?` : "Hola, cómo va?";
}

/**
 * El guion completo. Igual que en los otros dos sistemas, esto devuelve un
 * borrador determinístico: la IA lo reescribe para que suene natural, pero no
 * elige el enfoque ni cambia el pedido.
 */
export function generarMensajeAgencia(
    paso: PasoMensajeAgencia,
    p: Prospecto,
    canal: CanalAgencia = canalSugerido(p)
): string {
    const negocio = p.negocio || "la agencia";

    /* El toque de vigencia va antes de la rama de canal porque no cambia con el
     * canal: es el mismo texto corto por mail o por DM.
     *
     * Es el mensaje más difícil de escribir de todo el guion, porque el riesgo no
     * es que no conteste —no hace falta que conteste— sino volverse molesto con
     * alguien que ya te dijo que sí. Tres reglas: no se pregunta si hay novedades,
     * no se pide nada, y se trae algo nuevo propio. Un "¿cómo va todo?" cada tres
     * semanas es exactamente lo que hace que te dejen de contestar. */
    if (paso === "toque_vigencia") {
        const nombre = p.contacto_nombre.trim().split(" ")[0];
        return [
            nombre ? `Hola ${nombre}, ¿cómo va?` : "Hola, ¿cómo va?",
            "",
            `Te escribo cortito para que me tengan presente: sigo con lugar para tomar trabajo de ${negocio ? "ustedes" : "web"} este mes.`,
            "",
            "[QUÉ TERMINASTE ESTE MES — una línea concreta: un sitio, un rubro, un plazo]",
            "",
            `Cualquier cosa que les entre de web, avísenme y les paso plazo y valor el mismo día. ${LINEA_PORTFOLIO}`,
        ].join("\n");
    }


    // El mensaje 1 por mail es otro texto, no el mismo con más saltos de línea.
    // Un DM se lee en diez segundos y tiene que caber en la previsualización; un
    // mail frío compite con otros veinte y se lo juzga por el asunto y las dos
    // primeras líneas, pero si supera eso tiene lugar para las tres cosas que una
    // agencia necesita saber antes de contestar: qué entrega, con qué respaldo y
    // cuánto sale. Mandar el texto corto por mail obliga a un segundo intercambio
    // para decir lo que podría haber ido de una.
    if (paso === "m1" && canal === "email") {
        const segmento = segmentoAgencia(p);

        // La observación y el motivo cambian con el segmento, no el pedido.
        // A la lista B jamás se le dice que no hace webs: las hace, y venderle
        // capacidad que ya tiene es la forma más rápida de que archive el mail.
        const observacion =
            segmento === "sin_web"
                ? `Les escribo porque vi que trabajan ${loQueHacen(p)} y no vi desarrollo web entre los servicios que ofrecen.`
                : segmento === "con_web"
                  ? `Les escribo justamente porque ofrecen desarrollo web. En agencias del tamaño de ${negocio} lo normal es venderlo y ejecutarlo con alguien de afuera, distinto cada vez.`
                  : `Les escribo porque vi que trabajan ${loQueHacen(p)}.`;

        const motivo =
            segmento === "con_web"
                ? "Tener a alguien fijo para eso cambia dos cosas: no hay que volver a explicar cómo trabajan en cada proyecto, y el plazo que le prometen al cliente lo pueden decir antes de conseguir quién lo haga."
                : "Si les llegan pedidos de web que hoy no toman, o que mandan a un freelance distinto cada vez, tener a alguien fijo les ahorra la parte de salir a buscar y explicar todo de nuevo.";

        return [
            `Asunto: Desarrollo web tercerizado para ${negocio}`,
            "",
            `${saludo(p)} Soy ${REMITENTE}, diseñador y desarrollador web. Trabajo desde Argentina con agencias como proveedor tercerizado: ustedes venden y gestionan al cliente, yo diseño y entrego el sitio con la marca de ustedes. El cliente final nunca me ve.`,
            "",
            observacion,
            "",
            motivo,
            "",
            "Qué entrego: sitios en WordPress, landings, e-commerce y diseño en Figma.",
            `Entre otras cosas hice ${TRABAJOS[0]} y ${TRABAJOS[1]}. ${LINEA_PORTFOLIO}`,
            "",
            "Valores de proveedor:",
            ...PRECIOS_PROVEEDOR.slice(0, 4).map((x) => `· ${x.item}: ${x.precio}`),
            "",
            "Entrego en una o dos semanas según el tamaño y tengo disponibilidad este mes.",
            "",
            segmentoAgencia(p) === "con_web"
                ? "¿Con quién lo están resolviendo hoy? Si ya tienen a alguien fijo me lo dicen y no insisto; si va cambiando, les dejo mis valores y quedo a mano para la próxima."
                : "¿Les sirve tener un proveedor fijo para esto? Con un sí o un no me alcanza.",
            "",
            REMITENTE,
        ].join("\n");
    }

    if (paso === "m1") {
        // Estructura: quién soy y qué entrego · por qué les escribo justo a
        // ustedes (la observación verificable) · pregunta de sí o no.
        //
        // La observación va SIEMPRE en negativo suave ("no vi desarrollo web"),
        // nunca como reproche. Es un dato de su página, no una crítica.
        const segmento = segmentoAgencia(p);
        const observacion =
            segmento === "sin_web"
                ? `Les escribo puntual porque vi que hacen ${loQueHacen(p)} y no vi desarrollo web entre los servicios.`
                : segmento === "con_web"
                  ? "Les escribo justamente porque ofrecen desarrollo web."
                  : `Les escribo puntual porque vi que hacen ${loQueHacen(p)}.`;

        const motivo =
            segmento === "con_web"
                ? "Si eso hoy lo ejecuta alguien de afuera y va cambiando, tener a uno fijo les saca la parte de conseguirlo y explicar todo de nuevo cada vez."
                : "Si les entran pedidos de web que hoy no toman o mandan afuera, capaz les sirve tener a alguien fijo.";

        return [
            `${saludo(p)} Soy ${REMITENTE}, diseñador y desarrollador web. Trabajo desde Argentina con agencias como proveedor: ustedes venden y gestionan al cliente, yo diseño y entrego el sitio. WordPress, landings y e-commerce; diseño en Figma.`,
            "",
            `${observacion} ${motivo}`,
            "",
            "Tengo disponibilidad este mes y trabajo con precios de proveedor. Te paso referencias y valores?",
        ].join("\n");
    }

    if (paso === "fu1") {
        const pregunta =
            segmentoAgencia(p) === "con_web"
                ? "Es un sí o un no de una palabra: les sirve tener un proveedor fijo de web y diseño, o ya lo tienen resuelto? Si está resuelto, lo dejo y listo."
                : "Es un sí o un no de una palabra: les sirve tener un proveedor de web y diseño para lo que no llegan a tomar? Si hoy no, lo dejo y listo.";
        return [`Te reescribo por si se perdió entre otros mensajes.`, "", pregunta].join("\n");
    }

    if (paso === "fu2") {
        // El último toque deja algo concreto en vez de insistir. Una agencia
        // archiva contactos: que quede el dato es lo único que importa acá.
        return [
            "Última por acá para no ser pesado.",
            "",
            `Te dejo igual mis valores de proveedor por si en algún momento les entra algo: landings desde USD 250, sitios en WordPress desde USD 500, e-commerce desde USD 900. Entrego en 1 o 2 semanas.`,
            "",
            `Éxitos con ${negocio}!`,
        ].join("\n");
    }

    if (paso === "credenciales") {
        // Tres links, precios y disponibilidad. Nada más.
        //
        // Explícitamente NO va: la filosofía de trabajo, el diferencial de
        // "diagnóstico antes de diseño", ni el portfolio completo. A una agencia
        // eso le suena a que le vas a querer hablar con su cliente.
        return [
            "Buenísimo. Tres cosas que hice:",
            "",
            ...TRABAJOS.map((t) => `· ${t}`),
            "",
            LINEA_PORTFOLIO,
            "",
            "Valores de proveedor:",
            ...PRECIOS_PROVEEDOR.slice(0, 4).map((x) => `· ${x.item}: ${x.precio}`),
            "",
            "Entrego en 1 o 2 semanas según el tamaño, y trabajo con la marca de ustedes: el cliente nunca me ve. Tienen algo dando vueltas ahora o lo dejamos anotado para cuando entre?",
        ].join("\n");
    }

    if (paso === "precios") {
        return [
            "Va la lista, son precios de proveedor:",
            "",
            ...PRECIOS_PROVEEDOR.map((x) => `· ${x.item}: ${x.precio}`),
            "",
            "El rango depende de cuántas secciones y si el diseño viene de ustedes o lo armo yo. Pasame un proyecto concreto y te doy el número exacto en el día.",
        ].join("\n");
    }

    if (paso === "primer_trabajo") {
        // El objetivo del primer trabajo no es la plata: es que exista un
        // historial. Una agencia que ya te pagó una vez vuelve sin vender nada.
        return [
            "Te propongo algo para sacarnos la duda de encima sin que arriesguen nada: arrancamos por una landing chica, de las que les entran seguido.",
            "",
            "Precio cerrado, entrega en una semana, y si no queda como esperaban no me pagan. Si sale bien, ya sabemos cómo trabajamos y la próxima es directo.",
            "",
            "Tienen alguna ahora para probar?",
        ].join("\n");
    }

    // ruteo
    return "Una cosa: esto lo decidís vos o le escribo a alguien más del equipo? Si me pasás con quién, le escribo directo y no te hago de intermediario.";
}

/**
 * Cadencia de envío. Más baja que la de comercios locales a propósito: son
 * mensajes que llevan investigación real (abrir la página de servicios y
 * confirmar que no hacen web), y a diez por día son unos 45 minutos.
 */
export const AGENCIAS_POR_DIA = 10;

export type CanalAgencia =
    | "email"
    | "linkedin_persona"
    | "linkedin_empresa"
    | "instagram"
    | "sin_canal";

/**
 * En agencias el canal por defecto es el mail. Los dos LinkedIn se cuentan
 * aparte porque no son lo mismo ni de lejos:
 *
 *   · `/in/` es una persona. Se le puede escribir, pero recién después de que
 *     acepte la invitación — o sea, no es un canal de envío inmediato.
 *   · `/company/` es la página de la empresa, y ahí no hay a quién escribirle.
 *     Sirve para mirar el equipo y ver si publicaron una búsqueda de personal,
 *     que es una señal de calificación. Como canal de contacto no existe.
 *
 * El escaneo automático casi siempre encuentra el `/company/` (es el que va
 * linkeado en el pie de la web), así que tratarlo como canal daba por contactable
 * a una agencia a la que en realidad no había por dónde escribirle.
 */
export function canalSugerido(p: Prospecto): CanalAgencia {
    if (p.email.trim()) return "email";
    const li = p.linkedin_url.trim().toLowerCase();
    if (li.includes("/in/")) return "linkedin_persona";
    if (p.instagram_url.trim()) return "instagram";
    if (li.includes("/company/")) return "linkedin_empresa";
    return "sin_canal";
}

export const CANAL_AGENCIA_LABELS: Record<CanalAgencia, string> = {
    email: "Email — el canal que llega y no depende de que te acepten",
    linkedin_persona: "LinkedIn del fundador — hay que esperar que acepte la invitación",
    linkedin_empresa: "LinkedIn de la empresa — sirve para mirar, no para escribir",
    instagram: "Instagram DM — lo atiende el community, no el que decide",
    sin_canal: "Sin canal cargado",
};
