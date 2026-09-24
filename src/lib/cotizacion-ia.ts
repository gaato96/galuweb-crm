/**
 * Cotizaciones con IA
 * ─────────────────────────────────────────────────────────────
 * Lo que se releva del cliente (el briefing), y la vuelta a tierra
 * de lo que responde la IA.
 *
 * El briefing se comparte entre el formulario y la ruta de API: el
 * formulario dibuja los campos y la ruta arma el prompt con los mismos
 * títulos, así lo que se pregunta y lo que se manda no se desincronizan.
 */

import type {
    BriefingCotizacion, CotizacionItem, PlanPagoItem,
    SeccionesPDF, TipoCotizacion,
} from "./types";

// ── Briefing ─────────────────────────────────────────────────────────────────

export interface CampoBriefing {
    key: keyof BriefingCotizacion;
    label: string;
    placeholder: string;
    filas: number;
    /** Sin esto la IA no puede cotizar: inventaría el precio. */
    clave?: boolean;
}

export const CAMPOS_BRIEFING: CampoBriefing[] = [
    {
        key: "notas_reunion",
        label: "Qué se habló en la reunión",
        placeholder:
            "Pegá acá tus notas tal como las tengas, sin ordenar. Quién es, a qué se dedica, qué pidió, qué dijo que le molesta hoy, cualquier frase textual que te haya quedado.",
        filas: 6,
        clave: true,
    },
    {
        key: "situacion_actual",
        label: "Cómo lo resuelve hoy y qué le duele",
        placeholder:
            "Ej: vende por WhatsApp y coordina todo a mano, pierde consultas cuando no contesta rápido, lleva el registro en planillas sueltas.",
        filas: 3,
    },
    {
        key: "requerimientos",
        label: "Qué pidió puntualmente",
        placeholder:
            "Funcionalidades, módulos o secciones que mencionó. Uno por línea si te resulta más cómodo.",
        filas: 4,
        clave: true,
    },
    {
        key: "publico",
        label: "A quién le vende o quién lo va a usar",
        placeholder: "Ej: empleados públicos de comunas del interior; o el equipo de 4 personas que atiende al público.",
        filas: 2,
    },
    {
        key: "presupuesto",
        label: "Cuánto le vas a cobrar (USD)",
        placeholder:
            "El total que querés cerrar, en dólares. Ej: 750. Si querés mostrar descuento, aclaralo: \"750 finales, con 35% de descuento por referido\".",
        filas: 2,
        clave: true,
    },
    {
        key: "forma_pago",
        label: "Cómo se paga",
        placeholder: "Ej: 3 pagos mensuales de 250. O: 50% al arrancar y 50% contra entrega.",
        filas: 2,
        clave: true,
    },
    {
        key: "plazo",
        label: "Plazo de entrega",
        placeholder: "Ej: 5 semanas. Si tiene una fecha límite real, ponela.",
        filas: 2,
    },
    {
        key: "condiciones",
        label: "Condiciones y lo que queda afuera",
        placeholder:
            "Mantenimiento mensual, hosting, dominio, qué NO entra en el alcance, rondas de ajustes incluidas, cualquier cosa que quieras que figure escrita.",
        filas: 4,
    },
];

export const BRIEFING_VACIO: BriefingCotizacion = {
    notas_reunion: "",
    situacion_actual: "",
    requerimientos: "",
    publico: "",
    presupuesto: "",
    forma_pago: "",
    plazo: "",
    condiciones: "",
};

export function briefingVacio(): BriefingCotizacion {
    return { ...BRIEFING_VACIO };
}

/** Los campos sin los que generar es tirar una moneda. */
export function faltantesDelBriefing(b: BriefingCotizacion): string[] {
    return CAMPOS_BRIEFING.filter((c) => c.clave && !b[c.key]?.trim()).map((c) => c.label);
}

/**
 * Para estimar alcanza con saber qué hay que hacer: el precio es justamente
 * lo que falta. La forma de pago tampoco hace falta todavía.
 */
export function faltantesParaEstimar(b: BriefingCotizacion): string[] {
    const faltan: string[] = [];
    if (!b.notas_reunion?.trim() && !b.requerimientos?.trim()) {
        faltan.push("Qué se habló en la reunión o qué pidió puntualmente");
    }
    return faltan;
}

// ── Vuelta a tierra de lo que responde la IA ─────────────────────────────────

export interface CotizacionGenerada {
    items: CotizacionItem[];
    plan_pago: PlanPagoItem[];
    secciones: SeccionesPDF;
    resumen_interno: string;
}

const CLAVES_WEB = ["descripcion", "alcance", "cronograma", "terminos", "conclusion", "proximos_pasos"] as const;
const CLAVES_WEBAPP = ["descripcion", "alcance", "arquitectura", "cronograma", "terminos", "proximos_pasos"] as const;

function texto(v: unknown): string {
    return typeof v === "string" ? v.trim() : "";
}

function numero(v: unknown): number {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * Convierte la respuesta de la IA en algo que el formulario pueda mostrar sin
 * romperse. Todo campo que no venga queda vacío y editable a mano: preferimos
 * un hueco visible a un dato inventado.
 */
export function normalizarCotizacionIA(raw: unknown, tipo: TipoCotizacion): CotizacionGenerada {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

    const items: CotizacionItem[] = (Array.isArray(r.items) ? r.items : [])
        .map((i): CotizacionItem | null => {
            const io = (i && typeof i === "object" ? i : {}) as Record<string, unknown>;
            const descripcion = texto(io.descripcion);
            if (!descripcion) return null;
            return { descripcion, precio: numero(io.precio) };
        })
        .filter((i): i is CotizacionItem => i !== null);

    const plan_pago: PlanPagoItem[] = (Array.isArray(r.plan_pago) ? r.plan_pago : [])
        .map((p): PlanPagoItem | null => {
            const po = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
            const cuando = texto(po.cuando);
            if (!cuando) return null;
            return { cuando, monto: numero(po.monto), detalle: texto(po.detalle) };
        })
        .filter((p): p is PlanPagoItem => p !== null);

    const sec = (r.secciones && typeof r.secciones === "object" ? r.secciones : {}) as Record<string, unknown>;
    const claves = tipo === "webapp" ? CLAVES_WEBAPP : CLAVES_WEB;
    const secciones = claves.reduce((acc, k) => {
        acc[k] = texto(sec[k]);
        return acc;
    }, {} as Record<string, string>) as unknown as SeccionesPDF;

    return { items, plan_pago, secciones, resumen_interno: texto(r.resumen_interno) };
}

/** Lo que va a decir el PDF. Se calcula acá para no depender de que la IA sume bien. */
export function totalDeItems(items: CotizacionItem[]): number {
    return items.reduce((s, i) => s + (Number(i.precio) || 0), 0);
}

// ── Estimación de precio ─────────────────────────────────────────────────────

/**
 * Lo que la IA sugiere cobrar. Es una referencia para decidir, nunca el precio:
 * el número que manda es siempre el que se escribe en el briefing.
 */
export interface EstimacionPrecio {
    minimo: number;
    sugerido: number;
    maximo: number;
    razonamiento: string;
    factores: string[];
}

/** Una cotización pasada, reducida a lo que sirve como ancla de precio. */
export interface AnclaPrecio {
    tipo: TipoCotizacion;
    total: number;
    detalle: string;
}

export function normalizarEstimacion(raw: unknown): EstimacionPrecio | null {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const sugerido = numero(r.sugerido);
    if (sugerido <= 0) return null;
    const minimo = numero(r.minimo) || Math.round(sugerido * 0.8);
    const maximo = numero(r.maximo) || Math.round(sugerido * 1.25);
    return {
        minimo: Math.min(minimo, sugerido),
        sugerido,
        maximo: Math.max(maximo, sugerido),
        razonamiento: texto(r.razonamiento),
        factores: (Array.isArray(r.factores) ? r.factores : []).map(texto).filter(Boolean).slice(0, 5),
    };
}

/**
 * Las cotizaciones ya cerradas son el mejor dato de precio que tenemos: son
 * los números que este estudio cobra de verdad, no un promedio de internet.
 * Se mandan las más recientes del mismo tipo primero.
 */
export function anclasDePrecio(
    cotizaciones: { tipo_cotizacion?: TipoCotizacion; total: number; items: CotizacionItem[]; estado: string }[],
    tipo: TipoCotizacion,
    limite = 6,
): AnclaPrecio[] {
    return cotizaciones
        .filter((c) => c.total > 0 && c.estado !== "rechazada")
        .sort((a, b) => {
            const mismoA = (a.tipo_cotizacion || "web") === tipo ? 0 : 1;
            const mismoB = (b.tipo_cotizacion || "web") === tipo ? 0 : 1;
            return mismoA - mismoB;
        })
        .slice(0, limite)
        .map((c) => ({
            tipo: (c.tipo_cotizacion || "web") as TipoCotizacion,
            total: c.total,
            detalle: c.items.filter((i) => i.precio > 0).map((i) => i.descripcion).slice(0, 4).join("; "),
        }));
}
