"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
    Plus, Code, Rocket, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { proyectosStore, tareasStore } from "@/lib/store";
import { toast } from "sonner";
import type { Proyecto, Tarea, TipoProyectoPropio } from "@/lib/types";
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

// ── Main Page Component ──────────────────────────────────────────────────────
function MisProyectosContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [proyectos, setProyectos] = useState<Proyecto[]>([]);
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [mounted, setMounted] = useState(false);
    const [showNew, setShowNew] = useState(searchParams.get("new") === "true");

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
            
            const created = await proyectosStore.create({
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
            router.push(`/mis-proyectos/${created.id}`);
        } catch (error: any) {
            toast.error(`Error al crear proyecto: ${error?.message || "Desconocido"}`);
        }
    };

    if (!mounted) {
        return <div className="space-y-4 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-32 rounded-xl bg-secondary/30" />)}</div>;
    }

    return (
        <div className="p-6 space-y-6 animate-fade-in pb-20">
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
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
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
                                className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mt-1 font-medium"
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
                            className="w-full h-9 px-3 rounded-lg bg-secondary border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mt-1 font-medium"
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
                            onClick={() => router.push(`/mis-proyectos/${proyecto.id}`)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function MisProyectosPage() {
    return (
        <Suspense fallback={
            <div className="p-6 space-y-4 animate-pulse">
                {[...Array(3)].map((_, i) => <div key={i} className="h-32 rounded-xl bg-secondary/30" />)}
            </div>
        }>
            <MisProyectosContent />
        </Suspense>
    );
}
