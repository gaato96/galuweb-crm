"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Layers, X, CalendarClock, DollarSign, FileText, CheckSquare } from "lucide-react";
import { cn, getInitials, formatCurrency } from "@/lib/utils";
import { proyectosStore, tareasStore, clientesStore, cotizacionesStore, mensajeError } from "@/lib/store";
import { crearProyectoCompleto } from "@/lib/proyecto-acciones";
import {
    aISO, fasesIniciales, fechaCorta, generarPlanCobro, infoPlazo, sumarDias, ESTADO_PLAZO_COLORS,
} from "@/lib/proyecto-gestion";
import { fasesDe } from "@/lib/proyectos-estado";
import { toast } from "sonner";
import type { Proyecto, Tarea, Cliente, TipoProyecto, Cotizacion } from "@/lib/types";
import { FASES_POR_TIPO, TIPO_PROYECTO_LABELS } from "@/lib/types";

const ESTADO_BADGE: Record<string, string> = {
    activo: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    pausado: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    finalizado: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const inputCls = "w-full h-10 px-3 rounded-xl bg-secondary border border-border text-sm text-foreground focus:ring-2 focus:ring-primary/50 outline-none";
const labelCls = "text-xs font-bold text-muted-foreground uppercase mb-1 block";

// ── Project Card ─────────────────────────────────────────────────────────────
function ProyectoCard({
    proyecto, tareas, cliente, onClick,
}: {
    proyecto: Proyecto; tareas: Tarea[]; cliente: Cliente | undefined; onClick: () => void;
}) {
    const fases = fasesDe(proyecto);
    const completedFases = fases.filter((f) => f.completada).length;
    const progress = fases.length > 0 ? Math.round((completedFases / fases.length) * 100) : 0;
    const faseActual = fases.find((f) => !f.completada);
    const plazo = infoPlazo(proyecto, progress);
    const pendientes = tareas.filter((t) => t.estado !== "completada").length;

    return (
        <button onClick={onClick} className="w-full text-left rounded-xl border border-border bg-card p-5 card-hover group relative overflow-hidden">
            <div className="flex items-start justify-between mb-3 gap-2">
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
                    <h4 className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">{proyecto.nombre}</h4>
                    {cliente && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-primary/40 to-cyan-500/40 flex items-center justify-center text-[7px] font-bold">
                                {getInitials(cliente.nombre)}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{cliente.nombre}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-1.5 my-3">
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-bold flex items-center gap-1", ESTADO_PLAZO_COLORS[plazo.estado])}>
                    <CalendarClock className="w-3 h-3" />
                    {proyecto.fecha_entrega && plazo.estado !== "entregado" ? `${plazo.texto} · ${fechaCorta(proyecto.fecha_entrega)}` : plazo.texto}
                </span>
                {Number(proyecto.monto_total) > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-secondary/60 text-foreground font-bold flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-emerald-400" /> {formatCurrency(Number(proyecto.monto_total))}
                    </span>
                )}
                {pendientes > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-secondary/60 text-muted-foreground font-bold flex items-center gap-1">
                        <CheckSquare className="w-3 h-3" /> {pendientes}
                    </span>
                )}
            </div>

            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground truncate">
                        {faseActual ? <>Fase: <strong className="text-foreground">{faseActual.nombre}</strong></> : "Todas las fases completas"}
                    </span>
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
    open, onClose, clientes, reload, clienteInicial,
}: {
    open: boolean; onClose: () => void; clientes: Cliente[]; reload: () => void; clienteInicial?: string | null;
}) {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const hoy = aISO(new Date());
    const [form, setForm] = useState({
        nombre: "",
        tipo_proyecto: "landing" as TipoProyecto,
        cliente_id: "",
        descripcion: "",
        fecha_inicio: hoy,
        fecha_entrega: sumarDias(hoy, 21),
        monto_total: 0,
        cotizacion_id: "",
        conPlan: true,
        anticipoPct: 50,
        cuotas: 1,
        fechaPrimerCobro: hoy,
        anticipoCobrado: false,
        cargarChecklist: true,
    });
    const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);

    useEffect(() => {
        if (open && clienteInicial) {
            const c = clientes.find((x) => x.id === clienteInicial);
            setForm((f) => ({ ...f, cliente_id: clienteInicial, nombre: f.nombre || (c ? `${c.negocio || c.nombre} - Web` : "") }));
        }
    }, [open, clienteInicial, clientes]);

    useEffect(() => {
        if (!form.cliente_id) { setCotizaciones([]); return; }
        cotizacionesStore.getByCliente(form.cliente_id)
            .then((cs) => {
                const utiles = cs.filter((c) => c.estado !== "rechazada" && c.estado !== "archivada");
                setCotizaciones(utiles);
                const sugerida = utiles.find((c) => c.estado === "aceptada") || utiles[0];
                if (sugerida) {
                    setForm((f) => f.cotizacion_id ? f : {
                        ...f,
                        cotizacion_id: sugerida.id,
                        monto_total: f.monto_total || Number(sugerida.total) || 0,
                        tipo_proyecto: sugerida.tipo_cotizacion === "webapp" ? "webapp" : f.tipo_proyecto,
                    });
                }
            })
            .catch(() => setCotizaciones([]));
    }, [form.cliente_id]);

    const previewCobros = useMemo(() => form.conPlan && form.monto_total > 0
        ? generarPlanCobro({
            proyectoId: "preview", nombreProyecto: form.nombre || "Proyecto", monto: form.monto_total,
            anticipoPct: form.anticipoPct, cuotas: form.cuotas, fechaPrimerCobro: form.fechaPrimerCobro, anticipoCobrado: form.anticipoCobrado,
        })
        : [], [form]);

    const previewFases = useMemo(
        () => fasesIniciales(form.tipo_proyecto, form.fecha_inicio, form.fecha_entrega),
        [form.tipo_proyecto, form.fecha_inicio, form.fecha_entrega]
    );

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.nombre.trim()) { toast.error("El nombre es requerido"); return; }
        if (form.fecha_entrega && form.fecha_inicio && form.fecha_entrega < form.fecha_inicio) {
            toast.error("La fecha de entrega no puede ser anterior al inicio"); return;
        }
        setSubmitting(true);
        try {
            const res = await crearProyectoCompleto({
                nombre: form.nombre,
                tipo_proyecto: form.tipo_proyecto,
                cliente: clientes.find((c) => c.id === form.cliente_id) || null,
                descripcion: form.descripcion,
                fecha_inicio: form.fecha_inicio,
                fecha_entrega: form.fecha_entrega || null,
                monto_total: Number(form.monto_total) || 0,
                cotizacion_id: form.cotizacion_id || null,
                plan: form.conPlan ? {
                    anticipoPct: form.anticipoPct, cuotas: form.cuotas,
                    fechaPrimerCobro: form.fechaPrimerCobro, anticipoCobrado: form.anticipoCobrado,
                } : null,
                cargarChecklist: form.cargarChecklist,
            });
            const extra = [res.cobros ? `${res.cobros} cobros en Finanzas` : "", res.tareas ? `${res.tareas} tareas` : ""].filter(Boolean).join(" · ");
            toast.success(`Proyecto creado${extra ? ` — ${extra}` : ""}`);
            res.avisos.forEach((a) => toast.warning(a));
            onClose();
            reload();
            router.push(`/proyectos/${res.proyecto.id}`);
        } catch (err) {
            console.error(err);
            toast.error("Error al crear proyecto: " + mensajeError(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
            <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-2xl animate-fade-in space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="text-lg font-bold text-foreground">Crear Nuevo Proyecto</h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Datos básicos */}
                    <div className="space-y-3">
                        <div>
                            <label className={labelCls}>Nombre del Proyecto *</label>
                            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Web institucional Estudio Pérez" className={cn(inputCls, "font-medium")} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Cliente</label>
                                <select value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value, cotizacion_id: "" })} className={inputCls}>
                                    <option value="">Sin cliente</option>
                                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.negocio ? ` — ${c.negocio}` : ""}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Tipo</label>
                                <select value={form.tipo_proyecto} onChange={(e) => setForm({ ...form, tipo_proyecto: e.target.value as TipoProyecto })} className={inputCls}>
                                    {Object.entries(TIPO_PROYECTO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className={labelCls}>Descripción</label>
                            <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Qué hay que construir, para quién y qué tiene que lograr. La IA usa esto para armar el brief y las tareas." rows={3} className="w-full p-3 rounded-xl bg-secondary border border-border text-sm text-foreground focus:ring-2 focus:ring-primary/50 outline-none resize-none" />
                        </div>
                    </div>

                    {/* Plazos */}
                    <div className="p-4 rounded-2xl border border-border bg-secondary/20 space-y-3">
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5"><CalendarClock className="w-4 h-4 text-primary" /> Plazos</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Inicio</label>
                                <input type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Entrega</label>
                                <input type="date" value={form.fecha_entrega} onChange={(e) => setForm({ ...form, fecha_entrega: e.target.value })} className={inputCls} />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {previewFases.map((f, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-foreground font-bold">
                                    {i + 1}. {f.nombre}{f.fecha_limite ? <span className="text-muted-foreground font-medium"> · {fechaCorta(f.fecha_limite)}</span> : null}
                                </span>
                            ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground">Los plazos de cada fase se reparten solos entre inicio y entrega. Después los podés ajustar.</p>
                    </div>

                    {/* Dinero */}
                    <div className="p-4 rounded-2xl border border-border bg-secondary/20 space-y-3">
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-emerald-400" /> Monto y cobros (se sincroniza con Finanzas)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {cotizaciones.length > 0 && (
                                <div className="sm:col-span-2">
                                    <label className={labelCls}><FileText className="w-3 h-3 inline mr-1" />Cotización</label>
                                    <select
                                        value={form.cotizacion_id}
                                        onChange={(e) => {
                                            const c = cotizaciones.find((x) => x.id === e.target.value);
                                            setForm({ ...form, cotizacion_id: e.target.value, monto_total: c ? Number(c.total) : form.monto_total });
                                        }}
                                        className={inputCls}
                                    >
                                        <option value="">Sin vincular</option>
                                        {cotizaciones.map((c) => (
                                            <option key={c.id} value={c.id}>{formatCurrency(Number(c.total))} · {c.estado} · {new Date(c.created_at).toLocaleDateString("es-AR")}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className={labelCls}>Monto total</label>
                                <input type="number" min={0} value={form.monto_total || ""} onChange={(e) => setForm({ ...form, monto_total: Number(e.target.value) })} placeholder="0" className={cn(inputCls, "font-bold")} />
                            </div>
                            <label className="flex items-center gap-2 text-xs font-bold text-foreground self-end h-10">
                                <input type="checkbox" checked={form.conPlan} onChange={(e) => setForm({ ...form, conPlan: e.target.checked })} className="w-4 h-4" />
                                Crear plan de cobro en Finanzas
                            </label>
                        </div>
                        {form.conPlan && form.monto_total > 0 && (
                            <div className="space-y-3">
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className={labelCls}>Anticipo %</label>
                                        <input type="number" min={0} max={100} value={form.anticipoPct} onChange={(e) => setForm({ ...form, anticipoPct: Number(e.target.value) })} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Cuotas saldo</label>
                                        <input type="number" min={1} max={24} value={form.cuotas} onChange={(e) => setForm({ ...form, cuotas: Math.max(1, Number(e.target.value)) })} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>1er cobro</label>
                                        <input type="date" value={form.fechaPrimerCobro} onChange={(e) => setForm({ ...form, fechaPrimerCobro: e.target.value })} className={inputCls} />
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 text-xs text-foreground">
                                    <input type="checkbox" checked={form.anticipoCobrado} onChange={(e) => setForm({ ...form, anticipoCobrado: e.target.checked })} className="w-4 h-4" />
                                    El primer pago ya está cobrado
                                </label>
                                <div className="rounded-xl border border-border bg-card divide-y divide-border">
                                    {previewCobros.map((c, i) => (
                                        <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                                            <span className="text-foreground truncate">{c.descripcion.split(" — ")[1]}</span>
                                            <span className="text-muted-foreground">{fechaCorta(c.fecha_cobro)}</span>
                                            <span className={cn("font-bold", c.cobrado ? "text-emerald-400" : "text-amber-400")}>{formatCurrency(c.monto)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <label className="flex items-start gap-2 p-3 rounded-xl border border-border bg-secondary/20 text-xs text-foreground">
                        <input type="checkbox" checked={form.cargarChecklist} onChange={(e) => setForm({ ...form, cargarChecklist: e.target.checked })} className="w-4 h-4 mt-0.5" />
                        <span>
                            <strong className="flex items-center gap-1"><Layers className="w-3.5 h-3.5 text-primary" /> Cargar el checklist de la primera fase</strong>
                            <span className="text-muted-foreground">
                                {(FASES_POR_TIPO[form.tipo_proyecto]?.[0]?.tareas.length || 0)} tareas de &quot;{FASES_POR_TIPO[form.tipo_proyecto]?.[0]?.nombre}&quot;. Al completar cada fase se carga la siguiente.
                            </span>
                        </span>
                    </label>

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
    const [filter, setFilter] = useState<string>("activo");

    const reload = async () => {
        try {
            const [p, t, c] = await Promise.all([
                proyectosStore.getAll(),
                tareasStore.getAll(),
                clientesStore.getAll(),
            ]);
            setProyectos(p.filter(item => !item.es_interno && item.tipo_proyecto !== "saas"));
            setTareas(t);
            setClientes(c);
        } catch (e) {
            console.error("Error reloading projects:", e);
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

    const filtered = (filter === "todos" ? proyectos : proyectos.filter((p) => p.estado === filter))
        .slice()
        .sort((a, b) => (a.fecha_entrega || "9999").localeCompare(b.fecha_entrega || "9999"));

    return (
        <div className="p-3 sm:p-6 space-y-6 animate-fade-in pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Proyectos Clientes</h2>
                    <p className="text-sm text-muted-foreground">{proyectos.filter((p) => p.estado === "activo").length} proyectos activos · ordenados por fecha de entrega</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20">
                        <Plus className="w-4 h-4" /> Nuevo Proyecto
                    </button>
                    <div className="flex items-center gap-1.5">
                        {["activo", "pausado", "finalizado", "todos"].map((f) => (
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
                    <div className="col-span-full py-12 text-center text-muted-foreground">
                        <p>No hay proyectos {filter !== "todos" ? `con estado "${filter}"` : ""}</p>
                    </div>
                )}
            </div>

            <NuevoProyectoModal
                open={showNew}
                onClose={() => setShowNew(false)}
                clientes={clientes}
                reload={reload}
                clienteInicial={searchParams.get("cliente")}
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
