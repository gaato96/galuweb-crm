"use client";

import { useEffect, useState } from "react";
import { Plus, DollarSign, TrendingUp, PieChart, X, Calendar, AlertTriangle } from "lucide-react";
import { cn, formatCurrency, formatDate, daysFromNow } from "@/lib/utils";
import { finanzasStore, proyectosStore } from "@/lib/store";
import type { Finanza, TipoFinanza } from "@/lib/types";
import { toast } from "sonner";

const TIPO_BADGE: Record<TipoFinanza, string> = {
    ingreso: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    ads: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    gasto: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    herramienta: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

export default function FinanzasPage() {
    const [finanzas, setFinanzas] = useState<Finanza[]>([]);
    const [mounted, setMounted] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [form, setForm] = useState({ monto: 0, tipo: "ingreso" as TipoFinanza, descripcion: "", cuotas_totales: 1, cuota_actual: 1, fecha_cobro: "", proyecto_id: "" });

    const [proyectos, setProyectos] = useState<any[]>([]);

    const reload = async () => {
        try {
            const [f, p] = await Promise.all([
                finanzasStore.getAll(),
                proyectosStore.getAll()
            ]);
            setFinanzas(f);
            setProyectos(p);
        } catch {
            console.error("Error reloading finances/projects:");
        }
    };
    useEffect(() => { reload().then(() => setMounted(true)); }, []);

    // Remove direct call to store in render
    // const proyectos = proyectosStore.getAll();

    const handleCreate = async () => {
        if (!form.monto || !form.descripcion.trim()) { toast.error("Completa monto y descripción"); return; }
        try {
            if (form.cuotas_totales > 1) {
                // Create multiple cuota entries
                const montoPerCuota = form.monto / form.cuotas_totales;
                const creations = [];
                for (let i = 1; i <= form.cuotas_totales; i++) {
                    const fecha = new Date(form.fecha_cobro || Date.now());
                    fecha.setMonth(fecha.getMonth() + (i - 1));
                    creations.push(finanzasStore.create({
                        monto: Math.round(montoPerCuota * 100) / 100,
                        tipo: form.tipo,
                        descripcion: `${form.descripcion} — Cuota ${i}/${form.cuotas_totales}`,
                        cuotas_totales: form.cuotas_totales,
                        cuota_actual: i,
                        fecha_cobro: fecha.toISOString().split("T")[0],
                        proyecto_id: form.proyecto_id || null,
                    }));
                }
                await Promise.all(creations);
                toast.success(`${form.cuotas_totales} cuotas creadas`);
            } else {
                await finanzasStore.create({
                    ...form,
                    proyecto_id: form.proyecto_id || null,
                    fecha_cobro: form.fecha_cobro || new Date().toISOString().split("T")[0],
                });
                toast.success("Registro financiero creado");
            }
            setForm({ monto: 0, tipo: "ingreso", descripcion: "", cuotas_totales: 1, cuota_actual: 1, fecha_cobro: "", proyecto_id: "" });
            setShowNew(false);
            await reload();
        } catch {
            toast.error("Error al guardar registro financiero");
        }
    };

    if (!mounted) {
        return <div className="space-y-4 animate-pulse"><div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-xl skeleton" />)}</div></div>;
    }

    const ingresos = finanzas.filter((f) => f.tipo === "ingreso");
    const totalIngresos = ingresos.reduce((s, f) => s + f.monto, 0);
    const totalGastos = finanzas.filter((f) => f.tipo === "gasto" || f.tipo === "herramienta").reduce((s, f) => s + f.monto, 0);
    const totalAds = finanzas.filter((f) => f.tipo === "ads").reduce((s, f) => s + f.monto, 0);

    // Profit breakdown of ingresos
    const gananciaNeta = totalIngresos * 0.7;
    const inversionAds = totalIngresos * 0.2;
    const herramientas = totalIngresos * 0.1;

    const proximosCobros = finanzas.filter((f) => daysFromNow(f.fecha_cobro) > 0).sort((a, b) => new Date(a.fecha_cobro).getTime() - new Date(b.fecha_cobro).getTime());

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Finanzas</h2>
                    <p className="text-sm text-muted-foreground">Gestión de ingresos, gastos y proyecciones</p>
                </div>
                <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                    <Plus className="w-4 h-4" /> Nuevo Registro
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 mb-2"><div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center"><DollarSign className="w-4 h-4 text-emerald-400" /></div><span className="text-xs text-muted-foreground">Ingresos Totales</span></div>
                    <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalIngresos)}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 mb-2"><div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-rose-400" /></div><span className="text-xs text-muted-foreground">Gastos Totales</span></div>
                    <p className="text-2xl font-bold text-rose-400">{formatCurrency(totalGastos + totalAds)}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 mb-2"><div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center"><PieChart className="w-4 h-4 text-blue-400" /></div><span className="text-xs text-muted-foreground">Inversión Ads</span></div>
                    <p className="text-2xl font-bold text-blue-400">{formatCurrency(totalAds)}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 mb-2"><div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-primary" /></div><span className="text-xs text-muted-foreground">Balance Neto</span></div>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(totalIngresos - totalGastos - totalAds)}</p>
                </div>
            </div>

            {/* Profit Breakdown */}
            <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-base font-semibold text-foreground mb-4">Desglose de Ingresos (Proyección)</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                        <p className="text-xs text-muted-foreground mb-1">70% Ganancia Neta</p>
                        <p className="text-xl font-bold text-emerald-400">{formatCurrency(gananciaNeta)}</p>
                        <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: "70%" }} /></div>
                    </div>
                    <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-center">
                        <p className="text-xs text-muted-foreground mb-1">20% Inversión Ads</p>
                        <p className="text-xl font-bold text-blue-400">{formatCurrency(inversionAds)}</p>
                        <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{ width: "20%" }} /></div>
                    </div>
                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-center">
                        <p className="text-xs text-muted-foreground mb-1">10% Herramientas</p>
                        <p className="text-xl font-bold text-amber-400">{formatCurrency(herramientas)}</p>
                        <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden"><div className="h-full rounded-full bg-amber-500" style={{ width: "10%" }} /></div>
                    </div>
                </div>
            </div>

            {/* Upcoming Payments */}
            {proximosCobros.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                    <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" /> Recordatorios de Cobro
                    </h3>
                    <div className="space-y-2">
                        {proximosCobros.map((f) => {
                            const days = daysFromNow(f.fecha_cobro);
                            return (
                                <div key={f.id} className={cn("flex items-center gap-3 p-3 rounded-lg border", days <= 7 ? "bg-amber-500/5 border-amber-500/20" : "bg-secondary/30 border-border")}>
                                    {days <= 7 && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">{f.descripcion}</p>
                                        <p className="text-xs text-muted-foreground">{formatDate(f.fecha_cobro)} · en {days} días</p>
                                    </div>
                                    <span className="text-sm font-bold text-emerald-400">{formatCurrency(f.monto)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* New Record Form */}
            {showNew && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold text-foreground">Nuevo Registro Financiero</h3>
                            <button onClick={() => setShowNew(false)} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5 text-muted-foreground" /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Monto *</label>
                                    <input type="number" value={form.monto || ""} onChange={(e) => setForm({ ...form, monto: Number(e.target.value) })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="0" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Tipo *</label>
                                    <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoFinanza })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                                        <option value="ingreso">Ingreso</option>
                                        <option value="ads">Ads</option>
                                        <option value="gasto">Gasto</option>
                                        <option value="herramienta">Herramienta</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Descripción *</label>
                                <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Descripción del pago..." />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Cuotas</label>
                                    <input type="number" min={1} max={12} value={form.cuotas_totales} onChange={(e) => setForm({ ...form, cuotas_totales: Number(e.target.value) })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Fecha Cobro</label>
                                    <input type="date" value={form.fecha_cobro} onChange={(e) => setForm({ ...form, fecha_cobro: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Proyecto</label>
                                    <select value={form.proyecto_id} onChange={(e) => setForm({ ...form, proyecto_id: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                                        <option value="">Sin proyecto</option>
                                        {proyectos.map((p) => (<option key={p.id} value={p.id}>{p.nombre}</option>))}
                                    </select>
                                </div>
                            </div>
                            {form.cuotas_totales > 1 && (
                                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                                    <p className="text-xs text-muted-foreground">Se crearán {form.cuotas_totales} registros de {formatCurrency(form.monto / form.cuotas_totales)} cada uno, con fechas mensuales a partir de la fecha seleccionada.</p>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancelar</button>
                            <button onClick={handleCreate} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:opacity-90">Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* All Records Table */}
            <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-base font-semibold text-foreground mb-3">Todos los Registros</h3>
                <div className="space-y-1.5">
                    {finanzas.map((f) => {
                        const proyecto = f.proyecto_id ? proyectos.find((p) => p.id === f.proyecto_id) : null;
                        return (
                            <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
                                <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize w-[90px] text-center", TIPO_BADGE[f.tipo])}>{f.tipo}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-foreground truncate">{f.descripcion}</p>
                                    {proyecto && <p className="text-[11px] text-muted-foreground">{proyecto.nombre}</p>}
                                </div>
                                <span className="text-xs text-muted-foreground">{formatDate(f.fecha_cobro)}</span>
                                <span className={cn("text-sm font-bold", f.tipo === "ingreso" ? "text-emerald-400" : "text-rose-400")}>
                                    {f.tipo === "ingreso" ? "+" : "-"}{formatCurrency(f.monto)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
