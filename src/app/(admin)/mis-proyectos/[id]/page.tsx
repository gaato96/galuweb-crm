"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft, ExternalLink, Plus, X, CheckSquare, Layers, BookOpen, ScrollText,
    Zap, Rocket, Check, Trash2, Edit3, Save, Lock, FileUp, Eye, CheckCircle2, Clock, ChevronRight,
    Download, Copy
} from "lucide-react";
import { cn, formatDate, slugify, descargarTexto, descargarMarkdownCombinado } from "@/lib/utils";
import { proyectosStore, tareasStore, logsProyectoStore, mensajeError } from "@/lib/store";
import { toast } from "sonner";
import type { Proyecto, Tarea, LogProyecto, TipoProyectoPropio, FaseProyecto, DocumentoProyecto } from "@/lib/types";
import { FASES_POR_TIPO, PRIORIDAD_COLORS } from "@/lib/types";
import { calcularEstado, haceCuanto, SALUD_LABELS, SALUD_COLORS } from "@/lib/proyectos-estado";
import MarkdownViewer from "@/components/markdown-viewer";

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

const DOC_CATEGORIA_BADGE: Record<string, string> = {
    estrategia: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    marketing: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    contenido: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    prospeccion: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    manual: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    otro: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

type PageTab = "dashboard" | "fases" | "documentos" | "tareas" | "novedades" | "specs" | "accesos";

export default function MisProyectoDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [proyecto, setProyecto] = useState<Proyecto | null>(null);
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [logs, setLogs] = useState<LogProyecto[]>([]);
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<PageTab>("dashboard");

    // Local Fases Batch State
    const [localFases, setLocalFases] = useState<FaseProyecto[]>([]);
    const [hasUnsavedFases, setHasUnsavedFases] = useState(false);
    const [savingFases, setSavingFases] = useState(false);
    const [newFaseName, setNewFaseName] = useState("");
    const [addingFase, setAddingFase] = useState(false);

    // Documentos & Markdown Reader
    const [documentosList, setDocumentosList] = useState<DocumentoProyecto[]>([]);
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
    const [docMode, setDocMode] = useState<"read" | "edit">("read");
    const [showDocEdit, setShowDocEdit] = useState(false);
    const [editingDoc, setEditingDoc] = useState<DocumentoProyecto | null>(null);
    const [docForm, setDocForm] = useState<{
        id?: string;
        titulo: string;
        categoria: 'estrategia' | 'marketing' | 'contenido' | 'prospeccion' | 'manual' | 'otro';
        contenido: string;
    }>({ titulo: "", categoria: "manual", contenido: "" });

    // Credenciales & Specs Form
    const [showNewAcceso, setShowNewAcceso] = useState(false);
    const [newAcceso, setNewAcceso] = useState({ servicio: "", url: "", usuario: "", password: "" });
    const [editingGeneral, setEditingGeneral] = useState(false);
    const [genForm, setGenForm] = useState({
        saas_url: "", version: "", stack_tecnologico: "", notas_negocio: "", descripcion: "",
    });

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
        if (p.documentos && p.documentos.length > 0 && !selectedDocId) {
            setSelectedDocId(p.documentos[0].id);
        }
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
            <div className="h-[300px] rounded-2xl bg-secondary/30" />
        </div>
    );

    if (!proyecto) return null;

    const tipoPropio = proyecto.tipo_propio || 'web_propia';
    const completedFases = localFases.filter(f => f.completada).length;
    const fasesProgress = localFases.length > 0 ? Math.round((completedFases / localFases.length) * 100) : 0;
    const siguienteFaseIndex = localFases.findIndex(f => !f.completada);
    const siguienteFase = siguienteFaseIndex !== -1 ? localFases[siguienteFaseIndex] : null;
    const tareasPendientes = tareas.filter(t => t.estado !== "completada");
    const activeDoc = documentosList.find(d => d.id === selectedDocId) || documentosList[0];

    // ── Handlers ────────────────────────────────────────────────────────────
    const toggleEstadoProyecto = async () => {
        const estados: Proyecto["estado"][] = ["activo", "pausado", "finalizado"];
        const nextIdx = (estados.indexOf(proyecto.estado) + 1) % estados.length;
        const nextState = estados[nextIdx];
        try {
            await proyectosStore.update(proyecto.id, { estado: nextState });
            setProyecto({ ...proyecto, estado: nextState });
            toast.success(`Estado cambiado a "${nextState}"`);
        } catch { toast.error("Error al actualizar estado"); }
    };

    const toggleFaseLocal = (index: number) => {
        const updated = localFases.map((f, i) => i === index ? { ...f, completada: !f.completada } : f);
        setLocalFases(updated);
        setHasUnsavedFases(true);
    };

    /**
     * Cierre de fase desde la cabecera: guarda en el momento. Obligar a ir a otra
     * pestaña a confirmar hacía que el avance quedara sin registrar.
     */
    const completarFaseActual = async (index: number) => {
        const updated = localFases.map((f, i) => i === index ? { ...f, completada: true } : f);
        setLocalFases(updated);
        try {
            await proyectosStore.update(proyecto.id, { fases: updated });
            setHasUnsavedFases(false);
            toast.success(`Fase "${updated[index].nombre}" completada`);
        } catch (e) {
            setLocalFases(localFases); // revertir si no se pudo guardar
            toast.error(mensajeError(e));
        }
    };

    const saveFases = async () => {
        setSavingFases(true);
        try {
            await proyectosStore.update(proyecto.id, { fases: localFases });
            toast.success("Fases guardadas exitosamente");
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

    const toggleTareaEstado = async (t: Tarea) => {
        const nuevoEstado = t.estado === "completada" ? "pendiente" : "completada";
        try {
            await tareasStore.update(t.id, { estado: nuevoEstado as any });
            setTareas(tareas.map(item => item.id === t.id ? { ...item, estado: nuevoEstado as any } : item));
            toast.success(nuevoEstado === "completada" ? "Tarea completada" : "Tarea marcada pendiente");
        } catch { toast.error("Error al actualizar tarea"); }
    };

    // ── Docs & Sync ─────────────────────────────────────────────────────────
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
        setSelectedDocId(docPayload.id);
        try {
            await proyectosStore.update(proyecto.id, { documentos: updatedDocs });
            toast.success("Documento guardado");
            setShowDocEdit(false);
            setEditingDoc(null);
            setDocForm({ titulo: "", categoria: "manual", contenido: "" });
        } catch { toast.error("Error al guardar documento"); }
    };

    const handleDeleteDoc = async (docId: string) => {
        if (!confirm("¿Eliminar este documento?")) return;
        const updated = documentosList.filter(d => d.id !== docId);
        setDocumentosList(updated);
        if (selectedDocId === docId) setSelectedDocId(updated[0]?.id || null);
        try {
            await proyectosStore.update(proyecto.id, { documentos: updated });
            toast.success("Documento eliminado");
        } catch { toast.error("Error al eliminar"); }
    };

    const openDocEditor = (doc?: DocumentoProyecto) => {
        setEditingDoc(doc || null);
        setDocForm(doc ? { id: doc.id, titulo: doc.titulo, categoria: doc.categoria, contenido: doc.contenido }
            : { titulo: "", categoria: "manual", contenido: "" });
        setShowDocEdit(true);
    };

    const handleMdUploadSync = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const docPayload: DocumentoProyecto = {
                id: `doc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                titulo: file.name.replace(/\.md$/, ""),
                categoria: "manual",
                contenido: text,
                updated_at: new Date().toISOString()
            };
            const updatedDocs = [docPayload, ...documentosList];
            setDocumentosList(updatedDocs);
            setSelectedDocId(docPayload.id);
            proyectosStore.update(proyecto.id, { documentos: updatedDocs })
                .then(() => toast.success(`Documento "${docPayload.titulo}" importado`))
                .catch(() => toast.error("Error al guardar documento"));
        };
        reader.readAsText(file);
    };

    // ── Specs & Accesos Handlers ─────────────────────────────────────────────
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

    // Etiquetas cortas: con las largas, en el celular la barra era un scroll
    // horizontal donde no se leía en qué sección estabas.
    const TABS: { id: PageTab; label: string; icon: any; count?: number }[] = [
        { id: "dashboard", label: "Estado", icon: Zap },
        { id: "fases", label: "Roadmap", icon: Layers, count: localFases.length },
        { id: "tareas", label: "Tareas", icon: CheckSquare, count: tareasPendientes.length || undefined },
        { id: "novedades", label: "Bitácora", icon: ScrollText, count: logs.length || undefined },
        { id: "documentos", label: "Docs", icon: BookOpen, count: documentosList.length || undefined },
        { id: "specs", label: "Specs", icon: Rocket },
        { id: "accesos", label: "Accesos", icon: Lock, count: (proyecto.accesos || []).length || undefined },
    ];

    // Un único cálculo de "dónde estoy parado", igual al de la lista.
    const estadoProyecto = calcularEstado({ ...proyecto, fases: localFases }, tareas, logs);
    const quieto = (estadoProyecto.diasSinMovimiento ?? 0) > 14 && estadoProyecto.salud !== "terminado";

    return (
        <div className="p-3 sm:p-6 space-y-5 animate-fade-in pb-20 max-w-7xl mx-auto">
            {/* Header Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border/80 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-xl bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shrink-0"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>

                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="text-base sm:text-lg font-black text-foreground truncate flex items-center gap-2">
                                <Rocket className="w-5 h-5 text-primary shrink-0" />
                                {proyecto.nombre}
                            </h1>
                            <button
                                onClick={toggleEstadoProyecto}
                                className={cn("text-[9px] px-2.5 py-0.5 rounded-full border font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0", ESTADO_BADGE[proyecto.estado])}
                                title="Hacé clic para cambiar estado"
                            >
                                {proyecto.estado}
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                            Proyecto Propio · <strong className="text-foreground/80">{TIPO_PROPIO_LABELS[tipoPropio]}</strong>
                        </p>
                    </div>
                </div>

                {/* Top Quick Links */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {genForm.saas_url && (
                        <a
                            href={genForm.saas_url.startsWith('http') ? genForm.saas_url : `https://${genForm.saas_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary/10 border border-primary/30 text-xs font-bold text-primary hover:bg-primary/20 transition-all"
                        >
                            <ExternalLink className="w-3.5 h-3.5" /> Abrir Sitio / App
                        </a>
                    )}
                </div>
            </div>

            {/* ── Dónde estoy parado — visible en todas las pestañas ── */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                            {estadoProyecto.faseActual ? `Fase ${estadoProyecto.faseActualIndice} de ${estadoProyecto.fases.length}` : "Roadmap"}
                        </p>
                        <h2 className="text-lg sm:text-2xl font-black text-foreground mt-0.5 break-words">
                            {estadoProyecto.faseActual?.nombre || "Todas las fases completadas"}
                        </h2>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-2xl sm:text-3xl font-black text-primary tabular-nums leading-none">
                            {estadoProyecto.progreso}%
                        </p>
                        <span className={cn(
                            "inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full border font-bold",
                            SALUD_COLORS[estadoProyecto.salud]
                        )}>
                            {SALUD_LABELS[estadoProyecto.salud]}
                        </span>
                    </div>
                </div>

                {/* Barra segmentada: cada tramo es una fase, la ámbar es donde estás */}
                {estadoProyecto.fases.length > 0 && (
                    <button
                        onClick={() => setActiveTab("fases")}
                        className="w-full flex items-center gap-[3px] py-1 group"
                        title="Ver el roadmap completo"
                    >
                        {estadoProyecto.fases.map((f, i) => (
                            <span
                                key={i}
                                className={cn(
                                    "h-2 flex-1 rounded-full transition-all group-hover:opacity-80",
                                    f.completada ? "bg-primary" : i + 1 === estadoProyecto.faseActualIndice ? "bg-amber-400" : "bg-secondary"
                                )}
                            />
                        ))}
                    </button>
                )}

                {/* Próximo paso + señales */}
                <div className="grid sm:grid-cols-2 gap-3">
                    {estadoProyecto.proximoPaso && estadoProyecto.faseActual && (
                        <div className="flex items-start gap-2 rounded-xl bg-secondary/40 border border-border/60 px-3 py-2.5 min-w-0">
                            <ChevronRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Lo que sigue</p>
                                <p className="text-xs sm:text-sm text-foreground/90 break-words">{estadoProyecto.proximoPaso}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3 flex-wrap text-[11px] sm:text-xs sm:justify-end">
                        {estadoProyecto.tareasVencidas.length > 0 && (
                            <button
                                onClick={() => setActiveTab("tareas")}
                                className="flex items-center gap-1.5 text-rose-300 font-bold hover:underline min-h-[36px]"
                            >
                                <Clock className="w-3.5 h-3.5" />
                                {estadoProyecto.tareasVencidas.length} vencida{estadoProyecto.tareasVencidas.length !== 1 ? "s" : ""}
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab("tareas")}
                            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground min-h-[36px]"
                        >
                            <CheckSquare className="w-3.5 h-3.5" />
                            {estadoProyecto.tareasPendientes.length} pendiente{estadoProyecto.tareasPendientes.length !== 1 ? "s" : ""}
                        </button>
                        <button
                            onClick={() => setActiveTab("novedades")}
                            className={cn("flex items-center gap-1.5 min-h-[36px] hover:underline", quieto ? "text-amber-300 font-semibold" : "text-muted-foreground")}
                        >
                            <ScrollText className="w-3.5 h-3.5" />
                            {quieto ? "Sin movimiento " : "Último avance "}{haceCuanto(estadoProyecto.diasSinMovimiento)}
                        </button>
                    </div>
                </div>

                {estadoProyecto.faseActual && (
                    <button
                        onClick={() => completarFaseActual(estadoProyecto.faseActualIndice - 1)}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 active:scale-95 transition-all min-h-[44px]"
                    >
                        <Check className="w-4 h-4" />
                        Completar &ldquo;{estadoProyecto.faseActual.nombre}&rdquo;
                    </button>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-1.5 border-b border-border/80 bg-card/50 p-1.5 rounded-2xl overflow-x-auto scrollbar-none">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 whitespace-nowrap",
                            activeTab === tab.id
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                        )}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                        {tab.count !== undefined && (
                            <span className={cn(
                                "text-[9px] px-1.5 py-0.2 rounded-full font-bold",
                                activeTab === tab.id ? "bg-black/20 text-white" : "bg-primary/20 text-primary"
                            )}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* TAB 1: ESTADO — el progreso ya está en la cabecera, acá va el trabajo del día */}
            {activeTab === "dashboard" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Tareas a mano */}
                    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <CheckSquare className="w-4 h-4 text-cyan-400 shrink-0" />
                                Tareas pendientes
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground tabular-nums">
                                    {tareasPendientes.length}
                                </span>
                            </h3>
                            <button
                                onClick={() => setShowNewTarea(true)}
                                className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs text-primary font-bold hover:bg-primary/10 min-h-[40px]"
                            >
                                <Plus className="w-3.5 h-3.5" /> Nueva
                            </button>
                        </div>

                        <div className="space-y-1.5">
                            {tareasPendientes.slice(0, 6).map((t) => {
                                const vencida = t.fecha_vencimiento && new Date(t.fecha_vencimiento) < new Date();
                                return (
                                    <div
                                        key={t.id}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-xl border text-xs",
                                            vencida ? "bg-rose-500/5 border-rose-500/25" : "bg-secondary/40 border-border/50"
                                        )}
                                    >
                                        <button
                                            onClick={() => toggleTareaEstado(t)}
                                            className="w-5 h-5 rounded-md border-2 border-border hover:border-primary hover:bg-primary/10 transition-all shrink-0"
                                            title="Marcar como completada"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-foreground/90 truncate">{t.titulo}</p>
                                            {t.fecha_vencimiento && (
                                                <p className={cn("text-[10px] mt-0.5", vencida ? "text-rose-300 font-bold" : "text-muted-foreground")}>
                                                    {vencida ? "Vencida el " : "Vence el "}{formatDate(t.fecha_vencimiento)}
                                                </p>
                                            )}
                                        </div>
                                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase shrink-0", PRIORIDAD_COLORS[t.prioridad])}>
                                            {t.prioridad}
                                        </span>
                                    </div>
                                );
                            })}

                            {tareasPendientes.length === 0 && (
                                <p className="text-xs text-muted-foreground py-6 text-center">
                                    Sin tareas pendientes. El próximo paso es cerrar la fase actual.
                                </p>
                            )}
                            {tareasPendientes.length > 6 && (
                                <button onClick={() => setActiveTab("tareas")} className="w-full text-center text-xs text-primary font-bold py-2.5 hover:underline min-h-[40px]">
                                    Ver las {tareasPendientes.length - 6} restantes
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Últimos avances */}
                    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <ScrollText className="w-4 h-4 text-primary shrink-0" />
                                Últimos avances
                            </h3>
                            <button
                                onClick={() => setShowNewLog(true)}
                                className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs text-primary font-bold hover:bg-primary/10 min-h-[40px]"
                            >
                                <Plus className="w-3.5 h-3.5" /> Registrar
                            </button>
                        </div>

                        <div className="space-y-1.5">
                            {logs.slice(0, 5).map((l) => (
                                <div key={l.id} className="p-3 rounded-xl bg-secondary/40 border border-border/50">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <p className="text-xs font-bold text-foreground truncate">{l.titulo}</p>
                                        <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(l.fecha)}</span>
                                    </div>
                                    {l.descripcion && (
                                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{l.descripcion}</p>
                                    )}
                                </div>
                            ))}

                            {logs.length === 0 && (
                                <p className="text-xs text-muted-foreground py-6 text-center">
                                    Sin avances registrados. Anotar lo que hacés es lo que después te dice dónde quedaste.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: FASES ROADMAP */}
            {activeTab === "fases" && (
                <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <h3 className="text-base font-bold text-foreground">Fases de Desarrollo</h3>
                            <p className="text-xs text-muted-foreground">Actualiza tu avance. Haz clic en &quot;Guardar cambios&quot; para confirmar.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setAddingFase(!addingFase)} className="px-3 py-1.5 rounded-xl border border-border bg-secondary text-xs font-bold text-muted-foreground hover:text-foreground">
                                + Nueva Fase
                            </button>
                            {hasUnsavedFases && (
                                <button onClick={saveFases} disabled={savingFases} className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 shadow-md shadow-primary/20">
                                    {savingFases ? "Guardando..." : "Guardar cambios"}
                                </button>
                            )}
                        </div>
                    </div>

                    {addingFase && (
                        <div className="flex gap-2 animate-fade-in">
                            <input value={newFaseName} onChange={e => setNewFaseName(e.target.value)} placeholder="Nombre de la fase..." className="flex-1 h-9 px-3 rounded-xl bg-background border border-primary/40 text-xs font-medium text-foreground outline-none" autoFocus />
                            <button onClick={addFase} className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold">Agregar</button>
                        </div>
                    )}

                    <div className="space-y-2">
                        {localFases.map((fase, i) => (
                            <div key={i} className={cn("p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 group", fase.completada ? "bg-emerald-500/5 border-emerald-500/20" : "bg-card border-border hover:border-primary/30")}>
                                <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => toggleFaseLocal(i)}>
                                    <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border font-bold text-xs transition-all", fase.completada ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-secondary text-muted-foreground border-border")}>
                                        {fase.completada ? <Check className="w-4 h-4 stroke-[3]" /> : i + 1}
                                    </div>
                                    <span className={cn("text-sm font-bold truncate", fase.completada ? "text-emerald-400 line-through opacity-80" : "text-foreground")}>
                                        {fase.nombre}
                                    </span>
                                </div>
                                <button onClick={() => removeFase(i)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity shrink-0">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 3: WIKI / DOCUMENTOS MARKDOWN (WITH READER & CLAUDE SYNC) */}
            {activeTab === "documentos" && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    {/* Left Sidebar: Document List */}
                    <div className="lg:col-span-1 space-y-3 bg-card border border-border p-4 rounded-2xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <BookOpen className="w-4 h-4 text-primary" /> Documentos ({documentosList.length})
                            </h3>
                            <div className="flex items-center gap-1">
                                {documentosList.length > 0 && (
                                    <button
                                        onClick={() => descargarMarkdownCombinado(
                                            `${slugify(proyecto.nombre)}-docs.md`,
                                            documentosList.map(d => ({ titulo: d.titulo, contenido: d.contenido }))
                                        )}
                                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                                        title="Descargar todos los documentos en un .md"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={() => openDocEditor()} className="p-1.5 rounded-lg hover:bg-secondary text-primary" title="Nuevo documento">
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Sync with Claude file button */}
                        <label className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-xs font-bold text-primary hover:bg-primary/10 transition-all cursor-pointer">
                            <FileUp className="w-4 h-4" />
                            <span>Sincronizar .md de Claude</span>
                            <input type="file" accept=".md,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleMdUploadSync(f); e.target.value = ""; }} />
                        </label>

                        <div className="space-y-1.5 max-h-[500px] overflow-y-auto custom-scrollbar">
                            {documentosList.map((doc) => (
                                <button
                                    key={doc.id}
                                    onClick={() => { setSelectedDocId(doc.id); setDocMode("read"); }}
                                    className={cn(
                                        "w-full text-left p-3 rounded-xl border text-xs transition-all group flex flex-col gap-1",
                                        selectedDocId === doc.id
                                            ? "bg-primary/15 border-primary/40 text-primary font-bold"
                                            : "bg-secondary/20 border-border/60 hover:bg-secondary/50 text-foreground/90"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="truncate font-bold">{doc.titulo}</span>
                                        <span className={cn("text-[8px] px-1.5 py-0.2 rounded-full uppercase font-bold border", DOC_CATEGORIA_BADGE[doc.categoria])}>
                                            {doc.categoria}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">Actualizado: {formatDate(doc.updated_at)}</span>
                                </button>
                            ))}

                            {documentosList.length === 0 && (
                                <div className="py-8 text-center text-muted-foreground text-xs italic">
                                    Sin documentos. Haz clic en &quot;Sincronizar .md de Claude&quot; para importar tu archivo.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Area: Rendered Markdown Reader & Editor */}
                    <div className="lg:col-span-3 bg-card border border-border p-5 sm:p-6 rounded-2xl space-y-4">
                        {activeDoc ? (
                            <>
                                <div className="flex items-center justify-between border-b border-border pb-4 flex-wrap gap-2">
                                    <div>
                                        <h2 className="text-lg font-black text-foreground">{activeDoc.titulo}</h2>
                                        <span className={cn("text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase mt-1 inline-block", DOC_CATEGORIA_BADGE[activeDoc.categoria])}>
                                            {activeDoc.categoria}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                        <div className="flex items-center rounded-xl bg-secondary p-1 border border-border">
                                            <button
                                                onClick={() => setDocMode("read")}
                                                className={cn("px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5", docMode === "read" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                                            >
                                                <Eye className="w-3.5 h-3.5" /> Leer
                                            </button>
                                            <button
                                                onClick={() => { openDocEditor(activeDoc); setDocMode("edit"); }}
                                                className={cn("px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5", docMode === "edit" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                                            >
                                                <Edit3 className="w-3.5 h-3.5" /> Editar
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => descargarTexto(`${slugify(activeDoc.titulo)}.md`, activeDoc.contenido)}
                                            className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                            title="Descargar este documento como .md"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(activeDoc.contenido); toast.success("Markdown copiado"); }}
                                            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                            title="Copiar el Markdown crudo"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDeleteDoc(activeDoc.id)} className="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-colors" title="Eliminar documento">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {docMode === "read" ? (
                                    <div className="p-4 sm:p-6 rounded-2xl bg-secondary/15 border border-border/60 min-h-[400px]">
                                        <MarkdownViewer content={activeDoc.contenido} />
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <textarea
                                            value={docForm.contenido}
                                            onChange={e => setDocForm({ ...docForm, contenido: e.target.value })}
                                            rows={18}
                                            className="w-full p-4 rounded-xl bg-background border border-border text-xs font-mono text-foreground focus:ring-2 focus:ring-primary/50 outline-none leading-relaxed resize-none"
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setDocMode("read")} className="px-4 py-2 text-xs font-medium text-muted-foreground">Cancelar</button>
                                            <button onClick={handleSaveDoc} className="px-5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl flex items-center gap-1.5">
                                                <Save className="w-3.5 h-3.5" /> Guardar Cambios
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="py-20 text-center text-muted-foreground space-y-3">
                                <BookOpen className="w-12 h-12 mx-auto opacity-30" />
                                <p className="text-base font-bold text-foreground">Selecciona o importa un documento Markdown</p>
                                <p className="text-xs opacity-70 max-w-sm mx-auto">
                                    Haz clic en &quot;Sincronizar .md de Claude&quot; para cargar los archivos `.md` de tu proyecto.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 4: TAREAS PENDIENTES */}
            {activeTab === "tareas" && (
                <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-foreground">Gestión de Tareas ({tareas.length})</h3>
                        <button onClick={() => setShowNewTarea(!showNewTarea)} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 flex items-center gap-1.5">
                            <Plus className="w-4 h-4" /> Nueva Tarea
                        </button>
                    </div>

                    {showNewTarea && (
                        <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3 animate-fade-in">
                            <input value={tareaForm.titulo} onChange={e => setTareaForm({ ...tareaForm, titulo: e.target.value })} placeholder="Título de la tarea..." className="w-full h-9 px-3 rounded-lg bg-background border border-border text-xs" />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowNewTarea(false)} className="px-3 py-1 text-xs text-muted-foreground">Cancelar</button>
                                <button onClick={handleAddTarea} disabled={savingTarea} className="px-3 py-1 text-xs bg-primary text-primary-foreground font-bold rounded">Guardar</button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        {tareas.map((t) => (
                            <div key={t.id} className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-secondary/30 hover:border-primary/30 transition-all">
                                <div className="flex items-center gap-3 min-w-0">
                                    <button onClick={() => toggleTareaEstado(t)} className={cn("w-5 h-5 rounded flex items-center justify-center border transition-all", t.estado === "completada" ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-card border-border")}>
                                        {t.estado === "completada" && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    </button>
                                    <span className={cn("text-xs font-semibold truncate", t.estado === "completada" ? "line-through text-muted-foreground" : "text-foreground")}>
                                        {t.titulo}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 5: NOVEDADES & CHANGELOG */}
            {activeTab === "novedades" && (
                <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-foreground">Registro de Novedades</h3>
                        <button onClick={() => setShowNewLog(!showNewLog)} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 flex items-center gap-1.5">
                            <Plus className="w-4 h-4" /> Registrar Entrada
                        </button>
                    </div>

                    {showNewLog && (
                        <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3 animate-fade-in">
                            <input value={logForm.titulo} onChange={e => setLogForm({ ...logForm, titulo: e.target.value })} placeholder="Título..." className="w-full h-9 px-3 rounded-lg bg-background border border-border text-xs" />
                            <textarea value={logForm.descripcion} onChange={e => setLogForm({ ...logForm, descripcion: e.target.value })} placeholder="Descripción..." rows={3} className="w-full p-3 rounded-lg bg-background border border-border text-xs resize-none" />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setShowNewLog(false)} className="px-3 py-1 text-xs text-muted-foreground">Cancelar</button>
                                <button onClick={handleAddLog} disabled={savingLog} className="px-3 py-1 text-xs bg-primary text-primary-foreground font-bold rounded">Guardar</button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        {logs.map((l) => (
                            <div key={l.id} className="p-4 rounded-xl border border-border bg-card space-y-1">
                                <div className="flex justify-between items-center">
                                    <h5 className="text-xs font-bold text-foreground">{l.titulo}</h5>
                                    <span className="text-[10px] text-muted-foreground">{formatDate(l.fecha)}</span>
                                </div>
                                {l.descripcion && <p className="text-xs text-muted-foreground">{l.descripcion}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 6: SPECS & NOTAS (SECONDARY TAB) */}
            {activeTab === "specs" && (
                <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-foreground">Especificaciones del Producto</h3>
                        <button onClick={() => setEditingGeneral(!editingGeneral)} className="text-xs text-primary font-bold hover:underline">
                            {editingGeneral ? "Cancelar Edición" : "Editar Especificaciones"}
                        </button>
                    </div>

                    {editingGeneral ? (
                        <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-4 animate-fade-in">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">URL del Producto</label>
                                    <input type="text" value={genForm.saas_url} onChange={e => setGenForm({ ...genForm, saas_url: e.target.value })} className="w-full h-10 px-3 rounded-xl bg-background border border-border text-xs text-foreground mt-1" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Stack Tecnológico</label>
                                    <input type="text" value={genForm.stack_tecnologico} onChange={e => setGenForm({ ...genForm, stack_tecnologico: e.target.value })} className="w-full h-10 px-3 rounded-xl bg-background border border-border text-xs text-foreground mt-1" />
                                </div>
                            </div>
                            <button onClick={handleSaveGeneral} className="px-5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl">Guardar</button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl border border-border bg-secondary/30">
                                <p className="text-[10px] font-bold uppercase text-muted-foreground">Stack Tecnológico</p>
                                <p className="text-xs font-bold text-foreground mt-1">{proyecto.stack_tecnologico || "No especificado"}</p>
                            </div>
                            {proyecto.notas_negocio && (
                                <div className="p-4 rounded-xl border border-border bg-secondary/30">
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Notas de Negocio</p>
                                    <p className="text-xs text-foreground/90 whitespace-pre-wrap">{proyecto.notas_negocio}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 7: ACCESOS & KEYS (SECONDARY TAB) */}
            {activeTab === "accesos" && (
                <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <Lock className="w-4 h-4 text-primary" /> Credenciales y Keys
                            </h3>
                            <p className="text-xs text-muted-foreground">Accesos guardados para este proyecto</p>
                        </div>
                        <button onClick={() => setShowNewAcceso(!showNewAcceso)} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5">
                            <Plus className="w-4 h-4" /> Agregar Credencial
                        </button>
                    </div>

                    {showNewAcceso && (
                        <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3 animate-fade-in">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input type="text" placeholder="Servicio" className="text-xs p-2.5 rounded-xl bg-background border border-border" value={newAcceso.servicio} onChange={e => setNewAcceso({ ...newAcceso, servicio: e.target.value })} />
                                <input type="text" placeholder="URL Login" className="text-xs p-2.5 rounded-xl bg-background border border-border" value={newAcceso.url} onChange={e => setNewAcceso({ ...newAcceso, url: e.target.value })} />
                                <input type="text" placeholder="Usuario / Key" className="text-xs p-2.5 rounded-xl bg-background border border-border" value={newAcceso.usuario} onChange={e => setNewAcceso({ ...newAcceso, usuario: e.target.value })} />
                                <input type="text" placeholder="Password / Secret" className="text-xs p-2.5 rounded-xl bg-background border border-border" value={newAcceso.password} onChange={e => setNewAcceso({ ...newAcceso, password: e.target.value })} />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                                <button onClick={() => setShowNewAcceso(false)} className="px-3 py-1 text-xs text-muted-foreground">Cancelar</button>
                                <button onClick={handleAddAcceso} className="px-4 py-1.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl">Guardar</button>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(proyecto.accesos || []).map((acc, i) => (
                            <div key={i} className="p-4 rounded-xl border border-border bg-secondary/30 flex items-center justify-between group">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-foreground truncate">{acc.servicio}</p>
                                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{acc.usuario} • {acc.password}</p>
                                </div>
                                <button onClick={() => handleRemoveAcceso(i)} className="opacity-0 group-hover:opacity-100 p-1.5 text-rose-400 hover:text-rose-500 transition-opacity">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
