"use client";

import { useEffect, useState } from "react";
import { Plus, ExternalLink, Eye, Trash2, X, CheckCircle2, Circle, Clock } from "lucide-react";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { proyectosStore, tareasStore, clientesStore } from "@/lib/store";
import type { Proyecto, Tarea, Cliente } from "@/lib/types";
import { toast } from "sonner";
import Link from "next/link";

function ProyectoCard({
    proyecto,
    tareas,
    cliente,
    onClick,
}: {
    proyecto: Proyecto;
    tareas: Tarea[];
    cliente: Cliente | undefined;
    onClick: () => void;
}) {
    const completed = tareas.filter((t) => t.estado === "completada").length;
    const total = tareas.length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    const ESTADO_BADGE: Record<string, string> = {
        activo: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        pausado: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        finalizado: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    };

    const TIPO_LABEL: Record<string, string> = {
        landing: "Landing Page",
        institucional: "Web Institucional",
        ecommerce: "E-Commerce",
    };

    return (
        <button onClick={onClick} className="w-full text-left rounded-xl border border-border bg-card p-5 card-hover group">
            <div className="flex items-start justify-between mb-3">
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wider", ESTADO_BADGE[proyecto.estado])}>
                    {proyecto.estado}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase">{TIPO_LABEL[proyecto.tipo_proyecto]}</span>
            </div>
            <h4 className="text-base font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">{proyecto.nombre}</h4>
            {cliente && (
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/40 to-cyan-500/40 flex items-center justify-center text-[8px] font-bold text-foreground">
                        {getInitials(cliente.nombre)}
                    </div>
                    <p className="text-xs text-muted-foreground">{cliente.nombre}</p>
                </div>
            )}
            {/* Progress */}
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground">Progreso</span>
                    <span className="text-xs font-semibold text-foreground">{progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{completed}/{total} tareas</p>
            </div>
        </button>
    );
}

// --- Proyecto Detail Modal ---
function ProyectoDetailModal({ open, onClose, proyecto, reload }: { open: boolean; onClose: () => void; proyecto: Proyecto | null; reload: () => void; }) {
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [cliente, setCliente] = useState<Cliente | undefined>();

    useEffect(() => {
        if (proyecto) {
            setTareas(tareasStore.getByProyecto(proyecto.id));
            setCliente(clientesStore.getById(proyecto.cliente_id));
        }
    }, [proyecto]);

    if (!open || !proyecto) return null;

    const toggleTarea = (tareaId: string, currentEstado: string) => {
        const next = currentEstado === "completada" ? "pendiente" : "completada";
        tareasStore.update(tareaId, { estado: next as Tarea["estado"] });
        setTareas(tareasStore.getByProyecto(proyecto.id));
        reload();
    };

    const completed = tareas.filter((t) => t.estado === "completada").length;
    const progress = tareas.length > 0 ? Math.round((completed / tareas.length) * 100) : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
            <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h3 className="text-lg font-bold text-foreground">{proyecto.nombre}</h3>
                        <p className="text-sm text-muted-foreground">{cliente?.nombre} · {proyecto.tipo_proyecto}</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>

                {/* Links */}
                <div className="flex gap-3 mb-5">
                    {proyecto.figma_url && (
                        <a href={proyecto.figma_url} target="_blank" rel="noopener" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground hover:border-primary/30 transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" /> Figma
                        </a>
                    )}
                    <Link href={`/portal/${proyecto.slug_portal}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground hover:border-primary/30 transition-colors">
                        <Eye className="w-3.5 h-3.5" /> Portal del Cliente
                    </Link>
                </div>

                {/* Progress */}
                <div className="mb-5 p-3 rounded-lg bg-secondary/50 border border-border">
                    <div className="flex justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground">Progreso del Proyecto</span>
                        <span className="text-sm font-bold text-foreground">{progress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-background overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                </div>

                {/* Tasks Checklist */}
                <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3">Checklist de Tareas ({completed}/{tareas.length})</h4>
                    <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
                        {tareas.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => toggleTarea(t.id, t.estado)}
                                className={cn(
                                    "w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left",
                                    t.estado === "completada"
                                        ? "bg-emerald-500/5 border-emerald-500/20"
                                        : "bg-secondary/30 border-border hover:border-primary/30"
                                )}
                            >
                                {t.estado === "completada" ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                                ) : (
                                    <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                                )}
                                <span className={cn("text-sm flex-1", t.estado === "completada" ? "text-muted-foreground line-through" : "text-foreground")}>
                                    {t.titulo}
                                </span>
                                <span className="text-[10px] text-muted-foreground uppercase">{t.categoria}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ProyectosPage() {
    const [proyectos, setProyectos] = useState<Proyecto[]>([]);
    const [mounted, setMounted] = useState(false);
    const [selected, setSelected] = useState<Proyecto | null>(null);
    const [showDetail, setShowDetail] = useState(false);
    const [filter, setFilter] = useState<string>("todos");

    const reload = () => setProyectos(proyectosStore.getAll());
    useEffect(() => { reload(); setMounted(true); }, []);

    if (!mounted) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
                {[...Array(3)].map((_, i) => <div key={i} className="h-[200px] rounded-xl skeleton" />)}
            </div>
        );
    }

    const filtered = filter === "todos" ? proyectos : proyectos.filter((p) => p.estado === filter);

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Proyectos</h2>
                    <p className="text-sm text-muted-foreground">{proyectos.filter((p) => p.estado === "activo").length} proyectos activos</p>
                </div>
                <div className="flex items-center gap-2">
                    {["todos", "activo", "pausado", "finalizado"].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize",
                                filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((p) => (
                    <ProyectoCard
                        key={p.id}
                        proyecto={p}
                        tareas={tareasStore.getByProyecto(p.id)}
                        cliente={clientesStore.getById(p.cliente_id)}
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
            />
        </div>
    );
}
