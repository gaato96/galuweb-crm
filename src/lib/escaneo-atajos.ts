// ============================================================
// Atajos de escaneo — abrir en un clic los lugares donde se mira
//
// El escaneo se hace mirando siempre los mismos cinco o seis lugares. Tenerlos
// como links armados con el nombre y la ciudad ya puestos es la diferencia
// entre 6 minutos y 2 por prospecto.
// ============================================================

import type { Prospecto } from "./types";
import { detectarRubro } from "./dolores-rubro";

export interface AtajoEscaneo {
    id: string;
    label: string;
    /** Qué señal del catálogo se resuelve mirando acá. */
    busca: string;
    url: string;
}

const q = (texto: string) => `https://www.google.com/search?q=${encodeURIComponent(texto)}`;

/**
 * Para PedidosYa y Rappi se usa una búsqueda de Google con site: en vez de la
 * búsqueda interna de cada app. Las apps cambian sus URLs de búsqueda cada tanto
 * y un link roto es peor que no tenerlo; site: sigue funcionando igual.
 */
export function atajosEscaneo(p: Prospecto): AtajoEscaneo[] {
    const negocio = (p.negocio || "").trim();
    const ciudad = (p.ciudad || "").trim();
    const servicio = (p.especialidad || p.rubro || "").trim();
    const esGastro = detectarRubro(p) === "gastronomia";

    if (!negocio) return [];

    const comunes: AtajoEscaneo[] = [
        {
            id: "maps",
            label: "Ficha de Google",
            busca: "Horarios, sitio web, fotos y reseñas. De acá salen varias señales de una.",
            url: p.maps_url?.trim() || q(`${negocio} ${ciudad}`),
        },
        {
            id: "instagram",
            label: "Instagram",
            busca: "Comentarios sin responder, fecha del último posteo de la carta, qué dice la bio.",
            url: p.instagram_url?.trim() || q(`${negocio} ${ciudad} instagram`),
        },
        {
            id: "resenas",
            label: "Reseñas peores primero",
            busca: "La queja textual de nivel 1, y las menciones a pedidos mal o demoras.",
            url: q(`${negocio} ${ciudad} opiniones reseñas`),
        },
    ];

    if (!esGastro) {
        return [
            ...comunes,
            {
                id: "busqueda_rubro",
                label: "Buscar por especialidad",
                busca: "Si aparecen o no buscando lo que hacen, en vez de su nombre.",
                url: q([servicio, ciudad].filter(Boolean).join(" en ")),
            },
        ];
    }

    return [
        {
            id: "pedidosya",
            label: "¿Están en PedidosYa?",
            busca: "La señal más fuerte del catálogo. Si aparecen acá, hay comisión de por medio.",
            url: q(`site:pedidosya.com.ar ${negocio} ${ciudad}`),
        },
        {
            id: "rappi",
            label: "¿Están en Rappi?",
            busca: "Lo mismo que PedidosYa. Muchos locales están en las dos.",
            url: q(`site:rappi.com.ar ${negocio} ${ciudad}`),
        },
        ...comunes,
        {
            id: "busqueda_comida",
            label: "Buscar por tipo de comida",
            busca: "Si aparecen buscando la comida en la zona, o solo buscando el nombre.",
            url: q([servicio, ciudad].filter(Boolean).join(" en ")),
        },
    ];
}
