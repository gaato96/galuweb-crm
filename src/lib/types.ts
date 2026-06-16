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
    | "cliente_finalizado"
    | "no_interesado";

export type TipoProyecto = "landing" | "institucional" | "ecommerce" | "webapp" | "saas";
export type EstadoProyecto = "activo" | "pausado" | "finalizado";

export type Prioridad = "baja" | "media" | "alta";
export type EstadoTarea = "pendiente" | "en_progreso" | "completada";
export type CategoriaTarea = "diseno" | "dev" | "marketing" | "contenido" | "seo" | "otro";
export type BloqueTarea = "construccion" | "crecimiento";

export type EstadoCotizacion = "borrador" | "enviada" | "aceptada" | "rechazada";
export type TipoCotizacion = "web" | "webapp";
export type TipoFinanza = "ingreso" | "ads" | "gasto" | "herramienta";
export type TipoRecurso = "link" | "video" | "archivo" | "curso" | "plugin" | "inspiracion";

export type TipoInfraestructura = "hosting" | "dominio";
export type EstadoTicket = "abierto" | "en_progreso" | "resuelto";

// --- Fases de Proyecto ---
export interface FaseProyecto {
    nombre: string;
    completada: boolean;
}

export interface FaseConfig {
    nombre: string;
    descripcion: string;
    tareas: { titulo: string; categoria: CategoriaTarea; prioridad: Prioridad; descripcion?: string }[];
}

export const FASES_POR_TIPO: Record<TipoProyecto, FaseConfig[]> = {
    landing: [
        { nombre: "Investigación", descripcion: "Entender el negocio, competidores y objetivo de la Landing.", tareas: [{ titulo: "Reunión de Kickoff / Briefing", categoria: "otro", prioridad: "alta" }, { titulo: "Análisis de competidores y mercado", categoria: "seo", prioridad: "media" }] },
        { nombre: "Diseño", descripcion: "Bocetos, wireframes y diseño de alta fidelidad.", tareas: [{ titulo: "Crear Wireframes", categoria: "diseno", prioridad: "alta" }, { titulo: "Diseño UI en Figma", categoria: "diseno", prioridad: "alta" }, { titulo: "Definir Copywriting", categoria: "contenido", prioridad: "alta" }] },
        { nombre: "Desarrollo", descripcion: "Maquetación e implementación técnica.", tareas: [{ titulo: "Maquetación Responsive", categoria: "dev", prioridad: "alta" }, { titulo: "Integraciones (Mailchimp/Forms)", categoria: "dev", prioridad: "media" }] },
        { nombre: "Revisión del Cliente", descripcion: "Feedback y ajustes sobre el sitio funcional.", tareas: [{ titulo: "Presentar versión inicial", categoria: "otro", prioridad: "media" }, { titulo: "Aplicar correcciones de cliente", categoria: "dev", prioridad: "media" }] },
        { nombre: "Lanzamiento", descripcion: "Puesta en marcha en dominio oficial.", tareas: [{ titulo: "Configuración de Dominio/DNS", categoria: "dev", prioridad: "alta" }, { titulo: "Configurar Analytics / Píxeles", categoria: "seo", prioridad: "media" }] },
        { nombre: "Post-entrega", descripcion: "Soporte, recolección de feedback y cierre.", tareas: [{ titulo: "Enviar tutorial de uso", categoria: "otro", prioridad: "media" }] }
    ],
    institucional: [
        { nombre: "Investigación", descripcion: "Análisis en profundidad del modelo de negocio.", tareas: [{ titulo: "Reunión de Briefing", categoria: "otro", prioridad: "alta" }, { titulo: "Análisis de Competencia", categoria: "seo", prioridad: "alta" }] },
        { nombre: "Arquitectura", descripcion: "Definición de mapa de sitio y flujos.", tareas: [{ titulo: "Crear Sitemap", categoria: "seo", prioridad: "alta" }, { titulo: "Estructurar contenidos base", categoria: "contenido", prioridad: "media" }] },
        { nombre: "Diseño", descripcion: "Identidad visual y diseño UI.", tareas: [{ titulo: "Diseño UI de Home", categoria: "diseno", prioridad: "alta" }, { titulo: "Diseño UI de páginas internas", categoria: "diseno", prioridad: "alta" }] },
        { nombre: "Desarrollo", descripcion: "Implementación en CMS o código.", tareas: [{ titulo: "Desarrollo de Home", categoria: "dev", prioridad: "alta" }, { titulo: "Desarrollo de páginas internas", categoria: "dev", prioridad: "alta" }, { titulo: "Configuración de Blog / CMS", categoria: "dev", prioridad: "media" }] },
        { nombre: "SEO On-page", descripcion: "Optimización de motores de búsqueda.", tareas: [{ titulo: "Optimización Meta Tags y H1", categoria: "seo", prioridad: "alta" }, { titulo: "Optimización de imágenes (WebP, Alt)", categoria: "seo", prioridad: "media" }] },
        { nombre: "Revisión", descripcion: "QA interno y feedback del cliente.", tareas: [{ titulo: "Testing Multi-Device", categoria: "dev", prioridad: "alta" }, { titulo: "Revisión de textos y links", categoria: "contenido", prioridad: "media" }] },
        { nombre: "Lanzamiento", descripcion: "Puesta en producción oficial.", tareas: [{ titulo: "Migración a dominio final", categoria: "dev", prioridad: "alta" }, { titulo: "Indexación en Google Search Console", categoria: "seo", prioridad: "alta" }] },
        { nombre: "Post-entrega", descripcion: "Mantenimiento y soporte inicial.", tareas: [{ titulo: "Entrega de accesos", categoria: "otro", prioridad: "alta" }, { titulo: "Envío de video tutoriales", categoria: "otro", prioridad: "media" }] }
    ],
    ecommerce: [
        { nombre: "Investigación", descripcion: "Estudio de productos, logística y pagos.", tareas: [{ titulo: "Reunión levantamiento requerimientos", categoria: "otro", prioridad: "alta" }] },
        { nombre: "Diseño", descripcion: "UI orientada a conversión de ventas.", tareas: [{ titulo: "Diseño Home y Categorías", categoria: "diseno", prioridad: "alta" }, { titulo: "Diseño Ficha de Producto y Checkout", categoria: "diseno", prioridad: "alta" }] },
        { nombre: "Catálogo de Productos", descripcion: "Carga de categorías, variables y stock.", tareas: [{ titulo: "Importación de catálogo base", categoria: "dev", prioridad: "alta" }, { titulo: "Optimización imágenes productos", categoria: "diseno", prioridad: "media" }] },
        { nombre: "Pasarela de Pago", descripcion: "Integración de MercadoPago, Stripe, envíos.", tareas: [{ titulo: "Integrar pasarelas de pago", categoria: "dev", prioridad: "alta" }, { titulo: "Configurar métodos y zonas de envío", categoria: "dev", prioridad: "alta" }] },
        { nombre: "Desarrollo", descripcion: "Construcción completa de la tienda.", tareas: [{ titulo: "Desarrollo completo de la tienda", categoria: "dev", prioridad: "alta" }, { titulo: "Configuración de emails transaccionales", categoria: "dev", prioridad: "media" }] },
        { nombre: "Testing", descripcion: "Prueba de embudo de ventas y fallos.", tareas: [{ titulo: "Pruebas de compras reales", categoria: "dev", prioridad: "alta" }, { titulo: "Pruebas en móvil/tablet", categoria: "dev", prioridad: "alta" }] },
        { nombre: "Lanzamiento", descripcion: "Publicación y apertura de tienda.", tareas: [{ titulo: "Apertura oficial / DNS", categoria: "dev", prioridad: "alta" }, { titulo: "Configurar Google Analytics 4 Ecommerce", categoria: "seo", prioridad: "media" }] },
        { nombre: "Post-entrega", descripcion: "Capacitación en gestión de inventario.", tareas: [{ titulo: "Capacitación de gestión de tienda", categoria: "otro", prioridad: "alta" }] }
    ],
    webapp: [
        { nombre: "Investigación", descripcion: "Levantamiento de módulos y lógica de negocio.", tareas: [{ titulo: "Especificación de Requerimientos", categoria: "otro", prioridad: "alta" }, { titulo: "Definir casos de uso principales", categoria: "otro", prioridad: "alta" }] },
        { nombre: "Arquitectura del Sistema", descripcion: "Base de datos y estructura de servidor.", tareas: [{ titulo: "Diseño esquema Base de Datos", categoria: "dev", prioridad: "alta" }, { titulo: "Definir Stack y Repositorio", categoria: "dev", prioridad: "alta" }] },
        { nombre: "UX/UI", descripcion: "Flujos de usuario y diseño funcional.", tareas: [{ titulo: "Crear Wireframes Módulos Core", categoria: "diseno", prioridad: "alta" }, { titulo: "Diseño de Sistema de Componentes (Design System)", categoria: "diseno", prioridad: "media" }] },
        { nombre: "Autenticación", descripcion: "Sistemas de Login y Control de Sesión.", tareas: [{ titulo: "Setup Supabase/Auth", categoria: "dev", prioridad: "alta" }, { titulo: "Protección de Rutas Principales", categoria: "dev", prioridad: "alta" }] },
        { nombre: "Módulos Core", descripcion: "Desarrollo de las funcionalidades transaccionales.", tareas: [{ titulo: "Desarrollo CRUD principal", categoria: "dev", prioridad: "alta" }, { titulo: "Integración frontend con APIs/Base de datos", categoria: "dev", prioridad: "alta" }] },
        { nombre: "Testing QA", descripcion: "Validación de lógica de negocio y seguridad.", tareas: [{ titulo: "Pruebas de Regresión manuales", categoria: "dev", prioridad: "alta" }, { titulo: "Validación de Roles de Seguridad (RLS)", categoria: "dev", prioridad: "alta" }] },
        { nombre: "Deploy", descripcion: "Despliegue a infraestructura (Ej: Vercel, VPS).", tareas: [{ titulo: "Configuración de CI/CD", categoria: "dev", prioridad: "alta" }, { titulo: "Ajuste de variables de entorno", categoria: "dev", prioridad: "alta" }] },
        { nombre: "Documentación", descripcion: "Manuales técnicos o de usuario final.", tareas: [{ titulo: "Redactar uso de módulos", categoria: "contenido", prioridad: "media" }] },
        { nombre: "Iteración", descripcion: "Soporte y nuevas versiones post-feedback.", tareas: [{ titulo: "Recolectar feedback primera semana", categoria: "otro", prioridad: "media" }] }
    ],
    saas: [
        { nombre: "Investigación", descripcion: "Estudio de Target, MVP y Funcionalidades.", tareas: [{ titulo: "Definir core del MVP", categoria: "otro", prioridad: "alta" }, { titulo: "Investigación de competidores SaaS", categoria: "otro", prioridad: "media" }] },
        { nombre: "Arquitectura del Sistema", descripcion: "DB Multi-tenant o escalable.", tareas: [{ titulo: "Diseño DB Multi-Tenant", categoria: "dev", prioridad: "alta" }, { titulo: "Definir endpoints principales", categoria: "dev", prioridad: "alta" }] },
        { nombre: "UX/UI", descripcion: "Diseño base de la plataforma y dashboard.", tareas: [{ titulo: "Diseño Sidebar/Navegación Típica SaaS", categoria: "diseno", prioridad: "alta" }, { titulo: "Sistema de Notificaciones", categoria: "diseno", prioridad: "media" }] },
        { nombre: "Autenticación & Roles", descripcion: "Registro, login y permisos.", tareas: [{ titulo: "Registro de Org/Workspaces", categoria: "dev", prioridad: "alta" }, { titulo: "Invitación de usuarios a workspaces", categoria: "dev", prioridad: "media" }] },
        { nombre: "Módulos Core", descripcion: "Desarrollo del feature que da valor al SaaS.", tareas: [{ titulo: "Desarrollo principal MVP", categoria: "dev", prioridad: "alta" }, { titulo: "Gestión de estado global (Zustand/Context)", categoria: "dev", prioridad: "media" }] },
        { nombre: "Facturación/Membresías", descripcion: "Integración de pagos recurrentes (Stripe).", tareas: [{ titulo: "Integración Stripe Checkout", categoria: "dev", prioridad: "alta" }, { titulo: "Webhooks para cancelación/reactivación", categoria: "dev", prioridad: "alta" }] },
        { nombre: "Testing QA", descripcion: "Pruebas integrales exhaustivas.", tareas: [{ titulo: "Testing ciclo completo de pago", categoria: "dev", prioridad: "alta" }, { titulo: "Pruebas de Límites de Membresía", categoria: "dev", prioridad: "alta" }] },
        { nombre: "Deploy Producción", descripcion: "Despliegue robusto.", tareas: [{ titulo: "Deploy final a producción", categoria: "dev", prioridad: "alta" }, { titulo: "Configurar logs de errores (Sentry)", categoria: "dev", prioridad: "media" }] },
        { nombre: "Onboarding", descripcion: "Flujos iniciales de clientes nuevos.", tareas: [{ titulo: "Crear steps iniciales de setup", categoria: "diseno", prioridad: "media" }, { titulo: "Correos transaccionales de bienvenida", categoria: "contenido", prioridad: "media" }] },
        { nombre: "Iteración Continua", descripcion: "Monitoreo y roadmap.", tareas: [{ titulo: "Lanzar a redes / Product Hunt", categoria: "marketing", prioridad: "media" }] }
    ],
};

// --- Log de Proyecto (Changelog/Seguimiento) ---
export interface LogProyecto {
    id: string;
    created_at: string;
    proyecto_id: string;
    titulo: string;
    descripcion: string;
    fecha: string;
}

// --- Especificaciones Web App para Cotizaciones ---
export interface EspecificacionesWebApp {
    modulos: string[];
    cantidad_usuarios: string;
    roles: string;
    integraciones: string;
    plataforma: string;
    modelo_negocio: string;
    notas_tecnicas: string;
}

// --- Secciones del PDF de Cotización (texto libre por sección) ---
export interface SeccionesPDF {
    descripcion: string;         // 01. Descripción del proyecto / sistema
    alcance: string;             // 02. Alcance / Módulos y funcionalidades
    arquitectura?: string;       // 03. (Web App) Arquitectura y Tecnología
    cronograma: string;          // 04. Cronograma / Plan de desarrollo
    terminos: string;            // 05. Términos y modelo de pago
    proximos_pasos: string;      // 06. Próximos pasos
    conclusion?: string;         // (solo Web) Conclusión / cierre persuasivo
}

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
    pdf_cotizacion_url?: string;
    mantenimiento_mensual?: boolean;
    link_demo?: string;
}

export interface InfoInvestigacion {
    que_hace: string;
    puntos_debiles: string;
    soluciones: string;
    enlace?: string;
    contexto?: string;
    colores?: string;
    tipografia?: string;
    logo_url?: string;
    prompt_maestro?: string;
    tipo_pagina?: TipoProyecto;
    analisis_impacto?: string;
    solucion_tecnica?: string;
    guion_demo?: string;
}

export interface NotaSeguimiento {
    id: string;
    fecha: string;
    texto: string;
}

export interface Proyecto {
    id: string;
    created_at: string;
    cliente_id: string | null;
    nombre: string;
    tipo_proyecto: TipoProyecto;
    figma_url: string;
    calendly_url: string;
    slug_portal: string;
    contrato_url?: string;
    estado: EstadoProyecto;
    descripcion: string;
    fecha_entrega?: string;
    es_interno: boolean;
    accesos: { servicio: string; url: string; usuario: string; password: string; }[];
    figma_aprobado?: boolean;
    figma_comentarios?: string;
    cliente?: Cliente;
    // Fases de progreso
    fases?: FaseProyecto[];
    // Campos SaaS/Interno
    saas_url?: string;
    version?: string;
    usuarios_activos?: number;
    membresias?: { nombre: string; precio: number; activas: number; }[];
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
    bloque?: BloqueTarea;
    proyecto?: Proyecto;
    // Marketing/Content fields (solo para módulo de marketing)
    idea_contenido?: string;
    hook?: string;
    guion?: string;
    notas_visuales?: string;
    plataformas?: string[];
    formato?: string;
    workflow_stage?: string;
    editado?: boolean;
    publicado?: boolean;
    fecha_vencimiento?: string;
    hora_recordatorio?: string;
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
    tipo_cotizacion?: TipoCotizacion;
    especificaciones_webapp?: EspecificacionesWebApp | null;
    secciones_pdf?: SeccionesPDF | null;
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

export interface Infraestructura {
    id: string;
    created_at: string;
    cliente_id: string;
    tipo: TipoInfraestructura;
    nombre: string;
    proveedor: string;
    fecha_vencimiento: string | null;
    costo: number;
    cliente?: Cliente;
}

export interface TicketSoporte {
    id: string;
    created_at: string;
    cliente_id: string;
    proyecto_id: string | null;
    asunto: string;
    descripcion: string;
    estado: EstadoTicket;
    prioridad: Prioridad;
    cliente?: Cliente;
    proyecto?: Proyecto;
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
    no_interesado: "No Interesado",
};

export const ETAPA_COLORS: Record<EtapaCliente, string> = {
    contacto: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    investigando: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    calificado: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    contactado: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    cotizado: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    cliente_actual: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    cliente_finalizado: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    no_interesado: "bg-rose-500/20 text-rose-300 border-rose-500/30",
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

export const BLOQUE_COLORS: Record<BloqueTarea, string> = {
    construccion: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    crecimiento: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
};

export const TIPO_PROYECTO_LABELS: Record<TipoProyecto, string> = {
    landing: "Landing Page",
    institucional: "Web Institucional",
    ecommerce: "E-Commerce",
    webapp: "Web App",
    saas: "SaaS / Producto",
};

export const FASES_PIPELINE = {
    prospeccion: ["contacto", "investigando"] as EtapaCliente[],
    clasificacion: ["calificado", "contactado", "cotizado"] as EtapaCliente[],
    cierre: ["cliente_actual", "cliente_finalizado", "no_interesado"] as EtapaCliente[],
};

// --- Ideas ---
export type CategoriaIdea = "cliente_potencial" | "servicio" | "saas" | "software_rubro" | "otro";
export type EstadoIdea = "borrador" | "investigando" | "aprobada" | "descartada";

export interface Idea {
    id: string;
    created_at: string;
    titulo: string;
    categoria: CategoriaIdea;
    descripcion: string;
    rubro?: string;
    cliente_potencial?: string;
    impacto: number; // 1 a 5
    dificultad: number; // 1 a 5
    estado: EstadoIdea;
    notas_adicionales?: string;
}

export const CATEGORIA_IDEA_LABELS: Record<CategoriaIdea, string> = {
    cliente_potencial: "Cliente Potencial",
    servicio: "Idea de Servicio",
    saas: "Idea SaaS",
    software_rubro: "Software para Rubro",
    otro: "Otro",
};

export const CATEGORIA_IDEA_COLORS: Record<CategoriaIdea, string> = {
    cliente_potencial: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    servicio: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    saas: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    software_rubro: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    otro: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

export const ESTADO_IDEA_LABELS: Record<EstadoIdea, string> = {
    borrador: "Borrador",
    investigando: "Investigando",
    aprobada: "Aprobada",
    descartada: "Descartada",
};

export const ESTADO_IDEA_COLORS: Record<EstadoIdea, string> = {
    borrador: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    investigando: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    aprobada: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    descartada: "bg-rose-500/20 text-rose-300 border-rose-500/30",
};
