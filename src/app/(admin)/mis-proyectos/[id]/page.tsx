"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft, ExternalLink, Plus, X, CheckSquare, Layers, BookOpen, ScrollText,
    Globe, Rocket, Code, Sparkles, Save, Edit3, Trash2, Check, Download, FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { proyectosStore, tareasStore, logsProyectoStore } from "@/lib/store";
import { toast } from "sonner";
import type { Proyecto, Tarea, LogProyecto, TipoProyectoPropio, FaseProyecto, DocumentoProyecto } from "@/lib/types";
import { FASES_POR_TIPO } from "@/lib/types";

const TIPO_PROPIO_LABELS: Record<TipoProyectoPropio, string> = {
    web_propia: "Página Web / Portafolio",
    software: "Software / Aplicación",
    saas: "SaaS / Producto Recurrente"
};

const TIPO_PROPIO_BADGES: Record<TipoProyectoPropio, string> = {
    web_propia: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    software: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    saas: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
};

const ESTADO_BADGE: Record<string, string> = {
    activo: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    pausado: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    finalizado: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

type PageTab = "general" | "fases" | "documentos" | "tareas" | "novedades";

export default function MisProyectoDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [proyecto, setProyecto] = useState<Proyecto | null>(null);
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [logs, setLogs] = useState<LogProyecto[]>([]);
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<PageTab>("general");

    // Local Fases state with batch save
    const [localFases, setLocalFases] = useState<FaseProyecto[]>([]);
    const [hasUnsavedFases, setHasUnsavedFases] = useState(false);
    const [savingFases, setSavingFases] = useState(false);
    const [newFaseName, setNewFaseName] = useState("");
    const [addingFase, setAddingFase] = useState(false);

    // General Form / Specs editing
    const [editingGeneral, setEditingGeneral] = useState(false);
    const [genForm, setGenForm] = useState({
        saas_url: "",
        version: "",
        stack_tecnologico: "",
        notas_negocio: "",
        descripcion: "",
    });

    // Documentos / Wiki
    const [documentosList, setDocumentosList] = useState<DocumentoProyecto[]>([]);
    const [showDocEdit, setShowDocEdit] = useState(false);
    const [editingDoc, setEditingDoc] = useState<DocumentoProyecto | null>(null);
    const [docForm, setDocForm] = useState<{
        id?: string;
        titulo: string;
        categoria: 'estrategia' | 'marketing' | 'contenido' | 'prospeccion' | 'manual' | 'otro';
        contenido: string;
    }>({ titulo: "", categoria: "manual", contenido: "" });

    // Credenciales / Accesos
    const [showNewAcceso, setShowNewAcceso] = useState(false);
    const [newAcceso, setNewAcceso] = useState({ servicio: "", url: "", usuario: "", password: "" });

    // Tareas & Logs
    const [showNewTarea, setShowNewTarea] = useState(false);
    const [tareaForm, setTareaForm] = useState<Partial<Tarea>>({ titulo: "", prioridad: "media", categoria: "dev" });
    const [savingTarea, setSavingTarea] = useState(false);

    const [showNewLog, setShowNewLog] = useState(false);
    const [logForm, setLogForm] = useState({ titulo: "", descripcion: "", fecha: new Date().toISOString().slice(0, 10) });
    const [savingLog, setSavingLog] = useState(false);

    const reload = async () => {
        if (!id) return;
        const p = await proyectosStore.getById(id);
        if (!p) { router.push("/mis-proyectos"); return; }
        setProyecto(p);
        setDocumentosList(p.documentos || []);
        setGenForm({
            saas_url: p.saas_url || p.url_producto || "",
            version: p.version || "1.0.0",
            stack_tecnologico: p.stack_tecnologico || "",
            notas_negocio: p.notas_negocio || "",
            descripcion: p.descripcion || "",
        });

        const defaultFases = p.fases && p.fases.length > 0
            ? p.fases
            : FASES_POR_TIPO[p.tipo_proyecto === 'saas' ? 'saas' : 'webapp']?.map(c => ({ nombre: c.nombre, completada: false })) || [];
        setLocalFases(defaultFases);
        setHasUnsavedFases(false);

        const [pts, lg] = await Promise.all([
            tareasStore.getByProyecto(id),
            logsProyectoStore.getByProyecto(id),
        ]);
        setTareas(pts);
        setLogs(lg);
    };

    useEffect(() => {
        reload().then(() => setMounted(true));
    }, [id]);

    if (!mounted) return (
        <div className="p-6 space-y-6 animate-pulse">
            <div className="h-8 w-48 bg-secondary/50 rounded-xl" />
            <div className="h-[400px] rounded-2xl bg-secondary/30" />
        </div>
    );

    if (!proyecto) return null;

    const tipoPropio = proyecto.tipo_propio || 'web_propia';
    const completedFases = localFases.filter(f => f.completada).length;
    const fasesProgress = localFases.length > 0 ? Math.round((completedFases / localFases.length) * 100) : 0;

    // ── Fases handlers ──────────────────────────────────────────────────────
    const toggleFaseLocal = (index: number) => {
        const updated = localFases.map((f, i) => i === index ? { ...f, completada: !f.completada } : f);
        setLocalFases(updated);
        setHasUnsavedFases(true);
    };

    const saveFases = async () => {
        setSavingFases(true);
        try {
            await proyectosStore.update(proyecto.id, { fases: localFases });
            toast.success("Fases guardadas");
            setHasUnsavedFases(false);
            reload();
        } catch { toast.error("Error al guardar fases"); }
        finally { setSavingFases(false); }
    };

    const addFase = () => {
        if (!newFaseName.trim()) return;
        setLocalFases([...localFases, { nombre: newFaseName.trim(), completada: false }]);
        setNewFaseName("");
        setAddingFase(false);
        setHasUnsavedFases(true);
    };

    const removeFase = (index: number) => {
        setLocalFases(localFases.filter((_, i) => i !== index));
        setHasUnsavedFases(true);
    };

    // ── Specs / General Save ────────────────────────────────────────────────
    const handleSaveGeneral = async () => {
        try {
            await proyectosStore.update(proyecto.id, {
                saas_url: genForm.saas_url,
                url_producto: genForm.saas_url,
                version: genForm.version,
                stack_tecnologico: genForm.stack_tecnologico,
                notas_negocio: genForm.notas_negocio,
                descripcion: genForm.descripcion,
            });
            toast.success("Especificaciones actualizadas");
            setEditingGeneral(false);
            reload();
        } catch { toast.error("Error al actualizar datos"); }
    };

    // ── Documentos Handlers ──────────────────────────────────────────────────
    const handleSaveDoc = async () => {
        if (!docForm.titulo.trim()) { toast.error("Ingresa un título para el documento"); return; }
        const docPayload: DocumentoProyecto = {
            id: docForm.id || `doc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            titulo: docForm.titulo,
            categoria: docForm.categoria,
            contenido: docForm.contenido,
            updated_at: new Date().toISOString()
        };
        const exists = documentosList.some(d => d.id === docPayload.id);
        const updatedDocs = exists
            ? documentosList.map(d => d.id === docPayload.id ? docPayload : d)
            : [docPayload, ...documentosList];
        setDocumentosList(updatedDocs);
        try {
            await proyectosStore.update(proyecto.id, { documentos: updatedDocs });
            toast.success("Documento guardado");
            setShowDocEdit(false);
            setEditingDoc(null);
            setDocForm({ titulo: "", categoria: "manual", contenido: "" });
            reload();
        } catch { toast.error("Error al guardar documento"); }
    };

    const handleDeleteDoc = async (docId: string) => {
        if (!confirm("¿Eliminar este documento?")) return;
        const updated = documentosList.filter(d => d.id !== docId);
        setDocumentosList(updated);
        try {
            await proyectosStore.update(proyecto.id, { documentos: updated });
            toast.success("Documento eliminado");
            reload();
        } catch { toast.error("Error al eliminar"); }
    };

    const openDocEditor = (doc?: DocumentoProyecto) => {
        setEditingDoc(doc || null);
        setDocForm(doc ? { id: doc.id, titulo: doc.titulo, categoria: doc.categoria, contenido: doc.contenido }
            : { titulo: "", categoria: "manual", contenido: "" });
        setShowDocEdit(true);
    };

    const handleMdUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            setDocForm(f => ({ ...f, titulo: f.titulo || file.name.replace(/\.md$/, ""), contenido: text }));
            if (!showDocEdit) setShowDocEdit(true);
        };
        reader.readAsText(file);
    };

    const downloadDoc = (doc: DocumentoProyecto) => {
        const blob = new Blob([doc.contenido], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${doc.titulo.replace(/\s+/g, '-')}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── Credenciales Handlers ────────────────────────────────────────────────
    const handleAddAcceso = async () => {
        if (!newAcceso.servicio || !newAcceso.usuario) return;
        const updated = [...(proyecto.accesos || []), newAcceso];
        try {
            await proyectosStore.update(proyecto.id, { accesos: updated });
            toast.success("Acceso guardado");
            setNewAcceso({ servicio: "", url: "", usuario: "", password: "" });
            setShowNewAcceso(false);
            reload();
        } catch { toast.error("Error al guardar acceso"); }
    };

    const handleRemoveAcceso = async (i: number) => {
        const updated = (proyecto.accesos || []).filter((_, idx) => idx !== i);
        try {
            await proyectosStore.update(proyecto.id, { accesos: updated });
            toast.success("Acceso eliminado");
            reload();
        } catch { toast.error("Error al eliminar"); }
    };

    // ── Tareas & Logs Handlers ───────────────────────────────────────────────
    const handleAddTarea = async () => {
        if (!tareaForm.titulo?.trim()) { toast.error("El título es requerido"); return; }
        setSavingTarea(true);
        try {
            await tareasStore.create({
                proyecto_id: proyecto.id,
                titulo: tareaForm.titulo,
                descripcion: "",
                prioridad: tareaForm.prioridad as any,
                estado: "pendiente",
                categoria: tareaForm.categoria as any,
            });
            const updated = await tareasStore.getByProyecto(proyecto.id);
            setTareas(updated);
            setTareaForm({ titulo: "", prioridad: "media", categoria: "dev" });
            setShowNewTarea(false);
            toast.success("Tarea creada");
        } catch { toast.error("Error al crear tarea"); }
        finally { setSavingTarea(false); }
    };

    const handleAddLog = async () => {
        if (!logForm.titulo.trim()) { toast.error("El título es requerido"); return; }
        setSavingLog(true);
        try {
            await logsProyectoStore.create({ proyecto_id: proyecto.id, ...logForm });
            const updated = await logsProyectoStore.getByProyecto(proyecto.id);
            setLogs(updated);
            setLogForm({ titulo: "", descripcion: "", fecha: new Date().toISOString().slice(0, 10) });
            setShowNewLog(false);
            toast.success("Novedad registrada");
        } catch { toast.error("Error al guardar log"); }
        finally { setSavingLog(false); }
    };

    const TABS: { id: PageTab; label: string; icon: any; count?: number }[] = [
        { id: "general", label: "General & Specs", icon: Globe },
        { id: "fases", label: "Fases Roadmap", icon: Layers, count: localFases.length },
        { id: "documentos", label: "Documentos / Wiki", icon: BookOpen, count: documentosList.length || undefined },
        { id: "tareas", label: "Tareas", icon: CheckSquare, count: tareas.length || undefined },
        { id: "novedades", label: "Novedades / Log", icon: ScrollText, count: logs.length || undefined },
    ];

    return (
        <div className="min-h-screen pb-20">
            {/* Top Bar */}
            <div className="sticky top-[60px] lg:top-[65px] z-20 bg-background/80 backdrop-blur-md border-b border-border px-4 sm:px-6 h-12 flex items-center gap-3">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Mis Proyectos
                </button>
                <span className="text-border">/</span>
                <span className="text-xs font-bold text-foreground truncate">{proyecto.nombre}</span>
                <div className="ml-auto flex items-center gap-2">
                    <span className={cn("text-[10px] px-2.5 py-0.5 rounded-full border font-bold uppercase tracking-wider", TIPO_PROPIO_BADGES[tipoPropio])}>
                        {TIPO_PROPIO_LABELS[tipoPropio]}
                    </span>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider", ESTADO_BADGE[proyecto.estado])}>
                        {proyecto.estado}
                    </span>
                </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
                {/* Header Card */}
                <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
                                    <Rocket className="w-6 h-6 text-primary shrink-0" />
                                    {proyecto.nombre}
                                </h1>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Proyecto Propio · Versión {proyecto.version || "1.0.0"}
                            </p>
                        </div>

                        {genForm.saas_url && (
                            <a
                                href={genForm.saas_url.startsWith('http') ? genForm.saas_url : `https://${genForm.saas_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-xs font-bold text-primary hover:bg-primary/20 transition-all shrink-0 w-fit"
                            >
                                <ExternalLink className="w-4 h-4" /> Abrir App Live
                            </a>
                        )}
                    </div>

                    {/* Progress */}
                    <div className="mt-5">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-muted-foreground font-semibold">Progreso Roadmap ({completedFases}/{localFases.length} fases)</span>
                            <span className="text-sm font-black text-primary">{fasesProgress}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400 transition-all duration-700" style={{ width: `${fasesProgress}%` }} />
                        </div>
                    </div>
                </div>

                {/* Tabs Panel */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    {/* Navigation Tabs */}
                    <div className="flex gap-0 border-b border-border bg-secondary/20 overflow-x-auto scrollbar-none">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-1.5 px-4 py-3 text-xs font-bold transition-all shrink-0 border-b-2 whitespace-nowrap",
                                    activeTab === tab.id
                                        ? "border-primary text-primary bg-primary/5"
                                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                                )}
                            >
                                <tab.icon className="w-3.5 h-3.5" />
                                {tab.label}
                                {tab.count ? (
                                    <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold">{tab.count}</span>
                                ) : null}
                            </button>
                        ))}
                    </div>

                    <div className="p-4 sm:p-6">
                        {/* TAB GENERAL & SPECS */}
                        {activeTab === "general" && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-foreground">Especificaciones del Producto</h3>
                                    <button
                                        onClick={() => setEditingGeneral(!editingGeneral)}
                                        className="text-xs text-primary font-bold hover:underline"
                                    >
                                        {editingGeneral ? "Cancelar Edición" : "Editar Especificaciones"}
                                    </button>
                                </div>

                                {editingGeneral ? (
                                    <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-4 animate-fade-in">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-bold uppercase text-muted-foreground">URL del Producto / Web</label>
                                                <input
                                                    type="text"
                                                    value={genForm.saas_url}
                                                    onChange={e => setGenForm({ ...genForm, saas_url: e.target.value })}
                                                    placeholder="https://mi-saas.com"
                                                    className="w-full h-10 px-3 rounded-xl bg-background border border-border text-xs text-foreground focus:ring-2 focus:ring-primary/50 outline-none mt-1"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Stack Tecnológico</label>
                                                <input
                                                    type="text"
                                                    value={genForm.stack_tecnologico}
                                                    onChange={e => setGenForm({ ...genForm, stack_tecnologico: e.target.value })}
                                                    placeholder="Next.js, Supabase, Tailwind, Stripe..."
                                                    className="w-full h-10 px-3 rounded-xl bg-background border border-border text-xs text-foreground focus:ring-2 focus:ring-primary/50 outline-none mt-1"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase text-muted-foreground">Versión Actual</label>
                                            <input
                                                type="text"
                                                value={genForm.version}
                                                onChange={e => setGenForm({ ...genForm, version: e.target.value })}
                                                placeholder="v1.2.0"
                                                className="w-full h-10 px-3 rounded-xl bg-background border border-border text-xs text-foreground focus:ring-2 focus:ring-primary/50 outline-none mt-1"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase text-muted-foreground">Notas de Negocio / Monetización</label>
                                            <textarea
                                                value={genForm.notas_negocio}
                                                onChange={e => setGenForm({ ...genForm, notas_negocio: e.target.value })}
                                                placeholder="Modelo freemium, suscripción mensual $29/mes..."
                                                rows={3}
                                                className="w-full p-3 rounded-xl bg-background border border-border text-xs text-foreground focus:ring-2 focus:ring-primary/50 outline-none mt-1 resize-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase text-muted-foreground">Descripción</label>
                                            <textarea
                                                value={genForm.descripcion}
                                                onChange={e => setGenForm({ ...genForm, descripcion: e.target.value })}
                                                placeholder="Objetivo principal del proyecto..."
                                                rows={3}
                                                className="w-full p-3 rounded-xl bg-background border border-border text-xs text-foreground focus:ring-2 focus:ring-primary/50 outline-none mt-1 resize-none"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setEditingGeneral(false)} className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-secondary">Cancelar</button>
                                            <button onClick={handleSaveGeneral} className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90">
                                                Guardar Especificaciones
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="p-4 rounded-xl border border-border bg-secondary/30">
                                                <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                                                    <Code className="w-3.5 h-3.5 text-cyan-400" /> Stack Tecnológico
                                                </p>
                                                <p className="text-xs font-bold text-foreground mt-1">
                                                    {proyecto.stack_tecnologico || "No especificado"}
                                                </p>
                                            </div>
                                            <div className="p-4 rounded-xl border border-border bg-secondary/30">
                                                <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                                                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Versión
                                                </p>
                                                <p className="text-xs font-bold text-foreground mt-1">
                                                    {proyecto.version || "1.0.0"}
                                                </p>
                                            </div>
                                        </div>

                                        {proyecto.notas_negocio && (
                                            <div className="p-4 rounded-xl border border-border bg-secondary/30">
                                                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Notas de Negocio / Estrategia</p>
                                                <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">{proyecto.notas_negocio}</p>
                                            </div>
                                        )}

                                        <div>
                                            <h4 className="text-xs font-bold text-foreground mb-1">Descripción</h4>
                                            <div className="p-3.5 rounded-xl border border-border bg-secondary/30 text-xs text-muted-foreground min-h-[60px]">
                                                {proyecto.descripcion || "Sin descripción."}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Accesos / Credenciales Privadas */}
                                <div className="pt-4 border-t border-border">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-xs font-bold text-foreground">Accesos / API Keys / Credenciales</h4>
                                        <button onClick={() => setShowNewAcceso(!showNewAcceso)} className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
                                            <Plus className="w-3 h-3" /> Agregar Credencial
                                        </button>
                                    </div>
                                    {showNewAcceso && (
                                        <div className="mb-3 p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                                            <input type="text" placeholder="Servicio (ej. Supabase Admin, Stripe Keys)" className="w-full text-xs p-2 rounded-lg bg-background border border-border" value={newAcceso.servicio} onChange={e => setNewAcceso({ ...newAcceso, servicio: e.target.value })} />
                                            <input type="text" placeholder="URL Login (opcional)" className="w-full text-xs p-2 rounded-lg bg-background border border-border" value={newAcceso.url} onChange={e => setNewAcceso({ ...newAcceso, url: e.target.value })} />
                                            <input type="text" placeholder="Usuario / Key" className="w-full text-xs p-2 rounded-lg bg-background border border-border" value={newAcceso.usuario} onChange={e => setNewAcceso({ ...newAcceso, usuario: e.target.value })} />
                                            <div className="flex gap-2">
                                                <input type="text" placeholder="Secret / Password" className="flex-1 text-xs p-2 rounded-lg bg-background border border-border" value={newAcceso.password} onChange={e => setNewAcceso({ ...newAcceso, password: e.target.value })} />
                                                <button onClick={handleAddAcceso} className="bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-bold">Guardar</button>
                                            </div>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {(proyecto.accesos || []).map((acceso, i) => (
                                            <div key={i} className="p-3 rounded-xl border border-border bg-secondary/30 flex items-center justify-between group">
                                                <div className="min-w-0 mr-2">
                                                    <p className="text-xs font-bold text-foreground truncate">{acceso.servicio}</p>
                                                    <p className="text-[11px] text-muted-foreground truncate">{acceso.usuario} • {acceso.password}</p>
                                                </div>
                                                <button onClick={() => handleRemoveAcceso(i)} className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-500 transition-opacity shrink-0">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                        {(!proyecto.accesos || proyecto.accesos.length === 0) && !showNewAcceso && (
                                            <p className="text-xs text-muted-foreground italic col-span-2">Sin credenciales registradas</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB FASES ROADMAP */}
                        {activeTab === "fases" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-foreground">Fases de Desarrollo</h3>
                                        {hasUnsavedFases && (
                                            <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                                                Cambios sin guardar
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setAddingFase(!addingFase)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                                            <Plus className="w-3.5 h-3.5" /> Agregar fase
                                        </button>
                                        {hasUnsavedFases && (
                                            <button onClick={saveFases} disabled={savingFases} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 shadow-md shadow-primary/20">
                                                <Save className="w-3.5 h-3.5" /> {savingFases ? "Guardando..." : "Guardar cambios"}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {addingFase && (
                                    <div className="flex gap-2 animate-fade-in">
                                        <input
                                            value={newFaseName}
                                            onChange={e => setNewFaseName(e.target.value)}
                                            onKeyDown={e => { if (e.key === "Enter") addFase(); if (e.key === "Escape") setAddingFase(false); }}
                                            placeholder="Nombre de la nueva fase..."
                                            className="flex-1 h-9 px-3 rounded-xl bg-background border border-primary/40 text-xs font-medium text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
                                            autoFocus
                                        />
                                        <button onClick={addFase} className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold">Agregar</button>
                                        <button onClick={() => setAddingFase(false)} className="px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:bg-secondary">Cancelar</button>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    {localFases.map((fase, i) => (
                                        <div key={i} className={cn("flex items-center gap-3 p-3.5 rounded-xl border transition-all group", fase.completada ? "bg-emerald-500/5 border-emerald-500/20" : "bg-card border-border hover:border-primary/30")}>
                                            <button onClick={() => toggleFaseLocal(i)} className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border font-bold text-xs transition-all", fase.completada ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-secondary text-muted-foreground border-border hover:border-primary")}>
                                                {fase.completada ? <Check className="w-4 h-4 stroke-[3]" /> : i + 1}
                                            </button>
                                            <span onClick={() => toggleFaseLocal(i)} className={cn("text-xs font-bold flex-1 cursor-pointer", fase.completada ? "text-emerald-400 line-through opacity-80" : "text-foreground")}>
                                                {fase.nombre}
                                            </span>
                                            <button onClick={() => removeFase(i)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity shrink-0">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* TAB DOCUMENTOS / WIKI */}
                        {activeTab === "documentos" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div>
                                        <h4 className="text-sm font-bold text-foreground">Wiki / Documentación</h4>
                                        <p className="text-xs text-muted-foreground">Sube archivos .md o escribe documentos inline</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label
                                            htmlFor={`md-upload-${proyecto.id}`}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/30 bg-primary/5 text-xs font-bold text-primary hover:bg-primary/10 cursor-pointer transition-all"
                                        >
                                            <FileText className="w-3.5 h-3.5" /> Subir .md
                                        </label>
                                        <input
                                            type="file"
                                            accept=".md,.txt"
                                            id={`md-upload-${proyecto.id}`}
                                            className="hidden"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (f) handleMdUpload(f);
                                                e.target.value = "";
                                            }}
                                        />
                                        <button
                                            onClick={() => openDocEditor()}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 shadow-md shadow-primary/20"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Nuevo Doc
                                        </button>
                                    </div>
                                </div>

                                {showDocEdit && (
                                    <div className="p-4 rounded-2xl border border-primary/30 bg-primary/5 space-y-3 animate-fade-in">
                                        <div className="flex items-center justify-between">
                                            <h5 className="text-xs font-bold text-foreground">{editingDoc ? "Editar Documento" : "Nuevo Documento"}</h5>
                                            <button onClick={() => { setShowDocEdit(false); setEditingDoc(null); }} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Título</label>
                                                <input
                                                    value={docForm.titulo}
                                                    onChange={(e) => setDocForm({ ...docForm, titulo: e.target.value })}
                                                    placeholder="Nombre del documento..."
                                                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-xs text-foreground focus:ring-2 focus:ring-primary/50 outline-none mt-1"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Categoría</label>
                                                <select
                                                    value={docForm.categoria}
                                                    onChange={(e) => setDocForm({ ...docForm, categoria: e.target.value as any })}
                                                    className="w-full h-9 px-3 rounded-lg bg-background border border-border text-xs text-foreground outline-none mt-1"
                                                >
                                                    <option value="manual">📖 Manual / Guía</option>
                                                    <option value="estrategia">📊 Estrategia</option>
                                                    <option value="contenido">✍️ Contenido</option>
                                                    <option value="marketing">📣 Marketing</option>
                                                    <option value="otro">📁 Otro</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Contenido (Markdown)</label>
                                            <textarea
                                                value={docForm.contenido}
                                                onChange={(e) => setDocForm({ ...docForm, contenido: e.target.value })}
                                                placeholder="Escribe o pega el contenido en Markdown..."
                                                rows={12}
                                                className="w-full p-3 rounded-xl bg-background border border-border text-xs font-mono text-foreground focus:ring-2 focus:ring-primary/50 outline-none resize-none leading-relaxed"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => { setShowDocEdit(false); setEditingDoc(null); }} className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-secondary">Cancelar</button>
                                            <button onClick={handleSaveDoc} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs bg-primary text-primary-foreground font-bold hover:opacity-90">
                                                <Save className="w-3.5 h-3.5" /> Guardar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    {documentosList.length === 0 && !showDocEdit ? (
                                        <div className="py-10 text-center rounded-2xl border border-dashed border-border bg-secondary/20">
                                            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            <p className="text-xs font-semibold text-muted-foreground">Sin documentos aún</p>
                                            <p className="text-[11px] text-muted-foreground opacity-70 mt-1">Sube un .md o crea un documento nuevo</p>
                                        </div>
                                    ) : (
                                        documentosList.map((doc) => (
                                            <div key={doc.id} className="p-3.5 rounded-xl border border-border bg-card hover:border-primary/30 transition-all group space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                                                        <p className="text-xs font-bold text-foreground truncate">{doc.titulo}</p>
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground font-bold uppercase shrink-0">{doc.categoria}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                        <button onClick={() => downloadDoc(doc)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground" title="Descargar .md">
                                                            <Download className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button onClick={() => openDocEditor(doc)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
                                                            <Edit3 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button onClick={() => handleDeleteDoc(doc.id)} className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="text-[11px] text-muted-foreground font-mono line-clamp-2 leading-relaxed">
                                                    {doc.contenido.slice(0, 150)}{doc.contenido.length > 150 ? "..." : ""}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB TAREAS */}
                        {activeTab === "tareas" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground">Tareas para este proyecto</p>
                                    <button onClick={() => setShowNewTarea(!showNewTarea)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
                                        <Plus className="w-3.5 h-3.5" /> Nueva tarea
                                    </button>
                                </div>
                                {showNewTarea && (
                                    <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                                        <input value={tareaForm.titulo} onChange={e => setTareaForm({ ...tareaForm, titulo: e.target.value })} placeholder="Título de la tarea..." className="w-full h-9 px-3 rounded-lg bg-background border border-border text-xs" />
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setShowNewTarea(false)} className="px-3 py-1 text-xs text-muted-foreground">Cancelar</button>
                                            <button onClick={handleAddTarea} disabled={savingTarea} className="px-3 py-1 text-xs bg-primary text-primary-foreground font-bold rounded">Guardar</button>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    {tareas.map(t => (
                                        <div key={t.id} className="p-3 rounded-xl border border-border bg-secondary/30 flex items-center justify-between">
                                            <span className="text-xs font-semibold text-foreground">{t.titulo}</span>
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-card border border-border uppercase font-bold text-muted-foreground">{t.estado}</span>
                                        </div>
                                    ))}
                                    {tareas.length === 0 && (
                                        <div className="py-10 text-center text-muted-foreground">
                                            <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            <p className="text-sm">Sin tareas</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB NOVEDADES / LOG */}
                        {activeTab === "novedades" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground">Registro de novedades y changelog</p>
                                    <button onClick={() => setShowNewLog(!showNewLog)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
                                        <Plus className="w-3.5 h-3.5" /> Registrar Novedad
                                    </button>
                                </div>
                                {showNewLog && (
                                    <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                                        <input value={logForm.titulo} onChange={e => setLogForm({ ...logForm, titulo: e.target.value })} placeholder="Título..." className="w-full h-9 px-3 rounded-lg bg-background border border-border text-xs" />
                                        <textarea value={logForm.descripcion} onChange={e => setLogForm({ ...logForm, descripcion: e.target.value })} placeholder="Descripción..." rows={3} className="w-full p-3 rounded-lg bg-background border border-border text-xs resize-none" />
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setShowNewLog(false)} className="px-3 py-1 text-xs text-muted-foreground">Cancelar</button>
                                            <button onClick={handleAddLog} disabled={savingLog} className="px-3 py-1 text-xs bg-primary text-primary-foreground font-bold rounded">Guardar</button>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-3">
                                    {logs.map(l => (
                                        <div key={l.id} className="p-4 rounded-xl border border-border bg-card space-y-1">
                                            <div className="flex justify-between items-center">
                                                <h5 className="text-xs font-bold text-foreground">{l.titulo}</h5>
                                                <span className="text-[10px] text-muted-foreground">{l.fecha}</span>
                                            </div>
                                            {l.descripcion && <p className="text-xs text-muted-foreground">{l.descripcion}</p>}
                                        </div>
                                    ))}
                                    {logs.length === 0 && (
                                        <div className="py-10 text-center text-muted-foreground">
                                            <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            <p className="text-sm">Sin novedades registradas</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
