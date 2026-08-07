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
    | "capacidad";           // agenda que se llena mal

export const PATRON_LABELS: Record<PatronDolor, string> = {
    consulta_perdida: "La consulta que se pierde",
    demanda_que_no_llega: "La demanda que nunca llega",
    no_vuelve: "El que no vuelve",
    a_medio_terminar: "Lo empezado y no terminado",
    tiempo_del_dueno: "El dueño haciendo de secretaria",
    capacidad: "La agenda que se llena mal",
};

/** Rubros con catálogo propio. "generico" es el fallback para los que todavía no trabajamos. */
export type RubroProspeccion = "odontologia" | "generico";

export const RUBRO_LABELS: Record<RubroProspeccion, string> = {
    odontologia: "Odontología y salud",
    generico: "Genérico",
};

const CLAVES_RUBRO: Record<Exclude<RubroProspeccion, "generico">, string[]> = {
    odontologia: [
        "odontolog", "dentista", "dental", "ortodon", "implant", "endodon",
        "periodon", "odontopediatr", "consultorio", "clinica medica", "clínica médica",
        "medic", "kinesi", "pediatr", "dermatolog", "oftalmolog", "nutricion",
    ],
};

/** De qué rubro es un prospecto, mirando rubro + especialidad + categoría de Google. */
export function detectarRubro(p: Pick<Prospecto, "rubro" | "especialidad">): RubroProspeccion {
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
}

const SENIALES: SenialNivel2[] = [
    // ── Señales de dolor operativo ─────────────────────────────
    {
        id: "comentarios_sin_responder",
        label: "Comentarios pidiendo turno o precio que quedaron sin responder",
        donde: "Instagram → últimas 5 publicaciones → comentarios. Anotá hace cuánto.",
        patron: "consulta_perdida",
        rubros: "todos",
        peso: 100,
        linea1: (p) =>
            `Hola! Estuve mirando el Instagram de ${p.negocio} y vi que hay comentarios pidiendo turno que quedaron sin responder.`,
    },
    {
        id: "turnos_disponibles_posteo",
        label: 'Publicaron "quedan turnos para hoy / esta semana"',
        donde: "Instagram → publicaciones e historias destacadas de las últimas 2 semanas.",
        patron: "capacidad",
        rubros: "todos",
        peso: 90,
        linea1: (p) =>
            `Hola! Vi la publicación de ${p.negocio} avisando que quedaban turnos disponibles.`,
    },
    {
        id: "aviso_ausentismo",
        label: 'Publicaron pidiendo "avisá si no podés venir"',
        donde: "Instagram → publicaciones e historias. Es el dueño publicando su propio dolor.",
        patron: "capacidad",
        rubros: "todos",
        peso: 95,
        linea1: (p) =>
            `Hola! Vi el posteo de ${p.negocio} pidiendo que avisen cuando no pueden venir.`,
    },
    {
        id: "demanda_sin_camino",
        label: "Publican casos o resultados con buena repercusión, y no hay dónde reservar",
        donde: "Compará los likes/comentarios de un posteo de caso contra la bio: ¿hay algún link?",
        patron: "consulta_perdida",
        rubros: "todos",
        peso: 80,
        linea1: (p) =>
            `Hola! Estuve viendo los casos que publica ${p.negocio} y la repercusión que tienen en los comentarios.`,
    },
    {
        id: "contenido_sin_devolucion",
        label: "Publican seguido y los posteos quedan sin comentarios y con pocos me gusta",
        donde:
            "Instagram → últimas 9 publicaciones. Mirá comentarios y me gusta contra la cantidad de seguidores. Cero comentarios sostenido es la señal.",
        patron: "demanda_que_no_llega",
        rubros: "todos",
        peso: 82,
        linea1: (p) =>
            `Hola! Estuve viendo el Instagram de ${p.negocio}. Publican seguido, pero los posteos quedan en pocos me gusta y casi sin comentarios.`,
        lecturaPropia: () =>
            "Te lo comento porque el trabajo de producir eso ya lo están haciendo. El tema es que Instagram lo muestra casi solo a los que ya los siguen — para el que todavía no los conoce, ese contenido no existe. Es esfuerzo puesto que no está trayendo gente nueva.",
    },
    {
        id: "web_es_instagram",
        label: "El sitio web que figura en Google es el Instagram",
        donde: "Ficha de Maps → campo Sitio web. Si apunta a Instagram o Facebook, marcala.",
        patron: "demanda_que_no_llega",
        rubros: "todos",
        peso: 78,
        linea1: (p) =>
            `Hola! Entré a ${p.negocio} desde Google y el link de la web lleva al Instagram.`,
        lecturaPropia: () =>
            "Te lo comento porque el que llega desde Google y toca ahí va buscando algo concreto: qué hacen, cuánto sale, cómo sacar turno. Y cae en un perfil donde eso hay que ir a buscarlo scrolleando. La mayoría no lo hace — vuelve atrás y abre el siguiente de la lista.",
    },
    {
        id: "precio_en_comentarios",
        label: "La pregunta del precio se repite en los comentarios",
        donde: "Instagram → comentarios de las últimas publicaciones. Contá cuántas veces aparece.",
        patron: "tiempo_del_dueno",
        rubros: "todos",
        peso: 70,
        linea1: (p) =>
            `Hola! Estuve mirando el Instagram de ${p.negocio} y vi que la pregunta del precio se repite bastante en los comentarios.`,
    },
    {
        id: "sin_reserva_online",
        label: "No hay forma de sacar turno que no sea escribir y esperar",
        donde: "Bio de Instagram, ficha de Maps y web: ¿hay algún link que reserve solo?",
        patron: "tiempo_del_dueno",
        rubros: "todos",
        peso: 60,
        linea1: (p) =>
            `Hola! Busqué cómo sacar un turno en ${p.negocio} y no encontré otra forma que escribir y esperar respuesta.`,
    },
    {
        id: "varios_prof_un_canal",
        label: "Varios profesionales o especialidades, y todo entra por el mismo canal",
        donde: "Ficha de Maps o bio: contá profesionales/especialidades vs. teléfonos publicados.",
        patron: "tiempo_del_dueno",
        rubros: ["odontologia"],
        peso: 65,
        linea1: (p) =>
            `Hola! Vi que en ${p.negocio} atienden varios profesionales y que todo entra por el mismo teléfono.`,
    },

    // ── Higiene / encontrabilidad (apoyo, no titular) ──────────
    {
        id: "sin_responder_resenas",
        label: "Reseñas sin responder",
        donde: "Ficha de Google → reseñas ordenadas por menor puntaje.",
        patron: "consulta_perdida",
        rubros: "todos",
        peso: 50,
        linea1: (p) => `Hola! Estuve viendo las reseñas de ${p.negocio} y vi que quedaron sin responder.`,
    },
    {
        id: "whatsapp_personal",
        label: "WhatsApp personal (no Business)",
        donde: "Abrí el chat: ¿tiene horarios, catálogo, respuestas rápidas?",
        patron: "tiempo_del_dueno",
        rubros: "todos",
        peso: 45,
        linea1: (p) =>
            `Hola! Vi que el WhatsApp de ${p.negocio} figura como número personal, sin horarios ni respuestas cargadas.`,
    },
    {
        id: "horarios_mal",
        label: "Horarios de Maps mal cargados",
        donde: "Ficha de Google vs. lo que digan en Instagram.",
        patron: "consulta_perdida",
        rubros: "todos",
        peso: 40,
        linea1: (p) =>
            `Hola! Busqué ${p.negocio} en Google y los horarios que figuran no coinciden con los que publican.`,
    },
    {
        id: "ficha_incompleta",
        label: "Ficha de Google incompleta",
        donde: "Ficha de Google: servicios, horarios, fotos.",
        patron: "consulta_perdida",
        rubros: "todos",
        peso: 35,
        linea1: (p) =>
            `Hola! Busqué ${p.negocio} en Google y la ficha está sin servicios ni horarios cargados.`,
    },
    {
        id: "bio_rota",
        label: "Link de la bio de Instagram roto o inexistente",
        donde: "Tocá el link de la bio.",
        patron: "consulta_perdida",
        rubros: "todos",
        peso: 30,
        linea1: (p) => `Hola! Quise entrar por el link de la bio de ${p.negocio} y no lleva a ningún lado.`,
    },
    {
        id: "no_aparece_rubro",
        label: "No aparece al buscar la especialidad + ciudad (sí buscando el nombre)",
        donde:
            'Buscá "[especialidad] en [ciudad]" en incógnito. Antes fijate que la demanda de búsqueda no esté en "baja": si nadie busca ese servicio, esta señal no aplica.',
        patron: "demanda_que_no_llega",
        rubros: "todos",
        peso: 88,
        linea1: (p) =>
            `Hola! Busqué "${p.especialidad || p.rubro} en ${p.ciudad}" y no aparecen en la primera pantalla — sí aparecen buscando el nombre.`,
    },
    {
        id: "web_lenta",
        label: "La web no carga bien en celular",
        donde: "Abrila con datos móviles, no con wifi.",
        patron: "consulta_perdida",
        rubros: "todos",
        peso: 20,
        linea1: (p) => `Hola! Entré a la web de ${p.negocio} desde el celular y tarda bastante en abrir.`,
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
    if (p.rating != null && p.rating >= 4.3 && p.reviews_count != null && p.reviews_count >= 8) {
        return ` Y no es un tema de calidad: tienen ${p.rating} con ${p.reviews_count} reseñas, mejor puntaje que varios de los que sí aparecen ahí arriba.${cierre}`;
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
        consulta_perdida: () =>
            "Te lo comento porque en la mayoría de los consultorios eso no es desatención: es que las consultas entran mezcladas con todo lo demás y no hay dónde verlas juntas. El que pregunta un domingo con dolor le escribe a tres, y termina yendo al que le contesta primero.",
        demanda_que_no_llega: (p) =>
            `Te lo comento porque el que ya los conoce los busca por el nombre y los encuentra igual. El tema es el que todavía no los conoce: ese busca la especialidad, elige entre los que ve en la primera pantalla, y nunca llega a compararlos.${reputacionDesaprovechada(p)}`,
        capacidad: () =>
            "Te lo comento porque una hora de sillón que queda vacía no se recupera: el alquiler y la asistente se pagan igual. Y casi nunca es falta de pacientes — es que el hueco aparece tarde y no hay a quién avisarle a tiempo.",
        tiempo_del_dueno: () =>
            "Te lo comento porque esa pregunta la termina contestando alguien que debería estar atendiendo, y se repite todo el día. Además el precio suelto por chat, sin nada alrededor que lo explique, los manda derecho a comparar con el más barato.",
        no_vuelve: () =>
            "Te lo comento porque el paciente de control es el más barato que vas a conseguir: ya confía y ya vino una vez. Pero si nadie le avisa a los seis meses, no vuelve — y no es que se fue enojado, simplemente se olvidó.",
        a_medio_terminar: () =>
            "Te lo comento porque un tratamiento que queda por la mitad ya te costó el diagnóstico y a veces el laboratorio. Esa plata está puesta y no se termina de cobrar, y suele no notarse porque no hay ningún lado donde ver quién quedó a mitad de camino.",
    },
    generico: {
        consulta_perdida: () =>
            "Te lo comento porque esa consulta ya la habías ganado: la persona te buscó y te escribió. Lo que se pierde ahí no es visibilidad, es alguien que ya te había elegido y no recibió respuesta a tiempo.",
        demanda_que_no_llega: (p) =>
            `Te lo comento porque el que ya los conoce los encuentra igual, buscándolos por el nombre. El que todavía no los conoce busca el servicio, y elige entre los que aparecen.${reputacionDesaprovechada(p)}`,
        capacidad: () =>
            "Te lo comento porque ese lugar vacío no se recupera después: los costos corren igual, y el hueco casi siempre aparece demasiado tarde como para venderlo.",
        tiempo_del_dueno: () =>
            "Te lo comento porque eso se lleva horas de alguien que debería estar produciendo, y son horas que no se facturan ni se pueden delegar mientras siga siendo todo a mano.",
        no_vuelve: () =>
            "Te lo comento porque el cliente que ya te compró es el más barato de todos, y volver a traerlo depende de que alguien se acuerde de avisarle en el momento justo.",
        a_medio_terminar: () =>
            "Te lo comento porque lo que quedó empezado ya te costó tiempo y plata. Está puesto y sin terminar de cobrar, y no se nota porque no hay dónde verlo.",
    },
};

export function lecturaDelDolor(rubro: RubroProspeccion, patron: PatronDolor, p: Prospecto): string {
    return (LECTURA[rubro] || LECTURA.generico)[patron](p);
}

/** §7.2 — el regalo del follow-up: algo que puede hacer esa tarde, sin vos. */
const REGALO: Partial<Record<FallaVerificable, string>> = {
    comentarios_sin_responder:
        "contestar los comentarios que quedaron colgados, aunque sea con una línea. El que preguntó hace dos semanas capaz todavía no resolvió, y el que lo lee hoy ve si contestás o no.",
    no_aparece_rubro:
        "en la ficha de Google, cargar los servicios uno por uno con el nombre que usa la gente (no el término técnico). Es gratis y es lo que Google mira para decidir si te muestra cuando alguien busca la especialidad.",
    contenido_sin_devolucion:
        "terminar los posteos con una pregunta concreta y fácil de contestar. Un comentario le dice a Instagram que el posteo interesa, y ahí empieza a mostrárselo a gente que todavía no te sigue. Es lo único gratis que mueve el alcance.",
    web_es_instagram:
        "poner en la bio, arriba de todo, qué hacen y dónde están, en dos líneas. El que cae desde Google necesita confirmar eso en dos segundos, y hoy tiene que deducirlo de las fotos.",
    turnos_disponibles_posteo:
        "cuando te queda un hueco, publicarlo con el horario exacto y no como “quedan turnos”. El que está por escribir necesita saber si le sirve ese día, y decidir le lleva un segundo.",
    aviso_ausentismo:
        "mandar un mensaje de confirmación el día anterior, aunque sea a mano. Solo con eso el ausentismo baja bastante, y no requiere ningún sistema.",
    precio_en_comentarios:
        "cargar las respuestas rápidas de WhatsApp Business con las 5 preguntas que más se repiten. Es gratis y te saca la mitad del ida y vuelta.",
    sin_reserva_online:
        "poner en la bio un link de WhatsApp con el mensaje ya escrito (“Hola, quiero un turno para…”). Se arma en dos minutos y te ordena cómo llegan las consultas.",
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
