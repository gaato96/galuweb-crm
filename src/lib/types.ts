// ============================================================
// Galu-CRM TypeScript Types
// ============================================================

// --- Enums ---
export type EtapaCliente =
    | "contacto"
    | "investigando"
    | "calificado"
    | "contactado"
    | "cotizado"
    | "cliente_actual"
    | "cliente_finalizado";

export type TipoProyecto = "landing" | "institucional" | "ecommerce";
export type EstadoProyecto = "activo" | "pausado" | "finalizado";

export type Prioridad = "baja" | "media" | "alta";
export type EstadoTarea = "pendiente" | "en_progreso" | "completada";
export type CategoriaTarea = "diseno" | "dev" | "marketing" | "contenido" | "seo" | "otro";

export type EstadoCotizacion = "borrador" | "enviada" | "aceptada" | "rechazada";
export type TipoFinanza = "ingreso" | "ads" | "gasto" | "herramienta";
export type TipoRecurso = "link" | "video" | "archivo" | "curso" | "plugin" | "inspiracion";

// --- Database Models ---
export interface Cliente {
    id: string;
    created_at: string;
    nombre: string;
    negocio: string;
    email: string;
    tel: string;
    canal: string;
    etapa: EtapaCliente;
    info_investigacion: InfoInvestigacion | null;
    msg_whatsapp: string;
    notas_seguimiento: NotaSeguimiento[];
}

export interface InfoInvestigacion {
    que_hace: string;
    puntos_debiles: string;
    soluciones: string;
}

export interface NotaSeguimiento {
    id: string;
    fecha: string;
    texto: string;
}

export interface Proyecto {
    id: string;
    created_at: string;
    cliente_id: string;
    nombre: string;
    tipo_proyecto: TipoProyecto;
    figma_url: string;
    calendly_url: string;
    slug_portal: string;
    estado: EstadoProyecto;
    cliente?: Cliente;
}

export interface Tarea {
    id: string;
    created_at: string;
    proyecto_id: string | null;
    titulo: string;
    descripcion: string;
    prioridad: Prioridad;
    estado: EstadoTarea;
    categoria: CategoriaTarea;
    proyecto?: Proyecto;
}

export interface CotizacionItem {
    descripcion: string;
    precio: number;
}

export interface Cotizacion {
    id: string;
    created_at: string;
    cliente_id: string;
    total: number;
    items: CotizacionItem[];
    estado: EstadoCotizacion;
    pdf_url: string;
    notas: string;
    cliente?: Cliente;
}

export interface Finanza {
    id: string;
    created_at: string;
    proyecto_id: string | null;
    monto: number;
    tipo: TipoFinanza;
    cuotas_totales: number;
    cuota_actual: number;
    fecha_cobro: string;
    descripcion: string;
    proyecto?: Proyecto;
}

export interface BriefRespuesta {
    pregunta: string;
    respuesta: string;
}

export interface Brief {
    id: string;
    created_at: string;
    cliente_id: string;
    respuestas: BriefRespuesta[];
    cliente?: Cliente;
}

export interface Recurso {
    id: string;
    created_at: string;
    titulo: string;
    url: string;
    tipo: TipoRecurso;
    tags: string[];
    descripcion: string;
}

// --- UI Helpers ---
export const ETAPA_LABELS: Record<EtapaCliente, string> = {
    contacto: "Contacto",
    investigando: "Investigando",
    calificado: "Calificado",
    contactado: "Contactado",
    cotizado: "Cotizado",
    cliente_actual: "Cliente Actual",
    cliente_finalizado: "Finalizado",
};

export const ETAPA_COLORS: Record<EtapaCliente, string> = {
    contacto: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    investigando: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    calificado: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    contactado: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    cotizado: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    cliente_actual: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    cliente_finalizado: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export const PRIORIDAD_COLORS: Record<Prioridad, string> = {
    baja: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    media: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    alta: "bg-rose-500/20 text-rose-300 border-rose-500/30",
};

export const ESTADO_TAREA_COLORS: Record<EstadoTarea, string> = {
    pendiente: "bg-slate-500/20 text-slate-300",
    en_progreso: "bg-blue-500/20 text-blue-300",
    completada: "bg-emerald-500/20 text-emerald-300",
};

export const FASES_PIPELINE = {
    prospeccion: ["contacto", "investigando"] as EtapaCliente[],
    clasificacion: ["calificado", "contactado", "cotizado"] as EtapaCliente[],
    cierre: ["cliente_actual", "cliente_finalizado"] as EtapaCliente[],
};
