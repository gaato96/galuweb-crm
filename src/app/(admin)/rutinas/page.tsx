"use client";

import { useEffect, useState, Suspense } from "react";
import {
    Repeat, Plus, CheckCircle2, Clock, Trash2,
    RefreshCw, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tareasStore } from "@/lib/store";
import { toast } from "sonner";
import type { Tarea, FrecuenciaRecurrente, Prioridad, CategoriaTarea } from "@/lib/types";

const FRECUENCIA_LABELS: Record<FrecuenciaRecurrente, string> = {
    diaria: "Diaria",
    semanal: "Semanal",
    mensual: "Mensual"
};

const FRECUENCIA_COLORS: Record<FrecuenciaRecurrente, string> = {
    diaria: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    semanal: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    mensual: "bg-purple-500/20 text-purple-300 border-purple-500/30"
};

// Preset habits for freelancers/agencies
const PRESET_RUTINAS = [
    { titulo: "Hacer contacto en frío / Prosperar", frecuencia: "diaria" as FrecuenciaRecurrente, categoria: "marketing" as CategoriaTarea },
    { titulo: "Revisar y responder correos", frecuencia: "diaria" as FrecuenciaRecurrente, categoria: "otro" as CategoriaTarea },
    { titulo: "Responder consultas de prospectos", frecuencia: "diaria" as FrecuenciaRecurrente, categoria: "otro" as CategoriaTarea },
    { titulo: "Publicar contenido en Redes Social", frecuencia: "semanal" as FrecuenciaRecurrente, categoria: "marketing" as CategoriaTarea },
    { titulo: "Revisar métricas y finanzas del mes", frecuencia: "mensual" as FrecuenciaRecurrente, categoria: "otro" as CategoriaTarea },
];

function formatUltimaEjecucion(dateStr?: string): string {
    if (!dateStr) return "Nunca realizada aún";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 5) return "Recién hecha";
    if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
    if (diffHours < 24 && date.getDate() === now.getDate()) return `Hoy a las ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays === 1) return `Ayer a las ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString();
}

function RutinasContent() {
    const [rutinas, setRutinas] = useState<Tarea[]>([]);
    const [mounted, setMounted] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [filterFrecuencia, setFilterFrecuencia] = useState<string>("todas");

    const [form, setForm] = useState({
        titulo: "",
        descripcion: "",
        frecuencia_recurrente: "diaria" as FrecuenciaRecurrente,
        prioridad: "media" as Prioridad,
        categoria: "otro" as CategoriaTarea,
    });

    const reload = async () => {
        try {
            const all = await tareasStore.getAll();
            setRutinas(all.filter((t) => t.tipo_tarea === "recurrente"));
        } catch {
            toast.error("Error al cargar rutinas");
        }
    };

    useEffect(() => {
        reload().then(() => setMounted(true));
    }, []);

    const handleCreate = async () => {
        if (!form.titulo.trim()) { toast.error("El título es requerido"); return; }
        try {
            await tareasStore.create({
                titulo: form.titulo,
                descripcion: form.descripcion,
                tipo_tarea: "recurrente",
                frecuencia_recurrente: form.frecuencia_recurrente,
                prioridad: form.prioridad,
                categoria: form.categoria,
                estado: "pendiente",
                proyecto_id: null,
            });
            toast.success("Rutina agregada");
            setForm({ titulo: "", descripcion: "", frecuencia_recurrente: "diaria", prioridad: "media", categoria: "otro" });
            setShowNew(false);
            await reload();
        } catch {
            toast.error("Error al crear rutina");
        }
    };

    const handleMarcarEjecutada = async (rutina: Tarea) => {
        try {
            const nowIso = new Date().toISOString();
            await tareasStore.update(rutina.id, {
                ultima_ejecucion: nowIso,
                estado: "pendiente",
            });
            toast.success(`🎉 Rutina "${rutina.titulo}" marcada como realizada`);
            await reload();
        } catch {
            toast.error("Error al registrar rutina");
        }
    };

    const handleAddPreset = async (preset: typeof PRESET_RUTINAS[0]) => {
        try {
            await tareasStore.create({
                titulo: preset.titulo,
                descripcion: "Rutina predeterminada",
                tipo_tarea: "recurrente",
                frecuencia_recurrente: preset.frecuencia,
                prioridad: "media",
                categoria: preset.categoria,
                estado: "pendiente",
                proyecto_id: null,
            });
            toast.success(`Rutina "${preset.titulo}" añadida`);
            await reload();
        } catch {
            toast.error("Error al añadir rutina sugerida");
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await tareasStore.delete(id);
            toast.success("Rutina eliminada");
            await reload();
        } catch {
            toast.error("Error al eliminar");
        }
    };

    let filtered = rutinas;
    if (filterFrecuencia !== "todas") {
        filtered = filtered.filter((r) => r.frecuencia_recurrente === filterFrecuencia);
    }

    if (!mounted) {
        return <div className="space-y-3 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl skeleton" />)}</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Repeat className="w-6 h-6 text-primary" /> Rutinas y Hábitos Recurrentes
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Tareas frecuentes que hacés día a día sin necesidad de recrearlas
                    </p>
                </div>
                <button
                    onClick={() => setShowNew(!showNew)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
                >
                    <Plus className="w-4 h-4" /> Nueva Rutina
                </button>
            </div>

            {/* Presets rápido si hay pocas rutinas */}
            {rutinas.length < 3 && (
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                    <p className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                        <Zap className="w-4 h-4" /> Rutinas Sugeridas para Freelancers / Agencia
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {PRESET_RUTINAS.map((preset, idx) => {
                            const yaExiste = rutinas.some(r => r.titulo === preset.titulo);
                            if (yaExiste) return null;
                            return (
                                <button
                                    key={idx}
                                    onClick={() => handleAddPreset(preset)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border hover:border-primary text-xs text-foreground font-medium transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5 text-primary" /> {preset.titulo} ({preset.frecuencia})
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Modal Creación */}
            {showNew && (
                <div className="p-4 rounded-xl bg-card border border-primary/30 space-y-3 animate-fade-in shadow-xl">
                    <h3 className="text-sm font-bold text-foreground">Crear Rutina Recurrente</h3>
                    <input
                        value={form.titulo}
                        onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                        placeholder="Título (ej: Contactar 5 prospectos en frío, Responder consultas...)"
                        className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Frecuencia</label>
                            <select
                                value={form.frecuencia_recurrente}
                                onChange={(e) => setForm({ ...form, frecuencia_recurrente: e.target.value as FrecuenciaRecurrente })}
                                className="w-full h-8 px-2 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none mt-1"
                            >
                                <option value="diaria">Diaria</option>
                                <option value="semanal">Semanal</option>
                                <option value="mensual">Mensual</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Categoría</label>
                            <select
                                value={form.categoria}
                                onChange={(e) => setForm({ ...form, categoria: e.target.value as CategoriaTarea })}
                                className="w-full h-8 px-2 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none mt-1"
                            >
                                <option value="otro">General / Gestión</option>
                                <option value="marketing">Marketing / Ventas</option>
                                <option value="dev">Desarrollo</option>
                                <option value="diseno">Diseño</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                        <button onClick={() => setShowNew(false)} className="px-3 py-1.5 rounded text-xs text-muted-foreground hover:bg-secondary">Cancelar</button>
                        <button onClick={handleCreate} className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-bold text-xs hover:opacity-90">Guardar Rutina</button>
                    </div>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-border pb-3">
                {(["todas", "diaria", "semanal", "mensual"] as const).map((frec) => (
                    <button
                        key={frec}
                        onClick={() => setFilterFrecuencia(frec)}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all",
                            filterFrecuencia === frec
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {frec === "todas" ? "Todas las Rutinas" : FRECUENCIA_LABELS[frec]}
                    </button>
                ))}
            </div>

            {/* List */}
            {filtered.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground rounded-2xl border border-dashed border-border bg-card/50">
                    <Repeat className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-semibold text-foreground">No tenés rutinas registradas en esta categoría</p>
                    <p className="text-xs opacity-60 mt-1">Creá una rutina recurrente para mantener tus hábitos al día.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filtered.map((rutina) => {
                        const frec = rutina.frecuencia_recurrente || "diaria";
                        return (
                            <div
                                key={rutina.id}
                                className="p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-all flex flex-col justify-between group"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <span className={cn("text-[10px] px-2.5 py-0.5 rounded-full border font-bold uppercase tracking-wider", FRECUENCIA_COLORS[frec])}>
                                            {FRECUENCIA_LABELS[frec]}
                                        </span>
                                        <button
                                            onClick={() => handleDelete(rutina.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-400 transition-opacity"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <h4 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
                                        <RefreshCw className="w-4 h-4 text-primary shrink-0" />
                                        {rutina.titulo}
                                    </h4>
                                    {rutina.descripcion && (
                                        <p className="text-xs text-muted-foreground mb-3">{rutina.descripcion}</p>
                                    )}
                                </div>

                                <div className="pt-3 border-t border-border/50 flex items-center justify-between mt-3">
                                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-primary" />
                                        <span>Última vez: <strong className="text-foreground">{formatUltimaEjecucion(rutina.ultima_ejecucion)}</strong></span>
                                    </div>

                                    <button
                                        onClick={() => handleMarcarEjecutada(rutina)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/20 active:scale-95 transition-all"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Hecha Hoy
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function RutinasPage() {
    return (
        <Suspense fallback={
            <div className="space-y-3 animate-pulse">
                {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-secondary/30" />)}
            </div>
        }>
            <RutinasContent />
        </Suspense>
    );
}
