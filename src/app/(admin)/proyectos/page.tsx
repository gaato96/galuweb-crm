"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
    Plus, Layers, X
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { proyectosStore, tareasStore, clientesStore } from "@/lib/store";
import { toast } from "sonner";
import type { Proyecto, Tarea, Cliente, TipoProyecto } from "@/lib/types";
import { FASES_POR_TIPO, TIPO_PROYECTO_LABELS } from "@/lib/types";

// ── Utilities ────────────────────────────────────────────────────────────────
const ESTADO_BADGE: Record<string, string> = {
    activo: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    pausado: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    finalizado: "bg-slate-500/20 text-slate-400 border-slate-500/30",
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
    const router = useRouter();
    const searchParams = useSearchParams();
    const [proyectos, setProyectos] = useState<Proyecto[]>([]);
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [mounted, setMounted] = useState(false);
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
                        onClick={() => router.push(`/proyectos/${p.id}`)}
                    />
                ))}
                {filtered.length === 0 && (
                    <div className="col-span-3 py-12 text-center text-muted-foreground">
                        <p>No hay proyectos {filter !== "todos" ? `con estado "${filter}"` : ""}</p>
                    </div>
                )}
            </div>

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
