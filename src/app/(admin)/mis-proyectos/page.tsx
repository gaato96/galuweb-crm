"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
    ExternalLink, Plus, Layers, ScrollText, Globe, Code,
    X, CheckCircle2, CheckSquare, Rocket, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { proyectosStore, tareasStore, logsProyectoStore } from "@/lib/store";
import { toast } from "sonner";
import type { Proyecto, Tarea, LogProyecto, TipoProyectoPropio, FaseProyecto } from "@/lib/types";
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

type ModalTab = "general" | "fases" | "tareas" | "novedades" | "saas";

// ── Card Proyecto Propio ─────────────────────────────────────────────────────
function ProyectoPropioCard({
    proyecto, tareas, onClick,
}: {
    proyecto: Proyecto; tareas: Tarea[]; onClick: () => void;
}) {
    const fases = proyecto.fases || [];
    const totalFases = fases.length;
    const completedFases = fases.filter((f) => f.completada).length;
    const progress = totalFases > 0
        ? Math.round((completedFases / totalFases) * 100)
        : (tareas.length > 0 ? Math.round((tareas.filter((t) => t.estado === "completada").length / tareas.length) * 100) : 0);

    const tipoPropio = proyecto.tipo_propio || (proyecto.tipo_proyecto === 'saas' ? 'saas' : 'web_propia');

    return (
        <button onClick={onClick} className="w-full text-left rounded-xl border border-border bg-card p-5 card-hover group relative overflow-hidden">
            <div className="flex items-start justify-between mb-3">
                <span className={cn("text-[10px] px-2.5 py-0.5 rounded-full border font-bold uppercase tracking-wider", TIPO_PROPIO_BADGES[tipoPropio])}>
                    {TIPO_PROPIO_LABELS[tipoPropio]}
                </span>
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wider", ESTADO_BADGE[proyecto.estado])}>
                    {proyecto.estado}
                </span>
            </div>
            <h4 className="text-base font-bold text-foreground mb-1 group-hover:text-primary transition-colors flex items-center gap-2">
                <Rocket className="w-4 h-4 text-primary shrink-0" />
                {proyecto.nombre}
            </h4>
            {proyecto.descripcion && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {proyecto.descripcion}
                </p>
            )}

            {proyecto.stack_tecnologico && (
                <div className="flex items-center gap-1.5 mb-4 text-[11px] text-muted-foreground bg-secondary/50 px-2.5 py-1 rounded-md border border-border/50 w-fit max-w-full truncate">
                    <Code className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span className="truncate">{proyecto.stack_tecnologico}</span>
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

// ── Modal Detalle Proyecto Propio ────────────────────────────────────────────
function ProyectoPropioDetailModal({
    open, onClose, proyecto, reload,
}: {
    open: boolean; onClose: () => void; proyecto: Proyecto | null; reload: () => void;
}) {
    const [activeTab, setActiveTab] = useState<ModalTab>("general");
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [logs, setLogs] = useState<LogProyecto[]>([]);
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

    // General Form
    const [editingGeneral, setEditingGeneral] = useState(false);
    const [genForm, setGenForm] = useState({
        saas_url: "",
        version: "",
        stack_tecnologico: "",
        notas_negocio: "",
        descripcion: "",
    });

    useEffect(() => {
        if (!proyecto) return;
        setActiveTab("general");
        setGenForm({
            saas_url: proyecto.saas_url || proyecto.url_producto || "",
            version: proyecto.version || "1.0.0",
            stack_tecnologico: proyecto.stack_tecnologico || "",
            notas_negocio: proyecto.notas_negocio || "",
            descripcion: proyecto.descripcion || "",
        });
        const load = async () => {
            const [pts, lg] = await Promise.all([
                tareasStore.getByProyecto(proyecto.id),
                logsProyectoStore.getByProyecto(proyecto.id),
            ]);
            setTareas(pts);
            setLogs(lg);
        };
        load();
    }, [proyecto]);

    if (!open || !proyecto) return null;

    const currentFases: FaseProyecto[] = proyecto.fases && proyecto.fases.length > 0
        ? proyecto.fases
        : FASES_POR_TIPO[proyecto.tipo_proyecto === 'saas' ? 'saas' : 'webapp'].map((c) => ({ nombre: c.nombre, completada: false }));
    const completedFases = currentFases.filter((f) => f.completada).length;
    const fasesProgress = currentFases.length > 0 ? Math.round((completedFases / currentFases.length) * 100) : 0;

    const toggleFase = async (index: number) => {
        setSavingFase(true);
        const updated = currentFases.map((f, i) => i === index ? { ...f, completada: !f.completada } : f);
        try {
            await proyectosStore.update(proyecto.id, { fases: updated });
            toast.success("Fase actualizada");
            reload();
        } catch {
            toast.error("Error al actualizar fase");
        } finally {
            setSavingFase(false);
        }
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
        } catch { toast.error("Error al eliminar acceso"); }
    };

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
            toast.success("Proyecto actualizado");
            setEditingGeneral(false);
            reload();
        } catch {
            toast.error("Error al actualizar datos");
        }
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

    const TABS: { id: ModalTab; label: string; icon: any }[] = [
        { id: "general", label: "General & Specs", icon: Globe },
        { id: "fases", label: "Fases Roadmap", icon: Layers },
        { id: "tareas", label: "Tareas", icon: CheckSquare },
        { id: "novedades", label: "Novedades / Log", icon: ScrollText },
    ];

    const tipoPropio = proyecto.tipo_propio || 'web_propia';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8 px-4">
            <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                <Rocket className="w-5 h-5 text-primary" />
                                {proyecto.nombre}
                            </h3>
                            <span className={cn("text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border", TIPO_PROPIO_BADGES[tipoPropio])}>
                                {TIPO_PROPIO_LABELS[tipoPropio]}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Proyecto Propio · Versión {proyecto.version || "1.0.0"}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-6 pt-4 border-b border-border">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors -mb-px",
                                activeTab === tab.id
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <tab.icon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {/* TAB GENERAL */}
                    {activeTab === "general" && (
                        <div className="space-y-5">
                            {/* URL Link */}
                            <div className="flex items-center gap-2">
                                {genForm.saas_url ? (
                                    <a href={genForm.saas_url.startsWith('http') ? genForm.saas_url : `https://${genForm.saas_url}`} target="_blank" rel="noopener" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-xs text-primary font-semibold hover:bg-primary/20 transition-colors">
                                        <ExternalLink className="w-3.5 h-3.5" /> Abrir Sitio / App Live
                                    </a>
                                ) : (
                                    <span className="text-xs text-muted-foreground italic">Sin URL pública asignada</span>
                                )}
                                <button
                                    onClick={() => setEditingGeneral(!editingGeneral)}
                                    className="ml-auto text-xs text-primary hover:underline font-semibold"
                                >
                                    {editingGeneral ? "Cancelar Edición" : "Editar Specs"}
                                </button>
                            </div>

                            {editingGeneral ? (
                                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground">URL del Producto / Web</label>
                                        <input
                                            type="text"
                                            value={genForm.saas_url}
                                            onChange={e => setGenForm({ ...genForm, saas_url: e.target.value })}
                                            placeholder="https://mi-saas.com"
                                            className="w-full text-xs p-2 rounded-lg bg-background border border-border mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Stack Tecnológico</label>
                                        <input
                                            type="text"
                                            value={genForm.stack_tecnologico}
                                            onChange={e => setGenForm({ ...genForm, stack_tecnologico: e.target.value })}
                                            placeholder="Next.js, Supabase, Tailwind, Stripe..."
                                            className="w-full text-xs p-2 rounded-lg bg-background border border-border mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Versión Actual</label>
                                        <input
                                            type="text"
                                            value={genForm.version}
                                            onChange={e => setGenForm({ ...genForm, version: e.target.value })}
                                            placeholder="v1.2.0"
                                            className="w-full text-xs p-2 rounded-lg bg-background border border-border mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Notas de Negocio / Monetización</label>
                                        <textarea
                                            value={genForm.notas_negocio}
                                            onChange={e => setGenForm({ ...genForm, notas_negocio: e.target.value })}
                                            placeholder="Modelo freemium, suscripción mensual $29/mes..."
                                            rows={2}
                                            className="w-full text-xs p-2 rounded-lg bg-background border border-border mt-1 resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Descripción</label>
                                        <textarea
                                            value={genForm.descripcion}
                                            onChange={e => setGenForm({ ...genForm, descripcion: e.target.value })}
                                            placeholder="Objetivo principal del proyecto..."
                                            rows={2}
                                            className="w-full text-xs p-2 rounded-lg bg-background border border-border mt-1 resize-none"
                                        />
                                    </div>
                                    <button onClick={handleSaveGeneral} className="w-full py-2 bg-primary text-primary-foreground font-bold rounded-lg text-xs hover:opacity-90">
                                        Guardar Especificaciones
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="p-3 rounded-xl border border-border bg-secondary/30">
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                                                <Code className="w-3.5 h-3.5 text-cyan-400" /> Stack Tecnológico
                                            </p>
                                            <p className="text-xs font-semibold text-foreground mt-1">
                                                {proyecto.stack_tecnologico || "No especificado"}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl border border-border bg-secondary/30">
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                                                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Versión
                                            </p>
                                            <p className="text-xs font-semibold text-foreground mt-1">
                                                {proyecto.version || "1.0.0"}
                                            </p>
                                        </div>
                                    </div>

                                    {proyecto.notas_negocio && (
                                        <div className="p-3.5 rounded-xl border border-border bg-secondary/30">
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Notas de Negocio / Estrategia</p>
                                            <p className="text-xs text-foreground whitespace-pre-wrap">{proyecto.notas_negocio}</p>
                                        </div>
                                    )}

                                    <div>
                                        <h4 className="text-xs font-bold text-foreground mb-1">Descripción</h4>
                                        <div className="p-3 rounded-lg border border-border bg-secondary/30 text-xs text-muted-foreground min-h-[50px]">
                                            {proyecto.descripcion || "Sin descripción."}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Accesos / Credenciales Privadas */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-bold text-foreground">Accesos / API Keys / Credenciales</h4>
                                    <button onClick={() => setShowNewAcceso(!showNewAcceso)} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                                        <Plus className="w-3 h-3" /> Agregar Credencial
                                    </button>
                                </div>
                                {showNewAcceso && (
                                    <div className="mb-3 p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
                                        <input type="text" placeholder="Servicio (ej. Supabase Admin, Stripe Keys)" className="w-full text-xs p-1.5 rounded bg-background border border-border" value={newAcceso.servicio} onChange={e => setNewAcceso({ ...newAcceso, servicio: e.target.value })} />
                                        <input type="text" placeholder="URL Login (opcional)" className="w-full text-xs p-1.5 rounded bg-background border border-border" value={newAcceso.url} onChange={e => setNewAcceso({ ...newAcceso, url: e.target.value })} />
                                        <input type="text" placeholder="Usuario / Key" className="w-full text-xs p-1.5 rounded bg-background border border-border" value={newAcceso.usuario} onChange={e => setNewAcceso({ ...newAcceso, usuario: e.target.value })} />
                                        <div className="flex gap-2">
                                            <input type="text" placeholder="Secret / Password" className="flex-1 text-xs p-1.5 rounded bg-background border border-border" value={newAcceso.password} onChange={e => setNewAcceso({ ...newAcceso, password: e.target.value })} />
                                            <button onClick={handleAddAcceso} className="bg-primary text-black px-2 py-1.5 rounded text-xs font-bold">Guardar</button>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                                    {(!proyecto.accesos || proyecto.accesos.length === 0) && !showNewAcceso && (
                                        <p className="text-xs text-muted-foreground italic">No hay credenciales registradas.</p>
                                    )}
                                    {(proyecto.accesos || []).map((acceso, i) => (
                                        <div key={i} className="p-2.5 rounded-lg border border-border bg-secondary/30 group relative">
                                            <button onClick={() => handleRemoveAcceso(i)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-opacity">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                            <p className="text-xs font-bold text-foreground">{acceso.servicio}</p>
                                            <p className="text-[10px] text-muted-foreground break-all">{acceso.usuario} • {acceso.password}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB FASES */}
                    {activeTab === "fases" && (
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-secondary/50 border border-border">
                                <div className="flex justify-between mb-2">
                                    <span className="text-xs text-muted-foreground">Progreso de Desarrollo</span>
                                    <span className="text-sm font-bold text-foreground">{fasesProgress}%</span>
                                </div>
                                <div className="h-2 rounded-full bg-background overflow-hidden">
                                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400 transition-all duration-500" style={{ width: `${fasesProgress}%` }} />
                                </div>
                            </div>
                            <div className="space-y-3">
                                {currentFases.map((fase, i) => (
                                    <div key={i} className={cn("flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer", fase.completada ? "bg-emerald-500/5 border-emerald-500/20" : "bg-card border-border hover:border-primary/40")} onClick={() => !savingFase && toggleFase(i)}>
                                        <div className={cn("w-6 h-6 rounded flex items-center justify-center shrink-0 border", fase.completada ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-secondary text-muted-foreground border-border")}>
                                            {fase.completada ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                                        </div>
                                        <span className={cn("text-xs font-semibold", fase.completada ? "text-emerald-400 line-through" : "text-foreground")}>
                                            {fase.nombre}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TAB TAREAS */}
                    {activeTab === "tareas" && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">Tareas pendientes para este proyecto</p>
                                <button onClick={() => setShowNewTarea(!showNewTarea)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90">
                                    <Plus className="w-3.5 h-3.5" /> Nueva tarea
                                </button>
                            </div>
                            {showNewTarea && (
                                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                                    <input value={tareaForm.titulo} onChange={e => setTareaForm({ ...tareaForm, titulo: e.target.value })} placeholder="Título de la tarea..." className="w-full text-xs p-2 rounded-lg bg-background border border-border" />
                                    <textarea value={tareaForm.descripcion} onChange={e => setTareaForm({ ...tareaForm, descripcion: e.target.value })} placeholder="Descripción..." rows={2} className="w-full text-xs p-2 rounded-lg bg-background border border-border resize-none" />
                                    <button onClick={handleAddTarea} disabled={savingTarea} className="px-3 py-1.5 rounded bg-primary text-black font-bold text-xs">Guardar Tarea</button>
                                </div>
                            )}
                            <div className="space-y-2">
                                {tareas.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic py-4 text-center">No hay tareas pendientes en este proyecto.</p>
                                ) : (
                                    tareas.map(t => (
                                        <div key={t.id} className="p-3 rounded-lg border border-border bg-secondary/30 flex items-center justify-between">
                                            <span className="text-xs font-medium text-foreground">{t.titulo}</span>
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-secondary uppercase text-muted-foreground font-bold">{t.estado}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB NOVEDADES */}
                    {activeTab === "novedades" && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">Registro de versiones y actualizaciones</p>
                                <button onClick={() => setShowNewLog(!showNewLog)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90">
                                    <Plus className="w-3.5 h-3.5" /> Registrar Novedad
                                </button>
                            </div>
                            {showNewLog && (
                                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                                    <input value={logForm.titulo} onChange={e => setLogForm({ ...logForm, titulo: e.target.value })} placeholder="Título de la novedad (ej. v1.1 Lanzamiento Auth)..." className="w-full text-xs p-2 rounded-lg bg-background border border-border" />
                                    <textarea value={logForm.descripcion} onChange={e => setLogForm({ ...logForm, descripcion: e.target.value })} placeholder="Detalles de la versión..." rows={3} className="w-full text-xs p-2 rounded-lg bg-background border border-border resize-none" />
                                    <button onClick={handleAddLog} disabled={savingLog} className="px-3 py-1.5 rounded bg-primary text-black font-bold text-xs">Guardar Registro</button>
                                </div>
                            )}
                            <div className="space-y-3">
                                {logs.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic py-4 text-center">Sin novedades registradas aún.</p>
                                ) : (
                                    logs.map(log => (
                                        <div key={log.id} className="p-3.5 rounded-xl border border-border bg-secondary/30">
                                            <p className="text-[10px] text-muted-foreground">{log.fecha}</p>
                                            <h4 className="text-xs font-bold text-foreground mt-0.5">{log.titulo}</h4>
                                            {log.descripcion && <p className="text-xs text-muted-foreground mt-1">{log.descripcion}</p>}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main Page Component ──────────────────────────────────────────────────────
function MisProyectosContent() {
    const searchParams = useSearchParams();
    const [proyectos, setProyectos] = useState<Proyecto[]>([]);
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [mounted, setMounted] = useState(false);
    const [showNew, setShowNew] = useState(searchParams.get("new") === "true");
    const [selectedProyecto, setSelectedProyecto] = useState<Proyecto | null>(null);

    const [form, setForm] = useState({
        nombre: "",
        tipo_propio: "web_propia" as TipoProyectoPropio,
        descripcion: "",
        stack_tecnologico: "",
        notas_negocio: "",
        saas_url: "",
    });

    const reload = async () => {
        try {
            const [p, t] = await Promise.all([
                proyectosStore.getAll(),
                tareasStore.getAll(),
            ]);
            // Filter strictly internal/own projects
            setProyectos(p.filter(item => item.es_interno || item.tipo_proyecto === 'saas'));
            setTareas(t);
        } catch {
            toast.error("Error al cargar proyectos");
        }
    };

    useEffect(() => {
        reload().then(() => setMounted(true));
    }, []);

    const handleCreate = async () => {
        if (!form.nombre.trim()) { toast.error("El nombre es requerido"); return; }
        try {
            const slug = form.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).substring(2, 6);
            
            await proyectosStore.create({
                nombre: form.nombre,
                tipo_proyecto: form.tipo_propio === 'saas' ? 'saas' : 'webapp',
                tipo_propio: form.tipo_propio,
                descripcion: form.descripcion,
                stack_tecnologico: form.stack_tecnologico,
                notas_negocio: form.notas_negocio,
                saas_url: form.saas_url,
                url_producto: form.saas_url,
                es_interno: true,
                cliente_id: null,
                estado: "activo",
                figma_url: "",
                calendly_url: "",
                slug_portal: slug,
                accesos: [],
                fases: FASES_POR_TIPO[form.tipo_propio === 'saas' ? 'saas' : 'webapp'].map(c => ({ nombre: c.nombre, completada: false })),
            });

            toast.success("Proyecto propio creado");
            setForm({ nombre: "", tipo_propio: "web_propia", descripcion: "", stack_tecnologico: "", notas_negocio: "", saas_url: "" });
            setShowNew(false);
            await reload();
        } catch (error: any) {
            toast.error(`Error al crear proyecto: ${error?.message || "Desconocido"}`);
        }
    };

    if (!mounted) {
        return <div className="space-y-4 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-32 rounded-xl skeleton" />)}</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Rocket className="w-6 h-6 text-primary" /> Mis Proyectos
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Tus páginas webs personales, software propio y proyectos SaaS
                    </p>
                </div>
                <button
                    onClick={() => setShowNew(!showNew)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
                >
                    <Plus className="w-4 h-4" /> Nuevo Proyecto Propio
                </button>
            </div>

            {/* Modal Creación */}
            {showNew && (
                <div className="p-5 rounded-2xl bg-card border border-primary/40 space-y-4 animate-fade-in shadow-xl">
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" /> Crear Nuevo Proyecto Propio
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[11px] font-bold text-muted-foreground uppercase">Nombre del Proyecto</label>
                            <input
                                value={form.nombre}
                                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                placeholder="Ej: Galuweb CRM, Mi Portafolio, SaaS Analytics..."
                                className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-muted-foreground uppercase">Tipo de Proyecto</label>
                            <select
                                value={form.tipo_propio}
                                onChange={(e) => setForm({ ...form, tipo_propio: e.target.value as TipoProyectoPropio })}
                                className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mt-1"
                            >
                                <option value="web_propia">Página Web / Portafolio</option>
                                <option value="software">Software / App</option>
                                <option value="saas">SaaS / Producto Recurrente</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-bold text-muted-foreground uppercase">Stack Tecnológico</label>
                        <input
                            value={form.stack_tecnologico}
                            onChange={(e) => setForm({ ...form, stack_tecnologico: e.target.value })}
                            placeholder="Ej: Next.js, Supabase, Tailwind CSS, TypeScript"
                            className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mt-1"
                        />
                    </div>
                    <div>
                        <label className="text-[11px] font-bold text-muted-foreground uppercase">Descripción / Objetivo</label>
                        <textarea
                            value={form.descripcion}
                            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                            placeholder="Breve resumen de lo que hace o busca resolver este proyecto..."
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mt-1 resize-none"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg text-xs text-muted-foreground hover:bg-secondary">Cancelar</button>
                        <button onClick={handleCreate} className="px-4 py-2 rounded-lg text-xs bg-primary text-primary-foreground font-bold hover:opacity-90">Guardar Proyecto</button>
                    </div>
                </div>
            )}

            {/* Grid Proyectos */}
            {proyectos.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground rounded-2xl border border-dashed border-border bg-card/50">
                    <Rocket className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-base font-semibold text-foreground">No tenés proyectos propios aún</p>
                    <p className="text-xs mt-1 text-muted-foreground max-w-sm mx-auto">
                        Registrá tus páginas web, experimentos, aplicaciones o productos SaaS para gestionar su roadmap y accesos.
                    </p>
                    <button
                        onClick={() => setShowNew(true)}
                        className="mt-4 px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-lg hover:opacity-90"
                    >
                        Crear Primer Proyecto Propio
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {proyectos.map((proyecto) => (
                        <ProyectoPropioCard
                            key={proyecto.id}
                            proyecto={proyecto}
                            tareas={tareas.filter(t => t.proyecto_id === proyecto.id)}
                            onClick={() => setSelectedProyecto(proyecto)}
                        />
                    ))}
                </div>
            )}

            {/* Modal Detail */}
            <ProyectoPropioDetailModal
                open={!!selectedProyecto}
                proyecto={selectedProyecto}
                onClose={() => setSelectedProyecto(null)}
                reload={reload}
            />
        </div>
    );
}

export default function MisProyectosPage() {
    return (
        <Suspense fallback={
            <div className="space-y-4 animate-pulse">
                {[...Array(3)].map((_, i) => <div key={i} className="h-32 rounded-xl bg-secondary/30" />)}
            </div>
        }>
            <MisProyectosContent />
        </Suspense>
    );
}
