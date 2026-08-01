"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft, ExternalLink, Eye, Copy, Upload, Plus, X,
    CheckSquare, Layers, BookOpen, ScrollText, Globe, Zap,
    FileText, Save, Edit3, Trash2, Check, Lock, CheckCircle2,
    Clock, Tag, CalendarDays
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import {
    proyectosStore, tareasStore, clientesStore,
    logsProyectoStore, storageStore
} from "@/lib/store";
import { toast } from "sonner";
import type {
    Proyecto, Tarea, Cliente, FaseProyecto, LogProyecto,
    DocumentoProyecto, TipoProyecto
} from "@/lib/types";
import { FASES_POR_TIPO, TIPO_PROYECTO_LABELS, PRIORIDAD_COLORS } from "@/lib/types";
import Link from "next/link";

// ── Helpers ───────────────────────────────────────────────────────────────────
const ESTADO_BADGE: Record<string, string> = {
    activo: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    pausado: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    finalizado: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};
const DOC_CATEGORIA_BADGE: Record<string, string> = {
    estrategia: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    marketing: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    contenido: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    prospeccion: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    manual: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    otro: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

type PageTab = "fases" | "tareas" | "documentos" | "novedades" | "saas";

export default function ProyectoDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [proyecto, setProyecto] = useState<Proyecto | null>(null);
    const [cliente, setCliente] = useState<Cliente | null>(null);
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [logs, setLogs] = useState<LogProyecto[]>([]);
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<PageTab>("fases");

    // Fases (local batch state)
    const [localFases, setLocalFases] = useState<FaseProyecto[]>([]);
    const [hasUnsavedFases, setHasUnsavedFases] = useState(false);
    const [savingFases, setSavingFases] = useState(false);
    const [newFaseName, setNewFaseName] = useState("");
    const [addingFase, setAddingFase] = useState(false);
    const [showPlantillas, setShowPlantillas] = useState(false);

    // Logo
    const [logoUrl, setLogoUrl] = useState("");

    // Documentos
    const [documentosList, setDocumentosList] = useState<DocumentoProyecto[]>([]);
    const [showDocEdit, setShowDocEdit] = useState(false);
    const [editingDoc, setEditingDoc] = useState<DocumentoProyecto | null>(null);
    const [docForm, setDocForm] = useState<{
        id?: string;
        titulo: string;
        categoria: 'estrategia' | 'marketing' | 'contenido' | 'prospeccion' | 'manual' | 'otro';
        contenido: string;
    }>({ titulo: "", categoria: "estrategia", contenido: "" });

    // Accesos
    const [showNewAcceso, setShowNewAcceso] = useState(false);
    const [newAcceso, setNewAcceso] = useState({ servicio: "", url: "", usuario: "", password: "" });

    // Tareas
    const [showNewTarea, setShowNewTarea] = useState(false);
    const [tareaForm, setTareaForm] = useState<Partial<Tarea>>({ titulo: "", prioridad: "media", categoria: "dev" });
    const [savingTarea, setSavingTarea] = useState(false);

    // Logs
    const [showNewLog, setShowNewLog] = useState(false);
    const [logForm, setLogForm] = useState({ titulo: "", descripcion: "", fecha: new Date().toISOString().slice(0, 10) });
    const [savingLog, setSavingLog] = useState(false);

    // Estado edit
    const [editingEstado, setEditingEstado] = useState(false);

    const reload = async () => {
        if (!id) return;
        const p = await proyectosStore.getById(id);
        if (!p) { router.push("/proyectos"); return; }
        setProyecto(p);
        setLogoUrl(p.logo_url || "");
        setDocumentosList(p.documentos || []);
        const defaultFases = p.fases && p.fases.length > 0
            ? p.fases
            : FASES_POR_TIPO[p.tipo_proyecto]?.map(c => ({ nombre: c.nombre, completada: false })) || [];
        setLocalFases(defaultFases);
        setHasUnsavedFases(false);

        const [pts, cl, lg] = await Promise.all([
            tareasStore.getByProyecto(id),
            p.cliente_id ? clientesStore.getById(p.cliente_id) : Promise.resolve(null),
            logsProyectoStore.getByProyecto(id),
        ]);
        setTareas(pts);
        setCliente(cl);
        setLogs(lg);
    };

    useEffect(() => {
        reload().then(() => setMounted(true));
    }, [id]);

    if (!mounted) return (
        <div className="p-6 space-y-6 animate-pulse">
            <div className="h-8 w-48 bg-secondary/50 rounded-xl" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="h-[400px] rounded-2xl bg-secondary/30" />
                <div className="lg:col-span-2 h-[400px] rounded-2xl bg-secondary/30" />
            </div>
        </div>
    );

    if (!proyecto) return null;

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

    const applyPlantilla = () => {
        const plantilla = FASES_POR_TIPO[proyecto.tipo_proyecto]?.map(c => ({ nombre: c.nombre, completada: false })) || [];
        setLocalFases(plantilla);
        setShowPlantillas(false);
        setHasUnsavedFases(true);
        toast.success("Plantilla aplicada — guarda para confirmar");
    };

    // ── Logo upload ──────────────────────────────────────────────────────────
    const handleUploadLogo = async (file: File) => {
        const toastId = toast.loading("Subiendo logo...");
        try {
            const url = await storageStore.uploadLogo(file);
            await proyectosStore.update(proyecto.id, { logo_url: url });
            setLogoUrl(url);
            toast.success("Logo guardado", { id: toastId });
            reload();
        } catch { toast.error("Error al subir logo", { id: toastId }); }
    };

    // ── Docs handlers ────────────────────────────────────────────────────────
    const handleSaveDoc = async () => {
        if (!docForm.titulo.trim()) { toast.error("El título es requerido"); return; }
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
            setDocForm({ titulo: "", categoria: "estrategia", contenido: "" });
        } catch { toast.error("Error al guardar"); }
    };

    const handleDeleteDoc = async (docId: string) => {
        if (!confirm("¿Eliminar este documento?")) return;
        const updated = documentosList.filter(d => d.id !== docId);
        setDocumentosList(updated);
        try {
            await proyectosStore.update(proyecto.id, { documentos: updated });
            toast.success("Eliminado");
        } catch { toast.error("Error al eliminar"); }
    };

    const openDocEditor = (doc?: DocumentoProyecto) => {
        setEditingDoc(doc || null);
        setDocForm(doc ? { id: doc.id, titulo: doc.titulo, categoria: doc.categoria, contenido: doc.contenido }
            : { titulo: "", categoria: "estrategia", contenido: "" });
        setShowDocEdit(true);
    };

    // ── Accesos handlers ─────────────────────────────────────────────────────
    const handleAddAcceso = async () => {
        if (!newAcceso.servicio || !newAcceso.usuario) return;
        const updated = [...(proyecto.accesos || []), newAcceso];
        try {
            await proyectosStore.update(proyecto.id, { accesos: updated });
            toast.success("Acceso guardado");
            setNewAcceso({ servicio: "", url: "", usuario: "", password: "" });
            setShowNewAcceso(false);
            reload();
        } catch { toast.error("Error al guardar"); }
    };

    const handleRemoveAcceso = async (i: number) => {
        const updated = (proyecto.accesos || []).filter((_, idx) => idx !== i);
        try {
            await proyectosStore.update(proyecto.id, { accesos: updated });
            toast.success("Acceso eliminado");
            reload();
        } catch { toast.error("Error al eliminar"); }
    };

    // ── Tareas ───────────────────────────────────────────────────────────────
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

    const addRecommendedTask = async (t: any) => {
        try {
            await tareasStore.create({ proyecto_id: proyecto.id, titulo: t.titulo, descripcion: t.descripcion || "", prioridad: t.prioridad, estado: "pendiente", categoria: t.categoria });
            const updated = await tareasStore.getByProyecto(proyecto.id);
            setTareas(updated);
            toast.success("Tarea agregada");
        } catch { toast.error("Error al crear tarea"); }
    };

    // ── Logs ─────────────────────────────────────────────────────────────────
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
        } catch { toast.error("Error al guardar"); }
        finally { setSavingLog(false); }
    };

    const TABS: { id: PageTab; label: string; icon: any; count?: number }[] = [
        { id: "fases", label: "Fases", icon: Layers, count: localFases.length },
        { id: "documentos", label: "Documentos", icon: BookOpen, count: documentosList.length || undefined },
        { id: "tareas", label: "Tareas", icon: CheckSquare, count: tareas.length || undefined },
        { id: "novedades", label: "Novedades", icon: ScrollText, count: logs.length || undefined },
        ...(proyecto.es_interno ? [{ id: "saas" as PageTab, label: "SaaS", icon: Zap }] : []),
    ];

    return (
        <div className="min-h-screen pb-20">
            {/* Top bar */}
            <div className="sticky top-[60px] lg:top-[65px] z-20 bg-background/80 backdrop-blur-md border-b border-border px-4 sm:px-6 h-12 flex items-center gap-3">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Proyectos
                </button>
                <span className="text-border">/</span>
                <span className="text-xs font-bold text-foreground truncate">{proyecto.nombre}</span>
                <div className="ml-auto flex items-center gap-2">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider", ESTADO_BADGE[proyecto.estado])}>
                        {proyecto.estado}
                    </span>
                    <span className="text-[10px] text-muted-foreground hidden sm:block">{TIPO_PROYECTO_LABELS[proyecto.tipo_proyecto]}</span>
                </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
                {/* Header Card */}
                <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                        {/* Logo */}
                        <div className="relative group shrink-0">
                            {logoUrl ? (
                                <img src={logoUrl} alt={proyecto.nombre} className="w-16 h-16 rounded-2xl object-contain bg-secondary border border-border p-1.5 shadow-sm" />
                            ) : (
                                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xl shadow-sm">
                                    {proyecto.nombre.slice(0, 2).toUpperCase()}
                                </div>
                            )}
                            <label
                                htmlFor="logo-upload"
                                className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center text-[9px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                                <Upload className="w-4 h-4" />
                            </label>
                            <input type="file" accept="image/*" id="logo-upload" className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadLogo(f); }} />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h1 className="text-xl sm:text-2xl font-black text-foreground">{proyecto.nombre}</h1>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        {cliente ? cliente.nombre : "Sin cliente asignado"} · {TIPO_PROYECTO_LABELS[proyecto.tipo_proyecto]}
                                    </p>
                                </div>
                            </div>

                            {/* Progress */}
                            <div className="mt-4">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs text-muted-foreground">Progreso ({completedFases}/{localFases.length} fases)</span>
                                    <span className="text-sm font-black text-primary">{fasesProgress}%</span>
                                </div>
                                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400 transition-all duration-700" style={{ width: `${fasesProgress}%` }} />
                                </div>
                            </div>

                            {/* Quick Links */}
                            <div className="flex flex-wrap gap-2 mt-4">
                                {proyecto.figma_url && (
                                    <a href={proyecto.figma_url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground hover:border-primary/30 transition-colors">
                                        <ExternalLink className="w-3.5 h-3.5" /> Figma
                                    </a>
                                )}
                                <Link href={`/portal/${proyecto.slug_portal}`} target="_blank"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground hover:border-primary/30 transition-colors">
                                    <Eye className="w-3.5 h-3.5" /> Portal Cliente
                                </Link>
                                <button
                                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/portal/${proyecto.slug_portal}`); toast.success("Enlace copiado"); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary font-medium hover:bg-primary/20 transition-colors">
                                    <Copy className="w-3.5 h-3.5" /> Copiar Link
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border">
                        {[
                            { label: "Cliente", value: cliente?.nombre || "Sin asignar" },
                            { label: "Tipo", value: TIPO_PROYECTO_LABELS[proyecto.tipo_proyecto] },
                            { label: "Estado", value: proyecto.estado },
                            { label: "Entrega", value: proyecto.fecha_entrega ? formatDate(proyecto.fecha_entrega) : "Sin fecha" },
                        ].map(({ label, value }) => (
                            <div key={label} className="p-3 rounded-xl bg-secondary/30 border border-border">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">{label}</p>
                                <p className="text-xs font-bold text-foreground mt-0.5 truncate capitalize">{value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Descripción */}
                    {proyecto.descripcion && (
                        <div className="mt-4 p-3.5 rounded-xl bg-secondary/30 border border-border">
                            <p className="text-xs font-bold text-muted-foreground mb-1">Descripción</p>
                            <p className="text-sm text-foreground/80 leading-relaxed">{proyecto.descripcion}</p>
                        </div>
                    )}

                    {/* Accesos */}
                    <div className="mt-5 pt-4 border-t border-border">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <Lock className="w-3.5 h-3.5 text-primary" /> Accesos / Credenciales
                            </h3>
                            <button onClick={() => setShowNewAcceso(!showNewAcceso)} className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Agregar
                            </button>
                        </div>
                        {showNewAcceso && (
                            <div className="mb-3 p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <input type="text" placeholder="Servicio" className="text-xs p-2 rounded-lg bg-background border border-border" value={newAcceso.servicio} onChange={e => setNewAcceso({ ...newAcceso, servicio: e.target.value })} />
                                    <input type="text" placeholder="URL Login" className="text-xs p-2 rounded-lg bg-background border border-border" value={newAcceso.url} onChange={e => setNewAcceso({ ...newAcceso, url: e.target.value })} />
                                    <input type="text" placeholder="Usuario / Email" className="text-xs p-2 rounded-lg bg-background border border-border" value={newAcceso.usuario} onChange={e => setNewAcceso({ ...newAcceso, usuario: e.target.value })} />
                                    <div className="flex gap-2">
                                        <input type="text" placeholder="Contraseña" className="flex-1 text-xs p-2 rounded-lg bg-background border border-border" value={newAcceso.password} onChange={e => setNewAcceso({ ...newAcceso, password: e.target.value })} />
                                        <button onClick={handleAddAcceso} className="bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-bold">Guardar</button>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {(proyecto.accesos || []).map((acc, i) => (
                                <div key={i} className="p-3 rounded-xl border border-border bg-secondary/30 flex items-center justify-between group">
                                    <div className="min-w-0 mr-2">
                                        <p className="text-xs font-bold text-foreground truncate">{acc.servicio}</p>
                                        <p className="text-[11px] text-muted-foreground truncate">{acc.usuario}</p>
                                    </div>
                                    <button onClick={() => handleRemoveAcceso(i)} className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-500 transition-opacity shrink-0">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                            {(proyecto.accesos || []).length === 0 && !showNewAcceso && (
                                <p className="text-xs text-muted-foreground italic">Sin accesos registrados</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabs content */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    {/* Tab bar */}
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
                        {/* TAB FASES */}
                        {activeTab === "fases" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-foreground">Roadmap de Fases</h3>
                                        {hasUnsavedFases && (
                                            <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                                                Cambios sin guardar
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setShowPlantillas(!showPlantillas)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <Layers className="w-3.5 h-3.5" /> Plantilla
                                        </button>
                                        <button
                                            onClick={() => setAddingFase(!addingFase)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> Agregar fase
                                        </button>
                                        {hasUnsavedFases && (
                                            <button
                                                onClick={saveFases}
                                                disabled={savingFases}
                                                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 shadow-md shadow-primary/20"
                                            >
                                                <Save className="w-3.5 h-3.5" />
                                                {savingFases ? "Guardando..." : "Guardar cambios"}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Plantillas panel */}
                                {showPlantillas && (
                                    <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2 animate-fade-in">
                                        <p className="text-xs font-bold text-foreground">Aplicar plantilla de fases para &quot;{TIPO_PROYECTO_LABELS[proyecto.tipo_proyecto]}&quot;</p>
                                        <p className="text-[11px] text-muted-foreground">
                                            Esto reemplazará las fases actuales con las fases predefinidas para este tipo de proyecto.
                                        </p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {FASES_POR_TIPO[proyecto.tipo_proyecto]?.map((f, i) => (
                                                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-foreground font-bold">
                                                    {i + 1}. {f.nombre}
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex gap-2 pt-1">
                                            <button onClick={applyPlantilla} className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90">
                                                Aplicar plantilla
                                            </button>
                                            <button onClick={() => setShowPlantillas(false)} className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-secondary">
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Add fase input */}
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

                                {/* Fases list */}
                                <div className="space-y-2">
                                    {localFases.map((fase, i) => {
                                        const configFase = FASES_POR_TIPO[proyecto.tipo_proyecto]?.find(c => c.nombre === fase.nombre);
                                        return (
                                            <div key={i} className={cn(
                                                "rounded-2xl border transition-all",
                                                fase.completada ? "bg-emerald-500/5 border-emerald-500/20" : "bg-card border-border hover:border-primary/30"
                                            )}>
                                                <div className="flex items-center gap-3 p-4">
                                                    <button
                                                        onClick={() => toggleFaseLocal(i)}
                                                        className={cn(
                                                            "w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-all border font-bold text-xs",
                                                            fase.completada
                                                                ? "bg-emerald-500 text-slate-950 border-emerald-400"
                                                                : "bg-secondary text-muted-foreground border-border hover:border-primary"
                                                        )}
                                                    >
                                                        {fase.completada ? <Check className="w-4 h-4 stroke-[3]" /> : i + 1}
                                                    </button>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={cn("text-sm font-bold", fase.completada ? "text-emerald-400/80 line-through" : "text-foreground")}>
                                                            {fase.nombre}
                                                        </p>
                                                        {configFase?.descripcion && (
                                                            <p className="text-xs text-muted-foreground mt-0.5">{configFase.descripcion}</p>
                                                        )}
                                                    </div>
                                                    <button onClick={() => removeFase(i)} className="opacity-0 hover:opacity-100 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity shrink-0" aria-label="Eliminar fase">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                {/* Tareas sugeridas para fases no completadas */}
                                                {!fase.completada && configFase?.tareas && configFase.tareas.length > 0 && (
                                                    <div className="px-4 pb-4">
                                                        <div className="bg-secondary/30 rounded-xl border border-border/50 p-3 space-y-2">
                                                            <p className="text-[10px] uppercase font-black text-muted-foreground tracking-wider flex items-center gap-1.5">
                                                                <CheckSquare className="w-3 h-3 text-primary" /> Tareas sugeridas
                                                            </p>
                                                            <div className="space-y-1">
                                                                {configFase.tareas.map((t, idx) => {
                                                                    const isAdded = tareas.some(tarea => tarea.titulo === t.titulo);
                                                                    return (
                                                                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/50 text-xs">
                                                                            <span className="truncate font-medium">{t.titulo}</span>
                                                                            {isAdded ? (
                                                                                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded shrink-0">Agregada</span>
                                                                            ) : (
                                                                                <button onClick={() => addRecommendedTask(t)} className="text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-md shrink-0">+ Agregar</button>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* TAB DOCUMENTOS */}
                        {activeTab === "documentos" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-bold text-foreground">Wiki de Estrategia y Documentación</h3>
                                        <p className="text-xs text-muted-foreground">Pega manuales, estrategias o briefs de Claude Code</p>
                                    </div>
                                    <button onClick={() => openDocEditor()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 shadow-md shadow-primary/20">
                                        <Plus className="w-3.5 h-3.5" /> Nuevo Documento
                                    </button>
                                </div>
                                {showDocEdit && (
                                    <div className="p-5 rounded-2xl border border-primary/30 bg-primary/5 space-y-4 animate-fade-in">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-bold text-foreground">{editingDoc ? "Editar Documento" : "Nuevo Documento"}</h4>
                                            <button onClick={() => setShowDocEdit(false)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Título</label>
                                                <input value={docForm.titulo} onChange={e => setDocForm({ ...docForm, titulo: e.target.value })} placeholder="Título del documento..." className="w-full h-10 px-3 rounded-xl bg-background border border-border text-xs text-foreground focus:ring-2 focus:ring-primary/50 outline-none mt-1 font-medium" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Categoría</label>
                                                <select value={docForm.categoria} onChange={e => setDocForm({ ...docForm, categoria: e.target.value as any })} className="w-full h-10 px-3 rounded-xl bg-background border border-border text-xs text-foreground outline-none mt-1">
                                                    <option value="estrategia">📊 Estrategia</option>
                                                    <option value="marketing">📣 Marketing</option>
                                                    <option value="contenido">✍️ Contenido</option>
                                                    <option value="prospeccion">🎯 Prospección</option>
                                                    <option value="manual">📖 Manual / Guía</option>
                                                    <option value="otro">📁 Otro</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Contenido (Markdown)</label>
                                            <textarea value={docForm.contenido} onChange={e => setDocForm({ ...docForm, contenido: e.target.value })} placeholder="Pega aquí el contenido en Markdown..." rows={14} className="w-full p-4 rounded-xl bg-background border border-border text-xs font-mono text-foreground focus:ring-2 focus:ring-primary/50 outline-none resize-none leading-relaxed" />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setShowDocEdit(false)} className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-secondary">Cancelar</button>
                                            <button onClick={handleSaveDoc} className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs bg-primary text-primary-foreground font-bold hover:opacity-90">
                                                <Save className="w-3.5 h-3.5" /> Guardar Documento
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-3">
                                    {documentosList.map(doc => (
                                        <div key={doc.id} className="p-4 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all space-y-3 group">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn("text-[9px] px-2.5 py-0.5 rounded-full border font-bold uppercase", DOC_CATEGORIA_BADGE[doc.categoria])}>{doc.categoria}</span>
                                                    <h5 className="text-sm font-bold text-foreground">{doc.titulo}</h5>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => openDocEditor(doc)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"><Edit3 className="w-3.5 h-3.5" /></button>
                                                    <button onClick={() => handleDeleteDoc(doc.id)} className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </div>
                                            <div className="p-3 rounded-xl bg-secondary/30 border border-border/50 text-xs font-mono text-muted-foreground whitespace-pre-wrap max-h-52 overflow-y-auto custom-scrollbar">
                                                {doc.contenido || "Sin contenido."}
                                            </div>
                                        </div>
                                    ))}
                                    {documentosList.length === 0 && !showDocEdit && (
                                        <div className="py-12 text-center text-muted-foreground rounded-2xl border border-dashed border-border bg-card/50">
                                            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                            <p className="text-sm font-semibold">No hay documentos aún</p>
                                            <p className="text-xs opacity-60 mt-1">Crea un nuevo documento para guardar estrategias o briefs.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB TAREAS */}
                        {activeTab === "tareas" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground">{tareas.length} tareas vinculadas a este proyecto</p>
                                    <button onClick={() => setShowNewTarea(!showNewTarea)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
                                        <Plus className="w-3.5 h-3.5" /> Nueva tarea
                                    </button>
                                </div>
                                {showNewTarea && (
                                    <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                                        <input value={tareaForm.titulo} onChange={e => setTareaForm({ ...tareaForm, titulo: e.target.value })} placeholder="Título de la tarea..." className="w-full h-9 px-3 rounded-lg bg-background border border-border text-xs" />
                                        <div className="grid grid-cols-2 gap-2">
                                            <select value={tareaForm.prioridad} onChange={e => setTareaForm({ ...tareaForm, prioridad: e.target.value as any })} className="h-9 px-2 rounded-lg bg-background border border-border text-xs text-foreground outline-none">
                                                <option value="alta">Alta</option>
                                                <option value="media">Media</option>
                                                <option value="baja">Baja</option>
                                            </select>
                                            <select value={tareaForm.categoria} onChange={e => setTareaForm({ ...tareaForm, categoria: e.target.value as any })} className="h-9 px-2 rounded-lg bg-background border border-border text-xs text-foreground outline-none">
                                                <option value="dev">Dev</option>
                                                <option value="diseno">Diseño</option>
                                                <option value="marketing">Marketing</option>
                                                <option value="contenido">Contenido</option>
                                                <option value="seo">SEO</option>
                                                <option value="otro">Otro</option>
                                            </select>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setShowNewTarea(false)} className="px-3 py-1 text-xs text-muted-foreground">Cancelar</button>
                                            <button onClick={handleAddTarea} disabled={savingTarea} className="px-3 py-1 text-xs bg-primary text-primary-foreground font-bold rounded">Guardar</button>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    {tareas.map(t => (
                                        <div key={t.id} className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-secondary/30 hover:border-primary/30 transition-all group">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className={cn("w-2 h-2 rounded-full shrink-0", PRIORIDAD_COLORS[t.prioridad])} />
                                                <span className="text-xs font-semibold text-foreground truncate">{t.titulo}</span>
                                            </div>
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-card border border-border uppercase font-bold text-muted-foreground shrink-0">{t.estado}</span>
                                        </div>
                                    ))}
                                    {tareas.length === 0 && (
                                        <div className="py-10 text-center text-muted-foreground">
                                            <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            <p className="text-sm">Sin tareas en este proyecto</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB NOVEDADES */}
                        {activeTab === "novedades" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground">Registro de avances y cambios del proyecto</p>
                                    <button onClick={() => setShowNewLog(!showNewLog)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
                                        <Plus className="w-3.5 h-3.5" /> Nueva entrada
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
                                                <span className="text-[10px] text-muted-foreground">{formatDate(l.fecha)}</span>
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
