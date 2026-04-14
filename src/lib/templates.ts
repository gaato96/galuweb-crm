import { TipoProyecto, CategoriaTarea, Prioridad } from "./types";

interface TaskTemplate {
    titulo: string;
    categoria: CategoriaTarea;
    prioridad: Prioridad;
}

export const PROJECT_TEMPLATES: Record<TipoProyecto, TaskTemplate[]> = {
    landing: [
        { titulo: "Configurar Hosting y Dominio", categoria: "dev", prioridad: "alta" },
        { titulo: "Diseño Hero Section en Figma", categoria: "diseno", prioridad: "alta" },
        { titulo: "Diseño Secciones Internas", categoria: "diseno", prioridad: "alta" },
        { titulo: "Copywriting de textos", categoria: "otro", prioridad: "alta" },
        { titulo: "Maquetación Frontend", categoria: "dev", prioridad: "alta" },
        { titulo: "Formulario de Contacto", categoria: "dev", prioridad: "media" },
        { titulo: "Optimización SEO On-Page", categoria: "seo", prioridad: "media" },
        { titulo: "Integración Analytics", categoria: "dev", prioridad: "baja" },
        { titulo: "Testing Responsive", categoria: "dev", prioridad: "media" },
        { titulo: "Deploy y puesta en producción", categoria: "dev", prioridad: "alta" },
    ],
    institucional: [
        { titulo: "Brief de Contenido Institucional", categoria: "otro", prioridad: "alta" },
        { titulo: "Arquitectura de Información", categoria: "diseno", prioridad: "alta" },
        { titulo: "Diseño UI/UX Completo en Figma", categoria: "diseno", prioridad: "alta" },
        { titulo: "Diseño de Páginas Internas", categoria: "diseno", prioridad: "alta" },
        { titulo: "Configurar Hosting y Dominio", categoria: "dev", prioridad: "alta" },
        { titulo: "Desarrollo Frontend", categoria: "dev", prioridad: "alta" },
        { titulo: "Integración CMS/Backend", categoria: "dev", prioridad: "media" },
        { titulo: "Copywriting de textos", categoria: "otro", prioridad: "alta" },
        { titulo: "Formularios y funcionalidades", categoria: "dev", prioridad: "media" },
        { titulo: "Optimización SEO On-Page", categoria: "seo", prioridad: "media" },
        { titulo: "Integración Analytics y Search Console", categoria: "seo", prioridad: "baja" },
        { titulo: "Testing Responsive y Cross-Browser", categoria: "dev", prioridad: "media" },
        { titulo: "Deploy y puesta en producción", categoria: "dev", prioridad: "alta" },
    ],
    ecommerce: [
        { titulo: "Configurar Plataforma Ecommerce", categoria: "dev", prioridad: "alta" },
        { titulo: "Configurar Hosting y Dominio", categoria: "dev", prioridad: "alta" },
        { titulo: "Diseño UI/UX Tienda en Figma", categoria: "diseno", prioridad: "alta" },
        { titulo: "Diseño de páginas de producto", categoria: "diseno", prioridad: "alta" },
        { titulo: "Diseño de carrito y checkout", categoria: "diseno", prioridad: "alta" },
        { titulo: "Maquetación Frontend Tienda", categoria: "dev", prioridad: "alta" },
        { titulo: "Carga de Catálogo de Productos", categoria: "otro", prioridad: "alta" },
        { titulo: "Configurar Pasarela de Pago", categoria: "dev", prioridad: "alta" },
        { titulo: "Configurar Envíos y Logística", categoria: "dev", prioridad: "media" },
        { titulo: "Copywriting de textos", categoria: "otro", prioridad: "media" },
        { titulo: "Emails transaccionales", categoria: "dev", prioridad: "media" },
        { titulo: "Optimización SEO Productos", categoria: "seo", prioridad: "media" },
        { titulo: "Testing Responsive y Flujo de Compra", categoria: "dev", prioridad: "alta" },
        { titulo: "Deploy y puesta en producción", categoria: "dev", prioridad: "alta" },
    ],
    webapp: [
        { titulo: "Análisis de requerimientos", categoria: "diseno", prioridad: "alta" },
        { titulo: "Arquitectura del Sistema", categoria: "dev", prioridad: "alta" },
        { titulo: "Diseño UX/UI (Figma)", categoria: "diseno", prioridad: "alta" },
        { titulo: "Autenticación y Roles", categoria: "dev", prioridad: "alta" },
        { titulo: "Desarrollo de Módulos Core", categoria: "dev", prioridad: "alta" },
        { titulo: "Testing QA", categoria: "dev", prioridad: "media" },
        { titulo: "Deploy y CI/CD", categoria: "dev", prioridad: "alta" },
    ],
    saas: [
        { titulo: "Análisis de requerimientos", categoria: "diseno", prioridad: "alta" },
        { titulo: "Arquitectura del Sistema", categoria: "dev", prioridad: "alta" },
        { titulo: "Diseño UX/UI (Figma)", categoria: "diseno", prioridad: "alta" },
        { titulo: "Autenticación, Roles y Multi-tenant", categoria: "dev", prioridad: "alta" },
        { titulo: "Módulos Core", categoria: "dev", prioridad: "alta" },
        { titulo: "Facturación / Membresías", categoria: "dev", prioridad: "alta" },
        { titulo: "Testing QA", categoria: "dev", prioridad: "media" },
        { titulo: "Deploy Producción", categoria: "dev", prioridad: "alta" },
    ],
};

export const BRIEF_QUESTIONS = [
    "¿Cuál es el objetivo principal del sitio web?",
    "¿Quién es su público objetivo o cliente ideal?",
    "¿Cuáles son sus principales competidores online?",
    "¿Tiene preferencias de colores o estilos visuales en mente?",
    "¿Tiene un logo o manual de marca existente?",
    "¿Qué secciones o páginas debería tener el sitio?",
    "¿Necesita funcionalidades especiales? (formularios, blog, e-commerce, reservas, etc.)",
    "¿Tiene el contenido listo (textos, fotos, videos)?",
    "¿Tiene algún sitio web de referencia que le guste?",
    "¿Cuál es el plazo esperado para el proyecto?",
    "¿Tiene dominio y hosting contratado?",
    "¿Va a necesitar mantenimiento post-lanzamiento?",
];
