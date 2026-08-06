// ============================================================
// Motor de prospección en frío — Galu Agencia
// Baja a código el sistema operativo de contacto en frío (doc 08):
//   §3.1 descarte rápido · §3.2 calificación · §4 escalera del dato
//   §5 escalera de mensajes · §7.3 fallas en mercado sin webs
//   §8 orden de trabajo sobre listas grandes · §11 métricas
// Todas las funciones son puras: se pueden testear y reusar desde la API.
// ============================================================

import type {
    Prospecto,
    EscaneoProspecto,
    ClasificacionWeb,
    EstadoProspecto,
    FallaVerificable,
    Sistema,
} from "./types";
import { ESCANEO_VACIO, FALLA_LABELS } from "./types";

// ─────────────────────────────────────────────────────────────
// §4 — La escalera del dato de personalización
// ─────────────────────────────────────────────────────────────

export const NIVEL_DATO_LABELS: Record<number, string> = {
    1: "N1 · Queja de un cliente",
    2: "N2 · Falla verificable",
    3: "N3 · Hito reciente",
    4: "N4 · Detalle de su trabajo",
};

export const NIVEL_DATO_COLORS: Record<number, string> = {
    1: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    2: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    3: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    4: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

export function normalizarEscaneo(e: Partial<EscaneoProspecto> | null | undefined): EscaneoProspecto {
    return {
        tiene_queja_cliente: !!e?.tiene_queja_cliente,
        queja_textual: e?.queja_textual || "",
        fallas: Array.isArray(e?.fallas) ? e!.fallas : [],
        hito_reciente: e?.hito_reciente || "",
        detalle_trabajo: e?.detalle_trabajo || "",
    };
}

/**
 * §4 — "tomá el más alto que encuentres, y si hay una queja de cliente esa gana siempre".
 * El nivel NO depende de si tiene web: los cuatro niveles existen en las dos situaciones.
 */
export function calcularNivelDato(escaneo: EscaneoProspecto): number | null {
    if (escaneo.tiene_queja_cliente && escaneo.queja_textual.trim()) return 1;
    if (escaneo.fallas.length > 0) return 2;
    if (escaneo.hito_reciente.trim()) return 3;
    if (escaneo.detalle_trabajo.trim()) return 4;
    return null;
}

/** El texto del dato, no "vi su Instagram" (§3.3). Se autocompleta desde el nivel más alto. */
export function sugerirDatoUsado(escaneo: EscaneoProspecto): string {
    const nivel = calcularNivelDato(escaneo);
    if (nivel === 1) return escaneo.queja_textual.trim();
    if (nivel === 2) return escaneo.fallas.map((f) => FALLA_LABELS[f]).join(" · ");
    if (nivel === 3) return escaneo.hito_reciente.trim();
    if (nivel === 4) return escaneo.detalle_trabajo.trim();
    return "";
}

// ─────────────────────────────────────────────────────────────
// §8 — Peso de las reseñas según el rubro
// "A un abogado casi nadie lo reseña, gane o pierda el juicio."
// ─────────────────────────────────────────────────────────────

const RUBROS_RESENA_FUERTE = [
    "odontolog", "dentista", "consultorio", "medic", "clinic", "pediatr", "kinesi",
    "gastronom", "restaurant", "bar", "cafeter", "pizzer", "rotiser", "comida",
    "comercio", "indumentaria", "calzado", "optic", "estetic", "peluquer", "barber",
    "gimnasio", "hotel", "veterinar",
];

const RUBROS_RESENA_DEBIL = [
    "abogad", "juridic", "contad", "contable", "estudio", "arquitect", "escriban",
    "asesor", "consultor", "seguro",
];

export type PesoResena = "fuerte" | "debil" | "neutro";

export function pesoResenaDelRubro(rubro: string): PesoResena {
    const r = normalizar(rubro);
    if (!r) return "neutro";
    if (RUBROS_RESENA_FUERTE.some((k) => r.includes(k))) return "fuerte";
    if (RUBROS_RESENA_DEBIL.some((k) => r.includes(k))) return "debil";
    return "neutro";
}

export function normalizar(str: string): string {
    return (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/**
 * §8 — "El umbral de reseñas es relativo al rubro, no absoluto."
 * Devuelve el percentil (0-1) del prospecto dentro de su propio rubro.
 * Con menos de 4 prospectos del rubro cargados no hay distribución que mirar → null.
 */
export function percentilResenasEnRubro(prospecto: Prospecto, universo: Prospecto[]): number | null {
    const reviews = prospecto.reviews_count;
    if (reviews == null) return null;

    const mismoRubro = universo.filter(
        (p) => normalizar(p.rubro) === normalizar(prospecto.rubro) && p.reviews_count != null
    );
    if (mismoRubro.length < 4) return null;

    const menores = mismoRubro.filter((p) => (p.reviews_count ?? 0) < reviews).length;
    return menores / mismoRubro.length;
}

// ─────────────────────────────────────────────────────────────
// §8 — Orden de trabajo por segmento
// "primero los ~50 de Instagram-como-web, después los sin nada,
//  y al final los con web real (argumento de rediseño, más difícil y peor pagado)"
// ─────────────────────────────────────────────────────────────

export const PRIORIDAD_SEGMENTO: Record<ClasificacionWeb, number> = {
    solo_redes: 1,
    sin_web: 2,
    web_debil: 3,
    web_buena: 4,
    sin_definir: 5,
};

const PUNTOS_SEGMENTO: Record<ClasificacionWeb, number> = {
    solo_redes: 20,  // ya demostró la intención sin tener el activo — el mejor segmento
    sin_web: 14,
    web_debil: 10,
    web_buena: 2,
    sin_definir: 6,
};

const PUNTOS_NIVEL: Record<number, number> = { 1: 40, 2: 30, 3: 15, 4: 8 };

export interface DesgloseScore {
    total: number;
    partes: { concepto: string; puntos: number }[];
}

/**
 * Score 0-100 de prioridad de contacto. Ordena la cola de trabajo del día.
 * El universo se usa para el percentil de reseñas relativo al rubro (§8).
 */
export function calcularScore(prospecto: Prospecto, universo: Prospecto[] = []): DesgloseScore {
    const partes: { concepto: string; puntos: number }[] = [];

    if (prospecto.estado === "descartado") {
        return { total: 0, partes: [{ concepto: "Descartado", puntos: 0 }] };
    }

    // 1. Nivel del dato — "el campo que decide si el mensaje funciona" (§3.2 punto 7)
    const escaneo = normalizarEscaneo(prospecto.escaneo);
    const nivel = calcularNivelDato(escaneo);
    if (nivel) {
        partes.push({ concepto: NIVEL_DATO_LABELS[nivel], puntos: PUNTOS_NIVEL[nivel] });
    } else {
        partes.push({ concepto: "Sin dato de personalización", puntos: 0 });
    }

    // 2. Segmento (§8)
    partes.push({
        concepto: `Segmento: ${prospecto.clasificacion_web.replace("_", " ")}`,
        puntos: PUNTOS_SEGMENTO[prospecto.clasificacion_web] ?? 0,
    });

    // 3. Reseñas, con peso relativo al rubro (§8)
    const peso = pesoResenaDelRubro(prospecto.rubro);
    const percentil = percentilResenasEnRubro(prospecto, universo);
    if (percentil != null && peso !== "debil") {
        const max = peso === "fuerte" ? 15 : 10;
        const puntos = Math.round(percentil * max);
        partes.push({ concepto: `Reseñas: percentil ${Math.round(percentil * 100)} del rubro`, puntos });
    } else if (peso === "debil") {
        // "En rubros donde nadie reseña, la cantidad de reseñas es un indicador débil."
        // Se reemplaza por actividad de IG, tamaño y especialidad, ya contemplados abajo.
        partes.push({ concepto: "Reseñas: indicador débil en este rubro", puntos: 0 });
    }

    // 4. Demanda de búsqueda de la especialidad (§8)
    if (prospecto.demanda_busqueda === "alta") {
        partes.push({ concepto: "Especialidad con demanda de búsqueda", puntos: 10 });
    } else if (prospecto.demanda_busqueda === "baja") {
        partes.push({ concepto: "Sin demanda de búsqueda (usar ángulo de credibilidad)", puntos: 0 });
    }

    // 5. Actividad de Instagram (§3.2 punto 3)
    if (prospecto.dias_ultimo_post != null) {
        if (prospecto.dias_ultimo_post <= 60) {
            partes.push({ concepto: "Instagram activo (últimos 60 días)", puntos: 8 });
        } else {
            partes.push({ concepto: "Instagram sin posts en 60+ días", puntos: -6 });
        }
    }

    // 6. Canal resuelto (§3.2 punto 4)
    if (prospecto.whatsapp_publicado || prospecto.instagram_url) {
        partes.push({ concepto: "Canal de contacto resuelto", puntos: 5 });
    }

    // 7. Tamaño / quién decide (§3.2 punto 5)
    if (prospecto.cant_profesionales != null) {
        if (prospecto.cant_profesionales <= 3) {
            partes.push({ concepto: "1-3 profesionales: decide uno solo", puntos: 7 });
        } else {
            partes.push({ concepto: "Estudio grande: ciclo largo", puntos: 2 });
        }
    }

    const total = Math.max(0, Math.min(100, partes.reduce((s, p) => s + p.puntos, 0)));
    return { total, partes };
}

// ─────────────────────────────────────────────────────────────
// §3.1 — Descarte rápido
// ─────────────────────────────────────────────────────────────

export interface AlertaDescarte {
    regla: string;
    detalle: string;
}

export function alertasDescarte(p: Prospecto): AlertaDescarte[] {
    const alertas: AlertaDescarte[] = [];

    if (p.reviews_count != null && p.reviews_count < 5) {
        alertas.push({
            regla: "Volumen demasiado bajo",
            detalle: `${p.reviews_count} reseñas — casi no hay flujo, o la ficha está abandonada.`,
        });
    }
    if (p.clasificacion_web === "web_buena") {
        alertas.push({
            regla: "Ya tiene web moderna",
            detalle: "Descartar salvo que haya una falla específica → ahí es candidato de rediseño.",
        });
    }
    if (p.dias_ultimo_post != null && p.dias_ultimo_post > 180) {
        alertas.push({
            regla: "Cuenta abandonada",
            detalle: `Último post hace ${p.dias_ultimo_post} días — el DM se pierde.`,
        });
    }
    if (!p.whatsapp_publicado && !p.instagram_url) {
        alertas.push({
            regla: "Sin canal de contacto",
            detalle: "Ni WhatsApp publicado ni Instagram. No hay por dónde escribir.",
        });
    }
    return alertas;
}

// ─────────────────────────────────────────────────────────────
// §5 — La escalera de mensajes
// ─────────────────────────────────────────────────────────────

export type PasoMensaje = "m1" | "m2" | "m3" | "fu1" | "fu2" | "fu3" | "ruteo";

export const PASO_MENSAJE_LABELS: Record<PasoMensaje, string> = {
    m1: "Mensaje 1 — Permiso",
    m2: "Mensaje 2 — Entrega del análisis",
    m3: "Mensaje 3 — Caso y oferta",
    fu1: "Follow-up 1 (3-4 días)",
    fu2: "Follow-up 2 (7-10 días)",
    fu3: "Follow-up 3", // Galu no llega acá (doc 08 no tiene mensaje 4); existe para que el calendario de VivoMenu comparta el mismo tipo.
    ruteo: "Línea de ruteo al decisor",
};

const CONSECUENCIA_POR_CLASIFICACION: Record<ClasificacionWeb, string> = {
    sin_web:
        "Te lo comento porque ese lugar hoy está libre: el que aparece ahí se queda con todos los que buscan. No es que tengas algo mal hecho — es que nadie lo está ocupando.",
    solo_redes:
        "Te lo comento porque el que busca en Google no llega a Instagram: si no hay nada que abrir, compara 2 o 3 y se queda con el que sí tiene algo.",
    web_debil:
        "Te lo digo porque el que entra desde el celular y no puede leer nada se va en 5 segundos, y esa consulta termina en otro lado.",
    web_buena:
        "Te lo digo porque es lo primero que ve alguien que los está por elegir, y hoy juega en contra.",
    sin_definir:
        "Te lo digo porque el que busca compara 2 o 3 antes de escribir, y suele quedarse con el que sí tiene algo que mirar.",
};

/**
 * §5 — Mensaje 1, estructura fija de 3 líneas:
 *   L1 el dato observable · L2 la consecuencia en plata o tiempo · L3 permiso de una palabra.
 * §4 regla de uso: con nivel 3 o 4 va la versión corta, sin diagnóstico de la consecuencia.
 */
export function generarMensaje(paso: PasoMensaje, p: Prospecto): string {
    const escaneo = normalizarEscaneo(p.escaneo);
    const nivel = calcularNivelDato(escaneo);
    const rubro = p.especialidad || p.rubro || "tu rubro";
    const ciudad = p.ciudad || "la zona";

    if (paso === "ruteo") {
        return "Che, una cosa: ¿esto lo maneja alguien más? Si me decís con quién, le escribo directo y no te hago de intermediaria.";
    }

    if (paso === "m1") {
        // Versión corta — nivel 3 o 4. "Un mensaje largo apoyado en un dato flojo se lee como plantilla."
        if (!nivel || nivel >= 3) {
            const observacion =
                nivel === 3
                    ? `Vi que ${minuscula(escaneo.hito_reciente)} — felicitaciones.`
                    : nivel === 4
                      ? `Vi ${minuscula(escaneo.detalle_trabajo)}.`
                      : `Estuve viendo ${p.negocio}.`;
            return [
                `Hola! ${observacion}`,
                "",
                "Pregunta corta: ¿tienen algo online donde alguien que los busca pueda ver los servicios y dejar sus datos, o hoy va todo por WhatsApp?",
            ].join("\n");
        }

        // Versión completa — nivel 1 o 2.
        const linea1 =
            nivel === 1
                ? `Hola! Estuve viendo las reseñas ${p.negocio ? `de ${p.negocio}` : ""} y hay gente que menciona que ${minuscula(escaneo.queja_textual)}.`.replace(
                      /\s+/g,
                      " "
                  )
                : `Hola! Busqué ${p.negocio} en Google para ver los servicios y ${descripcionFalla(escaneo.fallas, p)}.`;

        const linea2 =
            nivel === 1
                ? "Te lo comento porque casi nunca es un problema de atención: es que no hay dónde ordenar las consultas y se mezclan todas en el mismo WhatsApp — y al final la que atiende queda expuesta por algo que es del sistema, no suyo."
                : CONSECUENCIA_POR_CLASIFICACION[p.clasificacion_web];

        const linea3 = `Te armé un análisis en una página con lo que veo desde afuera: qué ve la gente que busca ${rubro} en ${ciudad}, cuántos son por mes, y qué se puede arreglar o corregir sin contratar a nadie más. Es gratis, sin compromiso. ¿Te lo mando?`;

        return [linea1, "", linea2, "", linea3].join("\n");
    }

    if (paso === "m2") {
        const link = p.revision_url || "[link de la revisión]";
        return [
            `Ahí va 👇 ${link}`,
            "",
            "Son 4 cosas concretas, la primera la podés arreglar hoy sin ayuda de nadie.",
            "",
            "Una pregunta para entender: hoy, cuando alguien los consulta por primera vez, ¿entra por WhatsApp, por teléfono o por recomendación?",
        ].join("\n");
    }

    if (paso === "m3") {
        return [
            "Buenísimo. Eso que me contás es igual a lo que le pasaba a [caso donde la situación coincide]: todo entraba por WhatsApp y se perdía la mitad.",
            "",
            "Lo que hacemos es un diagnóstico de 30 minutos, sin costo — sale un documento de una página con qué conviene tocar primero y qué cuesta. Sin compromiso de nada.",
            "",
            "¿Te sirve esta semana o la próxima?",
        ].join("\n");
    }

    if (paso === "fu1") {
        const regalo = regaloFollowUp(escaneo.fallas, p);
        return [
            `Che, te dejo lo más importante de lo que había visto, así al menos te queda el dato: ${regalo}`,
            "",
            "Si te interesa el resto, avisame. Si no, no hay drama.",
        ].join("\n");
    }

    // fu2 — el que más respuestas trae de los tres
    return "Última por acá para no ser pesado 😅 Si en algún momento sentís que estás perdiendo consultas porque no te encuentran o no llegás a contestar, escribime. Éxitos!";
}

function minuscula(txt: string): string {
    const t = (txt || "").trim();
    if (!t) return "";
    return t.charAt(0).toLowerCase() + t.slice(1);
}

function descripcionFalla(fallas: FallaVerificable[], p: Prospecto): string {
    const f = fallas[0];
    switch (f) {
        case "web_lenta":
            return "la web tarda bastante en abrir desde el celular";
        case "ficha_incompleta":
            return "la ficha de Google está sin horarios ni servicios cargados";
        case "horarios_mal":
            return "los horarios que figuran en Maps no coinciden con los reales";
        case "bio_rota":
            return "el link de la bio de Instagram no lleva a ningún lado";
        case "no_aparece_rubro":
            return `buscando "${p.especialidad || p.rubro} en ${p.ciudad}" no aparecen — sí buscando el nombre`;
        case "whatsapp_personal":
            return "el WhatsApp figura como personal, sin horarios ni respuestas rápidas";
        case "sin_responder_resenas":
            return "vi que las reseñas quedaron sin responder";
        default:
            return "no encontré web, solo la ficha de Maps";
    }
}

/** §7.2 punto 3 — el regalo de reciprocidad: algo que puede hacer esa tarde sin vos. */
function regaloFollowUp(fallas: FallaVerificable[], p: Prospecto): string {
    if (fallas.includes("whatsapp_personal"))
        return "pasar el WhatsApp a WhatsApp Business (es gratis) y cargar las respuestas rápidas de las 5 preguntas que más se repiten. Baja bastante el ida y vuelta.";
    if (fallas.includes("ficha_incompleta"))
        return `cargar los servicios en la ficha de Google. Ahí es donde se decide si aparecen cuando alguien busca "${p.especialidad || p.rubro} en ${p.ciudad}".`;
    if (fallas.includes("horarios_mal"))
        return "corregir los horarios de Google: hoy dice cerrado en horas en las que están abiertos, y esa gente no llama.";
    if (fallas.includes("bio_rota"))
        return "arreglar el link de la bio de Instagram, hoy no lleva a ningún lado.";
    if (fallas.includes("sin_responder_resenas"))
        return "responder las 3 reseñas peores con una línea cada una. Una queja respondida hace mucho menos daño que una queja sola, y es gratis.";
    return `completar la ficha de Google con servicios, horarios y fotos. Es lo que define si aparecen buscando "${p.especialidad || p.rubro} en ${p.ciudad}".`;
}

// ─────────────────────────────────────────────────────────────
// Follow-ups: FU1 a los 3-4 días, FU2 a los 7-10. Después, archivar.
// ─────────────────────────────────────────────────────────────

export type AccionSeguimiento = { paso: PasoMensaje; vencido: boolean; dias: number } | null;

const ESTADOS_CERRADOS: EstadoProspecto[] = [
    "respondio", "revision_enviada", "reunion", "cliente", "descartado", "sin_respuesta",
];

/**
 * Doc 08 (Galu) define solo dos toques: día 3-4 y día 7-10.
 * VivoMenu §5 Rama C define tres: día 3, día 7 y día 14 — sin mensaje 4 en ninguno.
 */
const CADENCIA_FOLLOWUP: Record<Sistema, { fu1: number; fu2: number; fu3?: number }> = {
    galu: { fu1: 3, fu2: 7 },
    vivomenu: { fu1: 3, fu2: 7, fu3: 14 },
};

export function proximaAccion(p: Prospecto, hoy: Date = new Date()): AccionSeguimiento {
    if (ESTADOS_CERRADOS.includes(p.estado)) return null;
    const cadencia = CADENCIA_FOLLOWUP[p.sistema] || CADENCIA_FOLLOWUP.galu;

    if (p.estado === "enviado" && p.fecha_envio) {
        const dias = diasDesde(p.fecha_envio, hoy);
        return { paso: "fu1", vencido: dias >= cadencia.fu1, dias };
    }
    if (p.estado === "fu1" && p.fecha_fu1) {
        const dias = diasDesde(p.fecha_fu1, hoy);
        return { paso: "fu2", vencido: dias >= cadencia.fu2, dias };
    }
    if (p.estado === "fu2" && p.fecha_fu2 && cadencia.fu3) {
        const dias = diasDesde(p.fecha_fu2, hoy);
        return { paso: "fu3", vencido: dias >= cadencia.fu3, dias };
    }
    return null;
}

export function diasDesde(fecha: string, hoy: Date = new Date()): number {
    const d = new Date(fecha + (fecha.length === 10 ? "T00:00:00" : ""));
    return Math.floor((hoy.getTime() - d.getTime()) / 86_400_000);
}

export function hoyISO(): string {
    return new Date().toISOString().split("T")[0];
}

// ─────────────────────────────────────────────────────────────
// §11 — Qué mirar a las 3 semanas
// ─────────────────────────────────────────────────────────────

const ESTADOS_ENVIADOS: EstadoProspecto[] = [
    "enviado", "fu1", "fu2", "sin_respuesta", "respondio", "revision_enviada", "reunion", "cliente",
];
const ESTADOS_RESPONDIO: EstadoProspecto[] = ["respondio", "revision_enviada", "reunion", "cliente"];

export interface CorteMetrica {
    clave: string;
    enviados: number;
    respondieron: number;
    tasa: number;
}

export function fueEnviado(p: Prospecto): boolean {
    return ESTADOS_ENVIADOS.includes(p.estado);
}
export function respondio(p: Prospecto): boolean {
    return ESTADOS_RESPONDIO.includes(p.estado);
}

function agrupar(prospectos: Prospecto[], clave: (p: Prospecto) => string): CorteMetrica[] {
    const mapa = new Map<string, { enviados: number; respondieron: number }>();
    prospectos.filter(fueEnviado).forEach((p) => {
        const k = clave(p);
        const acc = mapa.get(k) || { enviados: 0, respondieron: 0 };
        acc.enviados++;
        if (respondio(p)) acc.respondieron++;
        mapa.set(k, acc);
    });
    return Array.from(mapa.entries())
        .map(([clave, v]) => ({
            clave,
            enviados: v.enviados,
            respondieron: v.respondieron,
            tasa: v.enviados ? v.respondieron / v.enviados : 0,
        }))
        .sort((a, b) => b.enviados - a.enviados);
}

export function tasaPorNivelDato(prospectos: Prospecto[]): CorteMetrica[] {
    return agrupar(prospectos, (p) => {
        const n = p.nivel_dato ?? calcularNivelDato(normalizarEscaneo(p.escaneo));
        return n ? NIVEL_DATO_LABELS[n] : "Sin dato";
    });
}

export function tasaPorRubro(prospectos: Prospecto[]): CorteMetrica[] {
    return agrupar(prospectos, (p) => p.rubro || "Sin rubro");
}

export function tasaPorQuienLeyo(prospectos: Prospecto[]): CorteMetrica[] {
    return agrupar(prospectos, (p) => p.quien_leyo || "no_se");
}

/** §11 — Diagnóstico rápido según dónde se corta el embudo. */
export interface DiagnosticoEmbudo {
    sintoma: string;
    causa: string;
    accion: string;
    activo: boolean;
}

export function diagnosticoEmbudo(prospectos: Prospecto[]): DiagnosticoEmbudo[] {
    const enviados = prospectos.filter(fueEnviado);
    const respondieron = enviados.filter(respondio);
    const revisiones = prospectos.filter((p) =>
        ["revision_enviada", "reunion", "cliente"].includes(p.estado)
    );
    const reuniones = prospectos.filter((p) => ["reunion", "cliente"].includes(p.estado));
    const clientes = prospectos.filter((p) => p.estado === "cliente");

    const hayMuestra = enviados.length >= 20;
    const tasaResp = enviados.length ? respondieron.length / enviados.length : 0;

    return [
        {
            sintoma: "Nadie responde (menos del 5%)",
            causa: "Línea 1 débil o dato genérico",
            accion: "Tocar el dato, no el volumen",
            activo: hayMuestra && tasaResp < 0.05,
        },
        {
            sintoma: "Responden pero no aceptan el análisis",
            causa: "La consecuencia (línea 2) no le duele o no la entiende",
            accion: "Reescribir la línea 2 en su idioma",
            activo: respondieron.length >= 5 && revisiones.length / respondieron.length < 0.4,
        },
        {
            sintoma: "Aceptan el análisis y después desaparecen",
            causa: "El análisis no dice nada que no supieran",
            accion: "Que el punto 3 sea de verdad accionable y gratis",
            activo: revisiones.length >= 4 && reuniones.length / revisiones.length < 0.35,
        },
        {
            sintoma: "Llegan a la consultoría y no cierran",
            causa: "Problema de oferta o precio, no de prospección",
            accion: "Volver a la decisión de precios (plan maestro §8)",
            activo: reuniones.length >= 3 && clientes.length / reuniones.length < 0.25,
        },
    ];
}

// ─────────────────────────────────────────────────────────────
// Importación desde la planilla de Google Sheets (pegado TSV/CSV)
// ─────────────────────────────────────────────────────────────

export const CAMPOS_IMPORTABLES = [
    { key: "negocio", label: "Negocio", alias: ["negocio", "nombre", "empresa", "titulo", "name"] },
    { key: "rubro", label: "Rubro", alias: ["rubro", "categoria", "category", "tipo"] },
    { key: "especialidad", label: "Especialidad", alias: ["especialidad", "subrubro"] },
    { key: "ciudad", label: "Ciudad", alias: ["ciudad", "lugar", "localidad", "city"] },
    { key: "direccion", label: "Dirección", alias: ["direccion", "domicilio", "address"] },
    { key: "telefono", label: "Teléfono", alias: ["telefono", "tel", "celular", "phone", "whatsapp"] },
    { key: "sitio_web_url", label: "Sitio web", alias: ["sitio", "web", "website", "url", "sitio web", "pagina"] },
    { key: "instagram_url", label: "Instagram", alias: ["instagram", "ig", "red social", "redes"] },
    { key: "maps_url", label: "Link de Maps", alias: ["maps", "google maps", "link", "perfil", "ficha"] },
    { key: "rating", label: "Rating", alias: ["rating", "estrellas", "puntaje", "score", "calificacion"] },
    { key: "reviews_count", label: "Cant. reseñas", alias: ["reviews", "resenas", "reseñas", "opiniones", "comentarios"] },
    { key: "notas", label: "Notas", alias: ["notas", "observaciones", "comentario"] },
] as const;

export type CampoImportable = (typeof CAMPOS_IMPORTABLES)[number]["key"];

export interface FilaParseada {
    headers: string[];
    filas: string[][];
}

/** Parsea lo pegado desde Google Sheets (TSV) o un CSV. Respeta comillas dobles. */
export function parsearPegado(texto: string): FilaParseada | null {
    const limpio = texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    if (!limpio) return null;

    const lineas = limpio.split("\n").filter((l) => l.trim().length > 0);
    if (lineas.length === 0) return null;

    const sep = lineas[0].includes("\t") ? "\t" : lineas[0].split(";").length > lineas[0].split(",").length ? ";" : ",";
    const partir = (linea: string): string[] => {
        const out: string[] = [];
        let actual = "";
        let enComillas = false;
        for (let i = 0; i < linea.length; i++) {
            const c = linea[i];
            if (c === '"') {
                if (enComillas && linea[i + 1] === '"') { actual += '"'; i++; }
                else enComillas = !enComillas;
            } else if (c === sep && !enComillas) {
                out.push(actual.trim());
                actual = "";
            } else {
                actual += c;
            }
        }
        out.push(actual.trim());
        return out;
    };

    const headers = partir(lineas[0]);
    const filas = lineas.slice(1).map(partir);
    return { headers, filas };
}

/** Adivina a qué campo del CRM corresponde cada columna de la planilla. */
export function mapearColumnas(headers: string[]): (CampoImportable | "")[] {
    const usados = new Set<string>();
    return headers.map((h) => {
        const n = normalizar(h);
        for (const campo of CAMPOS_IMPORTABLES) {
            if (usados.has(campo.key)) continue;
            if (campo.alias.some((a) => n === a || n.includes(a))) {
                usados.add(campo.key);
                return campo.key;
            }
        }
        return "" as const;
    });
}

/** Clasificación web automática a partir de la URL del campo "sitio web" (§8). */
export function clasificarWebDesdeUrl(url: string): ClasificacionWeb {
    const u = normalizar(url);
    if (!u) return "sin_web";
    if (u.includes("instagram.com") || u.includes("facebook.com") || u.includes("linktr.ee")) return "solo_redes";
    return "web_debil"; // hay que abrirla para confirmar si es "buena"
}

/** Normaliza un teléfono argentino a formato wa.me. Devuelve "" si no es usable. */
export function telefonoAWhatsapp(raw: string): string {
    if (!raw) return "";
    let d = raw.replace(/\D/g, "");
    if (!d) return "";

    if (d.startsWith("00")) d = d.slice(2);
    if (d.startsWith("549")) return d.length >= 12 ? d : "";
    if (d.startsWith("54")) d = d.slice(2);
    if (d.startsWith("0")) d = d.slice(1);          // 0 de larga distancia

    // El "15" va después del código de área (0381-15-4123456) y no existe en formato
    // internacional. Sin sacarlo, wa.me abre un chat con un número que no es de nadie.
    if (d.length === 12) {
        for (const i of [2, 3, 4]) {
            if (d.slice(i, i + 2) === "15") { d = d.slice(0, i) + d.slice(i + 2); break; }
        }
    }
    if (d.startsWith("15")) d = d.slice(2);          // 15 suelto, sin código de área

    // Un número argentino sin 0 ni 15 tiene 10 dígitos (área 2-4 + abonado 6-8).
    if (d.length < 8 || d.length > 11) return "";
    return "549" + d;
}

export function prospectoVacio(sistema: Sistema = "galu"): Omit<Prospecto, "id" | "created_at"> {
    return {
        sistema,
        negocio: "",
        contacto_nombre: "",
        rubro: "",
        especialidad: "",
        ciudad: "",
        direccion: "",
        telefono: "",
        telefono_wa: "",
        whatsapp_publicado: false,
        es_whatsapp_business: null,
        instagram_url: "",
        dias_ultimo_post: null,
        sitio_web_url: "",
        maps_url: "",
        canal: "instagram",
        clasificacion_web: "sin_definir",
        demanda_busqueda: "sin_definir",
        rating: null,
        reviews_count: null,
        cant_profesionales: null,
        escaneo: { ...ESCANEO_VACIO },
        dato_usado: "",
        nivel_dato: null,
        score: 0,
        estado: "sin_calificar",
        motivo_descarte: "",
        fecha_envio: null,
        fecha_fu1: null,
        fecha_fu2: null,
        fecha_fu3: null,
        fecha_respuesta: null,
        quien_leyo: null,
        revision_url: "",
        mensaje_enviado: "",
        cliente_id: null,
        origen: "manual",
        notas: "",
    };
}
