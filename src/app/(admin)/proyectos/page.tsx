"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExternalLink, Eye, X, CheckCircle2, Circle, Plus, Copy } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { proyectosStore, tareasStore, clientesStore } from "@/lib/store";
import { toast } from "sonner";
import type { Proyecto, Tarea, Cliente } from "@/lib/types";
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
            <h4 className="text-base font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                {proyecto.nombre} {proyecto.es_interno && <span className="ml-1 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-md">SaaS / Interno</span>}
            </h4>
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
    const [showNewAcceso, setShowNewAcceso] = useState(false);
    const [newAcceso, setNewAcceso] = useState({ servicio: "", url: "", usuario: "", password: "" });

    useEffect(() => {
        const load = async () => {
            if (proyecto) {
                const [pts, cl] = await Promise.all([
                    tareasStore.getByProyecto(proyecto.id),
                    proyecto.cliente_id ? clientesStore.getById(proyecto.cliente_id) : Promise.resolve(null)
                ]);
                setTareas(pts);
                setCliente(cl || undefined);
            }
        };
        load();
    }, [proyecto]);

    if (!open || !proyecto) return null;

    const toggleTarea = async (tareaId: string, currentEstado: string) => {
        const next = currentEstado === "completada" ? "pendiente" : "completada";
        await tareasStore.update(tareaId, { estado: next as Tarea["estado"] });
        const updatedTareas = await tareasStore.getByProyecto(proyecto.id);
        setTareas(updatedTareas);
        reload();
    };

    const completed = tareas.filter((t) => t.estado === "completada").length;
    const progress = tareas.length > 0 ? Math.round((completed / tareas.length) * 100) : 0;

    const handleAddAcceso = async () => {
        if (!newAcceso.servicio || !newAcceso.usuario) return;
        const currentAccesos = proyecto.accesos || [];
        const updatedAccesos = [...currentAccesos, newAcceso];
        try {
            await proyectosStore.update(proyecto.id, { accesos: updatedAccesos });
            toast.success("Acceso guardado");
            setNewAcceso({ servicio: "", url: "", usuario: "", password: "" });
            setShowNewAcceso(false);
            reload();
        } catch {
            toast.error("Error al guardar acceso");
        }
    };

    const handleRemoveAcceso = async (index: number) => {
        const updatedAccesos = (proyecto.accesos || []).filter((_, i) => i !== index);
        try {
            await proyectosStore.update(proyecto.id, { accesos: updatedAccesos });
            toast.success("Acceso eliminado");
            reload();
        } catch {
            toast.error("Error al eliminar acceso");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
            <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-foreground">{proyecto.nombre}</h3>
                            {proyecto.es_interno && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-md uppercase font-bold tracking-wider">Interno</span>}
                        </div>
                        <p className="text-sm text-muted-foreground">{proyecto.es_interno ? "Producto Propio" : cliente?.nombre} · {proyecto.tipo_proyecto}</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>

                {/* Links */}
                <div className="flex flex-wrap gap-3 mb-5">
                    {proyecto.figma_url && (
                        <a href={proyecto.figma_url} target="_blank" rel="noopener" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground hover:border-primary/30 transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" /> Figma
                        </a>
                    )}
                    <Link href={`/portal/${proyecto.slug_portal}`} target="_blank" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground hover:border-primary/30 transition-colors">
                        <Eye className="w-3.5 h-3.5" /> Ver Portal
                    </Link>
                    <button 
                        onClick={() => {
                            const url = `${window.location.origin}/portal/${proyecto.slug_portal}`;
                            navigator.clipboard.writeText(url);
                            toast.success("Enlace del portal copiado al portapapeles");
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary font-medium hover:bg-primary/20 transition-colors"
                    >
                        <Copy className="w-3.5 h-3.5" /> Copiar Link
                    </button>
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
                    {proyecto.fecha_entrega && (
                        <p className="text-xs text-muted-foreground mt-2">Entrega: <strong className="text-foreground">{new Date(proyecto.fecha_entrega).toLocaleDateString()}</strong></p>
                    )}
                </div>

                {/* Figma Approval Status */}
                {proyecto.figma_url && (
                    <div className={cn(
                        "mb-5 p-4 rounded-xl border flex items-center justify-between",
                        proyecto.figma_aprobado ? "bg-emerald-500/10 border-emerald-500/20" : "bg-purple-500/5 border-purple-500/20"
                    )}>
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                proyecto.figma_aprobado ? "bg-emerald-500/20 text-emerald-500" : "bg-purple-500/20 text-purple-400"
                            )}>
                                {proyecto.figma_aprobado ? <CheckCircle2 className="w-5 h-5" /> : <ExternalLink className="w-5 h-5" />}
                            </div>
                            <div>
                                <h4 className={cn("text-sm font-bold", proyecto.figma_aprobado ? "text-emerald-500" : "text-purple-400")}>
                                    {proyecto.figma_aprobado ? "Diseño Aprobado por el Cliente" : "Diseño (Figma) Pendiente"}
                                </h4>
                                {proyecto.figma_comentarios ? (
                                    <p className="text-xs text-foreground/80 mt-1 italic">&quot;{proyecto.figma_comentarios}&quot;</p>
                                ) : (
                                    <p className="text-xs text-muted-foreground mt-0.5">Pendiente de aprobación en el portal.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                    {/* Detalles */}
                    <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">Descripción</h4>
                        <div className="p-3 rounded-lg border border-border bg-secondary/30 text-sm text-muted-foreground min-h-[80px]">
                            {proyecto.descripcion || "Sin descripción proporcionada."}
                        </div>
                    </div>

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
                                <input type="text" placeholder="Servicio (ej. Hosting)" className="w-full text-xs p-1.5 rounded bg-background border" value={newAcceso.servicio} onChange={e => setNewAcceso({...newAcceso, servicio: e.target.value})} />
                                <input type="text" placeholder="URL Login (opcional)" className="w-full text-xs p-1.5 rounded bg-background border" value={newAcceso.url} onChange={e => setNewAcceso({...newAcceso, url: e.target.value})} />
                                <input type="text" placeholder="Usuario / Email" className="w-full text-xs p-1.5 rounded bg-background border" value={newAcceso.usuario} onChange={e => setNewAcceso({...newAcceso, usuario: e.target.value})} />
                                <div className="flex gap-2">
                                    <input type="text" placeholder="Contraseña" className="flex-1 text-xs p-1.5 rounded bg-background border" value={newAcceso.password} onChange={e => setNewAcceso({...newAcceso, password: e.target.value})} />
                                    <button onClick={handleAddAcceso} className="bg-primary text-black px-2 py-1.5 rounded text-xs font-bold">Guardar</button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
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

// --- Nuevo Proyecto Modal ---
function NuevoProyectoModal({
    open,
    onClose,
    clientes,
    reload,
}: {
    open: boolean;
    onClose: () => void;
    clientes: Cliente[];
    reload: () => void;
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
            };

            if (form.es_interno) {
                data.cliente_id = null;
            } else {
                if (!form.cliente_id) {
                    toast.error("Seleccione un cliente para proyectos externos");
                    setSubmitting(false);
                    return;
                }
                data.cliente_id = form.cliente_id;
            }

            if (form.fecha_entrega) {
                data.fecha_entrega = form.fecha_entrega;
            }

            await proyectosStore.create(data);
            toast.success("Proyecto creado exitosamente");
            reload();
            onClose();
            setForm({ nombre: "", es_interno: false, cliente_id: "", tipo_proyecto: "landing", descripcion: "", fecha_entrega: "", figma_url: "", calendly_url: "", slug_portal: "" });
        } catch (err: any) {
            console.error("Error al crear proyecto:", err);
            toast.error(err?.message || "Error al crear proyecto");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
            <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in relative my-auto">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-foreground">Crear Nuevo Proyecto</h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-xs font-medium text-foreground">Nombre del Proyecto</label>
                            <input
                                required
                                type="text"
                                className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                value={form.nombre}
                                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                placeholder="Ej: E-commerce Galu"
                            />
                        </div>

                        <div className="space-y-1.5 flex flex-col justify-end">
                            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-border bg-secondary/50 hover:bg-secondary transition-colors">
                                <input
                                    type="checkbox"
                                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                                    checked={form.es_interno}
                                    onChange={(e) => setForm({ ...form, es_interno: e.target.checked, cliente_id: "" })}
                                />
                                <span className="text-sm font-medium text-foreground">Es un producto SaaS / Interno</span>
                            </label>
                        </div>

                        {!form.es_interno && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-foreground">Cliente</label>
                                <select
                                    required={!form.es_interno}
                                    className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    value={form.cliente_id}
                                    onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                                >
                                    <option value="">Seleccione un cliente...</option>
                                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground">Tipo de Proyecto</label>
                            <select
                                className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                value={form.tipo_proyecto}
                                onChange={(e) => setForm({ ...form, tipo_proyecto: e.target.value as Proyecto["tipo_proyecto"] })}
                            >
                                <option value="landing">Landing Page</option>
                                <option value="institucional">Institucional</option>
                                <option value="ecommerce">E-Commerce</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground">Fecha Estimada Entrega</label>
                            <input
                                type="date"
                                className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                value={form.fecha_entrega}
                                onChange={(e) => setForm({ ...form, fecha_entrega: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Descripción o Resumen</label>
                        <textarea
                            className="w-full p-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[80px]"
                            value={form.descripcion}
                            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                            placeholder="Detalles principales del proyecto..."
                        />
                    </div>

                    <div className="pt-4 border-t border-border flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                            Cancelar
                        </button>
                        <button disabled={submitting} type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
                            {submitting ? "Creando..." : "Crear Proyecto"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function ProyectosPage() {
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
                clientesStore.getAll()
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
                    <button
                        onClick={() => setShowNew(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-all glow-primary"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Nuevo Proyecto</span>
                    </button>
                    <div className="h-6 w-px bg-border hidden md:block" />
                    <div className="hidden md:flex items-center gap-2">
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
