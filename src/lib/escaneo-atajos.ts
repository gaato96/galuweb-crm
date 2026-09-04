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
    const rubro = detectarRubro(p);
    const esGastro = rubro === "gastronomia";
    const sitio = (p.sitio_web_url || "").trim();
    const sitioUrl = sitio ? (sitio.startsWith("http") ? sitio : `https://${sitio}`) : "";

    if (!negocio) return [];

    // Una agencia se califica por su propia web, no por su ficha de Maps: casi
    // ninguna la tiene cargada en serio y a ninguna la eligen por estrellas. El
    // orden acá es el orden en que hay que mirarlas.
    if (rubro === "agencias") {
        const atajos: AtajoEscaneo[] = [];
        if (sitioUrl) {
            atajos.push(
                {
                    id: "web",
                    label: "Su web",
                    busca: "La home. Primer vistazo a qué venden y qué tan cuidada está la suya propia.",
                    url: sitioUrl,
                },
                {
                    id: "servicios",
                    label: "Servicios",
                    busca: "EL filtro. Si figura desarrollo o diseño web, se descarta y no se mira nada más.",
                    url: q(`site:${sitioUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "")} servicios`),
                }
            );
        } else {
            atajos.push({
                id: "buscar_web",
                label: "Buscar su web",
                busca: "Sin la web no hay nada que calificar. Encontrala y cargala en Datos.",
                url: q(`${negocio} ${ciudad} agencia`),
            });
        }
        atajos.push(
            {
                id: "linkedin",
                label: "LinkedIn",
                busca: "Personas del equipo (¿hay algún perfil técnico?) y publicaciones buscando diseñador o dev.",
                url: p.linkedin_url?.trim() || q(`${negocio} ${ciudad} linkedin`),
            },
            {
                id: "instagram",
                label: "Instagram",
                busca: "Qué muestran de su trabajo, y si publicaron alguna búsqueda de personal.",
                url: p.instagram_url?.trim() || q(`${negocio} ${ciudad} instagram`),
            },
            {
                id: "clientes",
                label: "Sus clientes",
                busca: "Agarrá 2 o 3 y mirá el pie de la web de cada uno: si la hizo otro, ese trabajo se está yendo afuera.",
                url: sitioUrl
                    ? q(`site:${sitioUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "")} clientes OR casos OR portfolio`)
                    : q(`${negocio} ${ciudad} clientes casos`),
            }
        );
        return atajos;
    }

    const comunes: AtajoEscaneo[] = [
        {
            id: "maps",
            label: "Ficha de Google",
            busca: "Horarios, sitio web, fotos y reseñas. De acá salen varias señales de una.",
            url: p.maps_url?.trim() || q(`${negocio} ${ciudad}`),
        },
        // La web propia va arriba: es donde se confirma la mitad de las señales y
        // hasta ahora había que copiar la URL desde la pestaña de Datos.
        ...(sitioUrl
            ? [
                  {
                      id: "web",
                      label: "Su web",
                      busca: "Qué dice de sus servicios, si carga rápido en el celular y si hay por dónde escribirles.",
                      url: sitioUrl,
                  },
              ]
            : []),
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
