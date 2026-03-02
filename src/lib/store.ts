// ============================================================
// Mock Data Store — Replaces Supabase until connected
// Uses localStorage for persistence across page reloads
// ============================================================
import {
    Cliente, Proyecto, Tarea, Cotizacion, Finanza, Brief, Recurso,
    EtapaCliente, EstadoTarea, Prioridad, CategoriaTarea, TipoProyecto,
    EstadoProyecto, EstadoCotizacion, TipoFinanza, TipoRecurso,
} from "./types";

function generateId(): string {
    return crypto.randomUUID();
}

// --- Storage Helper ---
function getStore<T>(key: string, fallback: T[]): T[] {
    if (typeof window === "undefined") return fallback;
    try {
        const data = localStorage.getItem(`nexus_${key}`);
        return data ? JSON.parse(data) : fallback;
    } catch {
        return fallback;
    }
}

function setStore<T>(key: string, data: T[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem(`nexus_${key}`, JSON.stringify(data));
}

// --- Seed Data ---
const SEED_CLIENTES: Cliente[] = [
    {
        id: "c1", created_at: "2026-01-15T10:00:00Z", nombre: "Carlos Méndez", negocio: "Restaurante El Sabor",
        email: "carlos@elsabor.com", tel: "+5491155001234", canal: "Instagram",
        etapa: "investigando",
        info_investigacion: { que_hace: "Restaurante de comida argentina con delivery", puntos_debiles: "No tiene presencia online, pierde clientes ante competidores con web", soluciones: "Landing page con menú digital + botón de WhatsApp para pedidos" },
        msg_whatsapp: "", notas_seguimiento: [],
    },
    {
        id: "c2", created_at: "2026-01-20T14:00:00Z", nombre: "María García", negocio: "Estudio Jurídico García",
        email: "maria@garcia-abogados.com", tel: "+5491155005678", canal: "Referido",
        etapa: "calificado",
        info_investigacion: { que_hace: "Estudio de abogados especializado en derecho laboral", puntos_debiles: "Web obsoleta, no genera consultas", soluciones: "Web institucional profesional + formulario de consulta + blog SEO" },
        msg_whatsapp: "", notas_seguimiento: [],
    },
    {
        id: "c3", created_at: "2026-02-01T09:00:00Z", nombre: "Lucas Torres", negocio: "TechStore Online",
        email: "lucas@techstore.com.ar", tel: "+5491155009012", canal: "Google",
        etapa: "cliente_actual",
        info_investigacion: { que_hace: "Tienda de electrónica y accesorios tech", puntos_debiles: "Vende solo por MercadoLibre, necesita canal propio", soluciones: "Ecommerce completo con pasarela de pago" },
        msg_whatsapp: "", notas_seguimiento: [{ id: "n1", fecha: "2026-02-05", texto: "Reunión inicial realizada, muy interesado" }],
    },
    {
        id: "c4", created_at: "2026-02-10T11:00:00Z", nombre: "Ana Rodríguez", negocio: "Yoga Flow Studio",
        email: "ana@yogaflow.com", tel: "+5491155003456", canal: "Instagram",
        etapa: "contacto",
        info_investigacion: null, msg_whatsapp: "", notas_seguimiento: [],
    },
    {
        id: "c5", created_at: "2026-02-15T16:00:00Z", nombre: "Pedro Sánchez", negocio: "Constructora PS",
        email: "pedro@constructoraps.com", tel: "+5491155007890", canal: "LinkedIn",
        etapa: "cotizado",
        info_investigacion: { que_hace: "Constructora de viviendas residenciales", puntos_debiles: "No muestra portfolio de obras online", soluciones: "Web institucional con galería de proyectos y formulario" },
        msg_whatsapp: "", notas_seguimiento: [{ id: "n2", fecha: "2026-02-20", texto: "Cotización enviada, esperando respuesta" }],
    },
    {
        id: "c6", created_at: "2025-11-01T10:00:00Z", nombre: "Sofía Herrera", negocio: "Boutique Bella",
        email: "sofia@boutiquebella.com", tel: "+5491155004321", canal: "Referido",
        etapa: "cliente_finalizado",
        info_investigacion: { que_hace: "Boutique de ropa femenina", puntos_debiles: "Solo vendía en local físico", soluciones: "Ecommerce con catálogo y pagos online" },
        msg_whatsapp: "", notas_seguimiento: [],
    },
];

const SEED_PROYECTOS: Proyecto[] = [
    {
        id: "p1", created_at: "2026-02-05T10:00:00Z", cliente_id: "c3", nombre: "TechStore Ecommerce",
        tipo_proyecto: "ecommerce", figma_url: "https://figma.com/file/example", calendly_url: "https://calendly.com/agencia/reunion",
        slug_portal: "techstore-ecommerce", estado: "activo",
    },
    {
        id: "p2", created_at: "2025-11-15T10:00:00Z", cliente_id: "c6", nombre: "Boutique Bella Tienda",
        tipo_proyecto: "ecommerce", figma_url: "", calendly_url: "",
        slug_portal: "boutique-bella", estado: "finalizado",
    },
];

const SEED_TAREAS: Tarea[] = [
    { id: "t1", created_at: "2026-02-05T10:00:00Z", proyecto_id: "p1", titulo: "Configurar Plataforma Ecommerce", descripcion: "", prioridad: "alta", estado: "completada", categoria: "dev" },
    { id: "t2", created_at: "2026-02-05T10:00:00Z", proyecto_id: "p1", titulo: "Diseño UI/UX Tienda en Figma", descripcion: "", prioridad: "alta", estado: "en_progreso", categoria: "diseno" },
    { id: "t3", created_at: "2026-02-05T10:00:00Z", proyecto_id: "p1", titulo: "Carga de Catálogo de Productos", descripcion: "", prioridad: "alta", estado: "pendiente", categoria: "contenido" },
    { id: "t4", created_at: "2026-02-05T10:00:00Z", proyecto_id: "p1", titulo: "Configurar Pasarela de Pago", descripcion: "", prioridad: "alta", estado: "pendiente", categoria: "dev" },
    { id: "t5", created_at: "2026-02-05T10:00:00Z", proyecto_id: "p1", titulo: "Optimización SEO Productos", descripcion: "", prioridad: "media", estado: "pendiente", categoria: "seo" },
    { id: "t6", created_at: "2026-02-20T10:00:00Z", proyecto_id: null, titulo: "Crear contenido para Instagram", descripcion: "Post carrusel sobre diseño web trends 2026", prioridad: "media", estado: "pendiente", categoria: "marketing" },
    { id: "t7", created_at: "2026-02-21T10:00:00Z", proyecto_id: null, titulo: "Configurar campaña Google Ads", descripcion: "Campaña de búsqueda para captar leads", prioridad: "alta", estado: "pendiente", categoria: "marketing" },
];

const SEED_COTIZACIONES: Cotizacion[] = [
    {
        id: "q1", created_at: "2026-02-15T10:00:00Z", cliente_id: "c5",
        total: 2500, items: [
            { descripcion: "Diseño UI/UX Web Institucional", precio: 800 },
            { descripcion: "Desarrollo Frontend Responsive", precio: 1000 },
            { descripcion: "Optimización SEO", precio: 400 },
            { descripcion: "Hosting y Dominio (1 año)", precio: 300 },
        ],
        estado: "enviada", pdf_url: "", notas: "Web institucional con galería de proyectos",
    },
    {
        id: "q2", created_at: "2026-02-01T10:00:00Z", cliente_id: "c3",
        total: 4500, items: [
            { descripcion: "Diseño UI/UX Ecommerce", precio: 1200 },
            { descripcion: "Desarrollo Tienda Completa", precio: 2000 },
            { descripcion: "Pasarela de Pagos", precio: 500 },
            { descripcion: "SEO + Analytics", precio: 500 },
            { descripcion: "Hosting y Dominio", precio: 300 },
        ],
        estado: "aceptada", pdf_url: "", notas: "Ecommerce para TechStore",
    },
];

const SEED_FINANZAS: Finanza[] = [
    { id: "f1", created_at: "2026-02-05T10:00:00Z", proyecto_id: "p1", monto: 2250, tipo: "ingreso", cuotas_totales: 2, cuota_actual: 1, fecha_cobro: "2026-02-05", descripcion: "TechStore Ecommerce — Cuota 1/2" },
    { id: "f2", created_at: "2026-02-05T10:00:00Z", proyecto_id: "p1", monto: 2250, tipo: "ingreso", cuotas_totales: 2, cuota_actual: 2, fecha_cobro: "2026-03-15", descripcion: "TechStore Ecommerce — Cuota 2/2" },
    { id: "f3", created_at: "2026-02-10T10:00:00Z", proyecto_id: null, monto: 500, tipo: "ads", cuotas_totales: 1, cuota_actual: 1, fecha_cobro: "2026-02-10", descripcion: "Google Ads — Febrero" },
    { id: "f4", created_at: "2026-02-01T10:00:00Z", proyecto_id: null, monto: 50, tipo: "herramienta", cuotas_totales: 1, cuota_actual: 1, fecha_cobro: "2026-02-01", descripcion: "Figma Pro — Mensual" },
];

const SEED_BRIEFS: Brief[] = [
    {
        id: "b1", created_at: "2026-02-02T10:00:00Z", cliente_id: "c3",
        respuestas: [
            { pregunta: "¿Cuál es el objetivo principal del sitio web?", respuesta: "Vender productos de tecnología online sin depender de MercadoLibre" },
            { pregunta: "¿Quién es su público objetivo?", respuesta: "Jóvenes 18-35 años, gamers y entusiastas tech" },
            { pregunta: "¿Cuáles son sus principales competidores?", respuesta: "CompraGamer, Gezatek, FullH4rd" },
            { pregunta: "¿Tiene preferencias de colores?", respuesta: "Colores oscuros, negro con acentos en azul eléctrico" },
        ],
    },
];

const SEED_RECURSOS: Recurso[] = [
    { id: "r1", created_at: "2026-01-10T10:00:00Z", titulo: "Awwwards — Inspiración Web", url: "https://www.awwwards.com", tipo: "inspiracion", tags: ["inspiracion", "diseño"], descripcion: "Galería de los mejores diseños web del mundo" },
    { id: "r2", created_at: "2026-01-15T10:00:00Z", titulo: "Figma Community", url: "https://www.figma.com/community", tipo: "plugin", tags: ["figma", "plugins"], descripcion: "Plugins y templates gratuitos de Figma" },
    { id: "r3", created_at: "2026-01-20T10:00:00Z", titulo: "Curso Next.js Completo", url: "https://www.youtube.com/watch?v=example", tipo: "curso", tags: ["curso", "nextjs", "dev"], descripcion: "Curso completo de Next.js 14 en español" },
];

// ============================================================
// CRUD Operations (localStorage-backed)
// ============================================================

// Generic helpers
function getAll<T>(key: string, seed: T[]): T[] {
    return getStore<T>(key, seed);
}

function getById<T extends { id: string }>(key: string, seed: T[], id: string): T | undefined {
    return getAll(key, seed).find((item) => item.id === id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function create<T extends { id: string }>(key: string, seed: T[], item: any) {
    const all = getAll(key, seed);
    const newItem = { ...item, id: generateId(), created_at: new Date().toISOString() } as T;
    all.push(newItem);
    setStore(key, all);
    return newItem;
}

function update<T extends { id: string }>(key: string, seed: T[], id: string, updates: Partial<T>): T | undefined {
    const all = getAll(key, seed);
    const idx = all.findIndex((item) => item.id === id);
    if (idx === -1) return undefined;
    all[idx] = { ...all[idx], ...updates };
    setStore(key, all);
    return all[idx];
}

function remove<T extends { id: string }>(key: string, seed: T[], id: string): boolean {
    const all = getAll(key, seed);
    const filtered = all.filter((item) => item.id !== id);
    if (filtered.length === all.length) return false;
    setStore(key, filtered);
    return true;
}

// --- Clientes ---
export const clientesStore = {
    getAll: () => getAll<Cliente>("clientes", SEED_CLIENTES),
    getById: (id: string) => getById("clientes", SEED_CLIENTES, id),
    create: (data: Omit<Cliente, "id" | "created_at">) => create("clientes", SEED_CLIENTES, data),
    update: (id: string, data: Partial<Cliente>) => update("clientes", SEED_CLIENTES, id, data),
    delete: (id: string) => remove("clientes", SEED_CLIENTES, id),
    getByEtapa: (etapa: EtapaCliente) => getAll<Cliente>("clientes", SEED_CLIENTES).filter((c) => c.etapa === etapa),
};

// --- Proyectos ---
export const proyectosStore = {
    getAll: () => getAll<Proyecto>("proyectos", SEED_PROYECTOS),
    getById: (id: string) => getById("proyectos", SEED_PROYECTOS, id),
    getByCliente: (clienteId: string) => getAll<Proyecto>("proyectos", SEED_PROYECTOS).filter((p) => p.cliente_id === clienteId),
    create: (data: Omit<Proyecto, "id" | "created_at">) => create("proyectos", SEED_PROYECTOS, data),
    update: (id: string, data: Partial<Proyecto>) => update("proyectos", SEED_PROYECTOS, id, data),
    delete: (id: string) => remove("proyectos", SEED_PROYECTOS, id),
};

// --- Tareas ---
export const tareasStore = {
    getAll: () => getAll<Tarea>("tareas", SEED_TAREAS),
    getById: (id: string) => getById("tareas", SEED_TAREAS, id),
    getByProyecto: (proyectoId: string) => getAll<Tarea>("tareas", SEED_TAREAS).filter((t) => t.proyecto_id === proyectoId),
    getMarketing: () => getAll<Tarea>("tareas", SEED_TAREAS).filter((t) => !t.proyecto_id && (t.categoria === "marketing" || t.categoria === "contenido")),
    create: (data: Omit<Tarea, "id" | "created_at">) => create("tareas", SEED_TAREAS, data),
    update: (id: string, data: Partial<Tarea>) => update("tareas", SEED_TAREAS, id, data),
    delete: (id: string) => remove("tareas", SEED_TAREAS, id),
    createBulk: (items: Omit<Tarea, "id" | "created_at">[]) => {
        const all = getAll<Tarea>("tareas", SEED_TAREAS);
        const newItems = items.map((item) => ({ ...item, id: generateId(), created_at: new Date().toISOString() }) as Tarea);
        all.push(...newItems);
        setStore("tareas", all);
        return newItems;
    },
};

// --- Cotizaciones ---
export const cotizacionesStore = {
    getAll: () => getAll<Cotizacion>("cotizaciones", SEED_COTIZACIONES),
    getById: (id: string) => getById("cotizaciones", SEED_COTIZACIONES, id),
    getByCliente: (clienteId: string) => getAll<Cotizacion>("cotizaciones", SEED_COTIZACIONES).filter((c) => c.cliente_id === clienteId),
    create: (data: Omit<Cotizacion, "id" | "created_at">) => create("cotizaciones", SEED_COTIZACIONES, data),
    update: (id: string, data: Partial<Cotizacion>) => update("cotizaciones", SEED_COTIZACIONES, id, data),
    delete: (id: string) => remove("cotizaciones", SEED_COTIZACIONES, id),
};

// --- Finanzas ---
export const finanzasStore = {
    getAll: () => getAll<Finanza>("finanzas", SEED_FINANZAS),
    getById: (id: string) => getById("finanzas", SEED_FINANZAS, id),
    create: (data: Omit<Finanza, "id" | "created_at">) => create("finanzas", SEED_FINANZAS, data),
    update: (id: string, data: Partial<Finanza>) => update("finanzas", SEED_FINANZAS, id, data),
    delete: (id: string) => remove("finanzas", SEED_FINANZAS, id),
};

// --- Briefs ---
export const briefsStore = {
    getAll: () => getAll<Brief>("briefs", SEED_BRIEFS),
    getById: (id: string) => getById("briefs", SEED_BRIEFS, id),
    getByCliente: (clienteId: string) => getAll<Brief>("briefs", SEED_BRIEFS).find((b) => b.cliente_id === clienteId),
    create: (data: Omit<Brief, "id" | "created_at">) => create("briefs", SEED_BRIEFS, data),
    update: (id: string, data: Partial<Brief>) => update("briefs", SEED_BRIEFS, id, data),
    delete: (id: string) => remove("briefs", SEED_BRIEFS, id),
};

// --- Recursos ---
export const recursosStore = {
    getAll: () => getAll<Recurso>("recursos", SEED_RECURSOS),
    getById: (id: string) => getById("recursos", SEED_RECURSOS, id),
    create: (data: Omit<Recurso, "id" | "created_at">) => create("recursos", SEED_RECURSOS, data),
    update: (id: string, data: Partial<Recurso>) => update("recursos", SEED_RECURSOS, id, data),
    delete: (id: string) => remove("recursos", SEED_RECURSOS, id),
};
