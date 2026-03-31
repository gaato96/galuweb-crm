"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, CheckCircle2, Circle, Clock, Filter, Trash2, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { tareasStore, proyectosStore } from "@/lib/store";
import type { Tarea, Prioridad, EstadoTarea, CategoriaTarea } from "@/lib/types";
import { PRIORIDAD_COLORS } from "@/lib/types";
import { toast } from "sonner";

function TareasContent() {
    const searchParams = useSearchParams();
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [mounted, setMounted] = useState(false);
    const [showNew, setShowNew] = useState(searchParams.get("new") === "true");
    const [filterPrioridad, setFilterPrioridad] = useState<string>("todas");
    const [filterProyecto, setFilterProyecto] = useState<string>("todos");
    const [filterEstado, setFilterEstado] = useState<string>("todos");
    const [showHistory, setShowHistory] = useState(false);

    const [proyectos, setProyectos] = useState<any[]>([]);

    const reload = async () => {
        try {
            const [t, p] = await Promise.all([
                tareasStore.getAll(),
                proyectosStore.getAll()
            ]);
            setTareas(t);
            setProyectos(p);
        } catch {
            console.error("Error reloading tasks/projects:");
        }
    };
    useEffect(() => {
        reload().then(() => setMounted(true));
    }, []);

    // New task form
    const [form, setForm] = useState({ titulo: "", descripcion: "", prioridad: "media" as Prioridad, categoria: "otro" as CategoriaTarea, proyecto_id: "", fecha_vencimiento: "" });

    const handleCreate = async () => {
        if (!form.titulo.trim()) { toast.error("Título requerido"); return; }
        try {
            const data: any = { ...form, proyecto_id: form.proyecto_id || null, estado: "pendiente" as EstadoTarea };
            if (!data.fecha_vencimiento) {
                delete data.fecha_vencimiento;
            }
            await tareasStore.create(data);
            setForm({ titulo: "", descripcion: "", prioridad: "media", categoria: "otro", proyecto_id: "", fecha_vencimiento: "" });
            setShowNew(false);
            await reload();
            toast.success("Tarea creada");
        } catch (error: any) {
            console.error("Error creating task:", error);
            toast.error(`Error al crear tarea: ${error?.message || "Desconocido"}`);
        }
    };

    const toggleTarea = async (id: string, estado: EstadoTarea) => {
        const next = estado === "completada" ? "pendiente" : estado === "pendiente" ? "en_progreso" : "completada";
        try {
            await tareasStore.update(id, { estado: next });
            await reload();
        } catch {
            toast.error("Error al actualizar tarea");
        }
    };

    const deleteTarea = async (id: string) => {
        try {
            await tareasStore.delete(id);
            await reload();
            toast.success("Tarea eliminada");
        } catch {
            toast.error("Error al eliminar tarea");
        }
    };

    // Remove direct call to store in render
    // const proyectos = proyectosStore.getAll();

    let filtered = tareas;
    if (filterPrioridad !== "todas") filtered = filtered.filter((t) => t.prioridad === filterPrioridad);
    if (filterProyecto !== "todos") {
        if (filterProyecto === "sin_proyecto") filtered = filtered.filter((t) => !t.proyecto_id);
        else filtered = filtered.filter((t) => t.proyecto_id === filterProyecto);
    }
    if (filterEstado !== "todos") filtered = filtered.filter((t) => t.estado === filterEstado);

    const pendientes = filtered.filter((t) => t.estado === "pendiente");
    const enProgreso = filtered.filter((t) => t.estado === "en_progreso");
    const completadas = filtered.filter((t) => t.estado === "completada");

    if (!mounted) {
        return <div className="space-y-3 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-lg skeleton" />)}</div>;
    }

    const getDueDateStatus = (dateStr?: string) => {
        if (!dateStr) return null;
        // Parse date considering timezone offset properly (assuming YYYY-MM-DD input)
        const [year, month, day] = dateStr.split("-").map(Number);
        const due = new Date(year, month - 1, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { label: "Vencida", classes: "text-red-500 bg-red-500/10 border-red-500/30 font-bold" };
        if (diffDays === 0) return { label: "Vence Hoy", classes: "text-orange-500 bg-orange-500/10 border-orange-500/30 font-bold" };
        if (diffDays <= 2) return { label: `En ${diffDays} día${diffDays > 1 ? 's' : ''}`, classes: "text-amber-500 bg-amber-500/10 border-amber-500/30" };
        return { label: due.toLocaleDateString(), classes: "text-muted-foreground bg-secondary/50 border-border" };
    };

    const ICON_MAP = {
        pendiente: Circle,
        en_progreso: Clock,
        completada: CheckCircle2,
    };

    const renderTarea = (t: Tarea) => {
        const Icon = ICON_MAP[t.estado];
        const proyecto = t.proyecto_id ? proyectos.find((p) => p.id === t.proyecto_id) : null;
        const dueStatus = t.estado !== "completada" ? getDueDateStatus(t.fecha_vencimiento) : null;

        return (
            <div key={t.id} className={cn("flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border transition-all group", t.estado === "completada" ? "bg-emerald-500/5 border-emerald-500/20" : dueStatus && dueStatus.classes.includes("red") ? "bg-red-500/5 border-red-500/30" : "bg-secondary/30 border-border hover:border-primary/30")}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button onClick={() => toggleTarea(t.id, t.estado)}>
                        <Icon className={cn("w-5 h-5 shrink-0", t.estado === "completada" ? "text-emerald-400" : t.estado === "en_progreso" ? "text-blue-400" : "text-muted-foreground")} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium", t.estado === "completada" ? "text-muted-foreground line-through" : "text-foreground")}>{t.titulo}</p>
                        {proyecto && <p className="text-[11px] text-muted-foreground">{proyecto.nombre}</p>}
                    </div>
                </div>

                <div className="flex items-center gap-2 pl-8 sm:pl-0 sm:ml-auto">
                    {dueStatus && (
                        <span className={cn("flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border", dueStatus.classes)}>
                            <CalendarClock className="w-3 h-3" /> {dueStatus.label}
                        </span>
                    )}
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", PRIORIDAD_COLORS[t.prioridad])}>{t.prioridad}</span>
                    <span className="text-[10px] text-muted-foreground uppercase hidden md:block">{t.categoria}</span>
                    <button onClick={() => deleteTarea(t.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 transition-all">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Tareas</h2>
                    <p className="text-sm text-muted-foreground">{tareas.filter((t) => t.estado !== "completada").length} pendientes de {tareas.length}</p>
                </div>
                <button onClick={() => setShowNew(!showNew)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                    <Plus className="w-4 h-4" /> Nueva Tarea
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-card border border-border">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select value={filterPrioridad} onChange={(e) => setFilterPrioridad(e.target.value)} className="h-8 px-2 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none">
                    <option value="todas">Toda prioridad</option>
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                </select>
                <select value={filterProyecto} onChange={(e) => setFilterProyecto(e.target.value)} className="h-8 px-2 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none">
                    <option value="todos">Todo proyecto</option>
                    <option value="sin_proyecto">Sin proyecto</option>
                    {proyectos.map((p) => (<option key={p.id} value={p.id}>{p.nombre}</option>))}
                </select>
                <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} className="h-8 px-2 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none">
                    <option value="todos">Todo estado</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="en_progreso">En Progreso</option>
                    <option value="completada">Completada</option>
                </select>
            </div>

            {/* New Task Form */}
            {showNew && (
                <div className="p-4 rounded-xl bg-card border border-primary/30 space-y-3 animate-fade-in">
                    <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título de la tarea..." className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <select value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value as Prioridad })} className="h-9 px-2 rounded-lg bg-secondary border border-border text-xs text-foreground">
                            <option value="baja">Baja</option>
                            <option value="media">Media</option>
                            <option value="alta">Alta</option>
                        </select>
                        <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value as CategoriaTarea })} className="h-9 px-2 rounded-lg bg-secondary border border-border text-xs text-foreground">
                            <option value="diseno">Diseño</option>
                            <option value="dev">Desarrollo</option>
                            <option value="marketing">Marketing</option>
                            <option value="contenido">Contenido</option>
                            <option value="seo">SEO</option>
                            <option value="otro">Otro</option>
                        </select>
                        <select value={form.proyecto_id} onChange={(e) => setForm({ ...form, proyecto_id: e.target.value })} className="h-9 px-2 rounded-lg bg-secondary border border-border text-xs text-foreground">
                            <option value="">Sin proyecto</option>
                            {proyectos.map((p) => (<option key={p.id} value={p.id}>{p.nombre}</option>))}
                        </select>
                        <input type="date" value={form.fecha_vencimiento} onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })} className="h-9 px-2 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none" />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowNew(false)} className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-secondary">Cancelar</button>
                        <button onClick={handleCreate} className="px-3 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground hover:opacity-90">Guardar</button>
                    </div>
                </div>
            )}

            {/* Task Groups */}
            {enProgreso.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2"><Clock className="w-4 h-4" /> En Progreso ({enProgreso.length})</h3>
                    <div className="space-y-1.5">{enProgreso.map(renderTarea)}</div>
                </div>
            )}
            {pendientes.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Circle className="w-4 h-4" /> Pendientes ({pendientes.length})</h3>
                    <div className="space-y-1.5">{pendientes.map(renderTarea)}</div>
                </div>
            )}
            {completadas.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" /> Completadas ({completadas.length})
                        </h3>
                        {completadas.length > 3 && (
                            <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-muted-foreground hover:text-foreground underline">
                                {showHistory ? "Ocultar historial" : "Ver historial (" + (completadas.length - 3) + " más)"}
                            </button>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        {(showHistory ? completadas : completadas.slice(0, 3)).map(renderTarea)}
                    </div>
                </div>
            )}
        </div>
    );
}

import { Suspense } from "react";

export default function TareasPage() {
    return (
        <Suspense fallback={
            <div className="space-y-3 animate-pulse">
                {[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-secondary/30" />)}
            </div>
        }>
            <TareasContent />
        </Suspense>
    );
}
