"use client";

import { useEffect, useState } from "react";
import {
    Plus, Trash2, X, FileText, Sparkles, Upload, Link as LinkIcon,
    Code2, Globe, ChevronDown, ChevronUp
} from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { cotizacionesStore, clientesStore, storageStore } from "@/lib/store";
import type { Cotizacion, CotizacionItem, EstadoCotizacion, Cliente, EspecificacionesWebApp, TipoCotizacion } from "@/lib/types";
import { toast } from "sonner";

const ESTADO_BADGE: Record<EstadoCotizacion, string> = {
    borrador: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    enviada: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    aceptada: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    rechazada: "bg-rose-500/20 text-rose-300 border-rose-500/30",
};

const TIPO_BADGE: Record<TipoCotizacion, string> = {
    web: "bg-sky-500/10 text-sky-300 border-sky-500/20",
    webapp: "bg-violet-500/10 text-violet-300 border-violet-500/20",
};

const TIPO_LABEL: Record<TipoCotizacion, string> = {
    web: "Página Web",
    webapp: "Web App / Software",
};

const DEFAULT_WEBAPP_SPECS: EspecificacionesWebApp = {
    modulos: [],
    cantidad_usuarios: "",
    roles: "",
    integraciones: "",
    plataforma: "",
    modelo_negocio: "",
    notas_tecnicas: "",
};

export default function CotizacionesPage() {
    const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [mounted, setMounted] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showAI, setShowAI] = useState(false);
    const [promptView, setPromptView] = useState<Cotizacion | null>(null);
    const [transcript, setTranscript] = useState("");
    const [aiLoading, setAiLoading] = useState(false);

    // Form state
    const [tipoCotizacion, setTipoCotizacion] = useState<TipoCotizacion>("web");
    const [clienteId, setClienteId] = useState("");
    const [items, setItems] = useState<CotizacionItem[]>([{ descripcion: "", precio: 0 }]);
    const [notas, setNotas] = useState("");
    const [uploading, setUploading] = useState(false);
    const [pdfUrl, setPdfUrl] = useState("");
    const [webappSpecs, setWebappSpecs] = useState<EspecificacionesWebApp>(DEFAULT_WEBAPP_SPECS);
    const [moduloInput, setModuloInput] = useState("");

    const reload = async () => {
        try {
            const [q, c] = await Promise.all([cotizacionesStore.getAll(), clientesStore.getAll()]);
            setCotizaciones(q);
            setClientes(c);
        } catch {
            console.error("Error reloading quotes:");
        }
    };
    useEffect(() => { reload().then(() => setMounted(true)); }, []);

    const addItem = () => setItems([...items, { descripcion: "", precio: 0 }]);
    const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
    const updateItem = (i: number, field: keyof CotizacionItem, value: string | number) => {
        const updated = [...items];
        if (field === "precio") updated[i][field] = Number(value);
        else updated[i][field] = value as string;
        setItems(updated);
    };
    const total = items.reduce((sum, item) => sum + item.precio, 0);

    const addModulo = () => {
        const m = moduloInput.trim();
        if (!m) return;
        setWebappSpecs({ ...webappSpecs, modulos: [...webappSpecs.modulos, m] });
        setModuloInput("");
    };
    const removeModulo = (i: number) => setWebappSpecs({ ...webappSpecs, modulos: webappSpecs.modulos.filter((_, idx) => idx !== i) });

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.type !== "application/pdf") { toast.error("Solo archivos PDF"); return; }
        setUploading(true);
        try {
            const url = await storageStore.uploadCotizacion(file);
            setPdfUrl(url);
            toast.success("PDF subido correctamente");
        } catch { toast.error("Error al subir PDF"); }
        finally { setUploading(false); }
    };

    const handleSave = async () => {
        if (!clienteId) { toast.error("Selecciona un cliente"); return; }
        if (items.length === 0 || !items[0].descripcion) { toast.error("Agrega al menos un ítem"); return; }
        try {
            await cotizacionesStore.create({
                cliente_id: clienteId,
                total,
                items: items.filter((i) => i.descripcion),
                estado: "borrador",
                pdf_url: pdfUrl,
                notas,
                tipo_cotizacion: tipoCotizacion,
                especificaciones_webapp: tipoCotizacion === "webapp" ? webappSpecs : null,
            });
            setShowNew(false);
            resetForm();
            await reload();
            toast.success("Cotización creada");
        } catch { toast.error("Error al guardar cotización"); }
    };

    const resetForm = () => {
        setItems([{ descripcion: "", precio: 0 }]);
        setClienteId("");
        setNotas("");
        setPdfUrl("");
        setTipoCotizacion("web");
        setWebappSpecs(DEFAULT_WEBAPP_SPECS);
        setModuloInput("");
    };

    const handleAIGenerate = async () => {
        if (!transcript.trim()) { toast.error("Pega una transcripción o notas"); return; }
        setAiLoading(true);
        await new Promise((r) => setTimeout(r, 1500));
        const generated: CotizacionItem[] = tipoCotizacion === "webapp"
            ? [
                { descripcion: "Análisis y Arquitectura del Sistema", precio: 1500 },
                { descripcion: "Diseño UX/UI (Wireframes + Figma)", precio: 2000 },
                { descripcion: "Desarrollo Backend (API + Base de Datos)", precio: 4000 },
                { descripcion: "Desarrollo Frontend / Admin Panel", precio: 3000 },
                { descripcion: "Autenticación y Control de Roles", precio: 800 },
                { descripcion: "Integraciones y APIs externas", precio: 1200 },
                { descripcion: "Testing QA + Deploy", precio: 1000 },
            ]
            : [
                { descripcion: "Diseño UI/UX personalizado", precio: 800 },
                { descripcion: "Desarrollo Frontend Responsive", precio: 1200 },
                { descripcion: "Integración de funcionalidades", precio: 600 },
                { descripcion: "Optimización SEO On-Page", precio: 400 },
                { descripcion: "Hosting y Deploy", precio: 300 },
            ];
        setItems(generated);
        setShowAI(false);
        setShowNew(true);
        setAiLoading(false);
        toast.success("Ítems generados — revisá y ajustá los precios");
    };

    const updateEstado = async (id: string, estado: EstadoCotizacion) => {
        try {
            await cotizacionesStore.update(id, { estado });
            await reload();
            toast.success(`Cotización marcada como ${estado}`);
        } catch { toast.error("Error al actualizar estado"); }
    };

    const deleteCotizacion = async (id: string) => {
        if (!confirm("¿Seguro que deseas eliminar esta cotización?")) return;
        try {
            await cotizacionesStore.delete(id);
            await reload();
            toast.success("Cotización eliminada");
        } catch { toast.error("Error al eliminar"); }
    };

    if (!mounted) {
        return <div className="space-y-3 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl skeleton" />)}</div>;
    }

    // ── Prompt View ──────────────────────────────────────────────────────────
    if (promptView) {
        const c = clientes.find((cliente) => cliente.id === promptView.cliente_id);
        if (!c) return null;

        const notasCliente = c.notas_seguimiento?.map(n => n.texto).join("\n") || "Sin notas previas.";
        const info = c.info_investigacion
            ? `Qué hace: ${c.info_investigacion.que_hace}\nPuntos débiles: ${c.info_investigacion.puntos_debiles}\nSoluciones: ${c.info_investigacion.soluciones}`
            : "Sin información de investigación.";
        const itemsText = promptView.items.map(i => `- ${i.descripcion}: ${formatCurrency(i.precio)}`).join("\n");
        const isWebApp = promptView.tipo_cotizacion === "webapp";
        const specs = promptView.especificaciones_webapp;

        const webPrompt = `Actúa como un experto en redacción persuasiva y ventas para una agencia de diseño web.
Redacta el copywriting completo para una propuesta de servicios (Cotización de Página Web) basándote en la siguiente información.

--- INFORMACIÓN DEL CLIENTE ---
Nombre: ${c.nombre}
Negocio: ${c.negocio}
Notas de reuniones:
${notasCliente}

Información de investigación:
${info}

Notas de esta cotización:
${promptView.notas || 'Ninguna'}

--- COTIZACIÓN ---
Ítems del servicio:
${itemsText}
Total: ${formatCurrency(promptView.total)}

--- ESTRUCTURA REQUERIDA ---
Estructura la propuesta en 6 secciones con tono persuasivo, profesional y claro para pegar en Figma:

01. Descripción general (Resumen ejecutivo del problema y la solución).
02. Alcance (Descripción detallada de los ítems y su impacto para el negocio).
03. Cronograma (Estimación de tiempos lógicos para este proyecto web).
04. Cotización (Presentación elegante de la inversión).
05. Términos (Condiciones de pago e iteraciones, breve y claro).
06. Acuerdo (Llamado a la acción final y próximos pasos).`;

        const webAppPrompt = `Actúa como un experto en ventas de software B2B y consultoría tecnológica.
Redacta una propuesta técnico-comercial completa para un desarrollo de Software a Medida / Web App.

--- INFORMACIÓN DEL CLIENTE ---
Nombre: ${c.nombre}
Negocio: ${c.negocio}
Notas de reuniones:
${notasCliente}

--- ESPECIFICACIONES DEL SISTEMA ---
Módulos requeridos: ${specs?.modulos?.join(", ") || "Por definir"}
Cantidad de usuarios: ${specs?.cantidad_usuarios || "Por definir"}
Roles y permisos: ${specs?.roles || "Por definir"}
Integraciones: ${specs?.integraciones || "Ninguna especificada"}
Plataforma objetivo: ${specs?.plataforma || "Web"}
Modelo de negocio: ${specs?.modelo_negocio || "Por definir"}
Notas técnicas adicionales: ${specs?.notas_tecnicas || "Ninguna"}

--- COTIZACIÓN ---
Ítems del desarrollo:
${itemsText}
Total de inversión: ${formatCurrency(promptView.total)}

--- ESTRUCTURA REQUERIDA ---
Estructura la propuesta técnico-comercial en las siguientes secciones:

01. Resumen Ejecutivo (Problema del negocio y valor de la solución tecnológica).
02. Descripción del Sistema (Qué es, cómo funciona, beneficios clave para el cliente).
03. Módulos y Funcionalidades (Detalle de cada módulo cotizado y su alcance).
04. Arquitectura y Tecnología (Stack sugerido, seguridad, escalabilidad — en términos accesibles).
05. Plan de Desarrollo (Fases y cronograma estimado).
06. Inversión (Detalle de ítems y totales con justificación de valor).
07. Términos y Modelo de Pago (Hitos, entregables, soporte post-entrega).
08. Próximos Pasos (Llamado a la acción claro).`;

        const promptText = isWebApp ? webAppPrompt : webPrompt;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="w-full max-w-3xl flex flex-col max-h-[90vh] rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                                {isWebApp
                                    ? <><Code2 className="w-5 h-5 text-violet-400" /> Prompt — Web App / Software a Medida</>
                                    : <><Sparkles className="w-5 h-5 text-violet-400" /> Prompt — Página Web</>
                                }
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {isWebApp
                                    ? "Propuesta técnico-comercial para software a medida."
                                    : "Copywriting persuasivo para presentación en Figma."}
                            </p>
                        </div>
                        <button onClick={() => setPromptView(null)} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5 text-muted-foreground" /></button>
                    </div>
                    <textarea
                        readOnly
                        className="flex-1 w-full p-4 rounded-xl bg-secondary/50 border border-primary/20 text-sm font-mono text-foreground focus:outline-none resize-none mb-4"
                        value={promptText}
                    />
                    <div className="flex justify-end gap-3 shrink-0">
                        <button onClick={() => setPromptView(null)} className="px-5 py-2.5 bg-secondary text-foreground text-sm font-medium rounded-xl hover:bg-secondary/80">Cerrar</button>
                        <button onClick={() => { navigator.clipboard.writeText(promptText); toast.success("Prompt copiado"); }} className="px-5 py-2.5 bg-violet-600 text-white font-bold text-sm rounded-xl hover:bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.5)]">
                            Copiar Prompt
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Main View ────────────────────────────────────────────────────────────
    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Cotizaciones</h2>
                    <p className="text-sm text-muted-foreground">{cotizaciones.length} cotizaciones</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowAI(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground hover:border-primary/30 transition-colors">
                        <Sparkles className="w-4 h-4 text-amber-400" /> Generar con IA
                    </button>
                    <button onClick={() => { resetForm(); setShowNew(true); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                        <Plus className="w-4 h-4" /> Nueva
                    </button>
                </div>
            </div>

            {/* AI Modal */}
            {showAI && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-foreground flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-400" /> Generar Cotización con IA</h3>
                            <button onClick={() => setShowAI(false)} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5 text-muted-foreground" /></button>
                        </div>
                        {/* Tipo selector */}
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setTipoCotizacion("web")}
                                className={cn("flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all", tipoCotizacion === "web" ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground hover:text-foreground")}
                            >
                                <Globe className="w-4 h-4" /> Página Web
                            </button>
                            <button
                                onClick={() => setTipoCotizacion("webapp")}
                                className={cn("flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all", tipoCotizacion === "webapp" ? "border-violet-500 bg-violet-500/10 text-violet-400" : "border-border bg-secondary text-muted-foreground hover:text-foreground")}
                            >
                                <Code2 className="w-4 h-4" /> Web App / Software
                            </button>
                        </div>
                        <p className="text-sm text-muted-foreground">Pegá la transcripción de la reunión o notas del cliente para generar los ítems.</p>
                        <textarea
                            value={transcript}
                            onChange={(e) => setTranscript(e.target.value)}
                            rows={7}
                            placeholder={tipoCotizacion === "webapp"
                                ? "El cliente necesita un CRM con módulo de clientes, ventas y reportes. Hasta 20 usuarios con roles distintos..."
                                : "El cliente necesita una landing page para su restaurante, con menú digital, formulario de contacto..."
                            }
                            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowAI(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancelar</button>
                            <button onClick={handleAIGenerate} disabled={aiLoading} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                                {aiLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                {aiLoading ? "Generando..." : "Generar Ítems"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Quote Form */}
            {showNew && (
                <div className="rounded-xl border border-primary/30 bg-card p-5 space-y-5 animate-fade-in">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-foreground">Nueva Cotización</h3>
                        <button onClick={() => { setShowNew(false); resetForm(); }} className="p-1 rounded-lg hover:bg-secondary"><X className="w-4 h-4 text-muted-foreground" /></button>
                    </div>

                    {/* Tipo selector */}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setTipoCotizacion("web")}
                            className={cn("flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all", tipoCotizacion === "web" ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground")}
                        >
                            <Globe className="w-4 h-4" /> Página Web
                        </button>
                        <button
                            onClick={() => setTipoCotizacion("webapp")}
                            className={cn("flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all", tipoCotizacion === "webapp" ? "border-violet-500 bg-violet-500/10 text-violet-400" : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground")}
                        >
                            <Code2 className="w-4 h-4" /> Web App / Software
                        </button>
                    </div>

                    <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                        <option value="">Seleccionar cliente...</option>
                        {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre} — {c.negocio}</option>)}
                    </select>

                    {/* WebApp Specs */}
                    {tipoCotizacion === "webapp" && (
                        <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-500/5 space-y-4">
                            <h4 className="text-sm font-semibold text-violet-400 flex items-center gap-2"><Code2 className="w-4 h-4" /> Especificaciones del Sistema</h4>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-foreground">Módulos del Sistema</label>
                                <div className="flex gap-2">
                                    <input
                                        value={moduloInput}
                                        onChange={(e) => setModuloInput(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addModulo())}
                                        placeholder="Ej: Gestión de Clientes"
                                        className="flex-1 h-8 px-3 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none"
                                    />
                                    <button onClick={addModulo} className="px-3 h-8 rounded-lg bg-violet-500/20 text-violet-400 text-xs font-medium hover:bg-violet-500/30">+ Agregar</button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {webappSpecs.modulos.map((m, i) => (
                                        <span key={i} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">
                                            {m}
                                            <button onClick={() => removeModulo(i)} className="ml-0.5 hover:text-red-400"><X className="w-2.5 h-2.5" /></button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-foreground">Cantidad de usuarios</label>
                                    <input value={webappSpecs.cantidad_usuarios} onChange={(e) => setWebappSpecs({ ...webappSpecs, cantidad_usuarios: e.target.value })} placeholder="Ej: 1-20 usuarios" className="w-full mt-1 h-8 px-3 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-foreground">Roles / Permisos</label>
                                    <input value={webappSpecs.roles} onChange={(e) => setWebappSpecs({ ...webappSpecs, roles: e.target.value })} placeholder="Ej: Admin, Operador, Cliente" className="w-full mt-1 h-8 px-3 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-foreground">Integraciones</label>
                                    <input value={webappSpecs.integraciones} onChange={(e) => setWebappSpecs({ ...webappSpecs, integraciones: e.target.value })} placeholder="Ej: MercadoPago, WhatsApp API" className="w-full mt-1 h-8 px-3 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-foreground">Plataforma objetivo</label>
                                    <select value={webappSpecs.plataforma} onChange={(e) => setWebappSpecs({ ...webappSpecs, plataforma: e.target.value })} className="w-full mt-1 h-8 px-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none">
                                        <option value="">Seleccionar...</option>
                                        <option value="Web (Desktop)">Web (Desktop)</option>
                                        <option value="Web Responsive">Web Responsive</option>
                                        <option value="PWA (Mobile + Web)">PWA (Mobile + Web)</option>
                                        <option value="Multiplataforma">Multiplataforma</option>
                                    </select>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="text-xs font-medium text-foreground">Modelo de negocio</label>
                                    <select value={webappSpecs.modelo_negocio} onChange={(e) => setWebappSpecs({ ...webappSpecs, modelo_negocio: e.target.value })} className="w-full mt-1 h-8 px-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none">
                                        <option value="">Seleccionar...</option>
                                        <option value="Pago único (licencia)">Pago único (licencia)</option>
                                        <option value="SaaS (suscripción mensual)">SaaS (suscripción mensual)</option>
                                        <option value="Freemium + planes">Freemium + planes</option>
                                        <option value="Uso interno / sin monetización">Uso interno / sin monetización</option>
                                    </select>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="text-xs font-medium text-foreground">Notas técnicas adicionales</label>
                                    <textarea value={webappSpecs.notas_tecnicas} onChange={(e) => setWebappSpecs({ ...webappSpecs, notas_tecnicas: e.target.value })} rows={2} placeholder="Cualquier requerimiento técnico específico..." className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none resize-none" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Items Table */}
                    <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_120px_40px] gap-2 text-[10px] text-muted-foreground uppercase">
                            <span>Descripción</span><span>Precio</span><span></span>
                        </div>
                        {items.map((item, i) => (
                            <div key={i} className="grid grid-cols-[1fr_120px_40px] gap-2">
                                <input value={item.descripcion} onChange={(e) => updateItem(i, "descripcion", e.target.value)} className="h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Descripción del servicio..." />
                                <input type="number" value={item.precio || ""} onChange={(e) => updateItem(i, "precio", e.target.value)} className="h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="0" />
                                <button onClick={() => removeItem(i)} className="h-9 flex items-center justify-center rounded-lg hover:bg-destructive/20"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                            </div>
                        ))}
                        <button onClick={addItem} className="text-xs text-primary hover:underline">+ Agregar ítem</button>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <span className="text-sm font-medium text-foreground">Total</span>
                        <span className="text-lg font-bold text-primary">{formatCurrency(total)}</span>
                    </div>

                    {/* PDF Upload */}
                    <div className="flex flex-col gap-3 p-3 rounded-lg border border-border bg-secondary/30">
                        <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2"><FileText className="w-3 h-3" /> Adjuntar PDF</label>
                        <div className="flex items-center gap-3">
                            <input type="file" accept=".pdf" onChange={handleFileUpload} id="pdf-upload" className="hidden" />
                            <label htmlFor="pdf-upload" className={cn("flex-1 flex items-center justify-center gap-2 h-10 rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-all text-sm", uploading && "opacity-50 pointer-events-none")}>
                                {uploading ? <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
                                {pdfUrl ? "Cambiar PDF" : "Subir archivo PDF"}
                            </label>
                            {pdfUrl && (
                                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="h-10 px-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20">
                                    <LinkIcon className="w-3.5 h-3.5" /> Ver PDF
                                </a>
                            )}
                        </div>
                    </div>

                    <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Notas adicionales..." className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />

                    <div className="flex justify-end gap-2">
                        <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:opacity-90">Guardar Cotización</button>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="space-y-3">
                {cotizaciones.map((q) => {
                    const cliente = clientes.find((c) => c.id === q.cliente_id);
                    const tipo = (q.tipo_cotizacion || "web") as TipoCotizacion;
                    return (
                        <div key={q.id} className="rounded-xl border border-border bg-card p-4 card-hover">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <h4 className="text-sm font-semibold text-foreground">{cliente?.nombre || "Cliente"}</h4>
                                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", TIPO_BADGE[tipo])}>
                                            {tipo === "webapp" ? <><Code2 className="w-2.5 h-2.5 inline mr-1" /></> : <><Globe className="w-2.5 h-2.5 inline mr-1" /></>}
                                            {TIPO_LABEL[tipo]}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{cliente?.negocio} · {formatDate(q.created_at)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={cn("text-[10px] px-2.5 py-1 rounded-full border font-medium capitalize", ESTADO_BADGE[q.estado])}>{q.estado}</span>
                                    <span className="text-base font-bold text-foreground">{formatCurrency(q.total)}</span>
                                </div>
                            </div>

                            {/* Modules for webapp */}
                            {tipo === "webapp" && (q.especificaciones_webapp?.modulos?.length ?? 0) > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                    {q.especificaciones_webapp?.modulos?.map((m, i) => (
                                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">{m}</span>
                                    ))}
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
                                {q.items.map((item, i) => (
                                    <div key={i} className="flex justify-between text-xs px-2 py-1.5 rounded bg-secondary/50">
                                        <span className="text-muted-foreground">{item.descripcion}</span>
                                        <span className="text-foreground font-medium">{formatCurrency(item.precio)}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center justify-between mt-4">
                                <div className="flex gap-1.5">
                                    {(["borrador", "enviada", "aceptada", "rechazada"] as EstadoCotizacion[]).map((e) => (
                                        <button key={e} onClick={() => updateEstado(q.id, e)} className={cn("px-2 py-1 rounded text-[10px] capitalize transition-colors", q.estado === e ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-secondary")}>
                                            {e}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2">
                                    {q.pdf_url && (
                                        <a href={q.pdf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20">
                                            <FileText className="w-4 h-4" /> Ver PDF
                                        </a>
                                    )}
                                    <button onClick={() => setPromptView(q)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold hover:bg-violet-500/20">
                                        <Sparkles className="w-4 h-4" /> Armar Prompt
                                    </button>
                                    <button onClick={() => deleteCotizacion(q.id)} className="p-1.5 rounded-lg bg-secondary/50 hover:bg-destructive/20">
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
