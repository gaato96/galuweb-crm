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
    /** Plazo interno de la fase (YYYY-MM-DD). */
    fecha_limite?: string | null;
    fecha_completada?: string | null;
}

export interface TareaPlantilla {
    titulo: string;
    categoria: CategoriaTarea;
    prioridad: Prioridad;
    descripcion?: string;
}

export interface FaseConfig {
    nombre: string;
    descripcion: string;
    /** Peso relativo de la fase para repartir el plazo total del proyecto. */
    dias: number;
    tareas: TareaPlantilla[];
}

const t = (titulo: string, categoria: CategoriaTarea, prioridad: Prioridad = "media", descripcion?: string): TareaPlantilla =>
    ({ titulo, categoria, prioridad, ...(descripcion ? { descripcion } : {}) });

export const FASES_POR_TIPO: Record<TipoProyecto, FaseConfig[]> = {
    landing: [
        { nombre: "Investigación", dias: 3, descripcion: "Entender el negocio, el objetivo de la landing y a quién le habla.", tareas: [
            t("Enviar el brief al cliente desde el portal", "otro", "alta", "Generar el brief, revisarlo y compartir el link del portal."),
            t("Reunión de kickoff", "otro", "alta"),
            t("Definir objetivo y llamado a la acción principal", "contenido", "alta"),
            t("Analizar 3 competidores o referentes", "seo", "media"),
            t("Pedir logo, fotos y textos al cliente", "otro", "alta", "Crear una solicitud en el portal para que los suba."),
        ] },
        { nombre: "Diseño", dias: 5, descripcion: "Estructura, copy y diseño de alta fidelidad.", tareas: [
            t("Armar estructura de secciones (wireframe)", "diseno", "alta"),
            t("Redactar copy de cada sección", "contenido", "alta"),
            t("Definir paleta y tipografías", "diseno", "media"),
            t("Diseño UI desktop en Figma", "diseno", "alta"),
            t("Diseño UI mobile en Figma", "diseno", "alta"),
            t("Enviar diseño para aprobación en el portal", "otro", "alta"),
        ] },
        { nombre: "Desarrollo", dias: 6, descripcion: "Maquetación e implementación técnica.", tareas: [
            t("Setup del proyecto y repositorio", "dev", "alta"),
            t("Maquetar secciones responsive", "dev", "alta"),
            t("Formulario / botón de WhatsApp funcionando", "dev", "alta"),
            t("Optimizar imágenes (WebP, lazy load)", "dev", "media"),
            t("Meta tags, favicon y Open Graph", "seo", "media"),
        ] },
        { nombre: "Revisión del Cliente", dias: 3, descripcion: "Feedback y ajustes sobre el sitio funcional.", tareas: [
            t("Compartir versión de prueba con el cliente", "otro", "alta"),
            t("Aplicar correcciones pedidas", "dev", "alta"),
            t("Testing en celular, tablet y desktop", "dev", "media"),
        ] },
        { nombre: "Lanzamiento", dias: 2, descripcion: "Puesta en marcha en el dominio oficial.", tareas: [
            t("Configurar dominio y DNS", "dev", "alta"),
            t("Certificado SSL activo", "dev", "alta"),
            t("Instalar Analytics / Píxel de Meta", "seo", "media"),
            t("Probar formularios en producción", "dev", "alta"),
        ] },
        { nombre: "Post-entrega", dias: 2, descripcion: "Soporte, feedback y cierre.", tareas: [
            t("Enviar accesos y tutorial de uso", "otro", "media"),
            t("Cobrar saldo final", "otro", "alta"),
            t("Pedir testimonio / reseña", "marketing", "baja"),
        ] },
    ],
    institucional: [
        { nombre: "Investigación", dias: 4, descripcion: "Análisis en profundidad del modelo de negocio.", tareas: [
            t("Enviar el brief al cliente desde el portal", "otro", "alta"),
            t("Reunión de kickoff", "otro", "alta"),
            t("Análisis de competencia", "seo", "media"),
            t("Investigación de palabras clave", "seo", "media"),
            t("Pedir logo, manual de marca y fotos", "otro", "alta"),
        ] },
        { nombre: "Arquitectura", dias: 3, descripcion: "Mapa de sitio y contenidos.", tareas: [
            t("Definir sitemap", "seo", "alta"),
            t("Wireframes de Home y páginas internas", "diseno", "alta"),
            t("Inventario de contenidos por página", "contenido", "media"),
        ] },
        { nombre: "Diseño", dias: 7, descripcion: "Identidad visual y diseño UI.", tareas: [
            t("Moodboard y estilo visual", "diseno", "media"),
            t("Diseño UI de Home", "diseno", "alta"),
            t("Diseño UI de páginas internas", "diseno", "alta"),
            t("Versión mobile", "diseno", "alta"),
            t("Enviar diseño para aprobación en el portal", "otro", "alta"),
        ] },
        { nombre: "Desarrollo", dias: 10, descripcion: "Implementación en CMS o código.", tareas: [
            t("Setup del proyecto, hosting de staging", "dev", "alta"),
            t("Desarrollo de Home", "dev", "alta"),
            t("Desarrollo de páginas internas", "dev", "alta"),
            t("Blog / CMS configurado", "dev", "media"),
            t("Formularios de contacto", "dev", "alta"),
            t("Carga de contenidos finales", "contenido", "media"),
        ] },
        { nombre: "SEO On-page", dias: 3, descripcion: "Optimización para buscadores.", tareas: [
            t("Meta títulos y descripciones", "seo", "alta"),
            t("Jerarquía de encabezados (H1-H3)", "seo", "media"),
            t("Imágenes optimizadas con alt", "seo", "media"),
            t("Sitemap.xml y robots.txt", "seo", "media"),
        ] },
        { nombre: "Revisión", dias: 4, descripcion: "QA interno y feedback del cliente.", tareas: [
            t("Testing multi-dispositivo y navegadores", "dev", "alta"),
            t("Revisión de textos y links rotos", "contenido", "media"),
            t("Ronda de correcciones del cliente", "dev", "alta"),
        ] },
        { nombre: "Lanzamiento", dias: 2, descripcion: "Puesta en producción oficial.", tareas: [
            t("Migración a dominio final + SSL", "dev", "alta"),
            t("Google Search Console e indexación", "seo", "alta"),
            t("Analytics y píxeles", "seo", "media"),
        ] },
        { nombre: "Post-entrega", dias: 3, descripcion: "Mantenimiento y soporte inicial.", tareas: [
            t("Entrega de accesos y video tutorial", "otro", "alta"),
            t("Cobrar saldo final", "otro", "alta"),
            t("Ofrecer plan de mantenimiento", "marketing", "media"),
        ] },
    ],
    ecommerce: [
        { nombre: "Investigación", dias: 4, descripcion: "Productos, logística y medios de pago.", tareas: [
            t("Enviar el brief al cliente desde el portal", "otro", "alta"),
            t("Reunión de relevamiento", "otro", "alta"),
            t("Definir plataforma (Tiendanube, Woo, Shopify, custom)", "dev", "alta"),
            t("Relevar medios de pago y envíos", "otro", "alta"),
            t("Pedir catálogo (planilla + fotos)", "otro", "alta"),
        ] },
        { nombre: "Diseño", dias: 7, descripcion: "UI orientada a conversión.", tareas: [
            t("Diseño de Home y categorías", "diseno", "alta"),
            t("Diseño de ficha de producto", "diseno", "alta"),
            t("Diseño de carrito y checkout", "diseno", "alta"),
            t("Enviar diseño para aprobación en el portal", "otro", "alta"),
        ] },
        { nombre: "Catálogo de Productos", dias: 5, descripcion: "Categorías, variantes y stock.", tareas: [
            t("Estructura de categorías y variantes", "dev", "alta"),
            t("Importación del catálogo", "dev", "alta"),
            t("Optimización de fotos de productos", "diseno", "media"),
        ] },
        { nombre: "Pasarela de Pago", dias: 3, descripcion: "Cobros y envíos.", tareas: [
            t("Integrar Mercado Pago / Stripe", "dev", "alta"),
            t("Configurar zonas y costos de envío", "dev", "alta"),
            t("Emails transaccionales", "dev", "media"),
        ] },
        { nombre: "Desarrollo", dias: 8, descripcion: "Construcción completa de la tienda.", tareas: [
            t("Maquetación de la tienda", "dev", "alta"),
            t("Páginas legales (términos, devoluciones)", "contenido", "media"),
            t("Integración con WhatsApp / redes", "dev", "media"),
        ] },
        { nombre: "Testing", dias: 3, descripcion: "Pruebas del embudo de compra.", tareas: [
            t("Compra de prueba completa", "dev", "alta"),
            t("Pruebas en celular", "dev", "alta"),
            t("Revisión de stock y precios con el cliente", "otro", "media"),
        ] },
        { nombre: "Lanzamiento", dias: 2, descripcion: "Apertura de la tienda.", tareas: [
            t("Dominio, DNS y SSL", "dev", "alta"),
            t("GA4 e-commerce y píxel", "seo", "media"),
        ] },
        { nombre: "Post-entrega", dias: 3, descripcion: "Capacitación y cierre.", tareas: [
            t("Capacitación de gestión de la tienda", "otro", "alta"),
            t("Cobrar saldo final", "otro", "alta"),
        ] },
    ],
    webapp: [
        { nombre: "Investigación", dias: 5, descripcion: "Módulos y lógica de negocio.", tareas: [
            t("Enviar el brief al cliente desde el portal", "otro", "alta"),
            t("Especificación de requerimientos", "otro", "alta"),
            t("Casos de uso y roles", "otro", "alta"),
            t("Priorizar alcance del MVP", "otro", "alta"),
        ] },
        { nombre: "Arquitectura del Sistema", dias: 4, descripcion: "Base de datos y estructura.", tareas: [
            t("Esquema de base de datos", "dev", "alta"),
            t("Definir stack y repositorio", "dev", "alta"),
            t("Generar archivos .md de contexto para desarrollo", "dev", "media"),
        ] },
        { nombre: "UX/UI", dias: 6, descripcion: "Flujos de usuario y diseño funcional.", tareas: [
            t("Wireframes de módulos core", "diseno", "alta"),
            t("Sistema de componentes", "diseno", "media"),
            t("Enviar diseño para aprobación en el portal", "otro", "alta"),
        ] },
        { nombre: "Autenticación", dias: 3, descripcion: "Login y control de sesión.", tareas: [
            t("Setup de Auth", "dev", "alta"),
            t("Protección de rutas y roles", "dev", "alta"),
        ] },
        { nombre: "Módulos Core", dias: 12, descripcion: "Funcionalidades principales.", tareas: [
            t("CRUD principal", "dev", "alta"),
            t("Integración frontend con la base de datos", "dev", "alta"),
            t("Validaciones y manejo de errores", "dev", "media"),
        ] },
        { nombre: "Testing QA", dias: 4, descripcion: "Validación de lógica y seguridad.", tareas: [
            t("Pruebas manuales de regresión", "dev", "alta"),
            t("Validar permisos / RLS", "dev", "alta"),
        ] },
        { nombre: "Deploy", dias: 2, descripcion: "Despliegue a producción.", tareas: [
            t("Variables de entorno y CI/CD", "dev", "alta"),
            t("Deploy a producción", "dev", "alta"),
        ] },
        { nombre: "Documentación", dias: 2, descripcion: "Manuales técnicos o de usuario.", tareas: [
            t("Manual de uso", "contenido", "media"),
            t("Cobrar saldo final", "otro", "alta"),
        ] },
        { nombre: "Iteración", dias: 5, descripcion: "Soporte y mejoras post-feedback.", tareas: [
            t("Recolectar feedback de la primera semana", "otro", "media"),
        ] },
    ],
    saas: [
        { nombre: "Investigación", dias: 5, descripcion: "Target, MVP y funcionalidades.", tareas: [
            t("Definir core del MVP", "otro", "alta"),
            t("Investigación de competidores", "otro", "media"),
        ] },
        { nombre: "Arquitectura del Sistema", dias: 4, descripcion: "DB multi-tenant o escalable.", tareas: [
            t("Diseño DB multi-tenant", "dev", "alta"),
            t("Definir endpoints principales", "dev", "alta"),
        ] },
        { nombre: "UX/UI", dias: 6, descripcion: "Diseño base de la plataforma.", tareas: [
            t("Navegación y dashboard", "diseno", "alta"),
            t("Sistema de notificaciones", "diseno", "media"),
        ] },
        { nombre: "Autenticación & Roles", dias: 3, descripcion: "Registro, login y permisos.", tareas: [
            t("Registro de organizaciones", "dev", "alta"),
            t("Invitación de usuarios", "dev", "media"),
        ] },
        { nombre: "Módulos Core", dias: 12, descripcion: "El feature que da valor.", tareas: [
            t("Desarrollo principal del MVP", "dev", "alta"),
            t("Gestión de estado global", "dev", "media"),
        ] },
        { nombre: "Facturación/Membresías", dias: 4, descripcion: "Pagos recurrentes.", tareas: [
            t("Checkout de suscripción", "dev", "alta"),
            t("Webhooks de cancelación/reactivación", "dev", "alta"),
        ] },
        { nombre: "Testing QA", dias: 4, descripcion: "Pruebas integrales.", tareas: [
            t("Ciclo completo de pago", "dev", "alta"),
            t("Límites de membresía", "dev", "alta"),
        ] },
        { nombre: "Deploy Producción", dias: 2, descripcion: "Despliegue robusto.", tareas: [
            t("Deploy final", "dev", "alta"),
            t("Logs de errores (Sentry)", "dev", "media"),
        ] },
        { nombre: "Onboarding", dias: 3, descripcion: "Flujos iniciales de clientes nuevos.", tareas: [
            t("Pasos iniciales de setup", "diseno", "media"),
            t("Emails de bienvenida", "contenido", "media"),
        ] },
        { nombre: "Iteración Continua", dias: 5, descripcion: "Monitoreo y roadmap.", tareas: [
            t("Lanzamiento en redes / Product Hunt", "marketing", "media"),
        ] },
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

// --- Briefing de Cotización (lo que se relevó del cliente, la entrada de la IA) ---
export interface BriefingCotizacion {
    notas_reunion: string;      // Lo que se habló, en crudo
    situacion_actual: string;   // Cómo resuelve esto hoy y qué le duele
    requerimientos: string;     // Funcionalidades o módulos que pidió
    publico: string;            // A quién le vende / quién lo va a usar
    presupuesto: string;        // Total objetivo en USD, o el rango que manejamos
    forma_pago: string;         // Un pago, dos, tres cuotas…
    plazo: string;              // Urgencia o fecha que necesita
    condiciones: string;        // Descuentos, referidos, mantenimiento, lo que quede fuera
}

/** Un tramo del plan de pago, que el PDF dibuja como tarjeta. */
export interface PlanPagoItem {
    cuando: string;   // "Pago 1 · Al aceptar"
    monto: number;
    detalle: string;  // "Arranque del proyecto"
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
    fecha_entrega?: string | null;
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
    // Gestión: plazos, dinero, material compartido y brief
    fecha_inicio?: string | null;
    monto_total?: number;
    cotizacion_id?: string | null;
    links?: LinkProyecto[];
    brief?: BriefProyecto | null;
}

export interface LinkProyecto {
    id: string;
    titulo: string;
    url: string;
    visible_cliente: boolean;
}

export type CategoriaArchivo = "cotizacion" | "contrato" | "logo" | "imagen" | "documento" | "otro";

export const CATEGORIA_ARCHIVO_LABELS: Record<CategoriaArchivo, string> = {
    cotizacion: "Cotización",
    contrato: "Contrato",
    logo: "Logo",
    imagen: "Imagen",
    documento: "Documento",
    otro: "Otro",
};

export interface ArchivoProyecto {
    id: string;
    created_at: string;
    proyecto_id: string;
    nombre: string;
    url: string;
    categoria: CategoriaArchivo;
    subido_por: "agencia" | "cliente";
    visible_cliente: boolean;
    solicitud_id: string | null;
    mime: string;
    tamano: number | null;
}

export type EstadoSolicitud = "pendiente" | "entregada" | "aprobada";

export interface SolicitudProyecto {
    id: string;
    created_at: string;
    proyecto_id: string;
    titulo: string;
    descripcion: string;
    estado: EstadoSolicitud;
    respuesta_cliente: string;
    fecha_limite: string | null;
    entregada_at: string | null;
}

// --- Brief del proyecto (lo responde el cliente desde el portal) ---
export type TipoPreguntaBrief = "texto" | "parrafo" | "opcion" | "multiple" | "archivo";

export interface BriefPregunta {
    id: string;
    pregunta: string;
    tipo: TipoPreguntaBrief;
    ayuda?: string;
    opciones?: string[];
    requerida?: boolean;
    /** texto/parrafo/opcion → string; multiple/archivo → string[] (en archivo, URLs). */
    respuesta?: string | string[];
}

export interface BriefSeccion {
    id: string;
    titulo: string;
    descripcion?: string;
    preguntas: BriefPregunta[];
}

export type EstadoBrief = "borrador" | "enviado" | "completado";

export interface BriefProyecto {
    estado: EstadoBrief;
    intro?: string;
    secciones: BriefSeccion[];
    generado_con_ia?: boolean;
    actualizado_at: string;
    completado_at?: string | null;
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
    /** Fase del roadmap del proyecto a la que pertenece. */
    fase?: string | null;
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
    briefing?: BriefingCotizacion | null;
    plan_pago?: PlanPagoItem[] | null;
    fecha_emision?: string | null;   // ISO (YYYY-MM-DD). Si falta, el PDF usa created_at.
    validez_dias?: number | null;
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
export type Sistema = "galu" | "vivomenu" | "agencias" | "odontologia";

export const SISTEMA_LABELS: Record<Sistema, string> = {
    galu: "Galu — Agencia web (archivado)",
    vivomenu: "VivoMenu — Menú digital",
    agencias: "Proveedor — Agencias del exterior",
    odontologia: "Sarvo — Consultorios odontológicos",
};

/**
 * Sistemas archivados: siguen consultándose y conservan su historial, pero no
 * se cargan prospectos nuevos ni aparecen como opción al importar.
 *
 * "galu" quedó acá el 2026-09-05. Era el ICP anterior —comercio o profesional
 * local, con análisis gratis por delante— y el plan lo dio de baja después de
 * 45 contactos en frío, 5 análisis pedidos y cero clientes. Los 45 no se borran:
 * son el registro de qué se probó y cómo salió.
 *
 * Archivado no es muerto. Desde el 2026-09-10 tiene un paso más, "reactivación":
 * a esos 45 se les vuelve a escribir una sola vez, con Sarvo y sin nombrar la
 * web. Es la lista más barata que hay —ya saben quién es Gastón— y lo único que
 * la vuelve peligrosa es mandarla antes de que exista el video.
 */
export const SISTEMAS_ARCHIVADOS: Sistema[] = ["galu"];

export function sistemaArchivado(s: Sistema): boolean {
    return SISTEMAS_ARCHIVADOS.includes(s);
}

/** Los que admiten carga nueva, en el orden en que se trabajan. */
export const SISTEMAS_ACTIVOS: Sistema[] = ["agencias", "odontologia", "vivomenu"];

/**
 * Una línea de contexto por sistema, para la pantalla. Lo que cambia entre
 * sistemas no es el tono: es a quién se le vende y qué se le pide.
 */
export const SISTEMA_PITCH: Record<Sistema, string> = {
    galu: "Comercio o profesional local. Hay que educar antes de vender: el análisis va primero, pero cierra con precio y fecha.",
    vivomenu: "Local gastronómico con pedidos por WhatsApp. Se muestra el producto funcionando, no se explica.",
    agencias:
        "Agencia de marketing del exterior. Lista A: vende redes y pauta pero NO desarrollo web, y se le ofrece capacidad. Lista B: sí lo vende, pero lo terceriza con un freelance distinto cada vez, y se le ofrece continuidad y precio. Nunca análisis, en ninguna de las dos.",
    odontologia:
        "Consultorio odontológico que publica WhatsApp. Se le escribe primero como paciente un sábado a la noche y la respuesta decide el ángulo: si tardó, la consulta que se pierde; si contestó rápido, lo que le cuesta sostener a alguien contestando y la agenda a mano. En los dos casos se pide permiso para mandar un video de 40 segundos, nunca un análisis.",
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

export function listaVacia(sistema: Sistema = "agencias"): Omit<ListaProspeccion, "id" | "created_at"> {
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
    | "acordado"          // quedó el acuerdo, falta que llegue el trabajo
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
    /* ── La prueba de la hora (sistema "odontologia") ──────────
     * El plan manda escribirle al consultorio como paciente un sábado a la
     * noche preguntando un precio, y anotar la hora exacta de la respuesta.
     * Ese dato no es color: es literalmente el mensaje de apertura, y además
     * es lo que más pesa en el score. Por eso vive acá y no en las notas.
     * Timestamps ISO completos — la hora importa tanto como el día. */
    /* ── Cuándo pasó el robot por acá ────────────────────
     * Sin esto no había forma de distinguir "todavía no lo escaneé" de "lo
     * escaneé y no encontró nada", así que los que no tenían nada que encontrar
     * volvían al mismo bloque de pendientes para siempre y había que apretar el
     * botón una y otra vez sobre los mismos. Se sella en cada corrida, encuentre
     * o no encuentre algo. */
    escaneado_at: string | null;

    prueba_enviada_at: string | null;
    prueba_respondida_at: string | null;

    /* ── El acuerdo sin trabajo todavía ──────────────────
     * Una agencia que dice "dale, te avisamos cuando nos entre algo de web" no
     * es "respondió" —ya pasó eso— ni es cliente —no facturó un peso—. Es la
     * meta del carril de agencias y hasta ahora no tenía dónde vivir, así que
     * se caía del embudo y se olvidaba.
     *
     * Lo que la mata no es que diga que no: es que a las seis semanas no se
     * acuerde de que existís. Por eso el estado tiene cadencia propia, larga y
     * sin apuro (ver DIAS_VIGENCIA), en vez de quedar cerrado como los demás. */
    fecha_acuerdo: string | null;
    /** Último toque de vigencia. Arranca en fecha_acuerdo y se pisa en cada toque. */
    fecha_ultimo_toque: string | null;
    /** Nunca contestaron. Es el mejor caso posible para vender, no un dato faltante. */
    prueba_sin_respuesta: boolean;

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
    acordado: "Acordado — espera trabajo",
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
    acordado: "bg-teal-500/20 text-teal-200 border-teal-500/40",
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

