// ============================================================
// Catálogo de dolores por rubro — Nivel 2 de la escalera del dato
//
// Reemplaza el planteo viejo, donde las 7 fallas describían todas problemas
// de encontrabilidad ("no te encuentran") y la consecuencia del mensaje salía
// de clasificacion_web. El dolor no lo define si tiene web: lo define el rubro
// y su economía.
//
// La separación que sostiene todo el sistema:
//   · SEÑAL (observable)  → lo que se ve desde afuera en 10 segundos. Va en la línea 1.
//   · LECTURA (inferida)  → el dolor conocido del rubro al que esa señal apunta.
//                           Va en la línea 2, SIEMPRE presentada como lectura y
//                           nunca como afirmación sobre su negocio.
//
// Afirmar el dolor inferido ("sé que tenés tratamientos abandonados") rompe lo
// único que hace funcionar el mensaje: que todo lo que se dice sea comprobable.
// ============================================================

import type { Prospecto, FallaVerificable } from "./types";

// Local a propósito: prospeccion.ts importa de este archivo, así que importar de
// vuelta armaria un ciclo. Mismo rango de diacriticos que usa prospeccion.ts.
const normalizar = (str: string): string =>
    (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * Variante estable por prospecto: el mismo negocio devuelve siempre la misma,
 * pero dos prospectos seguidos no arrancan con la misma frase. Mandando diez
 * mensajes por d\u00eda, que todos empiecen igual es lo que los delata como plantilla.
 */
function varianteDe(semilla: string, cantidad: number): number {
    let h = 0;
    for (let i = 0; i < semilla.length; i++) h = (h * 31 + semilla.charCodeAt(i)) | 0;
    return Math.abs(h) % cantidad;
}

// Sin signo de apertura a prop\u00f3sito: nadie escribe "\u00bf" desde el celular.
const SALUDOS = ["Hola! Como estas?", "Hola, que tal?", "Buenas! Como andan?"];
const CONECTORES = ["Te lo comento porque", "Te lo digo porque", "Lo menciono porque"];

export function saludoDe(p: Prospecto): string {
    return SALUDOS[varianteDe(p.negocio || p.id || "", SALUDOS.length)];
}

export function conectorDe(p: Prospecto): string {
    return CONECTORES[varianteDe((p.negocio || p.id || "") + "c", CONECTORES.length)];
}

/**
 * Los seis dolores que se repiten en todos los rubros, con distinta ropa.
 *
 * Ojo con la diferencia entre los dos primeros, porque define mensajes distintos:
 *   · consulta_perdida     → te escribieron y la consulta se cayó en la respuesta.
 *   · demanda_que_no_llega → nunca te escribieron, porque no estabas cuando buscaron.
 */
export type PatronDolor =
    | "consulta_perdida"     // demanda ya ganada que se cae en la respuesta
    | "demanda_que_no_llega" // demanda que existe en el mercado y termina en otro
    | "no_vuelve"            // recompra que nadie gestiona
    | "a_medio_terminar"     // plata a medio cobrar
    | "tiempo_del_dueno"     // el dueño haciendo de secretaria
    | "capacidad"            // agenda que se llena mal
    | "margen_regalado"      // la venta se hace, pero una parte se la lleva un tercero
    | "operar_a_ciegas";     // no hay dónde ver qué se vende, qué falta, qué precio rige

export const PATRON_LABELS: Record<PatronDolor, string> = {
    consulta_perdida: "La consulta que se pierde",
    demanda_que_no_llega: "La demanda que nunca llega",
    no_vuelve: "El que no vuelve",
    a_medio_terminar: "Lo empezado y no terminado",
    tiempo_del_dueno: "El dueño haciendo de secretaria",
    capacidad: "La agenda que se llena mal",
    margen_regalado: "El margen que se lleva otro",
    operar_a_ciegas: "Operar sin ver lo que pasa adentro",
};

/** Rubros con catálogo propio. "generico" es el fallback para los que todavía no trabajamos. */
export type RubroProspeccion = "odontologia" | "gastronomia" | "generico";

export const RUBRO_LABELS: Record<RubroProspeccion, string> = {
    odontologia: "Odontología y salud",
    gastronomia: "Gastronomía",
    generico: "Genérico",
};

const CLAVES_RUBRO: Record<Exclude<RubroProspeccion, "generico">, string[]> = {
    odontologia: [
        "odontolog", "dentista", "dental", "ortodon", "implant", "endodon",
        "periodon", "odontopediatr", "consultorio", "clinica medica", "clínica médica",
        "medic", "kinesi", "pediatr", "dermatolog", "oftalmolog", "nutricion",
    ],
    gastronomia: [
        "gastronom", "restaurant", "resto", "bar", "cerveceria", "cervecería", "pub",
        "cafeteria", "cafetería", "cafe", "café", "pizzer", "pizza", "hamburgues", "burger",
        "sushi", "parrilla", "rotiser", "empanada", "sandwich", "sanguche", "heladeria",
        "heladería", "pasteleria", "pastelería", "panaderia", "panadería", "comida",
        "delivery", "food", "wok", "milanesa", "pollo", "taco", "arepa", "pastas",
    ],
};

/**
 * De qué rubro es un prospecto.
 * El sistema manda por encima del texto: todo lo que se carga en VivoMenu es
 * gastronomía por definición, aunque el rubro venga escrito raro desde el scraper.
 */
export function detectarRubro(
    p: Pick<Prospecto, "rubro" | "especialidad"> & { sistema?: Prospecto["sistema"] }
): RubroProspeccion {
    if (p.sistema === "vivomenu") return "gastronomia";

    const texto = normalizar(`${p.rubro || ""} ${p.especialidad || ""}`);
    if (!texto.trim()) return "generico";

    for (const [rubro, claves] of Object.entries(CLAVES_RUBRO)) {
        if (claves.some((k) => texto.includes(normalizar(k)))) {
            return rubro as RubroProspeccion;
        }
    }
    return "generico";
}

// ─────────────────────────────────────────────────────────────
// Las señales observables
// ─────────────────────────────────────────────────────────────

export interface SenialNivel2 {
    id: FallaVerificable;
    /** Lo que se lee en el checkbox del escaneo. */
    label: string;
    /** Dónde mirarlo, para que el escaneo no dependa de acordarse. */
    donde: string;
    patron: PatronDolor;
    /** Rubros donde esta señal es relevante. "todos" = sirve en cualquiera. */
    rubros: RubroProspeccion[] | "todos";
    /**
     * Fuerza como titular del mensaje. Más alto gana cuando hay varias marcadas.
     * Una consulta pública sin responder pesa más que un horario mal cargado:
     * es un cliente hablando, no una configuración.
     */
    peso: number;
    /** Cómo entra en la línea 1. Tiene que sonar a algo que viste, no a un diagnóstico. */
    linea1: (p: Prospecto) => string;
    /**
     * Línea 2 propia, cuando la lectura genérica del patrón no encaja.
     * Dos señales del mismo patrón pueden necesitar explicaciones distintas: no aparecer
     * en una búsqueda y publicar sin devolución duelen igual, pero por motivos distintos.
     */
    lecturaPropia?: (p: Prospecto) => string;
    /**
     * La misma señal como frase suelta, en minúscula, para meterla en el medio de otra
     * oración. La usa VivoMenu en el chequeo de 3 puntos y en el primer contacto.
     */
    hallazgo?: string;
    /**
     * No se puede ver desde afuera: sale de escribirles como cliente y pedir la carta.
     * La UI las separa para que no se marquen "de memoria", y el mensaje del día 3 solo
     * dice "hice la prueba de pedirte" si alguna de estas está marcada de verdad.
     */
    requiereContacto?: boolean;
}

const SENIALES: SenialNivel2[] = [
    // ══ GASTRONOMÍA (VivoMenu) ═════════════════════════════════
    // Lo que se vende acá no es una web: es la carta propia, el pedido que llega
    // armado, la cocina y el stock en un solo lado. Los dolores son otros.
    {
        id: "en_apps_delivery",
        label: "Están en PedidosYa o Rappi",
        donde: "Buscá el nombre en PedidosYa. También mirá si el link de la bio va a una app de delivery.",
        patron: "margen_regalado",
        rubros: ["gastronomia"],
        peso: 100,
        linea1: (p) => `Vi que ${p.negocio} está en PedidosYa.`,
        hallazgo: "están tomando pedidos por PedidosYa",
    },
    {
        id: "carta_sin_precios",
        label: 'La carta publicada no tiene precios, o dice "consultar"',
        donde:
            "Instagram, ficha de Maps y link de la bio. Muchos los sacaron porque cambiaban todas las semanas y no daban abasto.",
        patron: "operar_a_ciegas",
        rubros: ["gastronomia"],
        peso: 95,
        linea1: (p) => `Estuve mirando la carta de ${p.negocio} y vi que no tiene los precios.`,
        hallazgo: "la carta que está publicada no tiene los precios",
        lecturaPropia: () =>
            "sacar los precios es lo que termina haciendo todo el mundo cuando cambian cada dos semanas, y se entiende. El costo es que el que estaba por pedir ahora tiene que preguntar, y una parte de esos no pregunta: pide en otro lado donde ya vio el número.",
    },
    {
        id: "comentarios_carta_sin_responder",
        label: "Preguntan por la carta, precios o delivery y quedó sin responder",
        donde: "Comentarios de las últimas publicaciones. Anotá de cuándo son.",
        patron: "consulta_perdida",
        rubros: ["gastronomia"],
        peso: 92,
        linea1: (p) =>
            `Estuve mirando el Instagram de ${p.negocio} y vi comentarios preguntando por la carta que quedaron sin responder.`,
        hallazgo: "hay comentarios preguntando por la carta que quedaron sin responder",
    },
    {
        id: "carta_desactualizada",
        label: "El último posteo con la carta tiene varios meses",
        donde: "Buscá el posteo de la carta y mirá la fecha. Con cómo se movieron los precios, tres meses ya es mucho.",
        patron: "operar_a_ciegas",
        rubros: ["gastronomia"],
        peso: 90,
        linea1: (p) => `Vi que la carta que tiene publicada ${p.negocio} es de hace varios meses.`,
        hallazgo: "la carta que está publicada es de hace varios meses",
    },
    {
        id: "resenas_pedido_errado",
        label: "Reseñas que mencionan pedido equivocado, incompleto o demorado",
        donde: "Google, reseñas de menor puntaje. Si hay una cita textual, cargala arriba como nivel 1.",
        patron: "operar_a_ciegas",
        rubros: ["gastronomia"],
        peso: 88,
        linea1: (p) =>
            `Estuve leyendo las reseñas de ${p.negocio} y vi que hay gente que menciona pedidos que llegaron mal o incompletos.`,
        hallazgo: "en las reseñas hay gente que menciona pedidos que llegaron mal o incompletos",
        lecturaPropia: () =>
            "casi nunca es que en la cocina trabajen mal. Es que el pedido se toma a mano, se pasa a mano, y en el medio se pierde un agregado o una aclaración. El plato se rehace, la comida ya se pagó, y encima queda escrito en Google para el que viene atrás.",
    },
    // ── Gastronomía: solo salen de la prueba de pedido ──
    {
        id: "demora_en_contestar",
        label: "Escribiste en hora pico y tardaron en contestar",
        donde:
            "Escribiles un viernes o sábado entre 21 y 22, que es cuando peor están. Anotá cuánto tardaron.",
        patron: "capacidad",
        rubros: ["gastronomia"],
        peso: 89,
        requiereContacto: true,
        linea1: (p) =>
            `Le escribí a ${p.negocio} un viernes a la noche preguntando por la carta y la respuesta tardó un rato.`,
        hallazgo: "escribí un viernes a la noche y la respuesta tardó",
    },
    {
        id: "carta_llega_como_imagen",
        label: "Te mandaron la carta como foto por WhatsApp",
        donde: 'Pediles la carta como un cliente cualquiera: "hola, tenés carta?". Mirá qué te llega.',
        patron: "consulta_perdida",
        rubros: ["gastronomia"],
        peso: 86,
        requiereContacto: true,
        linea1: (p) =>
            `Le pedí la carta a ${p.negocio} y me llegó como una foto que hay que agrandar para poder leerla.`,
        hallazgo: "la carta llega como una foto que hay que agrandar para leer",
        lecturaPropia: () =>
            "una foto de la carta se ve bien en la compu del que la armó y mal en el celular del que la recibe. El que está con hambre no agranda, no busca: pregunta dos cosas y si no le contestan rápido pide en otro lado.",
    },
    {
        id: "respuesta_automatica_sin_seguir",
        label: "Contestó un mensaje automático y después no siguió nadie",
        donde: "Después del automático, esperá. Si no aparece una persona, marcala.",
        patron: "consulta_perdida",
        rubros: ["gastronomia"],
        peso: 84,
        requiereContacto: true,
        linea1: (p) =>
            `Le escribí a ${p.negocio}, me contestó un mensaje automático y después quedó ahí.`,
        hallazgo: "contesta un mensaje automático y después no sigue nadie",
    },
    {
        id: "pedido_muchas_idas",
        label: "Hicieron falta varios mensajes para cerrar un pedido simple",
        donde: "Contá los mensajes desde que pedís hasta que queda cerrado con dirección y forma de pago.",
        patron: "tiempo_del_dueno",
        rubros: ["gastronomia"],
        peso: 82,
        requiereContacto: true,
        linea1: (p) =>
            `Probé hacer un pedido en ${p.negocio} y para cerrarlo hicieron falta varios mensajes de ida y vuelta.`,
        hallazgo: "para cerrar un pedido simple hicieron falta varios mensajes de ida y vuelta",
    },

    {
        id: "carta_como_imagen",
        label: "La carta publicada es una foto o PDF que hay que agrandar",
        donde: "Abrí la carta que está publicada en Instagram o Maps desde el celular. ¿Se lee sin hacer zoom?",
        patron: "consulta_perdida",
        rubros: ["gastronomia"],
        peso: 85,
        linea1: (p) => `Abrí la carta de ${p.negocio} desde el celular y vi que hay que agrandarla para poder leerla.`,
        hallazgo: "la carta es una imagen que hay que agrandar para leer desde el celular",
    },
    {
        id: "precio_por_privado",
        label: 'Contestan los precios por privado, de a uno',
        donde: 'Comentarios: buscá respuestas tipo "te paso por privado" o "te escribo al DM".',
        patron: "tiempo_del_dueno",
        rubros: ["gastronomia"],
        peso: 80,
        linea1: (p) =>
            `Vi que en ${p.negocio} los precios se pasan por privado, y esa misma pregunta se repite bastante.`,
        hallazgo: "los precios se pasan por privado, de a uno",
    },
    {
        id: "pedidos_solo_whatsapp",
        label: "El único modo de pedir es escribir y esperar que contesten",
        donde: "Bio, ficha de Maps y web: ¿hay algún lado donde el cliente arme el pedido solo?",
        patron: "tiempo_del_dueno",
        rubros: ["gastronomia"],
        peso: 78,
        linea1: (p) =>
            `Busqué cómo hacer un pedido en ${p.negocio} y vi que la única forma es escribir y esperar respuesta.`,
        hallazgo: "para pedir hay que escribir y esperar, no hay ningún lado donde el cliente arme el pedido solo",
    },
    {
        id: "no_aparece_comida",
        label: "No aparecen buscando el tipo de comida + la zona",
        donde: 'Buscá "[tipo de comida] en [ciudad]" o "delivery de [comida]" en incógnito.',
        patron: "demanda_que_no_llega",
        rubros: ["gastronomia"],
        peso: 72,
        linea1: (p) =>
            `Estuve buscando "${p.especialidad || p.rubro} en ${p.ciudad}" y vi que no aparecen, sí buscando el nombre.`,
        hallazgo: "buscando el tipo de comida en la zona no aparecen, solo buscando el nombre exacto",
    },
    {
        id: "posteos_sin_stock",
        label: 'Postean "hoy no hay" o "se nos terminó"',
        donde: "Historias y publicaciones. Es el faltante contado por el propio local.",
        patron: "operar_a_ciegas",
        rubros: ["gastronomia"],
        peso: 68,
        linea1: (p) => `Vi posteos de ${p.negocio} avisando que se habían quedado sin algunos productos.`,
        hallazgo: "vi posteos avisando que se habían quedado sin algunos productos",
        lecturaPropia: () =>
            "quedarse sin algo un viernes a la noche es la venta que más duele, porque el cliente ya estaba decidido. Y suele pasar por lo mismo: la compra se hace a ojo, sin un lugar donde ver qué salió más la semana pasada.",
    },

    // ── Señales de dolor operativo (servicios) ─────────────────
    {
        id: "comentarios_sin_responder",
        label: "Comentarios pidiendo turno o precio que quedaron sin responder",
        donde: "Instagram → últimas 5 publicaciones → comentarios. Anotá hace cuánto.",
        patron: "consulta_perdida",
        rubros: ["odontologia", "generico"],
        peso: 100,
        linea1: (p) =>
            `Estuve mirando el Instagram de ${p.negocio} y vi que hay comentarios pidiendo turno que quedaron sin responder.`,
    },
    {
        id: "turnos_disponibles_posteo",
        label: 'Publicaron "quedan turnos para hoy / esta semana"',
        donde: "Instagram → publicaciones e historias destacadas de las últimas 2 semanas.",
        patron: "capacidad",
        rubros: ["odontologia", "generico"],
        peso: 90,
        linea1: (p) =>
            `Vi la publicación de ${p.negocio} avisando que quedaban turnos disponibles.`,
    },
    {
        id: "aviso_ausentismo",
        label: 'Publicaron pidiendo "avisá si no podés venir"',
        donde: "Instagram → publicaciones e historias. Es el dueño publicando su propio dolor.",
        patron: "capacidad",
        rubros: ["odontologia", "generico"],
        peso: 95,
        linea1: (p) =>
            `Vi el posteo de ${p.negocio} pidiendo que avisen cuando no pueden venir.`,
    },
    {
        id: "demanda_sin_camino",
        label: "Publican casos o resultados con buena repercusión, y no hay dónde reservar",
        donde: "Compará los likes/comentarios de un posteo de caso contra la bio: ¿hay algún link?",
        patron: "consulta_perdida",
        rubros: ["odontologia", "generico"],
        peso: 80,
        linea1: (p) =>
            `Estuve viendo los casos que publica ${p.negocio} y la repercusión que tienen en los comentarios.`,
    },
    {
        id: "contenido_sin_devolucion",
        label: "Publican seguido y los posteos quedan sin comentarios y con pocos me gusta",
        donde:
            "Instagram → últimas 9 publicaciones. Mirá comentarios y me gusta contra la cantidad de seguidores. Cero comentarios sostenido es la señal.",
        patron: "demanda_que_no_llega",
        rubros: ["odontologia", "generico"],
        peso: 82,
        linea1: (p) =>
            `Estuve viendo el Instagram de ${p.negocio}. Publican seguido, pero los posteos quedan en pocos me gusta y casi sin comentarios.`,
        lecturaPropia: () =>
            "el trabajo de producir eso ya lo están haciendo. El tema es que Instagram lo muestra casi solo a los que ya los siguen. Para el que todavía no los conoce, ese contenido no existe. Es esfuerzo puesto que no está trayendo gente nueva.",
    },
    {
        id: "web_es_instagram",
        label: "El sitio web que figura en Google es el Instagram",
        donde: "Ficha de Maps → campo Sitio web. Si apunta a Instagram o Facebook, marcala.",
        patron: "demanda_que_no_llega",
        rubros: ["odontologia", "generico"],
        peso: 78,
        linea1: (p) =>
            `Entré a ${p.negocio} desde Google y vi que el link de la web lleva al Instagram.`,
        lecturaPropia: () =>
            "el que llega desde Google y toca ahí va buscando algo concreto: qué hacen, cuánto sale, cómo sacar turno. Y cae en un perfil donde eso hay que ir a buscarlo scrolleando. La mayoría no lo hace: vuelve atrás y abre el siguiente de la lista.",
    },
    {
        id: "precio_en_comentarios",
        label: "La pregunta del precio se repite en los comentarios",
        donde: "Instagram → comentarios de las últimas publicaciones. Contá cuántas veces aparece.",
        patron: "tiempo_del_dueno",
        rubros: ["odontologia", "generico"],
        peso: 70,
        linea1: (p) =>
            `Estuve mirando el Instagram de ${p.negocio} y vi que la pregunta del precio se repite bastante en los comentarios.`,
    },
    {
        id: "sin_reserva_online",
        label: "No hay forma de sacar turno que no sea escribir y esperar",
        donde: "Bio de Instagram, ficha de Maps y web: ¿hay algún link que reserve solo?",
        patron: "tiempo_del_dueno",
        rubros: ["odontologia", "generico"],
        peso: 60,
        linea1: (p) =>
            `Busqué cómo sacar un turno en ${p.negocio} y no encontré otra forma que escribir y esperar respuesta.`,
    },
    {
        id: "varios_prof_un_canal",
        label: "Varios profesionales o especialidades, y todo entra por el mismo canal",
        donde: "Ficha de Maps o bio: contá profesionales/especialidades vs. teléfonos publicados.",
        patron: "tiempo_del_dueno",
        rubros: ["odontologia"],
        peso: 65,
        linea1: (p) =>
            `Vi que en ${p.negocio} atienden varios profesionales y que todo entra por el mismo teléfono.`,
    },

    // ── Higiene / encontrabilidad (apoyo, no titular) ──────────
    {
        id: "sin_responder_resenas",
        label: "Reseñas sin responder",
        donde: "Ficha de Google → reseñas ordenadas por menor puntaje.",
        patron: "consulta_perdida",
        rubros: ["odontologia", "generico"],
        peso: 50,
        linea1: (p) => `Estuve viendo las reseñas de ${p.negocio} y vi que quedaron sin responder.`,
    },
    {
        id: "whatsapp_personal",
        label: "WhatsApp personal (no Business)",
        donde: "Abrí el chat: ¿tiene horarios, catálogo, respuestas rápidas?",
        patron: "tiempo_del_dueno",
        rubros: ["odontologia", "generico"],
        peso: 45,
        linea1: (p) =>
            `Vi que el WhatsApp de ${p.negocio} figura como número personal, sin horarios ni respuestas cargadas.`,
    },
    {
        id: "horarios_mal",
        label: "Horarios de Maps mal cargados",
        donde: "Ficha de Google vs. lo que digan en Instagram.",
        patron: "consulta_perdida",
        rubros: ["odontologia", "generico"],
        peso: 40,
        linea1: (p) =>
            `Busqué ${p.negocio} en Google y los horarios que figuran no coinciden con los que publican.`,
    },
    {
        id: "ficha_incompleta",
        label: "Ficha de Google incompleta",
        donde: "Ficha de Google: servicios, horarios, fotos.",
        patron: "consulta_perdida",
        rubros: ["odontologia", "generico"],
        peso: 35,
        linea1: (p) =>
            `Busqué ${p.negocio} en Google y la ficha está sin servicios ni horarios cargados.`,
    },
    {
        id: "bio_rota",
        label: "Link de la bio de Instagram roto o inexistente",
        donde: "Tocá el link de la bio.",
        patron: "consulta_perdida",
        rubros: ["odontologia", "generico"],
        peso: 30,
        linea1: (p) => `Quise entrar por el link de la bio de ${p.negocio} y no lleva a ningún lado.`,
    },
    {
        id: "no_aparece_rubro",
        label: "No aparece al buscar la especialidad + ciudad (sí buscando el nombre)",
        donde:
            'Buscá "[especialidad] en [ciudad]" en incógnito. Antes fijate que la demanda de búsqueda no esté en "baja": si nadie busca ese servicio, esta señal no aplica.',
        patron: "demanda_que_no_llega",
        rubros: ["odontologia", "generico"],
        peso: 88,
        linea1: (p) =>
            `Estuve buscando "${p.especialidad || p.rubro} en ${p.ciudad}" y vi que no aparecen en la primera pantalla — sí aparecen buscando el nombre.`,
    },
    {
        id: "web_lenta",
        label: "La web no carga bien en celular",
        donde: "Abrila con datos móviles, no con wifi.",
        patron: "consulta_perdida",
        rubros: ["odontologia", "generico"],
        peso: 20,
        linea1: (p) => `Entré a la web de ${p.negocio} desde el celular y tarda bastante en abrir.`,
    },
];

export const SENIALES_POR_ID: Record<string, SenialNivel2> = Object.fromEntries(
    SENIALES.map((s) => [s.id, s])
);

/** Las señales que tiene sentido mostrar para un rubro, de más fuerte a más débil. */
export function senialesPara(rubro: RubroProspeccion): SenialNivel2[] {
    return SENIALES.filter((s) => s.rubros === "todos" || s.rubros.includes(rubro)).sort(
        (a, b) => b.peso - a.peso
    );
}

/** La señal más fuerte de las marcadas — la que va de titular en la línea 1. */
export function senialPrincipal(fallas: FallaVerificable[]): SenialNivel2 | null {
    const candidatas = fallas.map((f) => SENIALES_POR_ID[f]).filter(Boolean);
    if (candidatas.length === 0) return null;
    return candidatas.sort((a, b) => b.peso - a.peso)[0];
}

/** ¿Se hizo la prueba de pedido? Define si el mensaje puede decir "te pedí como cliente". */
export function hizoPruebaDePedido(fallas: FallaVerificable[]): boolean {
    return fallas.some((f) => SENIALES_POR_ID[f]?.requiereContacto);
}

// ─────────────────────────────────────────────────────────────
// La lectura del rubro — línea 2
//
// Nunca afirma nada sobre ESTE negocio. Dice qué suele significar esa señal en
// el rubro, para que el dueño saque la conclusión solo. Es lo que permite llegar
// al dolor profundo (el tratamiento a medio hacer, el sillón vacío) sin inventar.
// ─────────────────────────────────────────────────────────────

/**
 * Cuando el negocio tiene buena reputación, esa reputación ES el argumento:
 * no le estás diciendo que es malo, le estás diciendo que lo bueno que hizo no
 * está llegando a la gente. Sale del rating real, así que sigue siendo verificable.
 */
function reputacionDesaprovechada(p: Prospecto): string {
    const cierre = " Esa reputación se la ganaron paciente por paciente y hoy no está jugando en esa decisión.";
    // Una cantidad negativa es un error de signo, nunca un dato real (ver reseñasSanas en prospeccion.ts).
    const reviews = p.reviews_count == null ? null : Math.abs(p.reviews_count);
    if (p.rating != null && p.rating >= 4.3 && reviews != null && reviews >= 8) {
        return ` Y no es un tema de calidad: tienen ${p.rating} con ${reviews} reseñas, mejor puntaje que varios de los que sí aparecen ahí arriba.${cierre}`;
    }
    if (p.rating != null && p.rating >= 4.3) {
        return ` Y no es un tema de calidad: las reseñas que tienen son muy buenas.${cierre}`;
    }
    // Sin rating cargado no se afirma nada sobre su reputación.
    return "";
}

type Lectura = (p: Prospecto) => string;

const LECTURA: Record<RubroProspeccion, Record<PatronDolor, Lectura>> = {
    odontologia: {
        margen_regalado: () =>
            "la obra social se queda con una parte y encima la paga tarde, así que el paciente particular es el que sostiene el mes. Y ese es justo el que se decide mirando desde afuera antes de escribir.",
        operar_a_ciegas: () =>
            "no hay un lugar donde ver quién quedó a mitad de tratamiento, quién tenía que volver y quién no volvió nunca. Sin eso, todo depende de que alguien se acuerde.",
        consulta_perdida: () =>
            "en la mayoría de los consultorios eso no es desatención: es que las consultas entran mezcladas con todo lo demás y no hay dónde verlas juntas. El que pregunta un domingo con dolor le escribe a tres, y termina yendo al que le contesta primero.",
        demanda_que_no_llega: (p) =>
            `el que ya los conoce los busca por el nombre y los encuentra igual. El tema es el que todavía no los conoce: ese busca la especialidad, elige entre los que ve en la primera pantalla, y nunca llega a compararlos.${reputacionDesaprovechada(p)}`,
        capacidad: () =>
            "una hora de sillón que queda vacía no se recupera: el alquiler y la asistente se pagan igual. Y casi nunca es falta de pacientes — es que el hueco aparece tarde y no hay a quién avisarle a tiempo.",
        tiempo_del_dueno: () =>
            "esa pregunta la termina contestando alguien que debería estar atendiendo, y se repite todo el día. Además el precio suelto por chat, sin nada alrededor que lo explique, los manda derecho a comparar con el más barato.",
        no_vuelve: () =>
            "el paciente de control es el más barato que vas a conseguir: ya confía y ya vino una vez. Pero si nadie le avisa a los seis meses, no vuelve — y no es que se fue enojado, simplemente se olvidó.",
        a_medio_terminar: () =>
            "un tratamiento que queda por la mitad ya te costó el diagnóstico y a veces el laboratorio. Esa plata está puesta y no se termina de cobrar, y suele no notarse porque no hay ningún lado donde ver quién quedó a mitad de camino.",
    },
    gastronomia: {
        margen_regalado: () =>
            "de cada pedido que entra por ahí se va una parte antes de que la veas. Cuánto exactamente lo sabés vos mejor que yo, cada acuerdo es distinto. Lo que pasa siempre es lo otro: el cliente queda del lado de la app. No tenés su teléfono, no le podés avisar cuando sacás algo nuevo, y el día que te bajes de ahí ese cliente nunca fue tuyo.",
        operar_a_ciegas: () =>
            "con cómo se movieron los costos, una carta de hace unos meses ya no tiene los precios que cobrás hoy. Y ahí pasa una de dos: o el cliente llega con un número en la cabeza que no es, o alguien tiene que rehacerla entera cada vez que cambia algo.",
        consulta_perdida: () =>
            "el que pregunta por la carta tiene hambre en ese momento, no dentro de tres horas. Si no le contestás ahí, pide en otro lado. Y no es que le gustó más el otro: fue el que le contestó primero.",
        tiempo_del_dueno: () =>
            "esa consulta la termina contestando alguien que en ese momento está tomando pedidos o atendiendo mesas. Y la hora en que más consultas entran es justo la hora en que menos tiempo hay para contestarlas.",
        capacidad: () =>
            "un viernes a la noche se juega en dos horas. Un pedido que tarda en tomarse no se atrasa: se pierde, porque el que tiene hambre no espera.",
        demanda_que_no_llega: () =>
            "el que ya los conoce los busca por el nombre y los encuentra igual. El que tiene hambre y todavía no los conoce busca la comida, no el local, y pide entre los que le aparecen.",
        no_vuelve: () =>
            "el que pidió una vez y le gustó es el más barato de traer de vuelta. Pero si ese pedido entró por la app o por un chat que quedó enterrado entre otros cincuenta, no hay a quién avisarle cuando sacás algo nuevo.",
        a_medio_terminar: () =>
            "el que empezó a armar el pedido y no lo mandó ya estaba decidido a comprar. Se cayó en el último paso, y sin nada que lo registre no hay forma ni de saber cuántos fueron.",
    },
    generico: {
        margen_regalado: () =>
            "esa venta la hiciste vos, pero una parte se la lleva otro antes de que llegue. Y con ella se va también el cliente: queda del lado del que te la trajo, no del tuyo.",
        operar_a_ciegas: () =>
            "no hay dónde ver de un vistazo qué se vendió, qué falta y qué precio rige hoy, así que las decisiones se toman de memoria y a ojo.",
        consulta_perdida: () =>
            "esa consulta ya la habías ganado: la persona te buscó y te escribió. Lo que se pierde ahí no es visibilidad, es alguien que ya te había elegido y no recibió respuesta a tiempo.",
        demanda_que_no_llega: (p) =>
            `el que ya los conoce los encuentra igual, buscándolos por el nombre. El que todavía no los conoce busca el servicio, y elige entre los que aparecen.${reputacionDesaprovechada(p)}`,
        capacidad: () =>
            "ese lugar vacío no se recupera después: los costos corren igual, y el hueco casi siempre aparece demasiado tarde como para venderlo.",
        tiempo_del_dueno: () =>
            "eso se lleva horas de alguien que debería estar produciendo, y son horas que no se facturan ni se pueden delegar mientras siga siendo todo a mano.",
        no_vuelve: () =>
            "el cliente que ya te compró es el más barato de todos, y volver a traerlo depende de que alguien se acuerde de avisarle en el momento justo.",
        a_medio_terminar: () =>
            "lo que quedó empezado ya te costó tiempo y plata. Está puesto y sin terminar de cobrar, y no se nota porque no hay dónde verlo.",
    },
};

export function lecturaDelDolor(rubro: RubroProspeccion, patron: PatronDolor, p: Prospecto): string {
    return (LECTURA[rubro] || LECTURA.generico)[patron](p);
}

/** §7.2 — el regalo del follow-up: algo que puede hacer esa tarde, sin vos. */
const REGALO: Partial<Record<FallaVerificable, string>> = {
    // ── Gastronomía ──
    en_apps_delivery:
        "en la bio, poner primero tu WhatsApp y después el link de la app. El que ya te conoce y entra a tu perfil no tiene por qué pedirte por un lugar que te cobra comisión.",
    carta_sin_precios:
        "publicar la carta con precios en una historia destacada, aunque sea con los diez productos que más salen. El que ve el número decide; el que no lo ve, pregunta o se va.",
    carta_desactualizada:
        "actualizar el posteo de la carta con los precios de hoy y fijarlo arriba de todo. Es media hora y te saca la mitad de las preguntas por privado.",
    comentarios_carta_sin_responder:
        "contestar los comentarios que quedaron colgados, aunque sea con una línea. El que preguntó capaz ya comió en otro lado, pero el que lo lee hoy ve si contestás o no.",
    resenas_pedido_errado:
        "responder las reseñas peores con una línea cada una. Una queja contestada hace mucho menos daño que una queja sola, y no te cuesta nada.",
    precio_por_privado:
        "cargar las respuestas rápidas de WhatsApp Business con los 5 productos que más te preguntan y sus precios. Es gratis y te saca la mitad del ida y vuelta.",
    pedidos_solo_whatsapp:
        'poner en la bio un link de WhatsApp con el mensaje ya escrito ("Hola, quiero hacer un pedido"). Se arma en dos minutos y te ordena cómo entran.',
    carta_como_imagen:
        "subir la carta partida en varias fotos por categoría en vez de una sola imagen chiquita. Se lee sin agrandar y es lo mismo de trabajo.",
    posteos_sin_stock:
        "anotar una semana qué se te terminó y qué día. Con eso solo ya vas a ver el patrón de lo que hay que comprar más.",

    // ── Servicios ──
    comentarios_sin_responder:
        "contestar los comentarios que quedaron colgados, aunque sea con una línea. El que preguntó hace dos semanas capaz todavía no resolvió, y el que lo lee hoy ve si contestás o no.",
    no_aparece_rubro:
        "en la ficha de Google, cargar los servicios uno por uno con el nombre que usa la gente (no el término técnico). Es gratis y es lo que Google mira para decidir si te muestra cuando alguien busca la especialidad.",
    contenido_sin_devolucion:
        "terminar los posteos con una pregunta concreta y fácil de contestar. Un comentario le dice a Instagram que el posteo interesa, y ahí empieza a mostrárselo a gente que todavía no te sigue. Es lo único gratis que mueve el alcance.",
    web_es_instagram:
        "poner en la bio, arriba de todo, qué hacen y dónde están, en dos líneas. El que cae desde Google necesita confirmar eso en dos segundos, y hoy tiene que deducirlo de las fotos.",
    turnos_disponibles_posteo:
        'cuando te queda un hueco, publicarlo con el horario exacto y no como "quedan turnos". El que está por escribir necesita saber si le sirve ese día, y decidir le lleva un segundo.',
    aviso_ausentismo:
        "mandar un mensaje de confirmación el día anterior, aunque sea a mano. Solo con eso el ausentismo baja bastante, y no requiere ningún sistema.",
    precio_en_comentarios:
        "cargar las respuestas rápidas de WhatsApp Business con las 5 preguntas que más se repiten. Es gratis y te saca la mitad del ida y vuelta.",
    sin_reserva_online:
        'poner en la bio un link de WhatsApp con el mensaje ya escrito ("Hola, quiero un turno para..."). Se arma en dos minutos y te ordena cómo llegan las consultas.',
    demanda_sin_camino:
        "poner en la bio un solo link que lleve a pedir turno. Hoy publicás casos que funcionan y la gente no tiene dónde seguir.",
    varios_prof_un_canal:
        "cargar en las respuestas rápidas quién atiende qué y en qué horarios. Evita el ida y vuelta de derivar a mano cada consulta.",
    whatsapp_personal:
        "pasar el WhatsApp a WhatsApp Business (es gratis) y cargar las respuestas rápidas de las 5 preguntas que más se repiten. Baja bastante el ida y vuelta.",
    ficha_incompleta:
        "cargar los servicios en la ficha de Google. Ahí es donde se decide si aparecen cuando alguien busca la especialidad.",
    horarios_mal:
        "corregir los horarios de Google: hoy dice cerrado en horas en las que están abiertos, y esa gente no llama.",
    bio_rota: "arreglar el link de la bio de Instagram, hoy no lleva a ningún lado.",
    sin_responder_resenas:
        "responder las 3 reseñas peores con una línea cada una. Una queja respondida hace mucho menos daño que una queja sola, y es gratis.",
};

export function regaloDeSenial(fallas: FallaVerificable[], p: Prospecto): string {
    const principal = senialPrincipal(fallas);
    if (principal && REGALO[principal.id]) return REGALO[principal.id]!;
    return `completar la ficha de Google con servicios, horarios y fotos. Es lo que define si aparecen buscando "${p.especialidad || p.rubro} en ${p.ciudad}".`;
}
