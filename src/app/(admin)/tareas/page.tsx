"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
    Plus, CheckCircle2, Circle, Clock, Filter, Trash2,
    CalendarClock, X, FileText, AlignLeft, CheckSquare, CalendarPlus,
    LayoutGrid, List, Layers, Tag, Search, ArrowRight, ChevronRight, Zap,
    Archive, History, RotateCcw, Inbox
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { tareasStore, proyectosStore, mensajeError } from "@/lib/store";
import type { Tarea, Prioridad, EstadoTarea, CategoriaTarea, BloqueTarea, Proyecto } from "@/lib/types";
import { PRIORIDAD_COLORS, ESTADO_TAREA_COLORS, BLOQUE_COLORS } from "@/lib/types";
import { toast } from "sonner";

// ── Google Calendar URL Generator ─────────────────────────────────────────────
function generarUrlGoogleCalendar(titulo: string, descripcion: string, fecha?: string, hora?: string): string | null {
    if (!fecha) return null;
    const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
    const text = encodeURIComponent(titulo);
    const details = encodeURIComponent(descripcion || '');
    const [y, m, d] = fecha.split('-');

    let dates = '';
    if (hora) {
        const [hh, mm] = hora.split(':');
        const start = `${y}${m}${d}T${hh}${mm}00`;
        const fechaFin = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(hh), parseInt(mm) + 30);
        const endY = String(fechaFin.getFullYear());
        const endM = String(fechaFin.getMonth() + 1).padStart(2, '0');
        const endD = String(fechaFin.getDate()).padStart(2, '0');
        const endH = String(fechaFin.getHours()).padStart(2, '0');
        const endMn = String(fechaFin.getMinutes()).padStart(2, '0');
        const end = `${endY}${endM}${endD}T${endH}${endMn}00`;
        dates = `&dates=${start}/${end}`;
    } else {
        const nextDay = new Date(parseInt(y), parseInt(m) - 1, parseInt(d) + 1);
        const ndY = String(nextDay.getFullYear());
        const ndM = String(nextDay.getMonth() + 1).padStart(2, '0');
        const ndD = String(nextDay.getDate()).padStart(2, '0');
        dates = `&dates=${y}${m}${d}/${ndY}${ndM}${ndD}`;
    }

    return `${baseUrl}&text=${text}${dates}&details=${details}`;
}

const CATEGORIA_LABELS: Record<CategoriaTarea, string> = {
    diseno: "Diseño UI/UX",
    dev: "Desarrollo",
    marketing: "Marketing",
    contenido: "Contenido",
    seo: "SEO",
    otro: "General",
};

const CATEGORIA_BADGE: Record<CategoriaTarea, string> = {
    diseno: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    dev: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    marketing: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    contenido: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    seo: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    otro: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

const KANBAN_COLUMNS: { id: EstadoTarea; title: string; color: string; badgeColor: string }[] = [
    { id: "pendiente", title: "Pendientes", color: "border-slate-500/30 bg-slate-500/5", badgeColor: "bg-slate-500/20 text-slate-300" },
    { id: "en_progreso", title: "En Progreso", color: "border-blue-500/30 bg-blue-500/5", badgeColor: "bg-blue-500/20 text-blue-300" },
    { id: "completada", title: "Completadas", color: "border-emerald-500/30 bg-emerald-500/5", badgeColor: "bg-emerald-500/20 text-emerald-300" },
];

// ── Modal / Drawer Detalle de Tarea ───────────────────────────────────────────
function TareaDetailModal({
    tarea,
    proyectos,
    onClose,
    onUpdated,
}: {
    tarea: Tarea;
    proyectos: Proyecto[];
    onClose: () => void;
    onUpdated: () => void;
}) {
    const [titulo, setTitulo] = useState(tarea.titulo);
    const [descripcion, setDescripcion] = useState(tarea.descripcion || "");
    const [prioridad, setPrioridad] = useState<Prioridad>(tarea.prioridad || "media");
    const [estado, setEstado] = useState<EstadoTarea>(tarea.estado || "pendiente");
    const [categoria, setCategoria] = useState<CategoriaTarea>(tarea.categoria || "otro");
    const [proyectoId, setProyectoId] = useState<string>(tarea.proyecto_id || "");
    const [fechaVenc, setFechaVenc] = useState(tarea.fecha_vencimiento || "");
    const [horaRec, setHoraRec] = useState(tarea.hora_recordatorio || "");
    const [pasos, setPasos] = useState<{ id: string; texto: string; completado: boolean }[]>(tarea.pasos || []);
    const [nuevoPasoTexto, setNuevoPasoTexto] = useState("");
    const [saving, setSaving] = useState(false);

    const proyecto = proyectoId ? proyectos.find((p) => p.id === proyectoId) : null;
    const gcalUrl = generarUrlGoogleCalendar(titulo, descripcion, fechaVenc, horaRec);

    const handleAddPaso = () => {
        if (!nuevoPasoTexto.trim()) return;
        const nuevo = { id: Math.random().toString(36).substring(2, 9), texto: nuevoPasoTexto.trim(), completado: false };
        setPasos([...pasos, nuevo]);
        setNuevoPasoTexto("");
    };

    const handleTogglePaso = (id: string) => {
        setPasos(pasos.map(p => p.id === id ? { ...p, completado: !p.completado } : p));
    };

    const handleRemovePaso = (id: string) => {
        setPasos(pasos.filter(p => p.id !== id));
    };

    const handleSave = async () => {
        if (!titulo.trim()) { toast.error("El título es requerido"); return; }
        setSaving(true);
        try {
            await tareasStore.update(tarea.id, {
                titulo,
                descripcion,
                prioridad,
                estado,
                categoria,
                proyecto_id: proyectoId || null,
                fecha_vencimiento: fechaVenc || undefined,
                hora_recordatorio: horaRec || undefined,
                pasos: pasos
            });
            toast.success("Tarea actualizada");
            onUpdated();
            onClose();
        } catch {
            toast.error("Error al guardar tarea");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("¿Eliminar esta tarea?")) return;
        try {
            await tareasStore.delete(tarea.id);
            toast.success("Tarea eliminada");
            onUpdated();
            onClose();
        } catch { toast.error("Error al eliminar"); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl sm:rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-2xl animate-fade-in space-y-4 sm:space-y-5 custom-scrollbar">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="text-base sm:text-lg font-bold text-foreground">Editar Tarea</h3>
                    <div className="flex items-center gap-2">
                        <button onClick={handleDelete} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                        <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary"><X className="w-5 h-5" /></button>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Título</label>
                        <input
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                            className="w-full h-10 sm:h-11 px-3 rounded-xl bg-secondary border border-border text-sm font-bold text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Estado</label>
                            <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoTarea)} className="w-full h-9 px-2 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none font-medium">
                                <option value="pendiente">Pendiente</option>
                                <option value="en_progreso">En Progreso</option>
                                <option value="completada">Completada</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Prioridad</label>
                            <select value={prioridad} onChange={(e) => setPrioridad(e.target.value as Prioridad)} className="w-full h-9 px-2 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none font-medium">
                                <option value="baja">Baja</option>
                                <option value="media">Media</option>
                                <option value="alta font-bold">Alta</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Categoría</label>
                            <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaTarea)} className="w-full h-9 px-2 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none font-medium">
                                {Object.entries(CATEGORIA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Proyecto Vinculado</label>
                            <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className="w-full h-9 px-2 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none">
                                <option value="">Sin proyecto</option>
                                {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Fecha Vencimiento</label>
                            <input type="date" value={fechaVenc} onChange={(e) => setFechaVenc(e.target.value)} className="w-full h-9 px-2 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none" />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Descripción</label>
                        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} className="w-full p-3 rounded-xl bg-secondary border border-border text-xs text-foreground focus:ring-2 focus:ring-primary/50 outline-none resize-none" placeholder="Detalles de la tarea..." />
                    </div>

                    {/* Subpasos / Checklist */}
                    <div className="p-3.5 rounded-xl border border-border bg-secondary/30 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                <CheckSquare className="w-3.5 h-3.5 text-primary" /> Subpasos ({pasos.filter(p => p.completado).length}/{pasos.length})
                            </span>
                        </div>

                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {pasos.map((p) => (
                                <div key={p.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background border border-border text-xs">
                                    <button onClick={() => handleTogglePaso(p.id)} className="flex items-center gap-2 text-left min-w-0 flex-1">
                                        <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", p.completado ? "bg-emerald-500 border-emerald-400 text-slate-950" : "border-border")}>
                                            {p.completado && <CheckCircle2 className="w-3.5 h-3.5" />}
                                        </div>
                                        <span className={cn("truncate", p.completado && "line-through text-muted-foreground")}>{p.texto}</span>
                                    </button>
                                    <button onClick={() => handleRemovePaso(p.id)} className="text-muted-foreground hover:text-rose-400"><X className="w-3.5 h-3.5" /></button>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <input
                                value={nuevoPasoTexto}
                                onChange={(e) => setNuevoPasoTexto(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAddPaso()}
                                placeholder="Añadir subpaso (Presiona Enter)..."
                                className="flex-1 h-8 px-3 rounded-lg bg-background border border-border text-xs text-foreground outline-none"
                            />
                            <button onClick={handleAddPaso} className="px-3 py-1.5 rounded-lg bg-secondary text-foreground text-xs font-bold hover:bg-secondary/80">+</button>
                        </div>
                    </div>

                    {gcalUrl && (
                        <a href={gcalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-all">
                            <CalendarPlus className="w-4 h-4" /> Programar en Google Calendar
                        </a>
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-secondary">Cancelar</button>
                    <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl text-xs bg-primary text-primary-foreground font-bold hover:opacity-90 disabled:opacity-50">
                        {saving ? "Guardando..." : "Guardar Cambios"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Tareas Component ─────────────────────────────────────────────────────────
function TareasContent() {
    const searchParams = useSearchParams();
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [proyectos, setProyectos] = useState<Proyecto[]>([]);
    const [mounted, setMounted] = useState(false);
    const [viewMode, setViewMode] = useState<"kanban" | "lista">("kanban");
    const [selectedTarea, setSelectedTarea] = useState<Tarea | null>(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [filterPrioridad, setFilterPrioridad] = useState<string>("todas");
    const [filterCategoria, setFilterCategoria] = useState<string>("todas");
    const [filterProyecto, setFilterProyecto] = useState<string>("todos");

    // Quick add per column
    const [quickAddTitles, setQuickAddTitles] = useState<Record<string, string>>({});

    // Historial de completadas
    const [showHistorial, setShowHistorial] = useState(false);
    const [archivadas, setArchivadas] = useState<Tarea[]>([]);
    const [limpiando, setLimpiando] = useState(false);

    const cargarArchivadas = async () => {
        try {
            setArchivadas(await tareasStore.getArchivadas());
        } catch (e) {
            toast.error(mensajeError(e));
        }
    };

    const handleLimpiarCompletadas = async () => {
        const completadas = tareas.filter((t) => t.estado === "completada").length;
        if (completadas === 0) {
            toast.info("No hay tareas completadas para archivar");
            return;
        }
        setLimpiando(true);
        try {
            const n = await tareasStore.archivarCompletadas();
            await reload();
            if (showHistorial) await cargarArchivadas();
            toast.success(`${n} tarea${n !== 1 ? "s" : ""} al historial`, {
                description: "Salen del tablero pero podés consultarlas o restaurarlas cuando quieras.",
            });
        } catch (e) {
            toast.error(mensajeError(e));
        } finally {
            setLimpiando(false);
        }
    };

    const handleRestaurar = async (t: Tarea) => {
        try {
            await tareasStore.restaurar(t.id);
            await Promise.all([reload(), cargarArchivadas()]);
            toast.success(`"${t.titulo}" volvió al tablero como pendiente`);
        } catch (e) {
            toast.error(mensajeError(e));
        }
    };

    const handleVaciarHistorial = async () => {
        if (!window.confirm(`¿Borrar definitivamente ${archivadas.length} tareas del historial? No se puede deshacer.`)) return;
        try {
            const n = await tareasStore.vaciarHistorial();
            await cargarArchivadas();
            toast.success(`${n} tareas eliminadas`);
        } catch (e) {
            toast.error(mensajeError(e));
        }
    };

    const reload = async () => {
        try {
            const [t, p] = await Promise.all([
                tareasStore.getAll(),
                proyectosStore.getAll(),
            ]);
            // Exclude recurring routines from main task board
            setTareas(t.filter((item) => item.tipo_tarea !== "recurrente"));
            setProyectos(p);
        } catch {
            toast.error("Error al cargar tareas");
        }
    };

    useEffect(() => { reload().then(() => setMounted(true)); }, []);

    const handleQuickAdd = async (columnId: EstadoTarea) => {
        const title = quickAddTitles[columnId]?.trim();
        if (!title) return;

        try {
            await tareasStore.create({
                titulo: title,
                descripcion: "",
                estado: columnId,
                prioridad: "media",
                categoria: "otro",
                proyecto_id: filterProyecto !== "todos" ? filterProyecto : null,
            });
            setQuickAddTitles({ ...quickAddTitles, [columnId]: "" });
            toast.success("Tarea agregada");
            await reload();
        } catch {
            toast.error("Error al crear tarea rápida");
        }
    };

    const handleMoveState = async (tarea: Tarea, nextState: EstadoTarea) => {
        try {
            await tareasStore.update(tarea.id, { estado: nextState });
            await reload();
        } catch { toast.error("Error al mover tarea"); }
    };

    if (!mounted) {
        return (
            <div className="p-6 space-y-4 animate-pulse">
                <div className="h-10 w-48 bg-secondary/50 rounded-xl" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-96 rounded-2xl bg-secondary/30" />)}
                </div>
            </div>
        );
    }

    const completadasEnTablero = tareas.filter((t) => t.estado === "completada").length;

    // Filter logic
    let filteredTareas = tareas;
    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filteredTareas = filteredTareas.filter(t => t.titulo.toLowerCase().includes(q) || t.descripcion?.toLowerCase().includes(q));
    }
    if (filterPrioridad !== "todas") {
        filteredTareas = filteredTareas.filter(t => t.prioridad === filterPrioridad);
    }
    if (filterCategoria !== "todas") {
        filteredTareas = filteredTareas.filter(t => t.categoria === filterCategoria);
    }
    if (filterProyecto !== "todos") {
        filteredTareas = filteredTareas.filter(t => t.proyecto_id === filterProyecto);
    }

    return (
        <div className="p-6 space-y-6 animate-fade-in pb-20">
            {/* Header + View Switcher */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <CheckSquare className="w-6 h-6 text-primary" /> Tablero de Tareas
                    </h2>
                    <p className="text-sm text-muted-foreground">{filteredTareas.length} tareas activas</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={handleLimpiarCompletadas}
                        disabled={limpiando || completadasEnTablero === 0}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-bold hover:bg-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Archiva las completadas: salen del tablero y quedan en el historial"
                    >
                        <Archive className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Limpiar completadas</span>
                        <span className="sm:hidden">Limpiar</span>
                        {completadasEnTablero > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/25 text-[10px] tabular-nums">
                                {completadasEnTablero}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => { setShowHistorial(true); cargarArchivadas(); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-secondary/60 text-muted-foreground hover:text-foreground text-xs font-bold transition-all"
                    >
                        <History className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Historial</span>
                    </button>

                    {/* View Switcher */}
                    <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 shadow-sm">
                        <button
                            onClick={() => setViewMode("kanban")}
                            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all", viewMode === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" /> Kanban
                        </button>
                        <button
                            onClick={() => setViewMode("lista")}
                            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all", viewMode === "lista" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                        >
                            <List className="w-3.5 h-3.5" /> Lista
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl border border-border bg-card shadow-sm">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar tareas por título o descripción..."
                        className="w-full h-10 pl-9 pr-3 rounded-xl bg-secondary border border-border text-xs text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
                    />
                </div>

                <select value={filterPrioridad} onChange={(e) => setFilterPrioridad(e.target.value)} className="h-10 px-3 rounded-xl bg-secondary border border-border text-xs text-foreground outline-none font-medium">
                    <option value="todas">Todas las Prioridades</option>
                    <option value="alta">🔴 Alta</option>
                    <option value="media">🟡 Media</option>
                    <option value="baja">🟢 Baja</option>
                </select>

                <select value={filterCategoria} onChange={(e) => setFilterCategoria(e.target.value)} className="h-10 px-3 rounded-xl bg-secondary border border-border text-xs text-foreground outline-none font-medium">
                    <option value="todas">Todas las Categorías</option>
                    {Object.entries(CATEGORIA_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>

                <select value={filterProyecto} onChange={(e) => setFilterProyecto(e.target.value)} className="h-10 px-3 rounded-xl bg-secondary border border-border text-xs text-foreground outline-none font-medium">
                    <option value="todos">Todos los Proyectos</option>
                    {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
            </div>

            {/* KANBAN VIEW */}
            {viewMode === "kanban" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {KANBAN_COLUMNS.map((col) => {
                        const colTasks = filteredTareas.filter(t => t.estado === col.id);

                        return (
                            <div key={col.id} className={cn("flex flex-col rounded-2xl border p-4 space-y-3 min-h-[500px]", col.color)}>
                                {/* Column Header */}
                                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-foreground">{col.title}</h3>
                                        <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full", col.badgeColor)}>
                                            {colTasks.length}
                                        </span>
                                    </div>
                                </div>

                                {/* Quick Add Input */}
                                <div className="flex gap-1.5">
                                    <input
                                        value={quickAddTitles[col.id] || ""}
                                        onChange={(e) => setQuickAddTitles({ ...quickAddTitles, [col.id]: e.target.value })}
                                        onKeyDown={(e) => e.key === "Enter" && handleQuickAdd(col.id)}
                                        placeholder="+ Nueva tarea rápida..."
                                        className="w-full h-8 px-3 rounded-lg bg-card border border-border text-xs text-foreground outline-none focus:border-primary"
                                    />
                                </div>

                                {/* Task Cards */}
                                <div className="space-y-3 flex-1">
                                    {colTasks.map((t) => {
                                        const proy = t.proyecto_id ? proyectos.find(p => p.id === t.proyecto_id) : null;
                                        const pasosCount = t.pasos?.length || 0;
                                        const pasosDone = t.pasos?.filter(p => p.completado).length || 0;

                                        return (
                                            <div
                                                key={t.id}
                                                onClick={() => setSelectedTarea(t)}
                                                className="p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-all cursor-pointer shadow-sm hover:shadow-md space-y-3 group"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className={cn("text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider", CATEGORIA_BADGE[t.categoria || "otro"])}>
                                                        {CATEGORIA_LABELS[t.categoria || "otro"]}
                                                    </span>

                                                    <span className={cn("text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider", PRIORIDAD_COLORS[t.prioridad || "media"])}>
                                                        {t.prioridad}
                                                    </span>
                                                </div>

                                                <div>
                                                    <h4 className="text-sm font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                                                        {t.titulo}
                                                    </h4>
                                                    {t.descripcion && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.descripcion}</p>}
                                                </div>

                                                {/* Meta Info */}
                                                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/40">
                                                    <div className="flex items-center gap-2">
                                                        {proy && <span className="font-semibold text-foreground bg-secondary px-1.5 py-0.5 rounded truncate max-w-[120px]">{proy.nombre}</span>}
                                                        {pasosCount > 0 && <span className="flex items-center gap-1"><CheckSquare className="w-3 h-3 text-primary" /> {pasosDone}/{pasosCount}</span>}
                                                    </div>

                                                    {/* Move state action button */}
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                                        {col.id !== "completada" && (
                                                            <button
                                                                onClick={() => handleMoveState(t, col.id === "pendiente" ? "en_progreso" : "completada")}
                                                                className="p-1 rounded bg-primary/10 text-primary hover:bg-primary/20"
                                                                title="Mover a siguiente columna"
                                                            >
                                                                <ArrowRight className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {colTasks.length === 0 && (
                                        <div className="py-12 text-center text-muted-foreground border-2 border-dashed border-border/40 rounded-xl">
                                            <p className="text-xs font-medium">Sin tareas</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* LIST VIEW */}
            {viewMode === "lista" && (
                <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
                    {filteredTareas.map((t) => {
                        const proy = t.proyecto_id ? proyectos.find(p => p.id === t.proyecto_id) : null;
                        const esCompletada = t.estado === "completada";

                        return (
                            <div
                                key={t.id}
                                onClick={() => setSelectedTarea(t)}
                                className={cn("flex items-center justify-between p-3.5 rounded-xl border border-border hover:border-primary/40 transition-all cursor-pointer group bg-secondary/30", esCompletada && "opacity-60")}
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleMoveState(t, esCompletada ? "pendiente" : "completada");
                                        }}
                                        className={cn("w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors", esCompletada ? "bg-emerald-500 text-slate-950 border-emerald-400" : "border-border hover:border-primary")}
                                    >
                                        {esCompletada && <CheckCircle2 className="w-4 h-4" />}
                                    </button>

                                    <div className="min-w-0 flex-1">
                                        <p className={cn("text-sm font-bold text-foreground truncate", esCompletada && "line-through text-muted-foreground")}>
                                            {t.titulo}
                                        </p>
                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                            <span className={cn("px-1.5 py-0.2 rounded border font-bold uppercase", CATEGORIA_BADGE[t.categoria || "otro"])}>
                                                {CATEGORIA_LABELS[t.categoria || "otro"]}
                                            </span>
                                            {proy && <span>Proyecto: <strong className="text-foreground">{proy.nombre}</strong></span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    <span className={cn("text-[10px] px-2.5 py-0.5 rounded-full border font-bold uppercase", PRIORIDAD_COLORS[t.prioridad || "media"])}>
                                        {t.prioridad}
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Task Detail Modal */}
            {selectedTarea && (
                <TareaDetailModal
                    tarea={selectedTarea}
                    proyectos={proyectos}
                    onClose={() => setSelectedTarea(null)}
                    onUpdated={reload}
                />
            )}

            {showHistorial && (
                <HistorialModal
                    archivadas={archivadas}
                    proyectos={proyectos}
                    onRestaurar={handleRestaurar}
                    onVaciar={handleVaciarHistorial}
                    onClose={() => setShowHistorial(false)}
                />
            )}
        </div>
    );
}

// ── Historial de tareas archivadas ────────────────────────────────────────────
function HistorialModal({
    archivadas,
    proyectos,
    onRestaurar,
    onVaciar,
    onClose,
}: {
    archivadas: Tarea[];
    proyectos: Proyecto[];
    onRestaurar: (t: Tarea) => void;
    onVaciar: () => void;
    onClose: () => void;
}) {
    const [q, setQ] = useState("");

    const filtradas = archivadas.filter((t) =>
        !q.trim() || t.titulo.toLowerCase().includes(q.toLowerCase())
    );

    // Agrupa por mes para que el historial se lea como una bitácora.
    const grupos = filtradas.reduce<Record<string, Tarea[]>>((acc, t) => {
        const ref = t.fecha_completada || t.fecha_archivada || t.created_at;
        const clave = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date(ref));
        (acc[clave] ||= []).push(t);
        return acc;
    }, {});

    return (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/75 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
            <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl sm:rounded-3xl border border-border bg-card shadow-2xl animate-fade-in my-2">
                <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-border">
                    <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                            <History className="w-5 h-5 text-primary shrink-0" />
                            Historial de tareas
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {archivadas.length} tarea{archivadas.length !== 1 ? "s" : ""} archivada{archivadas.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:bg-secondary shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {archivadas.length > 0 && (
                    <div className="p-4 sm:p-5 pb-3 border-b border-border">
                        <div className="relative">
                            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Buscar en el historial..."
                                className="w-full h-10 pl-9 pr-3 rounded-xl bg-secondary border border-border text-xs text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
                            />
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-5">
                    {archivadas.length === 0 && (
                        <div className="py-14 text-center">
                            <Inbox className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                            <p className="text-sm font-bold text-foreground">El historial está vacío</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                                Usá &quot;Limpiar completadas&quot; en el tablero para mandar acá lo que ya terminaste.
                            </p>
                        </div>
                    )}

                    {Object.entries(grupos).map(([mes, items]) => (
                        <div key={mes} className="space-y-2">
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide sticky top-0 bg-card py-1">
                                {mes} · {items.length}
                            </p>
                            {items.map((t) => {
                                const proyecto = proyectos.find((p) => p.id === t.proyecto_id);
                                const ref = t.fecha_completada || t.fecha_archivada;
                                return (
                                    <div
                                        key={t.id}
                                        className="flex items-start gap-3 p-3 rounded-xl border border-border bg-background/40 group"
                                    >
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400/70 shrink-0 mt-0.5" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-semibold text-muted-foreground line-through decoration-muted-foreground/40 truncate">
                                                {t.titulo}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                {ref && (
                                                    <span className="text-[10px] text-muted-foreground/70">{formatDate(ref)}</span>
                                                )}
                                                {proyecto && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground truncate max-w-[140px]">
                                                        {proyecto.nombre}
                                                    </span>
                                                )}
                                                <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", CATEGORIA_BADGE[t.categoria || "otro"])}>
                                                    {CATEGORIA_LABELS[t.categoria || "otro"]}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onRestaurar(t)}
                                            className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all shrink-0"
                                            title="Devolver al tablero como pendiente"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {archivadas.length > 0 && (
                    <div className="p-4 sm:p-5 border-t border-border flex items-center justify-between gap-3">
                        <button
                            onClick={onVaciar}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-all"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Vaciar historial
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
                        >
                            Cerrar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function TareasPage() {
    return (
        <Suspense fallback={
            <div className="p-6 space-y-4 animate-pulse">
                <div className="h-10 w-48 bg-secondary/50 rounded-xl" />
            </div>
        }>
            <TareasContent />
        </Suspense>
    );
}
