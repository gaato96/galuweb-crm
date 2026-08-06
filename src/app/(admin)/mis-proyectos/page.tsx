"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
    Plus, Rocket, Sparkles, AlertTriangle, Clock, ChevronRight,
    CheckSquare, Loader2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { proyectosStore, tareasStore, logsProyectoStore, mensajeError } from "@/lib/store";
import { toast } from "sonner";
import type { Proyecto, Tarea, LogProyecto, TipoProyectoPropio } from "@/lib/types";
import { FASES_POR_TIPO } from "@/lib/types";
import {
    calcularEstado, haceCuanto, SALUD_LABELS, SALUD_COLORS, type EstadoProyecto, type Salud,
} from "@/lib/proyectos-estado";

const TIPO_PROPIO_LABELS: Record<TipoProyectoPropio, string> = {
    web_propia: "Web / Portafolio",
    software: "Software / App",
    saas: "SaaS / Producto",
};

type Filtro = "todos" | "atencion" | "activos" | "terminados";

// ── Barra segmentada de fases: la posición se ve sin leer números ────────────
function BarraFases({ estado }: { estado: EstadoProyecto }) {
    const { fases, faseActualIndice } = estado;
    if (fases.length === 0) return null;

    return (
        <div className="flex items-center gap-[3px]" aria-hidden="true">
            {fases.map((f, i) => {
                const esActual = i + 1 === faseActualIndice;
                return (
                    <span
                        key={i}
                        title={f.nombre}
                        className={cn(
                            "h-1.5 flex-1 rounded-full transition-colors",
                            f.completada
                                ? "bg-primary"
                                : esActual
                                  ? "bg-amber-400"
                                  : "bg-secondary"
                        )}
                    />
                );
            })}
        </div>
    );
}

// ── Tarjeta de proyecto ──────────────────────────────────────────────────────
function ProyectoCard({
    proyecto, estado, onClick,
}: {
    proyecto: Proyecto; estado: EstadoProyecto; onClick: () => void;
}) {
    const tipo = proyecto.tipo_propio || (proyecto.tipo_proyecto === "saas" ? "saas" : "web_propia");
    const quieto = (estado.diasSinMovimiento ?? 0) > 14 && estado.salud !== "terminado";

    return (
        <button
            onClick={onClick}
            className="w-full text-left rounded-2xl border border-border bg-card p-4 sm:p-5 transition-all hover:border-primary/40 hover:bg-card/80 active:scale-[0.995] group flex flex-col gap-3.5 min-h-[44px]"
        >
            {/* Nombre + salud */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {proyecto.nombre}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {TIPO_PROPIO_LABELS[tipo]}
                        {proyecto.stack_tecnologico && ` · ${proyecto.stack_tecnologico}`}
                    </p>
                </div>
                <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border font-bold whitespace-nowrap shrink-0",
                    SALUD_COLORS[estado.salud]
                )}>
                    {SALUD_LABELS[estado.salud]}
                </span>
            </div>

            {/* Dónde estás parado */}
            <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                        {estado.faseActual ? "Fase actual" : "Roadmap"}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                        {estado.faseActual
                            ? `${estado.faseActualIndice} de ${estado.fases.length}`
                            : `${estado.fasesCompletadas}/${estado.fases.length} · ${estado.progreso}%`}
                    </span>
                </div>
                <p className="text-sm font-semibold text-foreground truncate">
                    {estado.faseActual?.nombre || "Todas las fases completadas"}
                </p>
                <BarraFases estado={estado} />
            </div>

            {/* Próximo paso */}
            {estado.proximoPaso && estado.faseActual && (
                <div className="flex items-start gap-2 rounded-xl bg-secondary/40 border border-border/60 px-3 py-2">
                    <ChevronRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Sigue</p>
                        <p className="text-xs text-foreground/90 truncate">{estado.proximoPaso}</p>
                    </div>
                </div>
            )}

            {/* Señales */}
            <div className="flex items-center gap-3 flex-wrap text-[11px]">
                {estado.tareasVencidas.length > 0 && (
                    <span className="flex items-center gap-1 text-rose-300 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {estado.tareasVencidas.length} vencida{estado.tareasVencidas.length !== 1 ? "s" : ""}
                    </span>
                )}
                <span className="flex items-center gap-1 text-muted-foreground">
                    <CheckSquare className="w-3.5 h-3.5" />
                    {estado.tareasPendientes.length} pendiente{estado.tareasPendientes.length !== 1 ? "s" : ""}
                </span>
                <span className={cn("flex items-center gap-1", quieto ? "text-amber-300 font-semibold" : "text-muted-foreground")}>
                    <Clock className="w-3.5 h-3.5" />
                    {haceCuanto(estado.diasSinMovimiento)}
                </span>
            </div>
        </button>
    );
}

// ── Página ───────────────────────────────────────────────────────────────────
function MisProyectosContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [proyectos, setProyectos] = useState<Proyecto[]>([]);
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [logs, setLogs] = useState<LogProyecto[]>([]);
    const [mounted, setMounted] = useState(false);
    const [showNew, setShowNew] = useState(searchParams.get("new") === "true");
    const [creando, setCreando] = useState(false);
    const [filtro, setFiltro] = useState<Filtro>("todos");

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
            const [p, t, l] = await Promise.all([
                proyectosStore.getAll(),
                tareasStore.getAll(),
                logsProyectoStore.getRecientes().catch(() => [] as LogProyecto[]),
            ]);
            setProyectos(p.filter((item) => item.es_interno || item.tipo_proyecto === "saas"));
            setTareas(t);
            setLogs(l);
        } catch (e) {
            toast.error(mensajeError(e));
        }
    };

    useEffect(() => { reload().then(() => setMounted(true)); }, []);

    const conEstado = useMemo(
        () => proyectos.map((p) => ({ proyecto: p, estado: calcularEstado(p, tareas, logs) })),
        [proyectos, tareas, logs]
    );

    // Lo que necesita atención primero; después lo activo; al final lo terminado.
    const ordenados = useMemo(() => {
        const peso: Record<Salud, number> = {
            atencion: 0, en_marcha: 1, sin_empezar: 2, frenado: 3, terminado: 4,
        };
        return [...conEstado].sort((a, b) => {
            const d = peso[a.estado.salud] - peso[b.estado.salud];
            if (d !== 0) return d;
            return (b.estado.diasSinMovimiento ?? 0) - (a.estado.diasSinMovimiento ?? 0);
        });
    }, [conEstado]);

    const visibles = ordenados.filter(({ estado }) => {
        if (filtro === "atencion") return estado.salud === "atencion";
        if (filtro === "activos") return estado.salud === "en_marcha" || estado.salud === "sin_empezar";
        if (filtro === "terminados") return estado.salud === "terminado" || estado.salud === "frenado";
        return true;
    });

    const totalVencidas = conEstado.reduce((s, x) => s + x.estado.tareasVencidas.length, 0);
    const totalAtencion = conEstado.filter((x) => x.estado.salud === "atencion").length;
    const totalPendientes = conEstado.reduce((s, x) => s + x.estado.tareasPendientes.length, 0);

    const handleCreate = async () => {
        if (!form.nombre.trim()) { toast.error("El nombre es requerido"); return; }
        setCreando(true);
        try {
            const slug =
                form.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") +
                "-" + Math.random().toString(36).substring(2, 6);

            const created = await proyectosStore.create({
                nombre: form.nombre,
                tipo_proyecto: form.tipo_propio === "saas" ? "saas" : "webapp",
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
                fases: FASES_POR_TIPO[form.tipo_propio === "saas" ? "saas" : "webapp"]
                    .map((c) => ({ nombre: c.nombre, completada: false })),
            });

            toast.success("Proyecto creado");
            setForm({ nombre: "", tipo_propio: "web_propia", descripcion: "", stack_tecnologico: "", notas_negocio: "", saas_url: "" });
            setShowNew(false);
            router.push(`/mis-proyectos/${created.id}`);
        } catch (e) {
            toast.error(mensajeError(e));
        } finally {
            setCreando(false);
        }
    };

    if (!mounted) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-20 rounded-2xl bg-secondary/30" />
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-52 rounded-2xl bg-secondary/30" />)}
                </div>
            </div>
        );
    }

    const FILTROS: { id: Filtro; label: string; badge?: number }[] = [
        { id: "todos", label: "Todos", badge: conEstado.length },
        { id: "atencion", label: "Necesitan atención", badge: totalAtencion || undefined },
        { id: "activos", label: "En marcha" },
        { id: "terminados", label: "Frenados y terminados" },
    ];

    return (
        <div className="space-y-4 sm:space-y-5 animate-fade-in pb-20 max-w-[1400px] mx-auto">
            {/* Cabecera */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                        <Rocket className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" /> Mis Proyectos
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        {totalPendientes} tareas pendientes en {conEstado.length} proyectos
                    </p>
                </div>
                <button
                    onClick={() => setShowNew(!showNew)}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20 shrink-0 min-h-[44px]"
                >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Nuevo proyecto</span>
                    <span className="sm:hidden">Nuevo</span>
                </button>
            </div>

            {/* Lo que requiere acción hoy */}
            {(totalVencidas > 0 || totalAtencion > 0) && (
                <button
                    onClick={() => setFiltro("atencion")}
                    className="w-full text-left rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 flex items-center gap-3 hover:bg-amber-500/10 transition-colors min-h-[44px]"
                >
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <p className="text-xs sm:text-sm text-amber-200 min-w-0">
                        {totalVencidas > 0 && (
                            <><span className="font-bold">{totalVencidas} tarea{totalVencidas !== 1 ? "s" : ""} vencida{totalVencidas !== 1 ? "s" : ""}</span>{totalAtencion > 0 && " · "}</>
                        )}
                        {totalAtencion > 0 && (
                            <>{totalAtencion} proyecto{totalAtencion !== 1 ? "s" : ""} necesita{totalAtencion === 1 ? "" : "n"} atención</>
                        )}
                    </p>
                    <ChevronRight className="w-4 h-4 text-amber-400/70 ml-auto shrink-0" />
                </button>
            )}

            {/* Filtros */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
                {FILTROS.map((f) => (
                    <button
                        key={f.id}
                        onClick={() => setFiltro(f.id)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap shrink-0 min-h-[40px]",
                            filtro === f.id
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                        )}
                    >
                        {f.label}
                        {f.badge != null && (
                            <span className={cn(
                                "px-1.5 py-0.5 rounded-full text-[10px] tabular-nums",
                                filtro === f.id ? "bg-black/20" : "bg-secondary"
                            )}>
                                {f.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Formulario de alta */}
            {showNew && (
                <div className="p-4 sm:p-5 rounded-2xl bg-card border border-primary/40 space-y-4 animate-fade-in shadow-xl">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-primary" /> Nuevo proyecto propio
                        </h3>
                        <button onClick={() => setShowNew(false)} className="p-2 rounded-lg text-muted-foreground hover:bg-secondary">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                            <label className="text-[11px] font-bold text-muted-foreground uppercase">Nombre</label>
                            <input
                                value={form.nombre}
                                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                                placeholder="Ej: Galuweb CRM"
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-muted-foreground uppercase">Tipo</label>
                            <select
                                value={form.tipo_propio}
                                onChange={(e) => setForm({ ...form, tipo_propio: e.target.value as TipoProyectoPropio })}
                                className={inputCls}
                            >
                                <option value="web_propia">Página web / Portafolio</option>
                                <option value="software">Software / App</option>
                                <option value="saas">SaaS / Producto recurrente</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-bold text-muted-foreground uppercase">Stack tecnológico</label>
                        <input
                            value={form.stack_tecnologico}
                            onChange={(e) => setForm({ ...form, stack_tecnologico: e.target.value })}
                            placeholder="Next.js, Supabase, Tailwind"
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className="text-[11px] font-bold text-muted-foreground uppercase">Descripción</label>
                        <textarea
                            value={form.descripcion}
                            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                            placeholder="Qué resuelve este proyecto"
                            rows={2}
                            className={cn(inputCls, "resize-y py-2 h-auto")}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                        <button onClick={() => setShowNew(false)} className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary min-h-[44px]">
                            Cancelar
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={creando}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs bg-primary text-primary-foreground font-bold hover:opacity-90 disabled:opacity-50 min-h-[44px]"
                        >
                            {creando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Crear proyecto
                        </button>
                    </div>
                </div>
            )}

            {/* Grilla */}
            {visibles.length === 0 ? (
                <div className="py-14 sm:py-16 text-center rounded-2xl border border-dashed border-border bg-card/50 px-4">
                    <Rocket className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm sm:text-base font-semibold text-foreground">
                        {conEstado.length === 0 ? "No tenés proyectos propios aún" : "Nada en este filtro"}
                    </p>
                    <p className="text-xs mt-1 text-muted-foreground max-w-sm mx-auto">
                        {conEstado.length === 0
                            ? "Registrá tus webs, apps o productos SaaS para llevar el roadmap, las tareas y los accesos en un solo lugar."
                            : "Probá con otro filtro."}
                    </p>
                    {conEstado.length === 0 && (
                        <button
                            onClick={() => setShowNew(true)}
                            className="mt-4 px-4 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:opacity-90 min-h-[44px]"
                        >
                            Crear el primero
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                    {visibles.map(({ proyecto, estado }) => (
                        <ProyectoCard
                            key={proyecto.id}
                            proyecto={proyecto}
                            estado={estado}
                            onClick={() => router.push(`/mis-proyectos/${proyecto.id}`)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

const inputCls =
    "w-full h-11 px-3 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mt-1 placeholder:text-muted-foreground/50";

export default function MisProyectosPage() {
    return (
        <Suspense fallback={
            <div className="space-y-4 animate-pulse">
                {[...Array(3)].map((_, i) => <div key={i} className="h-52 rounded-2xl bg-secondary/30" />)}
            </div>
        }>
            <MisProyectosContent />
        </Suspense>
    );
}
