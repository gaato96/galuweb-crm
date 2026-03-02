// ============================================================
// Real Data Store — Connects to Supabase
// ============================================================
import { supabase } from "./supabase";
import {
    Cliente, Proyecto, Tarea, Cotizacion, Finanza, Brief, Recurso,
    EtapaCliente,
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
        const { data, error } = await supabase.from("tareas").select("*").is("proyecto_id", null).order("created_at", { ascending: false });
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
