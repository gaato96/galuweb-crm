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
export type TipoProyectoPropio = "web_propia" | "software" | "saas";
export type EstadoProyecto = "activo" | "pausado" | "finalizado";

export type Prioridad = "baja" | "media" | "alta";
export type EstadoTarea = "pendiente" | "en_progreso" | "completada";
export type TipoTarea = "puntual" | "recurrente";
export type FrecuenciaRecurrente = "diaria" | "semanal" | "mensual";
export type CategoriaTarea = "diseno" | "dev" | "marketing" | "contenido" | "seo" | "otro";
export type BloqueTarea = "construccion" | "crecimiento";

export interface SubpasoTarea {
    id: string;
    texto: string;
    completado: boolean;
}

export type EstadoCotizacion = "borrador" | "enviada" | "aceptada" | "rechazada" | "archivada";
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

export interface DocumentoProyecto {
    id: string;
    titulo: string;
    contenido: string;
    categoria: 'estrategia' | 'marketing' | 'contenido' | 'prospeccion' | 'manual' | 'otro';
    updated_at: string;
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
    tipo_propio?: TipoProyectoPropio;
    stack_tecnologico?: string;
    notas_negocio?: string;
    url_producto?: string;
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
    // Logo y documentos
    logo_url?: string;
    documentos?: DocumentoProyecto[];
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
    pasos?: SubpasoTarea[];
    tipo_tarea?: TipoTarea;
    frecuencia_recurrente?: FrecuenciaRecurrente;
    ultima_ejecucion?: string;
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
    // Historial: las completadas se archivan en vez de acumularse en el tablero.
    archivada?: boolean;
    fecha_completada?: string | null;
    fecha_archivada?: string | null;
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
    cobrado?: boolean;
    fecha_cobrado?: string | null;
    es_recurrente?: boolean;
    grupo_cuota?: string | null;
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

// --- Scraper de Prospectos ---
export interface RedesSocialesProspecto {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    tiktok?: string;
}

export interface ProspectoScraped {
    id: string;
    nombre: string;
    rubro: string;
    lugar: string;
    direccion: string;
    telefono?: string | null;
    telefonoClean?: string | null; // Nro formateado para wa.me sin caracteres especiales
    tieneSitioWeb: boolean;
    sitioWebUrl?: string | null;
    rating?: number;
    reviewsCount?: number;
    redesSociales: RedesSocialesProspecto;
    guardadoEnCrm?: boolean;
    clienteId?: string;
    fechaExtraccion: string;
    mapsUrl?: string;
    contactado?: boolean;
    fechaContactado?: string;
    // --- Enriquecimiento y priorización (opcionales: las búsquedas viejas no los tienen) ---
    score?: number;
    categoriaGoogle?: string;
    sinHorarios?: boolean;
    lat?: number;
    lng?: number;
    enPlanilla?: boolean;
}

export interface ScraperBusqueda {
    id: string;
    created_at: string;
    rubro: string;
    lugar: string;
    tituloPersonalizado?: string;
    totalResultados: number;
    sinWebCount: number;
    conWhatsappCount: number;
    prospectos: ProspectoScraped[];
}

// ============================================================
// --- Planilla de Prospectos (Prospección en frío — doc 08) ---
// ============================================================

/** §3.2 punto 1 — define el ángulo del mensaje y el orden de trabajo de §8. */
export type ClasificacionWeb = "sin_definir" | "sin_web" | "solo_redes" | "web_debil" | "web_buena";

/** §8 — si el rubro/especialidad se busca en Google, el ángulo de demanda aplica. */
export type DemandaBusqueda = "sin_definir" | "alta" | "baja";

/** §3.2 punto 4 — el canal lo define si el WhatsApp está publicado por el negocio. */
export type CanalProspecto = "instagram" | "whatsapp";

/**
 * §11 punto 3 — dice si el rubro se traba en el filtro de la secretaria.
 * El mismo campo sirve para VivoMenu ("¿contestó el dueño o el empleado?"):
 * "secretaria" ahí se lee como "intermediario que no decide", que es el mismo
 * concepto que el empleado que atiende el WhatsApp de pedidos.
 */
export type QuienLeyo = "dueno" | "secretaria" | "no_se";

/** A qué sistema de prospección pertenece: cambia el guion de mensajes y el ritmo de envío. */
export type Sistema = "galu" | "vivomenu" | "agencias";

export const SISTEMA_LABELS: Record<Sistema, string> = {
    galu: "Galu — Agencia web",
    vivomenu: "VivoMenu — Menú digital",
    agencias: "Proveedor — Agencias del exterior",
};

/**
 * Una línea de contexto por sistema, para la pantalla. Lo que cambia entre
 * sistemas no es el tono: es a quién se le vende y qué se le pide.
 */
export const SISTEMA_PITCH: Record<Sistema, string> = {
    galu: "Comercio o profesional local. Hay que educar antes de vender: el análisis va primero, pero cierra con precio y fecha.",
    vivomenu: "Local gastronómico con pedidos por WhatsApp. Se muestra el producto funcionando, no se explica.",
    agencias:
        "Agencia de marketing del exterior que vende redes y pauta pero NO desarrollo web. No hay que educar a nadie ni mandar análisis: se ofrece capacidad de proveedor.",
};

export type OrigenProspecto = "manual" | "sheets" | "scraper";

// ─────────────────────────────────────────────────────────────
// Listados de prospección
// ─────────────────────────────────────────────────────────────

/**
 * Un listado = una tanda de prospección medible: un scrapeo, una ciudad, un
 * rubro. `sistema` decide el guion; el listado decide contra qué se compara la
 * tasa de respuesta. Sin esto, "agencias de Guadalajara" y "agencias de
 * Medellín" caen en el mismo promedio y no se puede saber cuál funciona.
 */
export interface ListaProspeccion {
    id: string;
    created_at: string;
    updated_at?: string;
    nombre: string;
    sistema: Sistema;
    pais: string;
    ciudad: string;
    rubro: string;
    origen: OrigenProspecto;
    /** Qué se busca probar con esta tanda. Se lee al revisar los números. */
    objetivo: string;
    notas: string;
    archivada: boolean;
}

export function listaVacia(sistema: Sistema = "galu"): Omit<ListaProspeccion, "id" | "created_at"> {
    return {
        nombre: "",
        sistema,
        pais: "",
        ciudad: "",
        rubro: "",
        origen: "scraper",
        objetivo: "",
        notas: "",
        archivada: false,
    };
}

/** Nombre sugerido al crear un listado desde una importación: PAÍS · Ciudad · Rubro. */
export function nombreSugeridoLista(pais: string, ciudad: string, rubro: string): string {
    return [pais.trim().toUpperCase(), ciudad.trim(), rubro.trim()].filter(Boolean).join(" · ");
}

/** Embudo de §5: cada paso pide más que el anterior. */
export type EstadoProspecto =
    | "sin_calificar"     // recién pasado en limpio desde Sheets / Scraper
    | "calificado"        // pasó §3.1 y §3.2, tiene dato de personalización
    | "descartado"        // §3.1 descarte rápido
    | "enviado"           // mensaje 1 enviado
    | "fu1"               // follow-up 1 enviado (día 3-4)
    | "fu2"               // follow-up 2 enviado (día 7-10)
    | "fu3"               // follow-up 3 — solo VivoMenu (día 14)
    | "sin_respuesta"     // cerrado tras el último follow-up
    | "respondio"         // dijo "sí" o contestó
    | "revision_enviada"  // §6 — se entregó el análisis de una página
    | "reunion"           // aceptó el diagnóstico de 30 min
    | "cliente";          // convertido a cliente del CRM

/**
 * §4 nivel 2 — señales verificables en 10 segundos.
 * El catálogo con su significado (a qué dolor apunta cada una, en qué rubro sirve
 * y cómo entra al mensaje) vive en dolores-rubro.ts.
 */
export type FallaVerificable =
    // Dolor operativo: la agenda y las consultas. Son las que pegan fuerte.
    | "comentarios_sin_responder"
    | "turnos_disponibles_posteo"
    | "aviso_ausentismo"
    | "demanda_sin_camino"
    | "precio_en_comentarios"
    | "sin_reserva_online"
    | "varios_prof_un_canal"
    // Demanda que nunca llega: existe en el mercado y termina eligiendo a otro.
    | "contenido_sin_devolucion"
    | "web_es_instagram"
    // Gastronomía (VivoMenu): la carta, el pedido, la comisión y el stock.
    | "en_apps_delivery"
    | "carta_sin_precios"
    | "carta_desactualizada"
    | "carta_como_imagen"
    | "comentarios_carta_sin_responder"
    | "resenas_pedido_errado"
    | "precio_por_privado"
    | "pedidos_solo_whatsapp"
    | "no_aparece_comida"
    | "posteos_sin_stock"
    // Gastronomía: estas cuatro salen de escribirles como cliente, no de mirar.
    | "demora_en_contestar"
    | "carta_llega_como_imagen"
    | "respuesta_automatica_sin_seguir"
    | "pedido_muchas_idas"
    // Agencias del exterior: lo que califica acá es la AUSENCIA de desarrollo
    // web, no una falla. Una agencia con la web rota no es mejor prospecto —
    // una agencia que no vende webs sí, porque le entran pedidos que rechaza.
    | "no_ofrece_desarrollo"
    | "casos_solo_redes"
    | "equipo_sin_devs"
    | "busca_disenador"
    | "clientes_sin_web"
    | "web_propia_desactualizada"
    // Higiene / encontrabilidad: sirven de apoyo, no de titular.
    | "whatsapp_personal"
    | "ficha_incompleta"
    | "horarios_mal"
    | "bio_rota"
    | "no_aparece_rubro"
    | "web_lenta"
    | "sin_responder_resenas";

/** §4 — la escalera del dato. El nivel se deriva de acá tomando el más alto que haya. */
export interface EscaneoProspecto {
    tiene_queja_cliente: boolean;   // nivel 1
    queja_textual: string;
    fallas: FallaVerificable[];     // nivel 2
    hito_reciente: string;          // nivel 3
    detalle_trabajo: string;        // nivel 4
}

export interface Prospecto {
    id: string;
    created_at: string;
    updated_at?: string;

    sistema: Sistema;
    /** Tanda a la que pertenece. null = cargado antes de que existieran los listados. */
    lista_id: string | null;
    negocio: string;
    contacto_nombre: string;
    rubro: string;
    especialidad: string;
    ciudad: string;
    /** Obligatorio en prospección internacional: hay Santiago, Córdoba y Mérida en varios países. */
    pais: string;
    direccion: string;

    telefono: string;
    telefono_wa: string;
    whatsapp_publicado: boolean;
    es_whatsapp_business: boolean | null;
    instagram_url: string;
    linkedin_url: string;
    email: string;
    dias_ultimo_post: number | null;
    sitio_web_url: string;
    maps_url: string;
    canal: CanalProspecto;

    /* ── Calificación de agencias (sistema "agencias") ──────────
     * null en los tres = todavía no se verificó. `ofrece_desarrollo_web` es el
     * filtro que manda: si es true, la agencia no es prospecto. */
    ofrece_desarrollo_web: boolean | null;
    tam_equipo: number | null;
    muestra_clientes: boolean | null;
    /** Lo que lista en su página de servicios, tal cual. De ahí sale la personalización. */
    servicios: string;

    clasificacion_web: ClasificacionWeb;
    demanda_busqueda: DemandaBusqueda;
    rating: number | null;
    reviews_count: number | null;
    cant_profesionales: number | null;
    escaneo: EscaneoProspecto;
    dato_usado: string;
    nivel_dato: number | null;
    score: number;

    estado: EstadoProspecto;
    motivo_descarte: string;
    fecha_envio: string | null;
    fecha_fu1: string | null;
    fecha_fu2: string | null;
    fecha_fu3: string | null;
    fecha_respuesta: string | null;
    /** §6 — cuándo se entregó el análisis. Arranca la cadencia de fu_revision1/2. */
    fecha_revision: string | null;
    fecha_revision_fu1: string | null;
    fecha_revision_fu2: string | null;
    quien_leyo: QuienLeyo | null;
    revision_url: string;
    mensaje_enviado: string;

    /* ── La oferta que cierra el análisis ───────────────────────
     * El embudo se cortaba justo acá: el análisis entregaba todo el valor y no
     * dejaba ninguna decisión sobre la mesa. Estos tres campos existen para que
     * no se pueda mandar un análisis sin que haya un precio y una fecha atrás.
     * Ver generarMensaje("m2") y ofertaCompleta(). */
    oferta_titulo: string;
    oferta_precio: string;
    oferta_plazo: string;

    cliente_id: string | null;
    origen: OrigenProspecto;
    notas: string;
}

export const ESCANEO_VACIO: EscaneoProspecto = {
    tiene_queja_cliente: false,
    queja_textual: "",
    fallas: [],
    hito_reciente: "",
    detalle_trabajo: "",
};

export const ESTADO_PROSPECTO_LABELS: Record<EstadoProspecto, string> = {
    sin_calificar: "Sin calificar",
    calificado: "Calificado",
    descartado: "Descartado",
    enviado: "Mensaje 1 enviado",
    fu1: "Follow-up 1",
    fu2: "Follow-up 2",
    fu3: "Follow-up 3",
    sin_respuesta: "Sin respuesta",
    respondio: "Respondió",
    revision_enviada: "Análisis enviado",
    reunion: "Reunión agendada",
    cliente: "Cliente",
};

export const ESTADO_PROSPECTO_COLORS: Record<EstadoProspecto, string> = {
    sin_calificar: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    calificado: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    descartado: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    enviado: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    fu1: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    fu2: "bg-orange-500/20 text-orange-200 border-orange-500/30",
    fu3: "bg-orange-500/20 text-orange-100 border-orange-500/30",
    sin_respuesta: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    respondio: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    revision_enviada: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    reunion: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    cliente: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

export const CLASIFICACION_WEB_LABELS: Record<ClasificacionWeb, string> = {
    sin_definir: "Sin definir",
    sin_web: "Sin web",
    solo_redes: "Instagram como web",
    web_debil: "Web débil",
    web_buena: "Web buena",
};

export const FALLA_LABELS: Record<FallaVerificable, string> = {
    comentarios_sin_responder: "Comentarios pidiendo turno o precio sin responder",
    turnos_disponibles_posteo: 'Publicaron "quedan turnos"',
    aviso_ausentismo: 'Publicaron "avisá si no podés venir"',
    demanda_sin_camino: "Publican casos con repercusión y no hay dónde reservar",
    precio_en_comentarios: "La pregunta del precio se repite en comentarios",
    sin_reserva_online: "No hay forma de sacar turno sin escribir",
    varios_prof_un_canal: "Varios profesionales, un solo canal",
    contenido_sin_devolucion: "Publican y los posteos quedan sin comentarios",
    web_es_instagram: "El sitio web en Google es el Instagram",
    en_apps_delivery: "Están en PedidosYa o Rappi",
    carta_sin_precios: "La carta publicada no tiene precios",
    carta_desactualizada: "La carta publicada tiene varios meses",
    carta_como_imagen: "La carta es una foto que hay que agrandar",
    comentarios_carta_sin_responder: "Preguntan por la carta y no les responden",
    resenas_pedido_errado: "Reseñas de pedidos mal o incompletos",
    precio_por_privado: "Pasan los precios por privado, de a uno",
    pedidos_solo_whatsapp: "Solo se puede pedir escribiendo y esperando",
    no_aparece_comida: "No aparecen buscando la comida + la zona",
    posteos_sin_stock: 'Postean "hoy no hay" o "se terminó"',
    demora_en_contestar: "Tardaron en contestar en hora pico",
    carta_llega_como_imagen: "Mandan la carta como foto por WhatsApp",
    respuesta_automatica_sin_seguir: "Contesta un automático y no sigue nadie",
    pedido_muchas_idas: "Varios mensajes para cerrar un pedido simple",
    whatsapp_personal: "WhatsApp personal (no Business)",
    ficha_incompleta: "Ficha de Google incompleta",
    horarios_mal: "Horarios de Maps mal cargados",
    bio_rota: "Link de bio de Instagram roto o inexistente",
    no_aparece_rubro: "No aparece al buscar su rubro + ciudad",
    web_lenta: "La web no carga bien en celular",
    sin_responder_resenas: "No responde las reseñas",
    no_ofrece_desarrollo: "No ofrece desarrollo web en sus servicios",
    casos_solo_redes: "Los casos que muestra son de redes y pauta, ninguna web",
    equipo_sin_devs: "El equipo que muestra no tiene desarrolladores",
    busca_disenador: "Publicó que busca diseñador o desarrollador",
    clientes_sin_web: "Sus propios clientes no tienen web",
    web_propia_desactualizada: "Su propia web está desactualizada",
};

/**
 * Las señales que califican a una agencia. El resto del catálogo mira negocios
 * finales y no aplica: a una agencia no le vendés porque tenga la ficha de
 * Google incompleta.
 */
export const FALLAS_AGENCIA: FallaVerificable[] = [
    "no_ofrece_desarrollo",
    "casos_solo_redes",
    "equipo_sin_devs",
    "busca_disenador",
    "clientes_sin_web",
    "web_propia_desactualizada",
];

export const QUIEN_LEYO_LABELS: Record<QuienLeyo, string> = {
    dueno: "Dueño / decisor",
    secretaria: "Secretaria / recepción",
    no_se: "No sé",
};

