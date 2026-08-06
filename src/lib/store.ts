// ============================================================
// Real Data Store — Connects to Supabase
// ============================================================
import { supabase } from "./supabase";
import {
    Cliente, Proyecto, Tarea, Cotizacion, Finanza, Brief, Recurso,
    EtapaCliente, Infraestructura, TicketSoporte, LogProyecto, Idea,
    ScraperBusqueda, ProspectoScraped, Prospecto
} from "./types";
import { ESCANEO_VACIO, type Sistema } from "./types";
import {
    normalizarEscaneo, calcularNivelDato, calcularScore, prospectoVacio,
    clasificarWebDesdeUrl, telefonoAWhatsapp, normalizar
} from "./prospeccion";

// ============================================================
// CRUD Operations (Supabase-backed)
// ============================================================

// --- Clientes ---
export const clientesStore = {
    getAll: async (): Promise<Cliente[]> => {
        const { data, error } = await supabase.from("clientes").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    },
    getById: async (id: string): Promise<Cliente | null> => {
        const { data, error } = await supabase.from("clientes").select("*").eq("id", id).single();
        if (error) return null;
        return data;
    },
    create: async (data: Omit<Cliente, "id" | "created_at">): Promise<Cliente> => {
        const { data: created, error } = await supabase.from("clientes").insert(data).select().single();
        if (error) throw error;
        return created;
    },
    update: async (id: string, data: Partial<Cliente>): Promise<Cliente> => {
        const { data: updated, error } = await supabase.from("clientes").update(data).eq("id", id).select().single();
        if (error) throw error;
        return updated;
    },
    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from("clientes").delete().eq("id", id);
        if (error) throw error;
    },
    getByEtapa: async (etapa: EtapaCliente): Promise<Cliente[]> => {
        const { data, error } = await supabase.from("clientes").select("*").eq("etapa", etapa).order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    },
};

// --- Proyectos ---
export const proyectosStore = {
    getAll: async (): Promise<Proyecto[]> => {
        const { data, error } = await supabase.from("proyectos").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    },
    getById: async (id: string): Promise<Proyecto | null> => {
        const { data, error } = await supabase.from("proyectos").select("*").eq("id", id).single();
        if (error) return null;
        return data;
    },
    getByCliente: async (clienteId: string): Promise<Proyecto[]> => {
        const { data, error } = await supabase.from("proyectos").select("*").eq("cliente_id", clienteId).order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    },
    getBySlug: async (slug: string): Promise<Proyecto | null> => {
        const { data, error } = await supabase.from("proyectos").select("*").eq("slug_portal", slug).single();
        if (error) return null;
        return data;
    },
    create: async (data: Omit<Proyecto, "id" | "created_at">): Promise<Proyecto> => {
        const { data: created, error } = await supabase.from("proyectos").insert(data).select().single();
        if (error) throw error;
        return created;
    },
    update: async (id: string, data: Partial<Proyecto>): Promise<Proyecto> => {
        const { data: updated, error } = await supabase.from("proyectos").update(data).eq("id", id).select().single();
        if (error) throw error;
        return updated;
    },
    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from("proyectos").delete().eq("id", id);
        if (error) throw error;
    },
};

// --- Tareas ---
export const tareasStore = {
    /** Solo las activas: las archivadas viven en el historial. */
    getAll: async (): Promise<Tarea[]> => {
        const { data, error } = await supabase
            .from("tareas").select("*").or("archivada.is.null,archivada.eq.false")
            .order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    },
    getById: async (id: string): Promise<Tarea | null> => {
        const { data, error } = await supabase.from("tareas").select("*").eq("id", id).single();
        if (error) return null;
        return data;
    },
    getArchivadas: async (): Promise<Tarea[]> => {
        const { data, error } = await supabase
            .from("tareas").select("*").eq("archivada", true)
            .order("fecha_archivada", { ascending: false });
        if (error) throw error;
        return data || [];
    },
    /** Saca del tablero todo lo completado. Devuelve cuántas archivó. */
    archivarCompletadas: async (): Promise<number> => {
        const ahora = new Date().toISOString();
        const { data, error } = await supabase
            .from("tareas")
            .update({ archivada: true, fecha_archivada: ahora })
            .eq("estado", "completada")
            .or("archivada.is.null,archivada.eq.false")
            .select("id");
        if (error) throw error;
        return (data || []).length;
    },
    restaurar: async (id: string): Promise<Tarea> => {
        const { data, error } = await supabase
            .from("tareas")
            .update({ archivada: false, fecha_archivada: null, estado: "pendiente" })
            .eq("id", id).select().single();
        if (error) throw error;
        return data;
    },
    /** Borrado definitivo de todo el historial. */
    vaciarHistorial: async (): Promise<number> => {
        const { data, error } = await supabase
            .from("tareas").delete().eq("archivada", true).select("id");
        if (error) throw error;
        return (data || []).length;
    },
    getByProyecto: async (proyectoId: string): Promise<Tarea[]> => {
        const { data, error } = await supabase.from("tareas").select("*").eq("proyecto_id", proyectoId).order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    },
    getMarketing: async (): Promise<Tarea[]> => {
        const { data, error } = await supabase.from("tareas").select("*").not("workflow_stage", "is", null).order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    },
    create: async (data: Omit<Tarea, "id" | "created_at">): Promise<Tarea> => {
        const { data: created, error } = await supabase.from("tareas").insert(data).select().single();
        if (error) throw error;
        return created;
    },
    update: async (id: string, data: Partial<Tarea>): Promise<Tarea> => {
        // Sellar la fecha al completar es lo que hace ordenable el historial.
        const payload: Partial<Tarea> = { ...data };
        if (data.estado === "completada") payload.fecha_completada = new Date().toISOString();
        else if (data.estado) payload.fecha_completada = null;

        const { data: updated, error } = await supabase.from("tareas").update(payload).eq("id", id).select().single();
        if (error) throw error;
        return updated;
    },
    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from("tareas").delete().eq("id", id);
        if (error) throw error;
    },
    createBulk: async (items: Omit<Tarea, "id" | "created_at">[]): Promise<Tarea[]> => {
        const { data, error } = await supabase.from("tareas").insert(items).select();
        if (error) throw error;
        return data || [];
    },
};

// --- Cotizaciones ---
export const cotizacionesStore = {
    getAll: async (): Promise<Cotizacion[]> => {
        const { data, error } = await supabase.from("cotizaciones").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    },
    getById: async (id: string): Promise<Cotizacion | null> => {
        const { data, error } = await supabase.from("cotizaciones").select("*").eq("id", id).single();
        if (error) return null;
        return data;
    },
    getByCliente: async (clienteId: string): Promise<Cotizacion[]> => {
        const { data, error } = await supabase.from("cotizaciones").select("*").eq("cliente_id", clienteId).order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    },
    create: async (data: Omit<Cotizacion, "id" | "created_at">): Promise<Cotizacion> => {
        const { data: created, error } = await supabase.from("cotizaciones").insert(data).select().single();
        if (error) throw error;
        return created;
    },
    update: async (id: string, data: Partial<Cotizacion>): Promise<Cotizacion> => {
        const { data: updated, error } = await supabase.from("cotizaciones").update(data).eq("id", id).select().single();
        if (error) throw error;
        return updated;
    },
    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from("cotizaciones").delete().eq("id", id);
        if (error) throw error;
    },
};

// --- Finanzas ---
export const finanzasStore = {
    getAll: async (): Promise<Finanza[]> => {
        const { data, error } = await supabase.from("finanzas").select("*").order("fecha_cobro", { ascending: false });
        if (error) throw error;
        return data || [];
    },
    getById: async (id: string): Promise<Finanza | null> => {
        const { data, error } = await supabase.from("finanzas").select("*").eq("id", id).single();
        if (error) return null;
        return data;
    },
    create: async (data: Omit<Finanza, "id" | "created_at">): Promise<Finanza> => {
        const { data: created, error } = await supabase.from("finanzas").insert(data).select().single();
        if (error) throw error;
        return created;
    },
    update: async (id: string, data: Partial<Finanza>): Promise<Finanza> => {
        const { data: updated, error } = await supabase.from("finanzas").update(data).eq("id", id).select().single();
        if (error) throw error;
        return updated;
    },
    marcarCobrado: async (id: string, cobrado: boolean = true): Promise<Finanza> => {
        const today = new Date().toISOString().split("T")[0];
        const { data: updated, error } = await supabase
            .from("finanzas")
            .update({ cobrado, fecha_cobrado: cobrado ? today : null })
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return updated;
    },
    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from("finanzas").delete().eq("id", id);
        if (error) throw error;
    },
};

// --- Briefs ---
export const briefsStore = {
    getAll: async (): Promise<Brief[]> => {
        const { data, error } = await supabase.from("briefs").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    },
    getById: async (id: string): Promise<Brief | null> => {
        const { data, error } = await supabase.from("briefs").select("*").eq("id", id).single();
        if (error) return null;
        return data;
    },
    getByCliente: async (clienteId: string): Promise<Brief | null> => {
        const { data, error } = await supabase.from("briefs").select("*").eq("cliente_id", clienteId).single();
        if (error) return null;
        return data;
    },
    create: async (data: Omit<Brief, "id" | "created_at">): Promise<Brief> => {
        const { data: created, error } = await supabase.from("briefs").insert(data).select().single();
        if (error) throw error;
        return created;
    },
    update: async (id: string, data: Partial<Brief>): Promise<Brief> => {
        const { data: updated, error } = await supabase.from("briefs").update(data).eq("id", id).select().single();
        if (error) throw error;
        return updated;
    },
    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from("briefs").delete().eq("id", id);
        if (error) throw error;
    },
};

// --- Recursos ---
export const recursosStore = {
    getAll: async (): Promise<Recurso[]> => {
        const { data, error } = await supabase.from("recursos").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    },
    getById: async (id: string): Promise<Recurso | null> => {
        const { data, error } = await supabase.from("recursos").select("*").eq("id", id).single();
        if (error) return null;
        return data;
    },
    create: async (data: Omit<Recurso, "id" | "created_at">): Promise<Recurso> => {
        const { data: created, error } = await supabase.from("recursos").insert(data).select().single();
        if (error) throw error;
        return created;
    },
    update: async (id: string, data: Partial<Recurso>): Promise<Recurso> => {
        const { data: updated, error } = await supabase.from("recursos").update(data).eq("id", id).select().single();
        if (error) throw error;
        return updated;
    },
    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from("recursos").delete().eq("id", id);
        if (error) throw error;
    },
};

// --- Infraestructura ---
export const infraestructuraStore = {
    getAll: async (): Promise<Infraestructura[]> => {
        const { data, error } = await supabase.from("infraestructura").select("*, cliente:clientes(*)").order("fecha_vencimiento", { ascending: true });
        if (error) throw error;
        return data || [];
    },
    getById: async (id: string): Promise<Infraestructura | null> => {
        const { data, error } = await supabase.from("infraestructura").select("*, cliente:clientes(*)").eq("id", id).single();
        if (error) return null;
        return data;
    },
    getByCliente: async (clienteId: string): Promise<Infraestructura[]> => {
        const { data, error } = await supabase.from("infraestructura").select("*").eq("cliente_id", clienteId).order("fecha_vencimiento", { ascending: true });
        if (error) throw error;
        return data || [];
    },
    create: async (data: Omit<Infraestructura, "id" | "created_at">): Promise<Infraestructura> => {
        const { data: created, error } = await supabase.from("infraestructura").insert(data).select("*, cliente:clientes(*)").single();
        if (error) throw error;
        return created;
    },
    update: async (id: string, data: Partial<Infraestructura>): Promise<Infraestructura> => {
        const { data: updated, error } = await supabase.from("infraestructura").update(data).eq("id", id).select("*, cliente:clientes(*)").single();
        if (error) throw error;
        return updated;
    },
    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from("infraestructura").delete().eq("id", id);
        if (error) throw error;
    },
};

// --- Tickets ---
export const ticketsStore = {
    getAll: async (): Promise<TicketSoporte[]> => {
        const { data, error } = await supabase.from("tickets").select("*, cliente:clientes(*), proyecto:proyectos(*)").order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    },
    getById: async (id: string): Promise<TicketSoporte | null> => {
        const { data, error } = await supabase.from("tickets").select("*, cliente:clientes(*), proyecto:proyectos(*)").eq("id", id).single();
        if (error) return null;
        return data;
    },
    getByCliente: async (clienteId: string): Promise<TicketSoporte[]> => {
        const { data, error } = await supabase.from("tickets").select("*").eq("cliente_id", clienteId).order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    },
    create: async (data: Omit<TicketSoporte, "id" | "created_at" | "estado">): Promise<TicketSoporte> => {
        const { data: created, error } = await supabase.from("tickets").insert(data).select("*, cliente:clientes(*), proyecto:proyectos(*)").single();
        if (error) throw error;
        return created;
    },
    update: async (id: string, data: Partial<TicketSoporte>): Promise<TicketSoporte> => {
        const { data: updated, error } = await supabase.from("tickets").update(data).eq("id", id).select("*, cliente:clientes(*), proyecto:proyectos(*)").single();
        if (error) throw error;
        return updated;
    },
    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from("tickets").delete().eq("id", id);
        if (error) throw error;
    },
};

// --- Storage ---
export const storageStore = {
    uploadCotizacion: async (file: File): Promise<string> => {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `cotizaciones/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from("galu-assets")
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from("galu-assets")
            .getPublicUrl(filePath);

        return data.publicUrl;
    },
    uploadContrato: async (file: File): Promise<string> => {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `contratos/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from("galu-assets")
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from("galu-assets")
            .getPublicUrl(filePath);

        return data.publicUrl;
    },
    uploadLogo: async (file: File): Promise<string> => {
        const fileExt = file.name.split(".").pop();
        const fileName = `logo_${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `logos/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from("galu-assets")
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from("galu-assets")
            .getPublicUrl(filePath);

        return data.publicUrl;
    },
};

// --- Logs de Proyecto (Changelog / Seguimiento) ---
export const logsProyectoStore = {
    /** Últimas novedades de todos los proyectos, para calcular actividad reciente. */
    getRecientes: async (limite = 500): Promise<LogProyecto[]> => {
        const { data, error } = await supabase
            .from("logs_proyecto")
            .select("*")
            .order("fecha", { ascending: false })
            .limit(limite);
        if (error) throw error;
        return data || [];
    },
    getByProyecto: async (proyectoId: string): Promise<LogProyecto[]> => {
        const { data, error } = await supabase
            .from("logs_proyecto")
            .select("*")
            .eq("proyecto_id", proyectoId)
            .order("fecha", { ascending: false });
        if (error) throw error;
        return data || [];
    },
    create: async (data: Omit<LogProyecto, "id" | "created_at">): Promise<LogProyecto> => {
        const { data: created, error } = await supabase.from("logs_proyecto").insert(data).select().single();
        if (error) throw error;
        return created;
    },
    update: async (id: string, data: Partial<LogProyecto>): Promise<LogProyecto> => {
        const { data: updated, error } = await supabase.from("logs_proyecto").update(data).eq("id", id).select().single();
        if (error) throw error;
        return updated;
    },
    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from("logs_proyecto").delete().eq("id", id);
        if (error) throw error;
    },
};

// --- Ideas ---
export const ideasStore = {
    getAll: async (): Promise<Idea[]> => {
        const { data, error } = await supabase.from("ideas").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    },
    getById: async (id: string): Promise<Idea | null> => {
        const { data, error } = await supabase.from("ideas").select("*").eq("id", id).single();
        if (error) return null;
        return data;
    },
    create: async (data: Omit<Idea, "id" | "created_at">): Promise<Idea> => {
        const { data: created, error } = await supabase.from("ideas").insert(data).select().single();
        if (error) throw error;
        return created;
    },
    update: async (id: string, data: Partial<Idea>): Promise<Idea> => {
        const { data: updated, error } = await supabase.from("ideas").update(data).eq("id", id).select().single();
        if (error) throw error;
        return updated;
    },
    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from("ideas").delete().eq("id", id);
        if (error) throw error;
    },
};

// --- Scraper de Prospectos ---
const SCRAPER_STORAGE_KEY = "galuweb_scraper_searches";
/**
 * localStorage tiene ~5MB y cada búsqueda puede traer 200 prospectos.
 * Guardar 50 búsquedas completas revienta la cuota y —como el error se
 * silenciaba— el historial "desaparecía" sin avisar. Supabase es la fuente
 * de verdad; esto es solo un caché de las últimas búsquedas.
 */
const SCRAPER_MAX_LOCAL = 8;

function leerLocal(): ScraperBusqueda[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(SCRAPER_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((item) => ({
            ...item,
            prospectos: Array.isArray(item.prospectos) ? item.prospectos : [],
        }));
    } catch {
        return [];
    }
}

/** Escribe recortando las búsquedas más viejas hasta que entre en la cuota. */
function escribirLocal(lista: ScraperBusqueda[]): void {
    if (typeof window === "undefined") return;
    let candidata = lista.slice(0, SCRAPER_MAX_LOCAL);

    while (candidata.length > 0) {
        try {
            localStorage.setItem(SCRAPER_STORAGE_KEY, JSON.stringify(candidata));
            return;
        } catch {
            candidata = candidata.slice(0, candidata.length - 1);
        }
    }
    // Ni una sola búsqueda entra: se limpia el caché y se sigue contra Supabase.
    try {
        localStorage.removeItem(SCRAPER_STORAGE_KEY);
        console.warn("[scraperStore] Caché local desactivado por falta de espacio. Se usa Supabase.");
    } catch {
        // Sin recuperación posible; no es bloqueante.
    }
}

// Mapea un row de Supabase (snake_case) a ScraperBusqueda (camelCase)
function dbRowToBusqueda(row: Record<string, unknown>): ScraperBusqueda {
    let prospectosParsed: ProspectoScraped[] = [];
    const rawProspectos = row.prospectos;
    if (Array.isArray(rawProspectos)) {
        prospectosParsed = rawProspectos as ProspectoScraped[];
    } else if (typeof rawProspectos === "string") {
        try {
            prospectosParsed = JSON.parse(rawProspectos);
        } catch {
            prospectosParsed = [];
        }
    }

    return {
        id: row.id as string,
        created_at: row.created_at as string,
        rubro: row.rubro as string,
        lugar: row.lugar as string,
        tituloPersonalizado: (row.titulo_personalizado ?? row.tituloPersonalizado) as string | undefined,
        totalResultados: (row.total_resultados ?? row.totalResultados ?? prospectosParsed.length ?? 0) as number,
        sinWebCount: (row.sin_web_count ?? row.sinWebCount ?? 0) as number,
        conWhatsappCount: (row.con_whatsapp_count ?? row.conWhatsappCount ?? 0) as number,
        prospectos: prospectosParsed,
    };
}

// Mapea ScraperBusqueda a snake_case para Supabase
function busquedaToDbRow(b: ScraperBusqueda): Record<string, unknown> {
    return {
        id: b.id,
        created_at: b.created_at,
        rubro: b.rubro,
        lugar: b.lugar,
        titulo_personalizado: b.tituloPersonalizado ?? null,
        total_resultados: b.totalResultados,
        sin_web_count: b.sinWebCount,
        con_whatsapp_count: b.conWhatsappCount,
        prospectos: b.prospectos,
    };
}

export const scraperStore = {
    getAllSearches: async (): Promise<ScraperBusqueda[]> => {
        let dbSearches: ScraperBusqueda[] = [];
        try {
            const { data, error } = await supabase
                .from("scraper_busquedas")
                .select("*")
                .order("created_at", { ascending: false });
            if (error) {
                console.warn("[scraperStore] Supabase error al leer historial:", error.message, error.code);
            } else if (data && Array.isArray(data)) {
                dbSearches = data.map(row => dbRowToBusqueda(row as Record<string, unknown>));
                console.log("[scraperStore] Supabase devolvio", dbSearches.length, "busquedas");
            }
        } catch (e) {
            console.warn("[scraperStore] Supabase no disponible:", e);
        }
        
        const localSearches: ScraperBusqueda[] = leerLocal();

        // Combinar por id eliminando duplicados (preservar el registro con mayor cantidad de prospectos)
        const combinedMap = new Map<string, ScraperBusqueda>();
        [...dbSearches, ...localSearches].forEach(item => {
            if (item && item.id) {
                const existing = combinedMap.get(item.id);
                if (!existing) {
                    combinedMap.set(item.id, item);
                } else {
                    const existingCount = (existing.prospectos || []).length;
                    const itemCount = (item.prospectos || []).length;
                    if (itemCount > existingCount) {
                        combinedMap.set(item.id, item);
                    }
                }
            }
        });

        const combined = Array.from(combinedMap.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        if (combined.length > 0) escribirLocal(combined);

        return combined;
    },

    saveSearch: async (busqueda: ScraperBusqueda): Promise<void> => {
        // 1. Guardado inmediato en localStorage (caché)
        escribirLocal([busqueda, ...leerLocal().filter(b => b.id !== busqueda.id)]);

        // 2. Guardado en Supabase con columnas snake_case
        try {
            const row = busquedaToDbRow(busqueda);
            const { error } = await supabase.from("scraper_busquedas").upsert(row);
            if (error) {
                console.warn("[scraperStore] Supabase upsert error:", error.message, "|", error.code);
                console.warn(">>> Si dice '42P01' la tabla NO existe. Crea la tabla en Supabase SQL Editor.");
            } else {
                console.log("[scraperStore] Guardado en Supabase OK:", busqueda.id);
            }
        } catch (e) {
            console.warn("[scraperStore] Supabase no disponible:", e);
        }
    },

    deleteSearch: async (id: string): Promise<void> => {
        escribirLocal(leerLocal().filter(b => b.id !== id));
        try {
            await supabase.from("scraper_busquedas").delete().eq("id", id);
        } catch {
            // Silencioso
        }
    },

    clearAllSearches: async (): Promise<void> => {
        if (typeof window !== "undefined") {
            localStorage.removeItem(SCRAPER_STORAGE_KEY);
        }
        try {
            // `neq('id','')` no borra nada si la columna es UUID. Se listan los ids
            // y se borran explícitamente.
            const { data } = await supabase.from("scraper_busquedas").select("id");
            const ids = (data || []).map((r: { id: string }) => r.id);
            if (ids.length > 0) await supabase.from("scraper_busquedas").delete().in("id", ids);
        } catch {
            // Silencioso
        }
    },

    renameSearch: async (id: string, nuevoTitulo: string): Promise<void> => {
        escribirLocal(leerLocal().map(b => b.id === id ? { ...b, tituloPersonalizado: nuevoTitulo } : b));
        try {
            // La columna es snake_case: con camelCase el update fallaba en silencio
            // y el nombre nuevo se perdía al recargar.
            const { error } = await supabase
                .from("scraper_busquedas")
                .update({ titulo_personalizado: nuevoTitulo })
                .eq("id", id);
            if (error) console.warn("[scraperStore] No se pudo renombrar en Supabase:", error.message);
        } catch {
            // Silencioso
        }
    },

    convertirAProspecto: async (prospecto: ProspectoScraped): Promise<void> => {
        await prospectosStore.importarDesdeScraper([prospecto]);
    },

    convertirACliente: async (prospecto: ProspectoScraped): Promise<Cliente> => {
        const clienteData: Omit<Cliente, "id" | "created_at"> = {
            nombre: prospecto.nombre,
            negocio: `${prospecto.rubro} - ${prospecto.lugar}`,
            email: "",
            tel: prospecto.telefono || "",
            canal: "Scraper Google Maps",
            etapa: "contacto" as EtapaCliente,
            info_investigacion: {
                que_hace: `Negocio de ${prospecto.rubro} ubicado en ${prospecto.direccion}. Rating: ${prospecto.rating || 'N/A'}.`,
                puntos_debiles: prospecto.tieneSitioWeb ? `Sitio Web existente: ${prospecto.sitioWebUrl}` : "¡NO TIENE SITIO WEB! Oportunidad para venta de diseño web.",
                soluciones: "Ofrecer servicio de desarrollo web y marketing digital en frío por WhatsApp.",
                enlace: prospecto.sitioWebUrl || prospecto.mapsUrl || "",
                contexto: `Redes Sociales: ${JSON.stringify(prospecto.redesSociales)}`
            },
            msg_whatsapp: "Hola! Como estan? Les queria hacer una consulta",
            notas_seguimiento: [
                {
                    id: `nota-${Date.now()}`,
                    fecha: new Date().toISOString().split("T")[0],
                    texto: `Scrapeado de Google Maps (${prospecto.lugar}). Dirección: ${prospecto.direccion}. Posee sitio web: ${prospecto.tieneSitioWeb ? (prospecto.sitioWebUrl || 'Sí') : 'NO'}`
                }
            ]
        };

        const nuevoCliente = await clientesStore.create(clienteData);
        return nuevoCliente;
    }
};

// ============================================================
// --- Planilla de Prospectos (prospección en frío) ---
// ============================================================

/**
 * Los errores de supabase-js son objetos planos ({ message, code, details, hint }),
 * NO instancias de Error. Un `e instanceof Error` los descarta y deja el mensaje
 * genérico, que es exactamente lo que impide diagnosticar una importación fallida.
 */
export function mensajeError(e: unknown): string {
    if (!e) return "Error desconocido";
    if (typeof e === "string") return e;
    if (e instanceof Error) return e.message;

    const err = e as { message?: string; code?: string; details?: string; hint?: string };
    const partes = [err.message, err.details, err.hint].filter(Boolean);
    const texto = partes.join(" · ") || JSON.stringify(e);

    if (!err.code) return texto;

    // Traducción de los códigos que más aparecen, con la acción concreta.
    const explicaciones: Record<string, string> = {
        "42P01": "La tabla no existe. Falta correr la migración en el SQL Editor de Supabase.",
        "42501": "La tabla tiene RLS activada sin políticas. Corré: ALTER TABLE <tabla> DISABLE ROW LEVEL SECURITY;",
        "23505": "Ya existe un registro con ese negocio y ciudad.",
        "23503": "Referencia inválida a otra tabla.",
        PGRST204: "La tabla no tiene alguna de las columnas que enviamos. Volvé a correr la migración completa.",
        PGRST205: "PostgREST no ve la tabla todavía. En Supabase: Settings → API → Reload schema cache.",
    };
    const explicacion = explicaciones[err.code];
    return explicacion ? `${texto} — ${explicacion} [${err.code}]` : `${texto} [${err.code}]`;
}

export interface ResultadoImportacion {
    insertados: Prospecto[];
    duplicados: number;
    fallidos: { negocio: string; motivo: string }[];
}

/** Los rows vienen de Postgres; `escaneo` puede llegar null o como string JSON. */
function rowToProspecto(row: Record<string, unknown>): Prospecto {
    let escaneo = row.escaneo;
    if (typeof escaneo === "string") {
        try { escaneo = JSON.parse(escaneo); } catch { escaneo = null; }
    }
    return {
        ...(row as unknown as Prospecto),
        escaneo: normalizarEscaneo(escaneo as never),
    };
}

/** Recalcula nivel de dato y score antes de persistir, para que la DB sea consultable. */
function conDerivados(p: Prospecto, universo: Prospecto[]): Prospecto {
    const escaneo = normalizarEscaneo(p.escaneo);
    const conEscaneo = { ...p, escaneo };
    return {
        ...conEscaneo,
        nivel_dato: calcularNivelDato(escaneo),
        score: calcularScore(conEscaneo, universo).total,
    };
}

export const prospectosStore = {
    getAll: async (): Promise<Prospecto[]> => {
        const { data, error } = await supabase
            .from("prospectos")
            .select("*")
            .order("score", { ascending: false });
        if (error) throw error;
        return (data || []).map((r) => rowToProspecto(r as Record<string, unknown>));
    },

    getById: async (id: string): Promise<Prospecto | null> => {
        const { data, error } = await supabase.from("prospectos").select("*").eq("id", id).single();
        if (error) return null;
        return rowToProspecto(data as Record<string, unknown>);
    },

    create: async (
        data: Partial<Prospecto>,
        universo: Prospecto[] = []
    ): Promise<Prospecto> => {
        const base = { ...prospectoVacio(), ...data } as Prospecto;
        const payload = conDerivados(base, universo);
        // id y created_at los pone la DB
        delete (payload as Partial<Prospecto>).id;
        delete (payload as Partial<Prospecto>).created_at;
        delete (payload as Partial<Prospecto>).updated_at;

        const { data: created, error } = await supabase
            .from("prospectos")
            .insert(payload)
            .select()
            .single();
        if (error) throw error;
        return rowToProspecto(created as Record<string, unknown>);
    },

    update: async (
        id: string,
        cambios: Partial<Prospecto>,
        actual?: Prospecto,
        universo: Prospecto[] = []
    ): Promise<Prospecto> => {
        let payload: Partial<Prospecto> = { ...cambios };

        // Si cambió algo que afecta el score, recalcularlo con el prospecto completo.
        if (actual) {
            const fusionado = { ...actual, ...cambios } as Prospecto;
            const derivado = conDerivados(fusionado, universo);
            payload = { ...cambios, nivel_dato: derivado.nivel_dato, score: derivado.score };
            if (cambios.escaneo) payload.escaneo = derivado.escaneo;
        }
        delete (payload as Partial<Prospecto>).created_at;
        delete (payload as Partial<Prospecto>).updated_at;

        const { data: updated, error } = await supabase
            .from("prospectos")
            .update(payload)
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return rowToProspecto(updated as Record<string, unknown>);
    },

    delete: async (id: string): Promise<void> => {
        const { error } = await supabase.from("prospectos").delete().eq("id", id);
        if (error) throw error;
    },

    deleteMany: async (ids: string[]): Promise<void> => {
        if (ids.length === 0) return;
        const { error } = await supabase.from("prospectos").delete().in("id", ids);
        if (error) throw error;
    },

    /**
     * Alta masiva. Deduplica contra lo ya cargado por (negocio, ciudad) —
     * el índice único de la tabla es la última red, pero filtrar acá permite
     * informar cuántos se saltearon en vez de fallar el insert entero.
     */
    createBulk: async (
        items: Partial<Prospecto>[],
        universo: Prospecto[] = []
    ): Promise<ResultadoImportacion> => {
        const yaCargados = new Set(
            universo.map((p) => `${normalizar(p.negocio)}|${normalizar(p.ciudad)}`)
        );
        const vistosEnLote = new Set<string>();
        const limpios: Prospecto[] = [];
        let duplicados = 0;

        for (const item of items) {
            const base = { ...prospectoVacio(), ...item } as Prospecto;
            if (!base.negocio.trim()) { duplicados++; continue; }
            const clave = `${normalizar(base.negocio)}|${normalizar(base.ciudad)}`;
            if (yaCargados.has(clave) || vistosEnLote.has(clave)) { duplicados++; continue; }
            vistosEnLote.add(clave);

            const payload = conDerivados(base, universo);
            delete (payload as Partial<Prospecto>).id;
            delete (payload as Partial<Prospecto>).created_at;
            delete (payload as Partial<Prospecto>).updated_at;
            limpios.push(payload);
        }

        if (limpios.length === 0) return { insertados: [], duplicados, fallidos: [] };

        const insertados: Prospecto[] = [];
        const fallidos: { negocio: string; motivo: string }[] = [];

        // Chunks de 100 para no pasarse del límite de payload de PostgREST.
        for (let i = 0; i < limpios.length; i += 100) {
            const chunk = limpios.slice(i, i + 100);
            const { data, error } = await supabase.from("prospectos").insert(chunk).select();

            if (!error) {
                insertados.push(...(data || []).map((r) => rowToProspecto(r as Record<string, unknown>)));
                continue;
            }

            // Un solo registro conflictivo tumba el lote entero. En vez de perder las
            // 100 filas, se reintenta de a una para salvar las buenas y poder decir
            // exactamente cuál falló y por qué.
            const codigosDeFila = ["23505", "23503", "22P02", "23514"];
            const esProblemaDeFila = codigosDeFila.includes((error as { code?: string }).code || "");
            if (!esProblemaDeFila) throw error;

            for (const fila of chunk) {
                const { data: uno, error: errFila } = await supabase
                    .from("prospectos").insert(fila).select().single();
                if (errFila) {
                    if ((errFila as { code?: string }).code === "23505") duplicados++;
                    else fallidos.push({ negocio: fila.negocio, motivo: mensajeError(errFila) });
                } else if (uno) {
                    insertados.push(rowToProspecto(uno as Record<string, unknown>));
                }
            }
        }
        return { insertados, duplicados, fallidos };
    },

    /**
     * Comprueba que la tabla exista y que se pueda escribir en ella, y devuelve el
     * error crudo de Supabase. Sirve para no adivinar cuando una importación falla.
     */
    diagnosticar: async (): Promise<{ ok: boolean; detalle: string }> => {
        const { error: errLectura } = await supabase.from("prospectos").select("id").limit(1);
        if (errLectura) return { ok: false, detalle: `Lectura: ${mensajeError(errLectura)}` };

        const sonda = { ...prospectoVacio(), negocio: `__diagnostico_${Date.now()}`, ciudad: "__test" };
        const { data, error: errEscritura } = await supabase
            .from("prospectos").insert(sonda).select("id").single();
        if (errEscritura) return { ok: false, detalle: `Escritura: ${mensajeError(errEscritura)}` };

        if (data?.id) await supabase.from("prospectos").delete().eq("id", data.id);
        return { ok: true, detalle: "La tabla existe y acepta lectura y escritura." };
    },

    /** Recalcula el score de todos: el percentil de reseñas cambia al crecer la lista (§8). */
    recalcularScores: async (universo: Prospecto[]): Promise<Prospecto[]> => {
        const actualizados = universo.map((p) => conDerivados(p, universo));
        const cambiaron = actualizados.filter((p, i) => p.score !== universo[i].score || p.nivel_dato !== universo[i].nivel_dato);

        await Promise.all(
            cambiaron.map((p) =>
                supabase.from("prospectos").update({ score: p.score, nivel_dato: p.nivel_dato }).eq("id", p.id)
            )
        );
        return actualizados;
    },

    /** Trae los prospectos de una búsqueda del Scraper a la planilla (sin duplicar). */
    importarDesdeScraper: async (
        scrapeados: ProspectoScraped[],
        universo: Prospecto[] = [],
        sistema: Sistema = "galu"
    ): Promise<ResultadoImportacion> => {
        const items: Partial<Prospecto>[] = scrapeados.map((s) => {
            const webUrl = s.sitioWebUrl || s.redesSociales?.instagram || s.redesSociales?.facebook || "";
            return {
                sistema,
                negocio: s.nombre,
                rubro: s.rubro,
                ciudad: s.lugar,
                direccion: s.direccion,
                telefono: s.telefono || "",
                telefono_wa: s.telefonoClean || telefonoAWhatsapp(s.telefono || ""),
                whatsapp_publicado: !!s.telefonoClean,
                instagram_url: s.redesSociales?.instagram || "",
                sitio_web_url: s.sitioWebUrl || "",
                maps_url: s.mapsUrl || "",
                clasificacion_web: clasificarWebDesdeUrl(webUrl),
                canal: s.telefonoClean ? ("whatsapp" as const) : ("instagram" as const),
                rating: s.rating ?? null,
                reviews_count: s.reviewsCount ?? null,
                escaneo: { ...ESCANEO_VACIO },
                origen: "scraper" as const,
            };
        });
        return prospectosStore.createBulk(items, universo);
    },

    /** Pasa un prospecto trabajado al pipeline de clientes conservando el análisis. */
    convertirACliente: async (p: Prospecto): Promise<Cliente> => {
        const escaneo = normalizarEscaneo(p.escaneo);
        const debilidades = [
            escaneo.tiene_queja_cliente ? `Queja pública de un cliente: "${escaneo.queja_textual}"` : "",
            ...escaneo.fallas.map((f) => `Falla verificable: ${f}`),
        ].filter(Boolean);

        const cliente = await clientesStore.create({
            nombre: p.contacto_nombre || p.negocio,
            negocio: p.negocio,
            email: "",
            tel: p.telefono,
            canal: p.canal === "whatsapp" ? "WhatsApp (prospección en frío)" : "Instagram DM (prospección en frío)",
            etapa: "contactado" as EtapaCliente,
            info_investigacion: {
                que_hace: `${p.rubro}${p.especialidad ? ` — ${p.especialidad}` : ""} en ${p.ciudad}. ${p.direccion}`,
                puntos_debiles: debilidades.join("\n") || p.dato_usado,
                soluciones: "Revisión de una página: búsqueda real, volumen de demanda, arreglos gratis y qué haría falta.",
                enlace: p.sitio_web_url || p.instagram_url || p.maps_url || "",
                contexto: `Nivel del dato: ${p.nivel_dato ?? "s/d"} · Score ${p.score} · Dato usado: ${p.dato_usado}`,
            },
            msg_whatsapp: p.mensaje_enviado,
            notas_seguimiento: [
                {
                    id: `nota-${Date.now()}`,
                    fecha: new Date().toISOString().split("T")[0],
                    texto: `Viene de la planilla de prospección. Estado al convertir: ${p.estado}. Leyó: ${p.quien_leyo || "no sé"}.`,
                },
            ],
        });

        await prospectosStore.update(p.id, { estado: "cliente", cliente_id: cliente.id }, p);
        return cliente;
    },
};


