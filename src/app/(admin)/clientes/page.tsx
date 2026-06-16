"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, MessageCircle, ArrowRight, X, GripVertical, Search, ShieldCheck, ChevronDown, ChevronUp, Eye, Trash2, LayoutGrid, List, Filter } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { clientesStore, proyectosStore, tareasStore } from "@/lib/store";
import type { Cliente, EtapaCliente, TipoProyecto } from "@/lib/types";
import { ETAPA_LABELS, ETAPA_COLORS, FASES_PIPELINE } from "@/lib/types";
import { PROJECT_TEMPLATES } from "@/lib/templates";
import { slugify } from "@/lib/utils";
import { toast } from "sonner";
import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    useDraggable,
    useDroppable,
} from "@dnd-kit/core";
import { storageStore } from "@/lib/store";
import { Upload, FileText, Sparkles, Loader2, ExternalLink } from "lucide-react";

const MAX_VISIBLE_CARDS = 3;

// --- Nuevo Cliente Modal ---
function NuevoClienteModal({
    open,
    onClose,
    onSave,
}: {
    open: boolean;
    onClose: () => void;
    onSave: (data: Partial<Cliente>) => void;
}) {
    const [form, setForm] = useState({
        nombre: "",
        negocio: "",
        email: "",
        tel: "",
        canal: "",
        enlace: "",
        contexto: "",
        mantenimiento_mensual: false,
    });

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-foreground">Nuevo Contacto</h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Nombre *</label>
                            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Negocio</label>
                            <input value={form.negocio} onChange={(e) => setForm({ ...form, negocio: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Teléfono</label>
                            <input value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Canal de Contacto</label>
                            <select value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                                <option value="">Seleccionar...</option>
                                <option value="Instagram">Instagram</option>
                                <option value="WhatsApp">WhatsApp</option>
                                <option value="Google">Google</option>
                                <option value="LinkedIn">LinkedIn</option>
                                <option value="Referido">Referido</option>
                                <option value="Email">Email</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Enlace del Negocio</label>
                            <input placeholder="Web, Instagram, etc." value={form.enlace} onChange={(e) => setForm({ ...form, enlace: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Contexto / Notas adicionales</label>
                        <textarea placeholder="Rubro, observaciones, o puntos débiles detectados..." value={form.contexto} onChange={(e) => setForm({ ...form, contexto: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                    </div>
                    <div className="flex items-center gap-2 mt-2 p-3 bg-secondary/50 rounded-lg border border-border">
                        <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50"
                            checked={form.mantenimiento_mensual}
                            onChange={(e) => setForm({ ...form, mantenimiento_mensual: e.target.checked })}
                            id="mant-mensual"
                        />
                        <label htmlFor="mant-mensual" className="text-sm font-medium text-foreground cursor-pointer flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            Abona Mantenimiento Mensual
                        </label>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={() => {
                            if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
                            const info_investigacion = {
                                que_hace: "",
                                puntos_debiles: "",
                                soluciones: "",
                                enlace: form.enlace,
                                contexto: form.contexto
                            };
                            onSave({
                                nombre: form.nombre,
                                negocio: form.negocio,
                                email: form.email,
                                tel: form.tel,
                                canal: form.canal,
                                mantenimiento_mensual: form.mantenimiento_mensual,
                                etapa: "contacto" as EtapaCliente,
                                info_investigacion,
                                msg_whatsapp: "",
                                notas_seguimiento: []
                            });
                            setForm({ nombre: "", negocio: "", email: "", tel: "", canal: "", enlace: "", contexto: "", mantenimiento_mensual: false });
                            onClose();
                        }}
                        className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
                    >
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Nuevo Proyecto Modal ---
function NuevoProyectoModal({ open, onClose, cliente }: { open: boolean; onClose: () => void; cliente: Cliente | null }) {
    const [tipo, setTipo] = useState<TipoProyecto>("landing");
    const [nombre, setNombre] = useState("");

    useEffect(() => {
        if (cliente) setNombre(`${cliente.negocio} - Web`);
    }, [cliente]);

    if (!open || !cliente) return null;

    const handleCreate = async () => {
        if (!nombre.trim()) { toast.error("Nombre de proyecto requerido"); return; }
        try {
            const proyecto = await proyectosStore.create({
                cliente_id: cliente.id,
                nombre,
                descripcion: "",
                es_interno: false,
                accesos: [],
                tipo_proyecto: tipo,
                figma_url: "",
                calendly_url: "https://calendly.com/agencia/reunion",
                slug_portal: slugify(nombre + "-" + Date.now().toString(36)),
                estado: "activo",
            });
            // Auto-create tasks from template
            const template = PROJECT_TEMPLATES[tipo];
            await tareasStore.createBulk(
                template.map((t) => ({
                    proyecto_id: proyecto.id,
                    titulo: t.titulo,
                    descripcion: "",
                    prioridad: t.prioridad,
                    estado: "pendiente" as const,
                    categoria: t.categoria,
                }))
            );
            toast.success(`Proyecto "${nombre}" creado con ${template.length} tareas`);
            onClose();
        } catch (error) {
            toast.error("Error al crear el proyecto");
            console.error(error);
        }
    };

    const TIPOS = [
        { value: "landing" as const, label: "Landing Page", desc: "Página única de conversión" },
        { value: "institucional" as const, label: "Web Institucional", desc: "Sitio web completo multisección" },
        { value: "ecommerce" as const, label: "E-Commerce", desc: "Tienda online con pagos" },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-foreground">Nuevo Proyecto para {cliente.nombre}</h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Nombre del Proyecto</label>
                        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground mb-2 block">Tipo de Proyecto</label>
                        <div className="grid grid-cols-3 gap-3">
                            {TIPOS.map((t) => (
                                <button
                                    key={t.value}
                                    onClick={() => setTipo(t.value)}
                                    className={cn(
                                        "p-3 rounded-xl border text-left transition-all",
                                        tipo === t.value
                                            ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                                            : "border-border bg-secondary hover:border-primary/30"
                                    )}
                                >
                                    <p className="text-sm font-medium text-foreground">{t.label}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                        <p className="text-xs text-muted-foreground mb-1">Tareas que se crearán automáticamente:</p>
                        <p className="text-sm font-medium text-primary">{PROJECT_TEMPLATES[tipo].length} tareas</p>
                        <div className="mt-2 space-y-1 max-h-[120px] overflow-y-auto">
                            {PROJECT_TEMPLATES[tipo].map((t, i) => (
                                <p key={i} className="text-xs text-muted-foreground">• {t.titulo}</p>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancelar</button>
                    <button onClick={handleCreate} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:opacity-90">
                        Crear Proyecto
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Cliente Detail Modal ---
function ClienteDetailModal({
    open,
    onClose,
    cliente,
    onUpdate,
    onAdvance,
}: {
    open: boolean;
    onClose: () => void;
    cliente: Cliente | null;
    onUpdate: (id: string, data: Partial<Cliente>) => void;
    onAdvance: (cliente: Cliente) => void;
}) {
    const [inv, setInv] = useState({
        que_hace: "",
        puntos_debiles: "",
        soluciones: "",
        enlace: "",
        contexto: "",
        colores: "",
        tipografia: "",
        logo_url: "",
        prompt_maestro: "",
        tipo_pagina: "landing" as TipoProyecto,
        analisis_impacto: "",
        solucion_tecnica: "",
        guion_demo: ""
    });
    const [seguimiento, setSeguimiento] = useState("");
    const [waMsg, setWaMsg] = useState("");
    const [loadingInvestigar, setLoadingInvestigar] = useState(false);
    const [loadingGenerarMsg, setLoadingGenerarMsg] = useState(false);
    const [loadingRegistrarDemo, setLoadingRegistrarDemo] = useState(false);
    const [servicioSeleccionado, setServicioSeleccionado] = useState("Landing Page");

    useEffect(() => {
        if (cliente?.info_investigacion) {
            setInv({
                que_hace: cliente.info_investigacion.que_hace || "",
                puntos_debiles: cliente.info_investigacion.puntos_debiles || "",
                soluciones: cliente.info_investigacion.soluciones || "",
                enlace: cliente.info_investigacion.enlace || "",
                contexto: cliente.info_investigacion.contexto || "",
                colores: cliente.info_investigacion.colores || "",
                tipografia: cliente.info_investigacion.tipografia || "",
                logo_url: cliente.info_investigacion.logo_url || "",
                prompt_maestro: cliente.info_investigacion.prompt_maestro || "",
                tipo_pagina: cliente.info_investigacion.tipo_pagina || "landing",
                analisis_impacto: cliente.info_investigacion.analisis_impacto || "",
                solucion_tecnica: cliente.info_investigacion.solucion_tecnica || "",
                guion_demo: cliente.info_investigacion.guion_demo || ""
            });
        } else {
            setInv({
                que_hace: "",
                puntos_debiles: "",
                soluciones: "",
                enlace: "",
                contexto: "",
                colores: "",
                tipografia: "",
                logo_url: "",
                prompt_maestro: "",
                tipo_pagina: "landing",
                analisis_impacto: "",
                solucion_tecnica: "",
                guion_demo: ""
            });
        }
        setWaMsg(cliente?.msg_whatsapp || "");
    }, [cliente]);

    if (!open || !cliente) return null;

    const handleInvestigarIA = async () => {
        setLoadingInvestigar(true);
        try {
            const res = await fetch("/api/gemini/investigar-contacto", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: cliente.nombre,
                    negocio: cliente.negocio,
                    link: inv.enlace,
                    contexto: inv.contexto,
                    tipo_pagina: inv.tipo_pagina || "landing"
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al investigar con IA");

            const newInv = {
                ...inv,
                que_hace: data.que_hace || "",
                puntos_debiles: data.puntos_debiles || "",
                soluciones: data.soluciones || "",
                colores: data.colores || "",
                tipografia: data.tipografia || "",
                logo_url: data.logo_url || "",
                prompt_maestro: data.prompt_maestro || "",
                tipo_pagina: data.tipo_pagina || inv.tipo_pagina || "landing"
            };
            setInv(newInv);
            onUpdate(cliente.id, { info_investigacion: newInv });
            toast.success("Investigación completada y Prompt Maestro generado");
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Error al investigar lead");
        } finally {
            setLoadingInvestigar(false);
        }
    };

    const handleGenerarWhatsappIA = async () => {
        setLoadingGenerarMsg(true);
        try {
            const res = await fetch("/api/gemini/generar-whatsapp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: cliente.nombre,
                    negocio: cliente.negocio,
                    que_hace: inv.que_hace,
                    puntos_debiles: inv.puntos_debiles,
                    soluciones: inv.soluciones,
                    tipo_pagina: inv.tipo_pagina,
                    link_demo: cliente.link_demo,
                    prompt_maestro: inv.prompt_maestro
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al generar mensaje");

            setWaMsg(data.mensaje);
            const updatedInv = {
                ...inv,
                analisis_impacto: data.analisis_impacto || inv.analisis_impacto,
                solucion_tecnica: data.solucion_tecnica || inv.solucion_tecnica,
                guion_demo: data.guion_demo || inv.guion_demo
            };
            setInv(updatedInv);
            onUpdate(cliente.id, { 
                msg_whatsapp: data.mensaje,
                info_investigacion: updatedInv
            });
            toast.success("Mensaje de WhatsApp, Análisis y Guion generados");
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Error al generar mensaje de WhatsApp");
        } finally {
            setLoadingGenerarMsg(false);
        }
    };

    const handleEnviarWhatsapp = () => {
        if (!cliente.tel) {
            toast.error("El contacto no tiene un teléfono registrado");
            return;
        }
        const cleanTel = cliente.tel.replace(/\D/g, "");
        if (!cleanTel) {
            toast.error("El número de teléfono no es válido");
            return;
        }
        
        let finalMsg = waMsg;
        if (cliente.link_demo) {
            finalMsg = finalMsg.replace(/\[LINK DE LA DEMO EN VERCEL\]/g, cliente.link_demo);
        }

        // Copy message to clipboard automatically before opening WhatsApp
        navigator.clipboard.writeText(finalMsg);
        toast.success("Mensaje copiado al portapapeles");

        const url = `https://api.whatsapp.com/send?phone=${cleanTel}&text=${encodeURIComponent(finalMsg)}`;
        window.open(url, "_blank");

        if (cliente.etapa === "contacto" || cliente.etapa === "investigando" || cliente.etapa === "calificado") {
            const confirmAdvance = confirm("¿Deseas marcar la etapa de este contacto como 'Contactado'?");
            if (confirmAdvance) {
                onUpdate(cliente.id, { etapa: "contactado" });
            }
        }
    };

    const generateClientSummary = () => {
        const msg = `RESUMEN DE CLIENTE: ${cliente.nombre} (${cliente.negocio})\n\n` +
                    `A QUÉ SE DEDICA:\n${inv.que_hace}\n\n` +
                    `PUNTOS DÉBILES:\n${inv.puntos_debiles}\n\n` +
                    `IDEAS DE SOLUCIÓN:\n${inv.soluciones}\n\n` +
                    `IDENTIDAD VISUAL:\n` +
                    `- Paleta de colores: ${inv.colores || "No especificada"}\n` +
                    `- Tipografía: ${inv.tipografia || "No especificada"}\n` +
                    `- Logo: ${inv.logo_url || "No especificado"}`;
        setWaMsg(msg);
        onUpdate(cliente.id, { msg_whatsapp: msg });
        toast.success("Resumen generado");
    };

    const saveInvestigation = () => {
        onUpdate(cliente.id, { info_investigacion: inv });
        toast.success("Investigación guardada");
    };

    const handleRegistrarDemo = async () => {
        if (!cliente.link_demo) {
            toast.error("Primero pegá el link de la demo en Vercel");
            return;
        }
        setLoadingRegistrarDemo(true);
        try {
            const res = await fetch("/api/clientes/actualizar-demo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clienteId: cliente.id,
                    linkDemo: cliente.link_demo
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al registrar demo");
            
            if (data.cliente) {
                setWaMsg(data.cliente.msg_whatsapp || "");
                if (data.cliente.info_investigacion) {
                    setInv({
                        que_hace: data.cliente.info_investigacion.que_hace || "",
                        puntos_debiles: data.cliente.info_investigacion.puntos_debiles || "",
                        soluciones: data.cliente.info_investigacion.soluciones || "",
                        enlace: data.cliente.info_investigacion.enlace || "",
                        contexto: data.cliente.info_investigacion.contexto || "",
                        colores: data.cliente.info_investigacion.colores || "",
                        tipografia: data.cliente.info_investigacion.tipografia || "",
                        logo_url: data.cliente.info_investigacion.logo_url || "",
                        prompt_maestro: data.cliente.info_investigacion.prompt_maestro || "",
                        tipo_pagina: data.cliente.info_investigacion.tipo_pagina || "landing",
                        analisis_impacto: data.cliente.info_investigacion.analisis_impacto || "",
                        solucion_tecnica: data.cliente.info_investigacion.solucion_tecnica || "",
                        guion_demo: data.cliente.info_investigacion.guion_demo || ""
                    });
                }
                onUpdate(cliente.id, data.cliente);
            }
            toast.success("✅ Demo registrada, Análisis e Impacto y Guion generados");
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Error al registrar demo");
        } finally {
            setLoadingRegistrarDemo(false);
        }
    };

    const addSeguimiento = () => {
        if (!seguimiento.trim()) return;
        const notas = [...(cliente.notas_seguimiento || []), { id: crypto.randomUUID(), fecha: new Date().toISOString(), texto: seguimiento }];
        onUpdate(cliente.id, { notas_seguimiento: notas });
        setSeguimiento("");
        toast.success("Nota de seguimiento agregada");
    };

    const NEXT_ETAPA: Partial<Record<EtapaCliente, EtapaCliente>> = {
        contacto: "investigando",
        investigando: "calificado",
        calificado: "contactado",
        contactado: "cotizado",
        cotizado: "cliente_actual",
        cliente_actual: "cliente_finalizado",
    };

    const clientHasInvestigation = cliente.info_investigacion?.que_hace || cliente.info_investigacion?.puntos_debiles;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
            <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-br from-primary to-cyan-400 text-sm font-bold text-white">
                            {getInitials(cliente.nombre)}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">{cliente.nombre}</h3>
                            <p className="text-sm text-muted-foreground">{cliente.negocio}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {cliente.mantenimiento_mensual && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase">
                                <ShieldCheck className="w-3.5 h-3.5" /> Mantenimiento
                            </div>
                        )}
                        <span className={cn("text-xs px-2.5 py-1 rounded-full border font-medium", ETAPA_COLORS[cliente.etapa])}>
                            {ETAPA_LABELS[cliente.etapa]}
                        </span>
                        <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5 text-muted-foreground" /></button>
                    </div>
                </div>

                {/* Datos Básicos */}
                <div className="grid grid-cols-4 gap-3 mb-4 p-3 rounded-lg bg-secondary/50 border border-border">
                    <div><p className="text-[10px] text-muted-foreground uppercase">Email</p><p className="text-sm text-foreground truncate">{cliente.email || "—"}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase">Teléfono</p><p className="text-sm text-foreground">{cliente.tel || "—"}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase">Canal</p><p className="text-sm text-foreground">{cliente.canal || "—"}</p></div>
                    <div className="flex items-center justify-end">
                        <button
                            onClick={() => {
                                onUpdate(cliente.id, { mantenimiento_mensual: !cliente.mantenimiento_mensual });
                                toast.success(cliente.mantenimiento_mensual ? "Mantenimiento desactivado" : "Mantenimiento activado");
                            }}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                                cliente.mantenimiento_mensual
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"
                                    : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"
                            )}>
                            <ShieldCheck className="w-4 h-4" /> {cliente.mantenimiento_mensual ? "Abona Mantenimiento" : "Sin Mantenimiento"}
                        </button>
                    </div>
                </div>

                {/* Link de Demo en Vercel */}
                <div className="mb-5 p-3 rounded-lg bg-secondary/50 border border-border space-y-2">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                            <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Link de Demo en Vercel</label>
                            <input
                                type="text"
                                value={cliente.link_demo || ""}
                                onChange={(e) => onUpdate(cliente.id, { link_demo: e.target.value })}
                                placeholder="Ej: https://tu-demo.vercel.app"
                                className="w-full h-8 px-3 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                            />
                        </div>
                        {cliente.link_demo && (
                            <a
                                href={cliente.link_demo}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-5 px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-xs font-bold border border-primary/30 transition-colors flex items-center gap-1.5 animate-fade-in"
                            >
                                <ExternalLink className="w-3.5 h-3.5" /> Probar Demo
                            </a>
                        )}
                    </div>
                    {cliente.link_demo && (
                        <button
                            type="button"
                            onClick={handleRegistrarDemo}
                            disabled={loadingRegistrarDemo}
                            className="w-full px-3 py-2 rounded-lg text-xs font-bold bg-green-600 hover:bg-green-700 text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loadingRegistrarDemo ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Registrando y generando mensaje...</>
                            ) : (
                                <><Sparkles className="w-3.5 h-3.5" /> Registrar Demo y Generar WhatsApp</>
                            )}
                        </button>
                    )}
                </div>

                {/* Fase Investigación */}
                {(cliente.etapa === "investigando" || cliente.etapa === "contacto") && (
                    <div className="mb-5 space-y-4">
                        <h4 className="text-sm font-semibold text-foreground border-b border-border/40 pb-2 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-primary" /> Investigación del Negocio
                        </h4>
                        
                        {/* Enriquecer con IA Card */}
                        <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                            <div className="flex items-center justify-between">
                                <h5 className="text-[11px] font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                                    <Sparkles className="w-3.5 h-3.5 animate-pulse-soft" /> Investigar y Analizar con IA
                                </h5>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[10px] text-muted-foreground mb-1 block font-semibold uppercase">Enlace del Negocio</label>
                                    <input
                                        type="text"
                                        value={inv.enlace}
                                        onChange={(e) => setInv({ ...inv, enlace: e.target.value })}
                                        placeholder="Ej: instagram.com/negocio, web.com..."
                                        className="w-full h-9 px-3 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                                        disabled={loadingInvestigar}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-muted-foreground mb-1 block font-semibold uppercase">Contexto / Notas adicionales</label>
                                    <textarea
                                        value={inv.contexto}
                                        onChange={(e) => setInv({ ...inv, contexto: e.target.value })}
                                        placeholder="Rubro del negocio, competidores o dolores observados..."
                                        rows={1}
                                        className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none h-9"
                                        disabled={loadingInvestigar}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-muted-foreground mb-1 block font-semibold uppercase">Tipo de Proyecto</label>
                                    <select
                                        value={inv.tipo_pagina || "landing"}
                                        onChange={(e) => setInv({ ...inv, tipo_pagina: e.target.value as any })}
                                        className="w-full h-9 px-2 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
                                        disabled={loadingInvestigar}
                                    >
                                        <option value="landing">Landing Page (Conversión)</option>
                                        <option value="institucional">Web Institucional (Marca/Catálogo)</option>
                                        <option value="ecommerce">E-Commerce (Tienda Online)</option>
                                        <option value="webapp">Web App a medida</option>
                                        <option value="saas">SaaS / Producto</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end pt-1">
                                <button
                                    onClick={handleInvestigarIA}
                                    disabled={loadingInvestigar}
                                    className="px-3.5 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {loadingInvestigar ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analizando...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-3.5 h-3.5" /> Investigar con IA
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Campos Manuales / Resultados de IA */}
                        <div className="space-y-3 pt-2">
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block font-semibold">¿Qué hace el negocio?</label>
                                <textarea value={inv.que_hace} onChange={(e) => setInv({ ...inv, que_hace: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block font-semibold">Puntos Débiles</label>
                                <textarea value={inv.puntos_debiles} onChange={(e) => setInv({ ...inv, puntos_debiles: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block font-semibold">Soluciones Propuestas</label>
                                <textarea value={inv.soluciones} onChange={(e) => setInv({ ...inv, soluciones: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block font-semibold">Paleta de Colores</label>
                                    <input type="text" value={inv.colores || ""} onChange={(e) => setInv({ ...inv, colores: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Ej: #0F172A Oscuro, #10B981 Acento..." />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block font-semibold">Tipografías</label>
                                    <input type="text" value={inv.tipografia || ""} onChange={(e) => setInv({ ...inv, tipografia: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Ej: Inter + Sora..." />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block font-semibold">URL del Logo</label>
                                <div className="flex gap-2">
                                    <input type="text" value={inv.logo_url || ""} onChange={(e) => setInv({ ...inv, logo_url: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 flex-1" placeholder="Ej: https://negocio.com/logo.png" />
                                    {inv.logo_url && inv.logo_url.startsWith("http") && (
                                        <div className="w-10 h-10 rounded-lg border border-border bg-secondary flex items-center justify-center overflow-hidden p-1">
                                            <img src={inv.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Prompt Maestro para Antigravity */}
                            {inv.prompt_maestro && (
                                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-primary font-bold text-xs">
                                            <Sparkles className="w-4 h-4 animate-pulse" /> PROMPT MAESTRO PARA ANTIGRAVITY
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(inv.prompt_maestro || "");
                                                toast.success("Prompt Maestro copiado al portapapeles");
                                            }}
                                            className="px-3 py-1 rounded-lg text-xs bg-primary text-primary-foreground font-bold hover:opacity-95 transition-opacity"
                                        >
                                            Copiar Prompt
                                        </button>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto p-3 rounded-lg bg-secondary text-xs font-mono text-muted-foreground whitespace-pre-wrap select-all border border-border">
                                        {inv.prompt_maestro}
                                    </div>
                                    <div className="space-y-1.5 text-[10px] text-muted-foreground bg-secondary/30 p-2 rounded-lg border border-border/40">
                                        <span className="font-semibold block">Comando para auto-desplegar y registrar en CRM:</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const scriptPath = "D:/Gutmark/Diseño Web/SaaS/Galuweb CRM/galuweb-crm/scripts/deploy-demo.js";
                                                const cmd = `node "${scriptPath}" --client=${cliente.id}`;
                                                navigator.clipboard.writeText(cmd);
                                                toast.success("Comando de despliegue copiado (con ruta completa al script)");
                                            }}
                                            className="font-mono text-[9px] hover:text-foreground underline transition-colors block w-full text-left"
                                        >
                                            📋 Copiar comando de deploy
                                        </button>
                                        <p className="text-[8px] opacity-70">Ejecutalo desde la carpeta del proyecto demo generado.</p>
                                    </div>
                                </div>
                            )}

                            {/* Análisis de Impacto y Solución Técnica */}
                            {(inv.analisis_impacto || inv.solucion_tecnica) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 p-4 rounded-xl border border-border bg-secondary/20">
                                    <div>
                                        <label className="text-xs text-primary font-bold uppercase tracking-wider block mb-2">📊 Análisis de Impacto</label>
                                        <textarea
                                            value={inv.analisis_impacto}
                                            onChange={(e) => setInv({ ...inv, analisis_impacto: e.target.value })}
                                            rows={3}
                                            className="w-full px-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                                            placeholder="Dinero/tiempo perdido..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-primary font-bold uppercase tracking-wider block mb-2">⚙️ Solución Técnica</label>
                                        <textarea
                                            value={inv.solucion_tecnica}
                                            onChange={(e) => setInv({ ...inv, solucion_tecnica: e.target.value })}
                                            rows={3}
                                            className="w-full px-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                                            placeholder="Herramienta recomendada..."
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Guion de la Demo */}
                            {inv.guion_demo && (
                                <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-3 mt-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
                                            🎬 GUION DE VIDEO EXPLICATIVO (2 MIN)
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(inv.guion_demo || "");
                                                toast.success("Guion copiado al portapapeles");
                                            }}
                                            className="px-3 py-1 rounded-lg text-xs bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors"
                                        >
                                            Copiar Guion
                                        </button>
                                    </div>
                                    <textarea
                                        value={inv.guion_demo}
                                        onChange={(e) => setInv({ ...inv, guion_demo: e.target.value })}
                                        rows={6}
                                        className="w-full p-3 rounded-lg bg-secondary text-xs font-sans text-muted-foreground whitespace-pre-wrap select-all border border-border focus:outline-none focus:ring-1 focus:ring-blue-500/50 leading-relaxed"
                                    />
                                </div>
                            )}
                            <div className="flex gap-2 pt-2">
                                <button onClick={saveInvestigation} className="px-3.5 py-2 rounded-lg text-xs bg-secondary border border-border text-foreground hover:bg-accent transition-colors font-medium">
                                    Guardar Investigación
                                </button>
                                <button onClick={generateClientSummary} className="px-3.5 py-2 rounded-lg text-xs bg-secondary border border-border text-foreground hover:bg-accent transition-colors flex items-center gap-1.5 font-medium">
                                    <FileText className="w-3.5 h-3.5" /> Resumen Clásico
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Calificado - Resumen visual */}
                {cliente.etapa === "calificado" && cliente.info_investigacion && (
                    <div className="mb-5 space-y-3">
                        <h4 className="text-sm font-semibold text-foreground mb-3">Resumen de Investigación</h4>
                        <div className="grid grid-cols-1 gap-3">
                            {[
                                { label: "Qué hace", value: cliente.info_investigacion.que_hace },
                                { label: "Puntos Débiles", value: cliente.info_investigacion.puntos_debiles },
                                { label: "Soluciones", value: cliente.info_investigacion.soluciones },
                                { label: "Colores de Identidad", value: cliente.info_investigacion.colores },
                                { label: "Tipografía Recomendada", value: cliente.info_investigacion.tipografia },
                                ...(cliente.info_investigacion.analisis_impacto ? [{ label: "📊 Análisis de Impacto", value: cliente.info_investigacion.analisis_impacto }] : []),
                                ...(cliente.info_investigacion.solucion_tecnica ? [{ label: "⚙️ Solución Técnica", value: cliente.info_investigacion.solucion_tecnica }] : []),
                                ...(cliente.info_investigacion.guion_demo ? [{ label: "🎬 Guion de la Demo", value: cliente.info_investigacion.guion_demo }] : []),
                            ].map((item) => (
                                <div key={item.label} className="p-3 rounded-lg bg-secondary/50 border border-border">
                                    <p className="text-[10px] text-primary uppercase font-medium mb-0.5">{item.label}</p>
                                    <p className="text-sm text-foreground whitespace-pre-line">{item.value || "—"}</p>
                                </div>
                            ))}
                            {cliente.info_investigacion.logo_url && (
                                <div className="p-3 rounded-lg bg-secondary/50 border border-border flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] text-primary uppercase font-medium mb-0.5">Logo</p>
                                        <p className="text-xs text-muted-foreground break-all">{cliente.info_investigacion.logo_url}</p>
                                    </div>
                                    {cliente.info_investigacion.logo_url.startsWith("http") && (
                                        <div className="w-12 h-12 rounded-lg border border-border bg-card flex items-center justify-center overflow-hidden p-1 shrink-0">
                                            <img src={cliente.info_investigacion.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Generador de Mensajes WhatsApp con IA */}
                {(cliente.etapa === "contacto" || cliente.etapa === "investigando" || cliente.etapa === "calificado") && (inv.que_hace || clientHasInvestigation) && (
                    <div className="mb-5 pt-4 border-t border-border/60 space-y-3">
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                            <MessageCircle className="w-4 h-4 text-emerald-500" /> Mensaje de Prospección (IA)
                        </h4>
                        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                                <div>
                                    <label className="text-[10px] text-muted-foreground mb-1 block font-semibold uppercase">Servicio a ofrecer</label>
                                    <select
                                        value={servicioSeleccionado}
                                        onChange={(e) => setServicioSeleccionado(e.target.value)}
                                        className="w-full h-9 px-2 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer"
                                        disabled={loadingGenerarMsg}
                                    >
                                        <option value="Landing Page">Landing Page (Conversión)</option>
                                        <option value="Web Institucional">Web Institucional (Marca/Catálogo)</option>
                                        <option value="E-Commerce">E-Commerce (Tienda Online)</option>
                                        <option value="Web App a medida">Web App a medida (Plataforma/Portal)</option>
                                        <option value="SaaS">SaaS (Software como servicio)</option>
                                    </select>
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleGenerarWhatsappIA}
                                        disabled={loadingGenerarMsg}
                                        className="w-full md:w-auto h-9 px-4 rounded-lg text-xs bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                        {loadingGenerarMsg ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Redactando...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-3.5 h-3.5" /> Generar Mensaje IA
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Previsualización del Mensaje de WhatsApp (Editable) */}
                {waMsg && (
                    <div className="mb-5 p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3 relative group">
                        <div className="flex justify-between items-center">
                            <p className="text-xs text-primary font-bold uppercase tracking-wider">Mensaje a Enviar por WhatsApp</p>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(waMsg);
                                    toast.success("Mensaje copiado al portapapeles");
                                }}
                                className="text-[10px] bg-secondary border border-border hover:bg-accent text-foreground px-2 py-1 rounded transition-colors font-semibold"
                            >
                                Copiar
                            </button>
                        </div>
                        <textarea
                            value={waMsg}
                            onChange={(e) => {
                                setWaMsg(e.target.value);
                                onUpdate(cliente.id, { msg_whatsapp: e.target.value });
                            }}
                            rows={5}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none font-sans leading-relaxed"
                            placeholder="Mensaje de WhatsApp..."
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(waMsg);
                                    toast.success("Mensaje copiado al portapapeles");
                                }}
                                className="px-4 py-2 rounded-lg text-xs bg-secondary border border-border text-foreground hover:bg-accent transition-colors font-bold"
                            >
                                Copiar Mensaje
                            </button>
                            {cliente.tel ? (
                                <button
                                    onClick={handleEnviarWhatsapp}
                                    className="px-4 py-2 rounded-lg text-xs bg-emerald-600 text-white hover:bg-emerald-700 transition-colors font-bold flex items-center gap-1.5"
                                >
                                    <MessageCircle className="w-4 h-4" /> Enviar por WhatsApp
                                </button>
                            ) : (
                                <p className="text-[11px] text-amber-500 italic mt-1">Completa el campo Teléfono en el CRM para poder enviar por WhatsApp.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Calificado - Resumen visual */}
                {cliente.etapa === "calificado" && cliente.info_investigacion && (
                    <div className="mb-5 space-y-3">
                        <h4 className="text-sm font-semibold text-foreground mb-3">Resumen de Investigación</h4>
                        <div className="grid grid-cols-1 gap-3">
                            {[
                                { label: "Qué hace", value: cliente.info_investigacion.que_hace },
                                { label: "Puntos Débiles", value: cliente.info_investigacion.puntos_debiles },
                                { label: "Soluciones", value: cliente.info_investigacion.soluciones },
                                { label: "Colores de Identidad", value: cliente.info_investigacion.colores },
                                { label: "Tipografía Recomendada", value: cliente.info_investigacion.tipografia },
                            ].map((item) => (
                                <div key={item.label} className="p-3 rounded-lg bg-secondary/50 border border-border">
                                    <p className="text-[10px] text-primary uppercase font-medium mb-0.5">{item.label}</p>
                                    <p className="text-sm text-foreground whitespace-pre-line">{item.value || "—"}</p>
                                </div>
                            ))}
                            {cliente.info_investigacion.logo_url && (
                                <div className="p-3 rounded-lg bg-secondary/50 border border-border flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] text-primary uppercase font-medium mb-0.5">Logo</p>
                                        <p className="text-xs text-muted-foreground break-all">{cliente.info_investigacion.logo_url}</p>
                                    </div>
                                    {cliente.info_investigacion.logo_url.startsWith("http") && (
                                        <div className="w-12 h-12 rounded-lg border border-border bg-card flex items-center justify-center overflow-hidden p-1 shrink-0">
                                            <img src={cliente.info_investigacion.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Seguimiento & Cotización */}
                {(cliente.etapa === "contactado" || cliente.etapa === "cotizado") && (
                    <div className="mb-5 space-y-4">
                        <div className="p-4 rounded-xl bg-secondary/30 border border-border">
                            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                <MessageCircle className="w-4 h-4 text-primary" /> Notas de Seguimiento
                            </h4>
                            <div className="flex gap-2 mb-3">
                                <input
                                    value={seguimiento}
                                    onChange={(e) => setSeguimiento(e.target.value)}
                                    placeholder="¿Qué se habló con el cliente?..."
                                    className="flex-1 h-10 px-3 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                                <button onClick={addSeguimiento} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">
                                    Agregar
                                </button>
                            </div>
                            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                                {(cliente.notas_seguimiento || []).length > 0 ? (
                                    (cliente.notas_seguimiento || []).map((n) => (
                                        <div key={n.id} className="p-3 rounded-lg bg-card border border-border/50 animate-fade-in">
                                            <p className="text-[10px] text-muted-foreground mb-1">{new Date(n.fecha).toLocaleString("es-AR", { dateStyle: 'short', timeStyle: 'short' })}</p>
                                            <p className="text-sm text-foreground leading-relaxed">{n.texto}</p>
                                        </div>
                                    )).reverse()
                                ) : (
                                    <p className="text-xs text-muted-foreground text-center py-4 italic">No hay notas de seguimiento aún</p>
                                )}
                            </div>
                        </div>

                        {cliente.etapa === "cotizado" && (
                            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                                <h4 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Cotización Formal (PDF)
                                </h4>
                                <div className="space-y-3">
                                    {cliente.pdf_cotizacion_url ? (
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-emerald-500/30">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-5 h-5 text-emerald-400" />
                                                <span className="text-sm font-medium text-foreground">Archivo adjunto</span>
                                            </div>
                                            <a
                                                href={cliente.pdf_cotizacion_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors"
                                            >
                                                Ver PDF
                                            </a>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic mb-2">No se ha adjuntado el PDF de la cotización aún.</p>
                                    )}

                                    <div className="flex items-center gap-3">
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            id="pdf-upload-detail"
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const toastId = toast.loading("Subiendo PDF...");
                                                    try {
                                                        const url = await storageStore.uploadCotizacion(file);
                                                        onUpdate(cliente.id, { pdf_cotizacion_url: url });
                                                        toast.success("PDF actualizado", { id: toastId });
                                                    } catch {
                                                        toast.error("Error al subir", { id: toastId });
                                                    }
                                                }
                                            }}
                                        />
                                        <label
                                            htmlFor="pdf-upload-detail"
                                            className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg border-2 border-dashed border-emerald-500/30 hover:border-emerald-500/50 cursor-pointer transition-all text-sm text-emerald-400 hover:bg-emerald-500/10"
                                        >
                                            <Upload className="w-4 h-4" />
                                            {cliente.pdf_cotizacion_url ? "Reemplazar PDF" : "Subir PDF de Cotización"}
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Action: Avanzar etapa */}
                {NEXT_ETAPA[cliente.etapa] && (
                    <div className="flex justify-end">
                        <button
                            onClick={() => onAdvance(cliente)}
                            className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:opacity-90 flex items-center gap-2"
                        >
                            Avanzar a {ETAPA_LABELS[NEXT_ETAPA[cliente.etapa]!]}
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Kanban Components ---
function DraggableClienteCard({ cliente, onClick }: { cliente: Cliente; onClick: () => void }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: cliente.id,
        data: { cliente },
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 100 : 1,
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "w-full text-left p-2.5 rounded-lg bg-secondary/50 border border-border hover:border-primary/30 transition-all group relative",
                isDragging && "opacity-50 border-primary shadow-2xl"
            )}
        >
            <div className="flex items-center gap-2">
                <div
                    {...listeners}
                    {...attributes}
                    className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground hover:text-foreground touch-none"
                >
                    <GripVertical className="w-3.5 h-3.5" />
                </div>
                <button
                    onClick={onClick}
                    className="flex-1 flex items-center gap-2 min-w-0"
                >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-cyan-500/40 flex items-center justify-center text-[10px] font-bold text-foreground shrink-0">
                        {getInitials(cliente.nombre)}
                    </div>
                    <div className="min-w-0 text-left flex-1">
                        <div className="flex items-center gap-1.5 justify-between">
                            <p className="text-sm font-medium text-foreground truncate">{cliente.nombre}</p>
                            {cliente.mantenimiento_mensual && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{cliente.negocio}</p>
                    </div>
                </button>
            </div>
        </div>
    );
}

function DroppableEtapaColumn({ etapa, children, count, isExpanded, onToggleExpand }: { etapa: EtapaCliente; children: React.ReactNode; count: number; isExpanded: boolean; onToggleExpand: () => void }) {
    const { setNodeRef, isOver } = useDroppable({
        id: etapa,
    });

    const childArray = Array.isArray(children) ? children : children ? [children] : [];
    const visibleChildren = isExpanded ? childArray : childArray.slice(0, MAX_VISIBLE_CARDS);
    const hiddenCount = childArray.length - MAX_VISIBLE_CARDS;

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "rounded-xl border border-border bg-card/50 p-3 min-h-[150px] transition-colors",
                isOver && "border-primary/50 bg-primary/5 shadow-inner shadow-primary/5"
            )}
        >
            <div className="flex items-center justify-between mb-3">
                <span className={cn("text-xs px-2.5 py-1 rounded-full border font-medium", ETAPA_COLORS[etapa])}>
                    {ETAPA_LABELS[etapa]}
                </span>
                <span className="text-xs text-muted-foreground">{count}</span>
            </div>
            <div className="space-y-2">
                {visibleChildren}
            </div>
            {hiddenCount > 0 && (
                <button
                    onClick={onToggleExpand}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all border border-border/50 backdrop-blur-sm bg-secondary/30 hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                >
                    {isExpanded ? (
                        <><ChevronUp className="w-3.5 h-3.5" /> Mostrar menos</>
                    ) : (
                        <><ChevronDown className="w-3.5 h-3.5" /> Mostrar +{hiddenCount} contactos</>
                    )}
                </button>
            )}
        </div>
    );
}

// --- Main Page ---
// --- Main Content ---
function ClientesContent() {
    const searchParams = useSearchParams();
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [mounted, setMounted] = useState(false);
    const [showNew, setShowNew] = useState(searchParams.get("new") === "true");
    const [showDetail, setShowDetail] = useState(false);
    const [showProject, setShowProject] = useState(false);
    const [selected, setSelected] = useState<Cliente | null>(null);
    const [search, setSearch] = useState("");
    const [viewMode, setViewMode] = useState<"pipeline" | "table">("pipeline");
    const [expandedColumns, setExpandedColumns] = useState<Record<string, boolean>>({});
    const [etapaFilter, setEtapaFilter] = useState<EtapaCliente | "all">("all");
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const reload = async () => {
        try {
            const data = await clientesStore.getAll();
            setClientes(data);
        } catch (error) {
            console.error("Error reloading clients:", error);
        }
    };
    useEffect(() => {
        reload().then(() => setMounted(true));
    }, []);

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const clienteId = active.id as string;
        const newEtapa = over.id as EtapaCliente;
        const cliente = active.data.current?.cliente as Cliente;

        if (cliente && cliente.etapa !== newEtapa) {
            try {
                await clientesStore.update(clienteId, { etapa: newEtapa });
                await reload();
                toast.success(`${cliente.nombre} movido a ${ETAPA_LABELS[newEtapa]}`);
            } catch {
                toast.error("Error al mover cliente");
            }
        }
    };

    const handleCreate = async (data: Partial<Cliente>) => {
        try {
            await clientesStore.create(data as Omit<Cliente, "id" | "created_at">);
            await reload();
            toast.success("Contacto agregado");
        } catch {
            toast.error("Error al añadir contacto");
        }
    };

    const handleUpdate = async (id: string, data: Partial<Cliente>) => {
        try {
            await clientesStore.update(id, data);
            await reload();
            const updated = await clientesStore.getById(id);
            setSelected(updated);
        } catch {
            toast.error("Error al actualizar");
        }
    };

    const handleAdvance = async (cliente: Cliente) => {
        const NEXT: Partial<Record<EtapaCliente, EtapaCliente>> = {
            contacto: "investigando", investigando: "calificado", calificado: "contactado",
            contactado: "cotizado", cotizado: "cliente_actual", cliente_actual: "cliente_finalizado",
        };
        const next = NEXT[cliente.etapa];
        if (!next) return;

        try {
            if (next === "cliente_actual") {
                await clientesStore.update(cliente.id, { etapa: next });
                await reload();
                setShowDetail(false);
                const updated = await clientesStore.getById(cliente.id);
                setSelected(updated);
                setShowProject(true);
                return;
            }

            await clientesStore.update(cliente.id, { etapa: next });
            await reload();
            const updated = await clientesStore.getById(cliente.id);
            setSelected(updated);
            toast.success(`${cliente.nombre} → ${ETAPA_LABELS[next]}`);
        } catch {
            toast.error("Error al avanzar etapa");
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await clientesStore.delete(id);
            await reload();
            setDeleteConfirm(null);
            toast.success("Contacto eliminado");
        } catch {
            toast.error("Error al eliminar contacto");
        }
    };

    const toggleColumn = (etapa: string) => {
        setExpandedColumns((prev) => ({ ...prev, [etapa]: !prev[etapa] }));
    };

    const filtered = clientes.filter(
        (c) =>
            c.nombre.toLowerCase().includes(search.toLowerCase()) ||
            c.negocio.toLowerCase().includes(search.toLowerCase())
    );

    const tableFiltered = filtered.filter(
        (c) => etapaFilter === "all" || c.etapa === etapaFilter
    );

    if (!mounted) {
        return (
            <div className="space-y-4 animate-pulse">
                {[...Array(3)].map((_, i) => (<div key={i} className="h-[200px] rounded-xl skeleton" />))}
            </div>
        );
    }

    const FASES = [
        { label: "Prospección", key: "prospeccion" as const, color: "from-slate-600 to-blue-600" },
        { label: "Clasificación", key: "clasificacion" as const, color: "from-purple-600 to-amber-600" },
        { label: "Cierre", key: "cierre" as const, color: "from-emerald-600 to-gray-600" },
    ];

    return (
        <div className="space-y-5 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Pipeline de Clientes</h2>
                    <p className="text-sm text-muted-foreground">{clientes.length} contactos en total</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* View Mode Toggle */}
                    <div className="flex items-center rounded-lg border border-border bg-secondary/50 p-0.5">
                        <button
                            onClick={() => setViewMode("pipeline")}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                viewMode === "pipeline" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" /> Pipeline
                        </button>
                        <button
                            onClick={() => setViewMode("table")}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                viewMode === "table" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <List className="w-3.5 h-3.5" /> Tabla
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar cliente..."
                            className="w-[200px] h-9 pl-9 pr-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                    <button
                        onClick={() => setShowNew(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                        <Plus className="w-4 h-4" /> Nuevo
                    </button>
                </div>
            </div>

            {/* Pipeline Board */}
            {viewMode === "pipeline" && (
                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                    <div className="space-y-6">
                        {FASES.map((fase) => (
                            <div key={fase.key}>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={cn("w-3 h-3 rounded-full bg-gradient-to-r", fase.color)} />
                                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{fase.label}</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                    {FASES_PIPELINE[fase.key].map((etapa) => {
                                        const etapaClientes = filtered.filter((c) => c.etapa === etapa);
                                        return (
                                            <DroppableEtapaColumn
                                                key={etapa}
                                                etapa={etapa}
                                                count={etapaClientes.length}
                                                isExpanded={!!expandedColumns[etapa]}
                                                onToggleExpand={() => toggleColumn(etapa)}
                                            >
                                                {etapaClientes.map((c) => (
                                                    <DraggableClienteCard
                                                        key={c.id}
                                                        cliente={c}
                                                        onClick={() => { setSelected(c); setShowDetail(true); }}
                                                    />
                                                ))}
                                                {etapaClientes.length === 0 && (
                                                    <p className="text-xs text-muted-foreground text-center py-3 opacity-50">Sin contactos</p>
                                                )}
                                            </DroppableEtapaColumn>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </DndContext>
            )}

            {/* Table View */}
            {viewMode === "table" && (
                <div className="space-y-4">
                    {/* Etapa Filter Chips */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <button
                            onClick={() => setEtapaFilter("all")}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                                etapaFilter === "all" ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                            )}
                        >
                            Todos ({filtered.length})
                        </button>
                        {(Object.keys(ETAPA_LABELS) as EtapaCliente[]).map((etapa) => {
                            const count = filtered.filter((c) => c.etapa === etapa).length;
                            if (count === 0) return null;
                            return (
                                <button
                                    key={etapa}
                                    onClick={() => setEtapaFilter(etapa)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                                        etapaFilter === etapa ? cn(ETAPA_COLORS[etapa], "shadow-sm") : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                                    )}
                                >
                                    {ETAPA_LABELS[etapa]} ({count})
                                </button>
                            );
                        })}
                    </div>

                    {/* Table */}
                    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border bg-secondary/30">
                                        <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Cliente</th>
                                        <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Etapa</th>
                                        <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">Canal</th>
                                        <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Contacto</th>
                                        <th className="text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Mant.</th>
                                        <th className="text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {tableFiltered.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                                                No se encontraron contactos{etapaFilter !== "all" ? ` en ${ETAPA_LABELS[etapaFilter]}` : ""}.
                                            </td>
                                        </tr>
                                    )}
                                    {tableFiltered.map((c) => (
                                        <tr key={c.id} className="group hover:bg-secondary/20 transition-colors">
                                            {/* Cliente */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/40 to-cyan-500/40 flex items-center justify-center text-[11px] font-bold text-foreground shrink-0">
                                                        {getInitials(c.nombre)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-foreground truncate">{c.nombre}</p>
                                                        <p className="text-[11px] text-muted-foreground truncate">{c.negocio || "—"}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            {/* Etapa */}
                                            <td className="px-4 py-3">
                                                <span className={cn("text-[11px] px-2.5 py-1 rounded-full border font-medium whitespace-nowrap", ETAPA_COLORS[c.etapa])}>
                                                    {ETAPA_LABELS[c.etapa]}
                                                </span>
                                            </td>
                                            {/* Canal */}
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                <span className="text-xs text-muted-foreground">{c.canal || "—"}</span>
                                            </td>
                                            {/* Contacto */}
                                            <td className="px-4 py-3 hidden lg:table-cell">
                                                <div className="space-y-0.5">
                                                    {c.email && (
                                                        <a href={`mailto:${c.email}`} className="text-xs text-primary hover:underline block truncate max-w-[200px]">{c.email}</a>
                                                    )}
                                                    {c.tel && (
                                                        <a href={`tel:${c.tel}`} className="text-xs text-muted-foreground hover:text-foreground block">{c.tel}</a>
                                                    )}
                                                    {!c.email && !c.tel && <span className="text-xs text-muted-foreground">—</span>}
                                                </div>
                                            </td>
                                            {/* Mantenimiento */}
                                            <td className="px-4 py-3 text-center hidden sm:table-cell">
                                                {c.mantenimiento_mensual ? (
                                                    <ShieldCheck className="w-4 h-4 text-emerald-500 mx-auto" />
                                                ) : (
                                                    <span className="text-xs text-muted-foreground/40">—</span>
                                                )}
                                            </td>
                                            {/* Acciones */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => { setSelected(c); setShowDetail(true); }}
                                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                                                        title="Ver detalle"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {deleteConfirm === c.id ? (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => handleDelete(c.id)}
                                                                className="px-2 py-1 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors"
                                                            >
                                                                Sí
                                                            </button>
                                                            <button
                                                                onClick={() => setDeleteConfirm(null)}
                                                                className="px-2 py-1 rounded-md text-[10px] font-bold bg-secondary text-muted-foreground hover:bg-secondary/80 transition-colors"
                                                            >
                                                                No
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setDeleteConfirm(c.id)}
                                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            <NuevoClienteModal open={showNew} onClose={() => setShowNew(false)} onSave={handleCreate} />
            <ClienteDetailModal
                open={showDetail}
                onClose={() => { setShowDetail(false); setSelected(null); }}
                cliente={selected}
                onUpdate={handleUpdate}
                onAdvance={handleAdvance}
            />
            <NuevoProyectoModal
                open={showProject}
                onClose={() => { setShowProject(false); setSelected(null); reload(); }}
                cliente={selected}
            />
        </div>
    );
}

import { Suspense } from "react";

export default function ClientesPage() {
    return (
        <Suspense fallback={
            <div className="space-y-4 animate-pulse">
                {[...Array(3)].map((_, i) => (<div key={i} className="h-[200px] rounded-xl bg-secondary/30" />))}
            </div>
        }>
            <ClientesContent />
        </Suspense>
    );
}
