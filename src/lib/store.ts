// ============================================================
// Real Data Store — Connects to Supabase
// ============================================================
import { supabase } from "./supabase";
import {
    Cliente, Proyecto, Tarea, Cotizacion, Finanza, Brief, Recurso,
    EtapaCliente, Infraestructura, TicketSoporte, LogProyecto
} from "./types";

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
    getAll: async (): Promise<Tarea[]> => {
        const { data, error } = await supabase.from("tareas").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
    },
    getById: async (id: string): Promise<Tarea | null> => {
        const { data, error } = await supabase.from("tareas").select("*").eq("id", id).single();
        if (error) return null;
        return data;
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
        const { data: updated, error } = await supabase.from("tareas").update(data).eq("id", id).select().single();
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
};

// --- Logs de Proyecto (Changelog / Seguimiento) ---
export const logsProyectoStore = {
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

