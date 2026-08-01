"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
    ExternalLink, Eye, X, CheckCircle2, Plus, Copy,
    Layers, ScrollText, Zap, Globe, Users, Tag,
    Trash2, CalendarDays, Clock, CheckSquare, FileText, Upload,
    Image as ImageIcon, BookOpen, Edit3, Save, Check
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { proyectosStore, tareasStore, clientesStore, logsProyectoStore, storageStore } from "@/lib/store";
import { toast } from "sonner";
import type { Proyecto, Tarea, Cliente, FaseProyecto, LogProyecto, DocumentoProyecto, TipoProyecto } from "@/lib/types";
import { FASES_POR_TIPO, TIPO_PROYECTO_LABELS, PRIORIDAD_COLORS } from "@/lib/types";
import Link from "next/link";

// ── Utilities ────────────────────────────────────────────────────────────────
const ESTADO_BADGE: Record<string, string> = {
    activo: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    pausado: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    finalizado: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

type ModalTab = "general" | "fases" | "tareas" | "novedades" | "documentos" | "saas";

const DOC_CATEGORIA_BADGE: Record<string, string> = {
    estrategia: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    marketing: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    contenido: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    prospeccion: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    manual: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    otro: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

// ── Project Card ─────────────────────────────────────────────────────────────
function ProyectoCard({
    proyecto, tareas, cliente, onClick,
}: {
    proyecto: Proyecto; tareas: Tarea[]; cliente: Cliente | undefined; onClick: () => void;
}) {
    const fases = proyecto.fases || [];
    const totalFases = fases.length;
    const completedFases = fases.filter((f) => f.completada).length;
    const progress = totalFases > 0
        ? Math.round((completedFases / totalFases) * 100)
        : (tareas.length > 0 ? Math.round((tareas.filter((t) => t.estado === "completada").length / tareas.length) * 100) : 0);

    return (
        <button onClick={onClick} className="w-full text-left rounded-xl border border-border bg-card p-5 card-hover group relative overflow-hidden">
            <div className="flex items-start justify-between mb-3">
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wider", ESTADO_BADGE[proyecto.estado])}>
                    {proyecto.estado}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase">{TIPO_PROYECTO_LABELS[proyecto.tipo_proyecto]}</span>
            </div>

            <div className="flex items-center gap-3 mb-2">
                {proyecto.logo_url ? (
                    <img src={proyecto.logo_url} alt={proyecto.nombre} className="w-10 h-10 rounded-lg object-contain bg-secondary border border-border p-1 shrink-0" />
                ) : (
                    <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {proyecto.nombre.slice(0, 2).toUpperCase()}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <h4 className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {proyecto.nombre}
                    </h4>
                    {proyecto.es_interno && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-md">SaaS/Interno</span>}
                </div>
            </div>

            {cliente && (
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/40 to-cyan-500/40 flex items-center justify-center text-[8px] font-bold">
                        {getInitials(cliente.nombre)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{cliente.nombre}</p>
                </div>
            )}

            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground">Progreso {totalFases > 0 ? `(${completedFases}/${totalFases} fases)` : ""}</span>
                    <span className="text-xs font-semibold text-foreground">{progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
            </div>
        </button>
    );
}

// ── Project Detail Modal / Drawer ─────────────────────────────────────────────
function ProyectoDetailModal({
    open, onClose, proyecto, reload, onUpdateProyecto
}: {
    open: boolean;
    onClose: () => void;
    proyecto: Proyecto | null;
    reload: () => void;
    onUpdateProyecto?: (p: Proyecto) => void;
}) {
    const [activeTab, setActiveTab] = useState<ModalTab>("general");
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [cliente, setCliente] = useState<Cliente | undefined>();
    const [logs, setLogs] = useState<LogProyecto[]>([]);

    // Local reactive states for live update without modal closure
    const [fasesList, setFasesList] = useState<FaseProyecto[]>([]);
    const [documentosList, setDocumentosList] = useState<DocumentoProyecto[]>([]);
    const [logoUrl, setLogoUrl] = useState<string>("");

    const [showNewAcceso, setShowNewAcceso] = useState(false);
    const [newAcceso, setNewAcceso] = useState({ servicio: "", url: "", usuario: "", password: "" });
    const [savingFase, setSavingFase] = useState(false);

    // Log form
    const [showNewLog, setShowNewLog] = useState(false);
    const [logForm, setLogForm] = useState({ titulo: "", descripcion: "", fecha: new Date().toISOString().slice(0, 10) });
    const [savingLog, setSavingLog] = useState(false);

    // Tareas form
    const [showNewTarea, setShowNewTarea] = useState(false);
    const [tareaForm, setTareaForm] = useState<Partial<Tarea>>({
        titulo: "", descripcion: "", prioridad: "media", categoria: "dev"
    });
    const [savingTarea, setSavingTarea] = useState(false);

    // SaaS fields
    const [saasForm, setSaasForm] = useState({
        saas_url: "", version: "", usuarios_activos: 0,
    });

    // Documentos Wiki Form
    const [showDocEdit, setShowDocEdit] = useState(false);
    const [editingDoc, setEditingDoc] = useState<DocumentoProyecto | null>(null);
    const [docForm, setDocForm] = useState<{
        id?: string;
        titulo: string;
        categoria: 'estrategia' | 'marketing' | 'contenido' | 'prospeccion' | 'manual' | 'otro';
        contenido: string;
    }>({
        titulo: "",
        categoria: "estrategia",
        contenido: ""
    });

    useEffect(() => {
        if (!proyecto) return;
        setActiveTab("general");
        setSaasForm({
            saas_url: proyecto.saas_url || "",
            version: proyecto.version || "",
            usuarios_activos: proyecto.usuarios_activos || 0,
        });

        // Initialize local reactive fields
        const defaultFases = proyecto.fases && proyecto.fases.length > 0
            ? proyecto.fases
            : FASES_POR_TIPO[proyecto.tipo_proyecto]?.map((c) => ({ nombre: c.nombre, completada: false })) || [];

        setFasesList(defaultFases);
        setDocumentosList(proyecto.documentos || []);
        setLogoUrl(proyecto.logo_url || "");

        const load = async () => {
            const [pts, cl, lg] = await Promise.all([
                tareasStore.getByProyecto(proyecto.id),
                proyecto.cliente_id ? clientesStore.getById(proyecto.cliente_id) : Promise.resolve(null),
                logsProyectoStore.getByProyecto(proyecto.id),
            ]);
            setTareas(pts);
            setCliente(cl || undefined);
            setLogs(lg);
        };
        load();
    }, [proyecto]);

    if (!open || !proyecto) return null;

    const completedFases = fasesList.filter((f) => f.completada).length;
    const fasesProgress = fasesList.length > 0 ? Math.round((completedFases / fasesList.length) * 100) : 0;

    // Toggle live phases immediately without page leave
    const toggleFase = async (index: number) => {
        setSavingFase(true);
        const updated = fasesList.map((f, i) => i === index ? { ...f, completada: !f.completada } : f);
        setFasesList(updated); // Optimistic UI update!

        try {
            const updatedProyecto = await proyectosStore.update(proyecto.id, { fases: updated });
            if (onUpdateProyecto) onUpdateProyecto(updatedProyecto);
            toast.success("Fase actualizada");
            reload();
        } catch {
            toast.error("Error al actualizar fase");
        } finally {
            setSavingFase(false);
        }
    };

    // Upload Logo
    const handleUploadLogo = async (file: File) => {
        const toastId = toast.loading("Subiendo logo...");
        try {
            const url = await storageStore.uploadLogo(file);
            const updated = await proyectosStore.update(proyecto.id, { logo_url: url });
            setLogoUrl(url);
            if (onUpdateProyecto) onUpdateProyecto(updated);
            toast.success("Logo guardado", { id: toastId });
            reload();
        } catch {
            toast.error("Error al subir logo", { id: toastId });
        }
    };

    // Save Strategy Document
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
            const updated = await proyectosStore.update(proyecto.id, { documentos: updatedDocs });
            if (onUpdateProyecto) onUpdateProyecto(updated);
            toast.success("Documento guardado");
            setShowDocEdit(false);
            setEditingDoc(null);
            setDocForm({ titulo: "", categoria: "estrategia", contenido: "" });
            reload();
        } catch {
            toast.error("Error al guardar documento");
        }
    };

    const handleDeleteDoc = async (id: string) => {
        if (!confirm("¿Eliminar este documento de estrategia?")) return;
        const updatedDocs = documentosList.filter(d => d.id !== id);
        setDocumentosList(updatedDocs);
        try {
            const updated = await proyectosStore.update(proyecto.id, { documentos: updatedDocs });
            if (onUpdateProyecto) onUpdateProyecto(updated);
            toast.success("Documento eliminado");
            reload();
        } catch { toast.error("Error al eliminar"); }
    };

    const openDocEditor = (doc?: DocumentoProyecto) => {
        if (doc) {
            setEditingDoc(doc);
            setDocForm({
                id: doc.id,
                titulo: doc.titulo,
                categoria: doc.categoria,
                contenido: doc.contenido
            });
        } else {
            setEditingDoc(null);
            setDocForm({ titulo: "", categoria: "estrategia", contenido: "" });
        }
        setShowDocEdit(true);
    };

    const addRecommendedTask = async (t: { titulo: string; categoria: string; prioridad: string; descripcion?: string }) => {
        setSavingTarea(true);
        try {
            await tareasStore.create({
                proyecto_id: proyecto.id,
                titulo: t.titulo,
                descripcion: t.descripcion || "",
                prioridad: t.prioridad as any,
                estado: "pendiente",
                categoria: t.categoria as any,
            });
            const updated = await tareasStore.getByProyecto(proyecto.id);
            setTareas(updated);
            toast.success("Tarea recomendada agregada");
            reload();
        } catch { toast.error("Error al crear tarea"); }
        finally { setSavingTarea(false); }
    };

    const handleAddTarea = async () => {
        if (!tareaForm.titulo?.trim()) { toast.error("El título es requerido"); return; }
        setSavingTarea(true);
        try {
            await tareasStore.create({
                proyecto_id: proyecto.id,
                titulo: tareaForm.titulo,
                descripcion: tareaForm.descripcion || "",
                prioridad: tareaForm.prioridad as any,
                estado: "pendiente",
                categoria: tareaForm.categoria as any,
            });
            const updated = await tareasStore.getByProyecto(proyecto.id);
            setTareas(updated);
            setTareaForm({ titulo: "", descripcion: "", prioridad: "media", categoria: "dev" });
            setShowNewTarea(false);
            toast.success("Tarea creada");
            reload();
        } catch { toast.error("Error al crear tarea"); }
        finally { setSavingTarea(false); }
    };

    const handleAddAcceso = async () => {
        if (!newAcceso.servicio || !newAcceso.usuario) return;
        const updated = [...(proyecto.accesos || []), newAcceso];
        try {
            const updatedP = await proyectosStore.update(proyecto.id, { accesos: updated });
            if (onUpdateProyecto) onUpdateProyecto(updatedP);
            toast.success("Acceso guardado");
            setNewAcceso({ servicio: "", url: "", usuario: "", password: "" });
            setShowNewAcceso(false);
            reload();
        } catch { toast.error("Error al guardar acceso"); }
    };

    const handleRemoveAcceso = async (i: number) => {
        const updated = (proyecto.accesos || []).filter((_, idx) => idx !== i);
        try {
            const updatedP = await proyectosStore.update(proyecto.id, { accesos: updated });
            if (onUpdateProyecto) onUpdateProyecto(updatedP);
            toast.success("Acceso eliminado");
            reload();
        } catch { toast.error("Error al eliminar acceso"); }
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

    const TABS: { id: ModalTab; label: string; icon: any }[] = [
        { id: "general", label: "General", icon: Globe },
        { id: "fases", label: "Fases", icon: Layers },
        { id: "documentos", label: "Documentos / Strategy Wiki", icon: BookOpen },
        { id: "tareas", label: "Tareas", icon: CheckSquare },
        { id: "novedades", label: "Novedades", icon: ScrollText },
        ...(proyecto.es_interno ? [{ id: "saas" as ModalTab, label: "SaaS", icon: Zap }] : []),
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-6 px-4">
            <div className="w-full max-w-4xl rounded-3xl border border-border bg-card shadow-2xl animate-fade-in flex flex-col max-h-[90vh]">
                {/* Header con Logo Upload */}
                <div className="p-6 border-b border-border flex items-center justify-between bg-secondary/20">
                    <div className="flex items-center gap-4">
                        {/* Logo Uploader */}
                        <div className="relative group shrink-0">
                            {logoUrl ? (
                                <img src={logoUrl} alt={proyecto.nombre} className="w-14 h-14 rounded-2xl object-contain bg-card border border-border p-1 shadow-sm" />
                            ) : (
                                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xl shadow-sm">
                                    {proyecto.nombre.slice(0, 2).toUpperCase()}
                                </div>
                            )}

                            <label
                                htmlFor={`logo-upload-${proyecto.id}`}
                                className="absolute inset-0 bg-black/60 rounded-2xl flex flex-col items-center justify-center text-[9px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-1 text-center"
                            >
                                <Upload className="w-4 h-4 mb-0.5" /> Logo
                            </label>
                            <input
                                type="file"
                                accept="image/*"
                                id={`logo-upload-${proyecto.id}`}
                                className="hidden"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleUploadLogo(f);
                                }}
                            />
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-black text-foreground">{proyecto.nombre}</h3>
                                {proyecto.es_interno && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-md uppercase font-bold tracking-wider">Interno</span>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {proyecto.es_interno ? "Producto Propio" : cliente?.nombre} · {TIPO_PROYECTO_LABELS[proyecto.tipo_proyecto]}
                            </p>
                        </div>
                    </div>

                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors">
                        <X className="w-6 h-6 text-muted-foreground" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 px-6 pt-3 border-b border-border bg-card overflow-x-auto">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all -mb-px shrink-0",
                                activeTab === tab.id
                                    ? "border-primary text-primary bg-primary/5"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                            {tab.id === "documentos" && documentosList.length > 0 && (
                                <span className="ml-1 text-[10px] bg-primary/20 text-primary px-1.5 py-0.2 rounded-full font-bold">
                                    {documentosList.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                    {/* TAB: GENERAL */}
                    {activeTab === "general" && (
                        <div className="space-y-6">
                            <div className="flex flex-wrap gap-2">
                                {proyecto.figma_url && (
                                    <a href={proyecto.figma_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground hover:border-primary/30 transition-colors">
                                        <ExternalLink className="w-3.5 h-3.5" /> Figma
                                    </a>
                                )}
                                <Link href={`/portal/${proyecto.slug_portal}`} target="_blank" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground hover:border-primary/30 transition-colors">
                                    <Eye className="w-3.5 h-3.5" /> Ver Portal
                                </Link>
                                <button
                                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/portal/${proyecto.slug_portal}`); toast.success("Enlace copiado"); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary font-medium hover:bg-primary/20 transition-colors"
                                >
                                    <Copy className="w-3.5 h-3.5" /> Copiar Link
                                </button>
                            </div>

                            {/* Contrato */}
                            <div className="p-4 rounded-xl border border-border bg-secondary/30">
                                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Contrato de Servicios</h4>
                                {proyecto.contrato_url ? (
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-primary/30">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-5 h-5 text-primary" />
                                            <span className="text-sm font-medium text-foreground">Contrato adjunto</span>
                                        </div>
                                        <a href={proyecto.contrato_url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold">Ver PDF</a>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            id={`contrato-upload-${proyecto.id}`}
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const toastId = toast.loading("Subiendo contrato...");
                                                    try {
                                                        const url = await storageStore.uploadContrato(file);
                                                        await proyectosStore.update(proyecto.id, { contrato_url: url });
                                                        toast.success("Contrato guardado", { id: toastId });
                                                        reload();
                                                    } catch { toast.error("Error al subir", { id: toastId }); }
                                                }
                                            }}
                                        />
                                        <label htmlFor={`contrato-upload-${proyecto.id}`} className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg border-2 border-dashed border-primary/40 text-xs font-semibold text-primary hover:bg-primary/5 cursor-pointer">
                                            <Upload className="w-4 h-4" /> Subir PDF del Contrato
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold text-foreground mb-2">Descripción</h4>
                                <div className="p-3 rounded-lg border border-border bg-secondary/30 text-sm text-muted-foreground min-h-[70px]">
                                    {proyecto.descripcion || "Sin descripción."}
                                </div>
                            </div>

                            {/* Accesos */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-semibold text-foreground">Accesos / Credenciales</h4>
                                    <button onClick={() => setShowNewAcceso(!showNewAcceso)} className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
                                        <Plus className="w-3 h-3" /> Agregar
                                    </button>
                                </div>
                                {showNewAcceso && (
                                    <div className="mb-3 p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
                                        <input type="text" placeholder="Servicio (ej. Hosting)" className="w-full text-xs p-2 rounded-lg bg-background border border-border" value={newAcceso.servicio} onChange={e => setNewAcceso({ ...newAcceso, servicio: e.target.value })} />
                                        <input type="text" placeholder="URL Login" className="w-full text-xs p-2 rounded-lg bg-background border border-border" value={newAcceso.url} onChange={e => setNewAcceso({ ...newAcceso, url: e.target.value })} />
                                        <input type="text" placeholder="Usuario / Email" className="w-full text-xs p-2 rounded-lg bg-background border border-border" value={newAcceso.usuario} onChange={e => setNewAcceso({ ...newAcceso, usuario: e.target.value })} />
                                        <div className="flex gap-2">
                                            <input type="text" placeholder="Contraseña" className="flex-1 text-xs p-2 rounded-lg bg-background border border-border" value={newAcceso.password} onChange={e => setNewAcceso({ ...newAcceso, password: e.target.value })} />
                                            <button onClick={handleAddAcceso} className="bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-bold">Guardar</button>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-2 max-h-[180px] overflow-y-auto">
                                    {(proyecto.accesos || []).map((acceso, i) => (
                                        <div key={i} className="p-3 rounded-xl border border-border bg-secondary/30 flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold text-foreground">{acceso.servicio}</p>
                                                <p className="text-[11px] text-muted-foreground">{acceso.usuario} • {acceso.password}</p>
                                            </div>
                                            <button onClick={() => handleRemoveAcceso(i)} className="text-rose-400 hover:text-rose-500"><X className="w-4 h-4" /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: FASES (LIVE INTERACTIVE) */}
                    {activeTab === "fases" && (
                        <div className="space-y-5">
                            <div className="p-4 rounded-2xl bg-secondary/50 border border-border">
                                <div className="flex justify-between mb-2">
                                    <span className="text-xs text-muted-foreground font-semibold">Progreso General del Proyecto</span>
                                    <span className="text-sm font-black text-primary">{fasesProgress}%</span>
                                </div>
                                <div className="h-2.5 rounded-full bg-background overflow-hidden">
                                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400 transition-all duration-500" style={{ width: `${fasesProgress}%` }} />
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-2">{completedFases} de {fasesList.length} fases completadas</p>
                            </div>

                            <div className="space-y-3">
                                {fasesList.map((fase, i) => {
                                    const configFase = FASES_POR_TIPO[proyecto.tipo_proyecto]?.find((c) => c.nombre === fase.nombre);

                                    return (
                                        <div key={i} className={cn("p-4 rounded-2xl border transition-all", fase.completada ? "bg-emerald-500/5 border-emerald-500/30" : "bg-card border-border hover:border-primary/40")}>
                                            <div className="flex items-start gap-3">
                                                <button
                                                    onClick={() => !savingFase && toggleFase(i)}
                                                    disabled={savingFase}
                                                    className={cn("mt-0.5 w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-all border font-bold text-xs", fase.completada ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-secondary text-muted-foreground border-border hover:border-primary")}
                                                >
                                                    {fase.completada ? <Check className="w-4 h-4 stroke-[3]" /> : i + 1}
                                                </button>
                                                <div className="flex-1">
                                                    <button onClick={() => !savingFase && toggleFase(i)} className={cn("text-base font-bold text-left transition-colors", fase.completada ? "text-emerald-400/80 line-through" : "text-foreground")}>
                                                        {fase.nombre}
                                                    </button>
                                                    {configFase?.descripcion && (
                                                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{configFase.descripcion}</p>
                                                    )}

                                                    {!fase.completada && configFase?.tareas && configFase.tareas.length > 0 && (
                                                        <div className="mt-4 bg-secondary/30 rounded-xl border border-border/50 p-3 space-y-2">
                                                            <p className="text-[10px] uppercase font-black text-muted-foreground tracking-wider flex items-center gap-1.5"><CheckSquare className="w-3 h-3 text-primary" /> Tareas Sugeridas</p>
                                                            <div className="space-y-1.5">
                                                                {configFase.tareas.map((t, idx) => {
                                                                    const isAdded = tareas.some(tarea => tarea.titulo === t.titulo);
                                                                    return (
                                                                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/50 text-xs">
                                                                            <span className="truncate font-medium">{t.titulo}</span>
                                                                            {isAdded ? (
                                                                                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Agregada</span>
                                                                            ) : (
                                                                                <button onClick={() => addRecommendedTask(t)} className="text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-md">
                                                                                    + Agregar
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* TAB: DOCUMENTOS / STRATEGY WIKI (ISSUE #8) */}
                    {activeTab === "documentos" && (
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-bold text-foreground">Wiki de Estrategia y Documentación</h4>
                                    <p className="text-xs text-muted-foreground">Pega manuales, estrategias o briefs de Claude Code directamente sin resubir archivos</p>
                                </div>
                                <button
                                    onClick={() => openDocEditor()}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-all shadow-md shadow-primary/20"
                                >
                                    <Plus className="w-4 h-4" /> Nuevo Documento
                                </button>
                            </div>

                            {/* Form de edición de documento */}
                            {showDocEdit && (
                                <div className="p-5 rounded-2xl border border-primary/30 bg-primary/5 space-y-4 animate-fade-in">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold text-foreground">{editingDoc ? "Editar Documento" : "Nuevo Documento de Estrategia"}</h4>
                                        <button onClick={() => setShowDocEdit(false)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Título</label>
                                            <input
                                                value={docForm.titulo}
                                                onChange={(e) => setDocForm({ ...docForm, titulo: e.target.value })}
                                                placeholder="Ej: Estrategia de Contenido Q3, Manual de Prospección..."
                                                className="w-full h-10 px-3 rounded-xl bg-background border border-border text-xs text-foreground focus:ring-2 focus:ring-primary/50 outline-none mt-1 font-medium"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Categoría</label>
                                            <select
                                                value={docForm.categoria}
                                                onChange={(e) => setDocForm({ ...docForm, categoria: e.target.value as any })}
                                                className="w-full h-10 px-3 rounded-xl bg-background border border-border text-xs text-foreground outline-none mt-1"
                                            >
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
                                        <textarea
                                            value={docForm.contenido}
                                            onChange={(e) => setDocForm({ ...docForm, contenido: e.target.value })}
                                            placeholder="Pega aquí el contenido en Markdown generado por Claude Code..."
                                            rows={12}
                                            className="w-full p-4 rounded-xl bg-background border border-border text-xs font-mono text-foreground focus:ring-2 focus:ring-primary/50 outline-none resize-none leading-relaxed"
                                        />
                                    </div>

                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setShowDocEdit(false)} className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-secondary">Cancelar</button>
                                        <button onClick={handleSaveDoc} className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs bg-primary text-primary-foreground font-bold hover:opacity-90">
                                            <Save className="w-3.5 h-3.5" /> Guardar Documento
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Lista de documentos */}
                            <div className="space-y-3">
                                {documentosList.map((doc) => (
                                    <div key={doc.id} className="p-4 rounded-2xl border border-border bg-card hover:border-primary/40 transition-all space-y-3 group">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className={cn("text-[9px] px-2.5 py-0.5 rounded-full border font-bold uppercase tracking-wider", DOC_CATEGORIA_BADGE[doc.categoria])}>
                                                    {doc.categoria}
                                                </span>
                                                <h5 className="text-sm font-bold text-foreground">{doc.titulo}</h5>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openDocEditor(doc)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => handleDeleteDoc(doc.id)} className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="p-3 rounded-xl bg-secondary/30 border border-border/50 text-xs font-mono text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">
                                            {doc.contenido || "Sin contenido."}
                                        </div>
                                    </div>
                                ))}

                                {documentosList.length === 0 && !showDocEdit && (
                                    <div className="py-12 text-center text-muted-foreground rounded-2xl border border-dashed border-border bg-card/50">
                                        <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm font-semibold">No hay documentos de estrategia guardados aún</p>
                                        <p className="text-xs opacity-60 mt-1">Crea un nuevo documento para guardar la estrategia generada por Claude Code.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB: TAREAS */}
                    {activeTab === "tareas" && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">{tareas.length} tareas asociadas a este proyecto</p>
                                <button onClick={() => setShowNewTarea(!showNewTarea)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
                                    <Plus className="w-3.5 h-3.5" /> Crear tarea
                                </button>
                            </div>

                            {showNewTarea && (
                                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                                    <input value={tareaForm.titulo} onChange={(e) => setTareaForm({ ...tareaForm, titulo: e.target.value })} placeholder="Título de la tarea..." className="w-full h-9 px-3 rounded-lg bg-background border border-border text-xs" />
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setShowNewTarea(false)} className="px-3 py-1 text-xs text-muted-foreground">Cancelar</button>
                                        <button onClick={handleAddTarea} disabled={savingTarea} className="px-3 py-1 text-xs bg-primary text-primary-foreground font-bold rounded">Guardar</button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2 max-h-[350px] overflow-y-auto">
                                {tareas.map((t) => (
                                    <div key={t.id} className="p-3 rounded-xl bg-secondary/30 border border-border flex items-center justify-between">
                                        <span className="text-xs font-semibold text-foreground">{t.titulo}</span>
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-card border border-border uppercase font-bold text-muted-foreground">{t.estado}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TAB: NOVEDADES */}
                    {activeTab === "novedades" && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">Registros de avances del proyecto</p>
                                <button onClick={() => setShowNewLog(!showNewLog)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
                                    <Plus className="w-3.5 h-3.5" /> Nueva entrada
                                </button>
                            </div>

                            {showNewLog && (
                                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                                    <input value={logForm.titulo} onChange={(e) => setLogForm({ ...logForm, titulo: e.target.value })} placeholder="Título..." className="w-full h-9 px-3 rounded-lg bg-background border border-border text-xs" />
                                    <textarea value={logForm.descripcion} onChange={(e) => setLogForm({ ...logForm, descripcion: e.target.value })} placeholder="Descripción..." rows={3} className="w-full p-3 rounded-lg bg-background border border-border text-xs resize-none" />
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => setShowNewLog(false)} className="px-3 py-1 text-xs text-muted-foreground">Cancelar</button>
                                        <button onClick={handleAddLog} disabled={savingLog} className="px-3 py-1 text-xs bg-primary text-primary-foreground font-bold rounded">Guardar</button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3 max-h-[350px] overflow-y-auto">
                                {logs.map((l) => (
                                    <div key={l.id} className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                                        <div className="flex justify-between items-center">
                                            <h5 className="text-xs font-bold text-foreground">{l.titulo}</h5>
                                            <span className="text-[10px] text-muted-foreground">{l.fecha}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{l.descripcion}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Modal Crear Proyecto ──────────────────────────────────────────────────────
function NuevoProyectoModal({
    open, onClose, clientes, reload,
}: {
    open: boolean; onClose: () => void; clientes: Cliente[]; reload: () => void;
}) {
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        nombre: "", tipo_proyecto: "landing" as any, cliente_id: "",
        figma_url: "", calendly_url: "", slug_portal: "",
        contrato_url: "", descripcion: "", fecha_entrega: "",
        es_interno: false, accesos: [] as any[],
        tipo_propio: "web_propia", stack_tecnologico: "",
        notas_negocio: "", url_producto: ""
    });

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.nombre.trim()) { toast.error("El nombre es requerido"); return; }
        setSubmitting(true);
        try {
            const slug = form.slug_portal.trim() || form.nombre.toLowerCase().replace(/[^a-z0-9]/g, "-");
            const defaultFases = FASES_POR_TIPO[form.tipo_proyecto as TipoProyecto]?.map((c) => ({ nombre: c.nombre, completada: false })) || [];

            await proyectosStore.create({
                ...form,
                tipo_proyecto: form.tipo_proyecto as TipoProyecto,
                tipo_propio: form.tipo_propio as any,
                cliente_id: form.cliente_id || null,
                slug_portal: slug,
                estado: "activo",
                fases: defaultFases,
            });
            toast.success("Proyecto creado exitosamente");
            onClose();
            reload();
        } catch (e: any) {
            console.error(e);
            toast.error("Error al crear proyecto: " + (e?.message || "intenta de nuevo"));
        } finally {
            setSubmitting(false);
        }
    };

    const previewFases = FASES_POR_TIPO[form.tipo_proyecto as TipoProyecto] || [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
            <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl animate-fade-in space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="text-lg font-bold text-foreground">Crear Nuevo Proyecto</h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Nombre del Proyecto *</label>
                        <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Rediseño Ecommerce Camila..." className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm text-foreground focus:ring-2 focus:ring-primary/50 outline-none font-medium" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Tipo</label>
                            <select value={form.tipo_proyecto} onChange={(e) => setForm({ ...form, tipo_proyecto: e.target.value as any })} className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none">
                                {Object.entries(TIPO_PROYECTO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Cliente</label>
                            <select value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })} className="w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none">
                                <option value="">Sin cliente (Interno)</option>
                                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Descripción</label>
                        <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Detalles clave del proyecto..." rows={3} className="w-full p-3 rounded-xl bg-secondary border border-border text-sm text-foreground focus:ring-2 focus:ring-primary/50 outline-none resize-none" />
                    </div>

                    <div className="p-3 rounded-xl border border-border bg-secondary/30">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-primary" /> Fases a inicializar ({previewFases.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {previewFases.map((f, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-foreground font-bold">
                                    {i + 1}. {f.nombre}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="pt-3 border-t border-border flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary rounded-lg">Cancelar</button>
                        <button disabled={submitting} type="submit" className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-50">
                            {submitting ? "Creando..." : "Crear Proyecto"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────
function ProyectosContent() {
    const searchParams = useSearchParams();
    const [proyectos, setProyectos] = useState<Proyecto[]>([]);
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [mounted, setMounted] = useState(false);
    const [selected, setSelected] = useState<Proyecto | null>(null);
    const [showDetail, setShowDetail] = useState(false);
    const [showNew, setShowNew] = useState(searchParams.get("new") === "true");
    const [filter, setFilter] = useState<string>("todos");

    const reload = async () => {
        try {
            const [p, t, c] = await Promise.all([
                proyectosStore.getAll(),
                tareasStore.getAll(),
                clientesStore.getAll(),
            ]);
            const filteredProys = p.filter(item => !item.es_interno && item.tipo_proyecto !== 'saas');
            setProyectos(filteredProys);
            setTareas(t);
            setClientes(c);

            // Keep selected modal project in sync with reloaded data
            if (selected) {
                const refreshed = filteredProys.find(item => item.id === selected.id);
                if (refreshed) setSelected(refreshed);
            }
        } catch {
            console.error("Error reloading projects:");
        }
    };
    useEffect(() => { reload().then(() => setMounted(true)); }, []);

    if (!mounted) {
        return (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
                {[...Array(3)].map((_, i) => <div key={i} className="h-[200px] rounded-xl bg-secondary/30" />)}
            </div>
        );
    }

    const filtered = filter === "todos" ? proyectos : proyectos.filter((p) => p.estado === filter);

    return (
        <div className="p-6 space-y-6 animate-fade-in pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Proyectos Clientes</h2>
                    <p className="text-sm text-muted-foreground">{proyectos.filter((p) => p.estado === "activo").length} proyectos activos</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20">
                        <Plus className="w-4 h-4" /> Nuevo Proyecto
                    </button>
                    <div className="h-6 w-px bg-border hidden md:block" />
                    <div className="hidden md:flex items-center gap-2">
                        {["todos", "activo", "pausado", "finalizado"].map((f) => (
                            <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize", filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((p) => (
                    <ProyectoCard
                        key={p.id}
                        proyecto={p}
                        tareas={tareas.filter(t => t.proyecto_id === p.id)}
                        cliente={clientes.find(c => c.id === p.cliente_id)}
                        onClick={() => { setSelected(p); setShowDetail(true); }}
                    />
                ))}
                {filtered.length === 0 && (
                    <div className="col-span-3 py-12 text-center text-muted-foreground">
                        <p>No hay proyectos {filter !== "todos" ? `con estado "${filter}"` : ""}</p>
                    </div>
                )}
            </div>

            <ProyectoDetailModal
                open={showDetail}
                onClose={() => { setShowDetail(false); setSelected(null); }}
                proyecto={selected}
                reload={reload}
                onUpdateProyecto={(updatedP) => setSelected(updatedP)}
            />
            <NuevoProyectoModal
                open={showNew}
                onClose={() => setShowNew(false)}
                clientes={clientes}
                reload={reload}
            />
        </div>
    );
}

export default function ProyectosPage() {
    return (
        <Suspense fallback={
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
                {[...Array(3)].map((_, i) => <div key={i} className="h-[200px] rounded-xl bg-secondary/30" />)}
            </div>
        }>
            <ProyectosContent />
        </Suspense>
    );
}
