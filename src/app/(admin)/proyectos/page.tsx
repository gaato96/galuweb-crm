"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
    ExternalLink, Eye, X, CheckCircle2, Circle, Plus, Copy,
    Layers, ScrollText, Zap, Globe, Users, Tag,
    ChevronRight, Trash2, CalendarDays, Clock
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { proyectosStore, tareasStore, clientesStore, logsProyectoStore } from "@/lib/store";
import { toast } from "sonner";
import type { Proyecto, Tarea, Cliente, FaseProyecto, LogProyecto } from "@/lib/types";
import { FASES_POR_TIPO, TIPO_PROYECTO_LABELS } from "@/lib/types";
import Link from "next/link";

// ── Utilities ────────────────────────────────────────────────────────────────
const ESTADO_BADGE: Record<string, string> = {
    activo: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    pausado: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    finalizado: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

type ModalTab = "general" | "fases" | "novedades" | "saas";

// ── Project Card ─────────────────────────────────────────────────────────────
function ProyectoCard({
    proyecto, tareas, cliente, onClick,
}: {
    proyecto: Proyecto; tareas: Tarea[]; cliente: Cliente | undefined; onClick: () => void;
}) {
    const fases = proyecto.fases || [];
    const totalFases = fases.length;
    const completedFases = fases.filter((f) => f.completada).length;
    // Fall back to task-based progress if no phases configured yet
    const progress = totalFases > 0
        ? Math.round((completedFases / totalFases) * 100)
        : (tareas.length > 0 ? Math.round((tareas.filter((t) => t.estado === "completada").length / tareas.length) * 100) : 0);

    return (
        <button onClick={onClick} className="w-full text-left rounded-xl border border-border bg-card p-5 card-hover group">
            <div className="flex items-start justify-between mb-3">
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wider", ESTADO_BADGE[proyecto.estado])}>
                    {proyecto.estado}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase">{TIPO_PROYECTO_LABELS[proyecto.tipo_proyecto]}</span>
            </div>
            <h4 className="text-base font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                {proyecto.nombre}
                {proyecto.es_interno && <span className="ml-2 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-md">SaaS/Interno</span>}
            </h4>
            {cliente && (
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary/40 to-cyan-500/40 flex items-center justify-center text-[8px] font-bold">
                        {getInitials(cliente.nombre)}
                    </div>
                    <p className="text-xs text-muted-foreground">{cliente.nombre}</p>
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

// ── Project Detail Modal ──────────────────────────────────────────────────────
function ProyectoDetailModal({
    open, onClose, proyecto, reload,
}: {
    open: boolean; onClose: () => void; proyecto: Proyecto | null; reload: () => void;
}) {
    const [activeTab, setActiveTab] = useState<ModalTab>("general");
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [cliente, setCliente] = useState<Cliente | undefined>();
    const [logs, setLogs] = useState<LogProyecto[]>([]);
    const [showNewAcceso, setShowNewAcceso] = useState(false);
    const [newAcceso, setNewAcceso] = useState({ servicio: "", url: "", usuario: "", password: "" });
    const [savingFase, setSavingFase] = useState(false);
    // Log form
    const [showNewLog, setShowNewLog] = useState(false);
    const [logForm, setLogForm] = useState({ titulo: "", descripcion: "", fecha: new Date().toISOString().slice(0, 10) });
    const [savingLog, setSavingLog] = useState(false);
    // SaaS fields
    const [saasForm, setSaasForm] = useState({
        saas_url: "", version: "", usuarios_activos: 0,
    });
    const [savingSaas, setSavingSaas] = useState(false);

    useEffect(() => {
        if (!proyecto) return;
        setActiveTab("general");
        setSaasForm({
            saas_url: proyecto.saas_url || "",
            version: proyecto.version || "",
            usuarios_activos: proyecto.usuarios_activos || 0,
        });
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

    // Derive fases (init default if empty)
    const currentFases: FaseProyecto[] = proyecto.fases && proyecto.fases.length > 0
        ? proyecto.fases
        : FASES_POR_TIPO[proyecto.tipo_proyecto].map((n) => ({ nombre: n, completada: false }));
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

    const handleDeleteLog = async (id: string) => {
        try {
            await logsProyectoStore.delete(id);
            setLogs(logs.filter((l) => l.id !== id));
            toast.success("Entrada eliminada");
        } catch { toast.error("Error al eliminar"); }
    };

    const handleSaveSaas = async () => {
        setSavingSaas(true);
        try {
            await proyectosStore.update(proyecto.id, {
                saas_url: saasForm.saas_url,
                version: saasForm.version,
                usuarios_activos: saasForm.usuarios_activos,
            });
            toast.success("Datos SaaS actualizados");
            reload();
        } catch { toast.error("Error al guardar"); }
        finally { setSavingSaas(false); }
    };

    const TABS: { id: ModalTab; label: string; icon: any }[] = [
        { id: "general", label: "General", icon: Globe },
        { id: "fases", label: "Fases", icon: Layers },
        { id: "novedades", label: "Novedades", icon: ScrollText },
        ...(proyecto.es_interno ? [{ id: "saas" as ModalTab, label: "SaaS", icon: Zap }] : []),
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8 px-4">
            <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-foreground">{proyecto.nombre}</h3>
                            {proyecto.es_interno && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-md uppercase font-bold tracking-wider">Interno</span>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {proyecto.es_interno ? "Producto Propio" : cliente?.nombre} · {TIPO_PROYECTO_LABELS[proyecto.tipo_proyecto]}
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

                <div className="p-6">
                    {/* ── TAB: GENERAL ──────────────────────────────────── */}
                    {activeTab === "general" && (
                        <div className="space-y-5">
                            {/* Links */}
                            <div className="flex flex-wrap gap-2">
                                {proyecto.figma_url && (
                                    <a href={proyecto.figma_url} target="_blank" rel="noopener" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground hover:border-primary/30 transition-colors">
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

                            {/* Figma status */}
                            {proyecto.figma_url && (
                                <div className={cn("p-4 rounded-xl border flex items-center gap-3", proyecto.figma_aprobado ? "bg-emerald-500/10 border-emerald-500/20" : "bg-purple-500/5 border-purple-500/20")}>
                                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", proyecto.figma_aprobado ? "bg-emerald-500/20 text-emerald-500" : "bg-purple-500/20 text-purple-400")}>
                                        {proyecto.figma_aprobado ? <CheckCircle2 className="w-5 h-5" /> : <ExternalLink className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h4 className={cn("text-sm font-bold", proyecto.figma_aprobado ? "text-emerald-500" : "text-purple-400")}>
                                            {proyecto.figma_aprobado ? "Diseño Aprobado" : "Diseño Pendiente"}
                                        </h4>
                                        {proyecto.figma_comentarios && <p className="text-xs text-foreground/80 italic">&quot;{proyecto.figma_comentarios}&quot;</p>}
                                    </div>
                                </div>
                            )}

                            {/* Descripción */}
                            <div>
                                <h4 className="text-sm font-semibold text-foreground mb-2">Descripción</h4>
                                <div className="p-3 rounded-lg border border-border bg-secondary/30 text-sm text-muted-foreground min-h-[70px]">
                                    {proyecto.descripcion || "Sin descripción."}
                                </div>
                            </div>

                            {/* Fecha entrega */}
                            {proyecto.fecha_entrega && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <CalendarDays className="w-3.5 h-3.5" />
                                    Entrega estimada: <strong className="text-foreground">{new Date(proyecto.fecha_entrega).toLocaleDateString()}</strong>
                                </div>
                            )}

                            {/* Accesos */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-semibold text-foreground">Accesos / Credenciales</h4>
                                    <button onClick={() => setShowNewAcceso(!showNewAcceso)} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                                        <Plus className="w-3 h-3" /> Agregar
                                    </button>
                                </div>
                                {showNewAcceso && (
                                    <div className="mb-3 p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
                                        <input type="text" placeholder="Servicio (ej. Hosting)" className="w-full text-xs p-1.5 rounded bg-background border border-border" value={newAcceso.servicio} onChange={e => setNewAcceso({ ...newAcceso, servicio: e.target.value })} />
                                        <input type="text" placeholder="URL Login (opcional)" className="w-full text-xs p-1.5 rounded bg-background border border-border" value={newAcceso.url} onChange={e => setNewAcceso({ ...newAcceso, url: e.target.value })} />
                                        <input type="text" placeholder="Usuario / Email" className="w-full text-xs p-1.5 rounded bg-background border border-border" value={newAcceso.usuario} onChange={e => setNewAcceso({ ...newAcceso, usuario: e.target.value })} />
                                        <div className="flex gap-2">
                                            <input type="text" placeholder="Contraseña" className="flex-1 text-xs p-1.5 rounded bg-background border border-border" value={newAcceso.password} onChange={e => setNewAcceso({ ...newAcceso, password: e.target.value })} />
                                            <button onClick={handleAddAcceso} className="bg-primary text-black px-2 py-1.5 rounded text-xs font-bold">Guardar</button>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                                    {(!proyecto.accesos || proyecto.accesos.length === 0) && !showNewAcceso && (
                                        <p className="text-xs text-muted-foreground italic">No hay accesos guardados.</p>
                                    )}
                                    {(proyecto.accesos || []).map((acceso, i) => (
                                        <div key={i} className="p-2.5 rounded-lg border border-border bg-secondary/30 group relative">
                                            <button onClick={() => handleRemoveAcceso(i)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-opacity">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                            <p className="text-xs font-bold text-foreground">{acceso.servicio}</p>
                                            <p className="text-[10px] text-muted-foreground break-all">{acceso.usuario} • {acceso.password}</p>
                                            {acceso.url && <a href={acceso.url} target="_blank" rel="noopener" className="text-[10px] text-primary hover:underline mt-1 inline-block">🔗 {acceso.url}</a>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── TAB: FASES ────────────────────────────────────── */}
                    {activeTab === "fases" && (
                        <div className="space-y-4">
                            {/* Progress */}
                            <div className="p-4 rounded-xl bg-secondary/50 border border-border">
                                <div className="flex justify-between mb-2">
                                    <span className="text-xs text-muted-foreground">Progreso por Fases</span>
                                    <span className="text-sm font-bold text-foreground">{fasesProgress}%</span>
                                </div>
                                <div className="h-2 rounded-full bg-background overflow-hidden">
                                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400 transition-all duration-500" style={{ width: `${fasesProgress}%` }} />
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-2">{completedFases} de {currentFases.length} fases completadas</p>
                            </div>

                            {/* Fase checklist */}
                            <div className="space-y-2">
                                {currentFases.map((fase, i) => (
                                    <button
                                        key={i}
                                        onClick={() => !savingFase && toggleFase(i)}
                                        disabled={savingFase}
                                        className={cn(
                                            "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group",
                                            fase.completada
                                                ? "bg-emerald-500/8 border-emerald-500/25 hover:border-emerald-500/40"
                                                : "bg-secondary/30 border-border hover:border-primary/40"
                                        )}
                                    >
                                        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all",
                                            fase.completada ? "bg-emerald-500/20 text-emerald-400" : "bg-secondary text-muted-foreground"
                                        )}>
                                            {fase.completada
                                                ? <CheckCircle2 className="w-4 h-4" />
                                                : <span className="text-[10px] font-bold">{i + 1}</span>
                                            }
                                        </div>
                                        <span className={cn("text-sm flex-1", fase.completada ? "text-emerald-400 line-through opacity-80" : "text-foreground")}>
                                            {fase.nombre}
                                        </span>
                                        {!fase.completada && <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── TAB: NOVEDADES ────────────────────────────────── */}
                    {activeTab === "novedades" && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">Registros de cambios, avances y estado del proyecto</p>
                                <button
                                    onClick={() => setShowNewLog(!showNewLog)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Nueva entrada
                                </button>
                            </div>

                            {/* New log form */}
                            {showNewLog && (
                                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3 animate-fade-in">
                                    <input
                                        value={logForm.titulo}
                                        onChange={(e) => setLogForm({ ...logForm, titulo: e.target.value })}
                                        placeholder="Título del avance / novedad..."
                                        className="w-full h-9 px-3 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none"
                                    />
                                    <textarea
                                        value={logForm.descripcion}
                                        onChange={(e) => setLogForm({ ...logForm, descripcion: e.target.value })}
                                        placeholder="Descripción detallada: qué se hizo, estado actual, próximos pasos..."
                                        rows={4}
                                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none resize-none"
                                    />
                                    <div className="flex items-center justify-between">
                                        <input
                                            type="date"
                                            value={logForm.fecha}
                                            onChange={(e) => setLogForm({ ...logForm, fecha: e.target.value })}
                                            className="h-8 px-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none"
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={() => setShowNewLog(false)} className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-secondary">Cancelar</button>
                                            <button onClick={handleAddLog} disabled={savingLog} className="px-3 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50">
                                                {savingLog ? "Guardando..." : "Guardar"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Log list */}
                            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                                {logs.length === 0 && !showNewLog && (
                                    <div className="py-10 text-center text-muted-foreground">
                                        <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                        <p className="text-sm">Sin novedades registradas</p>
                                        <p className="text-xs opacity-60">Registrá avances, cambios o el estado actual del proyecto</p>
                                    </div>
                                )}
                                {logs.map((log) => (
                                    <div key={log.id} className="p-4 rounded-xl border border-border bg-secondary/30 group relative">
                                        <button
                                            onClick={() => handleDeleteLog(log.id)}
                                            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-destructive hover:text-red-400 transition-opacity"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                                                <Clock className="w-2.5 h-2.5" />
                                                {new Date(log.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-semibold text-foreground mb-1">{log.titulo}</h4>
                                        {log.descripcion && <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{log.descripcion}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── TAB: SAAS ─────────────────────────────────────── */}
                    {activeTab === "saas" && proyecto.es_interno && (
                        <div className="space-y-5">
                            <p className="text-xs text-muted-foreground">Gestión del producto SaaS / Interno</p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5 sm:col-span-2">
                                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-primary" /> URL de Producción</label>
                                    <input
                                        type="url"
                                        value={saasForm.saas_url}
                                        onChange={(e) => setSaasForm({ ...saasForm, saas_url: e.target.value })}
                                        placeholder="https://app.ejemplo.com"
                                        className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                    {saasForm.saas_url && (
                                        <a href={saasForm.saas_url} target="_blank" rel="noopener" className="text-xs text-primary hover:underline flex items-center gap-1">
                                            <ExternalLink className="w-3 h-3" /> Abrir app
                                        </a>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-primary" /> Versión actual</label>
                                    <input
                                        type="text"
                                        value={saasForm.version}
                                        onChange={(e) => setSaasForm({ ...saasForm, version: e.target.value })}
                                        placeholder="v1.0.0"
                                        className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-primary" /> Usuarios activos</label>
                                    <input
                                        type="number"
                                        value={saasForm.usuarios_activos || ""}
                                        onChange={(e) => setSaasForm({ ...saasForm, usuarios_activos: parseInt(e.target.value) || 0 })}
                                        placeholder="0"
                                        className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                </div>
                            </div>

                            {/* Stats cards */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 text-center">
                                    <p className="text-xl font-bold text-primary">{saasForm.usuarios_activos || 0}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Usuarios</p>
                                </div>
                                <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/15 text-center">
                                    <p className="text-xl font-bold text-cyan-400">{saasForm.version || "—"}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Versión</p>
                                </div>
                                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-center">
                                    <p className="text-xl font-bold text-emerald-400 capitalize">{proyecto.estado}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Estado</p>
                                </div>
                            </div>

                            <div className="pt-2 flex justify-end">
                                <button
                                    onClick={handleSaveSaas}
                                    disabled={savingSaas}
                                    className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50"
                                >
                                    {savingSaas ? "Guardando..." : "Guardar datos SaaS"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Nuevo Proyecto Modal ──────────────────────────────────────────────────────
function NuevoProyectoModal({
    open, onClose, clientes, reload,
}: {
    open: boolean; onClose: () => void; clientes: Cliente[]; reload: () => void;
}) {
    const [form, setForm] = useState({
        nombre: "",
        es_interno: false,
        cliente_id: "",
        tipo_proyecto: "landing" as Proyecto["tipo_proyecto"],
        descripcion: "",
        fecha_entrega: "",
        figma_url: "",
        calendly_url: "",
        slug_portal: "",
    });
    const [submitting, setSubmitting] = useState(false);

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const fasesIniciales = FASES_POR_TIPO[form.tipo_proyecto].map((n) => ({ nombre: n, completada: false }));
            const data: any = {
                nombre: form.nombre,
                tipo_proyecto: form.tipo_proyecto,
                descripcion: form.descripcion || "",
                figma_url: form.figma_url || "",
                calendly_url: form.calendly_url || "",
                slug_portal: form.slug_portal || form.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
                estado: "activo" as const,
                es_interno: form.es_interno,
                accesos: [],
                fases: fasesIniciales,
            };

            if (form.es_interno) {
                data.cliente_id = null;
            } else {
                if (!form.cliente_id) { toast.error("Seleccione un cliente"); setSubmitting(false); return; }
                data.cliente_id = form.cliente_id;
            }
            if (form.fecha_entrega) data.fecha_entrega = form.fecha_entrega;

            await proyectosStore.create(data);
            toast.success("Proyecto creado con fases predefinidas");
            reload();
            onClose();
            setForm({ nombre: "", es_interno: false, cliente_id: "", tipo_proyecto: "landing", descripcion: "", fecha_entrega: "", figma_url: "", calendly_url: "", slug_portal: "" });
        } catch (err: any) {
            toast.error(err?.message || "Error al crear proyecto");
        } finally {
            setSubmitting(false);
        }
    };

    // Preview phases for selected type
    const previewFases = FASES_POR_TIPO[form.tipo_proyecto];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8 px-4">
            <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in my-auto">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-foreground">Crear Nuevo Proyecto</h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-xs font-medium text-foreground">Nombre del Proyecto</label>
                            <input required type="text" className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: E-commerce Galu" />
                        </div>

                        <div className="space-y-1.5 flex flex-col justify-end">
                            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-border bg-secondary/50 hover:bg-secondary transition-colors">
                                <input type="checkbox" className="rounded border-border text-primary h-4 w-4" checked={form.es_interno} onChange={(e) => setForm({ ...form, es_interno: e.target.checked, cliente_id: "" })} />
                                <span className="text-sm font-medium text-foreground">Producto SaaS / Interno</span>
                            </label>
                        </div>

                        {!form.es_interno && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-foreground">Cliente</label>
                                <select required={!form.es_interno} className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
                                    <option value="">Seleccione un cliente...</option>
                                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground">Tipo de Proyecto</label>
                            <select className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" value={form.tipo_proyecto} onChange={(e) => setForm({ ...form, tipo_proyecto: e.target.value as Proyecto["tipo_proyecto"] })}>
                                <option value="landing">Landing Page</option>
                                <option value="institucional">Institucional</option>
                                <option value="ecommerce">E-Commerce</option>
                                <option value="webapp">Web App</option>
                                <option value="saas">SaaS / Producto</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground">Fecha Estimada Entrega</label>
                            <input type="date" className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" value={form.fecha_entrega} onChange={(e) => setForm({ ...form, fecha_entrega: e.target.value })} />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Descripción</label>
                        <textarea className="w-full p-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[70px]" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Detalles del proyecto..." />
                    </div>

                    {/* Phase preview */}
                    <div className="p-3 rounded-xl border border-border bg-secondary/30">
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-2 flex items-center gap-1.5">
                            <Layers className="w-3 h-3" /> Fases que se crearán automáticamente
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {previewFases.map((f, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                                    {i + 1}. {f}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-border flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Cancelar</button>
                        <button disabled={submitting} type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
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
            setProyectos(p);
            setTareas(t);
            setClientes(c);
        } catch {
            console.error("Error reloading projects:");
        }
    };
    useEffect(() => { reload().then(() => setMounted(true)); }, []);

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
                <div className="flex items-center gap-3">
                    <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-all glow-primary">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
                {[...Array(3)].map((_, i) => <div key={i} className="h-[200px] rounded-xl bg-secondary/30" />)}
            </div>
        }>
            <ProyectosContent />
        </Suspense>
    );
}
