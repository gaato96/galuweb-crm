// ============================================================
// Demanda de búsqueda — cómo saber si la gente googlea este servicio
//
// El campo demanda_busqueda decide si la señal "no aparece buscando la
// especialidad" tiene sentido. Si nadie busca ese servicio, ese mensaje afirma
// algo falso y se cae solo, así que conviene chequearlo y no adivinarlo.
//
// Este módulo hace dos cosas:
//   1. Sugiere un punto de partida según el servicio (hipótesis, no medición).
//   2. Arma los links de los tres chequeos, ya con el término y la zona puestos.
// ============================================================

import type { Prospecto, DemandaBusqueda } from "./types";

const normalizar = (str: string): string =>
    (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * Servicios que la gente busca en Google cuando los necesita: son puntuales,
 * comparables y muchas veces urgentes. Nadie pide una recomendación para una
 * urgencia dental a las 11 de la noche — la googlea.
 */
const SE_BUSCA = [
    "implant", "ortodon", "blanqueamiento", "protesis", "prótesis", "conducto",
    "endodon", "urgencia", "guardia", "brackets", "odontolog", "dentista",
    "kinesi", "nutricion", "nutrición", "dermatolog", "oftalmolog", "psicolog",
    "taller", "mecanic", "mecánic", "gomeria", "gomería", "chapa", "pintura",
    "inmobiliaria", "alquiler", "propiedad", "abogad", "laboral", "sucesion", "sucesión",
    "cerrajer", "plomer", "electricista", "fletes", "mudanza", "veterinar",
    "gimnasio", "depilacion", "depilación", "estetic", "estétic",
];

/**
 * Servicios que se eligen por confianza y recomendación, donde el volumen de
 * búsqueda es bajo aunque el negocio ande bien. Acá el ángulo no es aparecer:
 * es credibilidad.
 */
const NO_SE_BUSCA = [
    "contad", "contable", "impuest", "monotributo", "liquidacion de sueldos",
    "peluquer", "barber", "manicur", "maquillaje",
    "consultor", "coach", "asesor",
];

export interface PistaDemanda {
    sugerencia: DemandaBusqueda;
    porque: string;
    /** Lo que conviene buscar textualmente para verificar. */
    consulta: string;
}

export function pistaDemanda(p: Pick<Prospecto, "rubro" | "especialidad" | "ciudad">): PistaDemanda {
    const servicio = (p.especialidad || p.rubro || "").trim();
    const ciudad = (p.ciudad || "").trim();
    const consulta = [servicio, ciudad].filter(Boolean).join(" en ") || servicio;
    const texto = normalizar(`${p.rubro || ""} ${p.especialidad || ""}`);

    if (!texto) {
        return {
            sugerencia: "sin_definir",
            porque: "Cargá el rubro o la especialidad para poder estimarlo.",
            consulta,
        };
    }
    if (NO_SE_BUSCA.some((k) => texto.includes(normalizar(k)))) {
        return {
            sugerencia: "baja",
            porque:
                "Es un servicio que se suele elegir por recomendación, no buscándolo. Verificá igual: si hay anuncios pagos en esa búsqueda, hay demanda y la sugerencia está errada.",
            consulta,
        };
    }
    if (SE_BUSCA.some((k) => texto.includes(normalizar(k)))) {
        return {
            sugerencia: "alta",
            porque:
                "Es un servicio puntual y comparable: la gente lo googlea cuando lo necesita, en vez de pedir una recomendación.",
            consulta,
        };
    }
    return {
        sugerencia: "sin_definir",
        porque: "No lo puedo estimar por el nombre del servicio. Chequealo con los botones de acá abajo.",
        consulta,
    };
}

/** Provincias donde más prospectamos. Trends filtra mucho mejor con la provincia puesta. */
const GEO_POR_CIUDAD: { claves: string[]; geo: string }[] = [
    { claves: ["tucuman", "yerba buena", "banda del rio sali", "concepcion"], geo: "AR-T" },
    { claves: ["cordoba"], geo: "AR-X" },
    { claves: ["rosario", "santa fe"], geo: "AR-S" },
    { claves: ["mendoza"], geo: "AR-M" },
    { claves: ["salta"], geo: "AR-A" },
    { claves: ["capital federal", "buenos aires", "caba", "palermo", "belgrano"], geo: "AR-C" },
];

function geoDe(ciudad: string): string {
    const c = normalizar(ciudad);
    if (!c) return "AR";
    return GEO_POR_CIUDAD.find((g) => g.claves.some((k) => c.includes(k)))?.geo || "AR";
}

export interface ChequeoDemanda {
    id: string;
    label: string;
    detalle: string;
    url: string;
}

/**
 * Los tres chequeos, ordenados por lo que menos se puede falsear.
 * El de anuncios va primero: si alguien paga por esa búsqueda, la demanda existe.
 */
export function chequeosDemanda(
    p: Pick<Prospecto, "rubro" | "especialidad" | "ciudad">
): ChequeoDemanda[] {
    const { consulta } = pistaDemanda(p);
    const geo = geoDe(p.ciudad || "");
    const termino = (p.especialidad || p.rubro || "").trim();

    return [
        {
            id: "anuncios",
            label: "Ver si hay anuncios",
            detalle:
                'Buscá y fijate si arriba hay resultados marcados "Patrocinado". Si alguien paga por esa búsqueda, hay demanda comercial confirmada. De paso comprobás si el prospecto aparece o no.',
            url: `https://www.google.com/search?q=${encodeURIComponent(consulta)}`,
        },
        {
            id: "planner",
            label: "Volumen mensual",
            detalle:
                'Keyword Planner, gratis dentro de Google Ads (no hace falta gastar). Buscá el término y filtrá por la zona. Sin campaña activa muestra rangos anchos tipo "100 – 1 mil": alcanza para decidir alta o baja.',
            url: "https://ads.google.com/aw/keywordplanner/home",
        },
        {
            id: "trends",
            label: "Tendencia en la zona",
            detalle:
                "Google Trends con la provincia ya puesta. No da números absolutos: sirve para ver si el término se mueve y en qué época del año sube.",
            url: `https://trends.google.com/trends/explore?date=today%2012-m&geo=${geo}&q=${encodeURIComponent(termino)}`,
        },
    ];
}
