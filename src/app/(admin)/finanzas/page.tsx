"use client";

import { useEffect, useState } from "react";
import {
    Plus, DollarSign, TrendingUp, PieChart, X, Calendar, AlertTriangle,
    ChevronLeft, ChevronRight, CheckCircle2, Clock, Trash2, Edit2, RefreshCw, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { cn, formatCurrency, formatDate, daysFromNow } from "@/lib/utils";
import { finanzasStore, proyectosStore } from "@/lib/store";
import type { Finanza, TipoFinanza, Proyecto } from "@/lib/types";
import { toast } from "sonner";

const TIPO_BADGE: Record<TipoFinanza, string> = {
    ingreso: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    ads: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    gasto: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    herramienta: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function FinanzasPage() {
    const [finanzas, setFinanzas] = useState<Finanza[]>([]);
    const [proyectos, setProyectos] = useState<Proyecto[]>([]);
    const [mounted, setMounted] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [editingItem, setEditingItem] = useState<Finanza | null>(null);

    // Navegación mensual
    const today = new Date();
    const [mesActual, setMesActual] = useState(today.getMonth());
    const [anioActual, setAnioActual] = useState(today.getFullYear());

    // Formulario
    const [form, setForm] = useState({
        monto: 0,
        tipo: "ingreso" as TipoFinanza,
        descripcion: "",
        cuotas_totales: 1,
        fecha_cobro: new Date().toISOString().split("T")[0],
        proyecto_id: "",
        cobrado: true,
        es_recurrente: false,
    });

    const reload = async () => {
        try {
            const [f, p] = await Promise.all([
                finanzasStore.getAll(),
                proyectosStore.getAll()
            ]);
            setFinanzas(f);
            setProyectos(p);
        } catch (e) {
            console.error("Error reloading finances:", e);
            toast.error("Error al cargar finanzas");
        }
    };

    useEffect(() => {
        reload().then(() => setMounted(true));
    }, []);

    // Handlers para mes
    const prevMes = () => {
        if (mesActual === 0) {
            setMesActual(11);
            setAnioActual(anioActual - 1);
        } else {
            setMesActual(mesActual - 1);
        }
    };

    const nextMes = () => {
        if (mesActual === 11) {
            setMesActual(0);
            setAnioActual(anioActual + 1);
        } else {
            setMesActual(mesActual + 1);
        }
    };

    const resetHoy = () => {
        setMesActual(today.getMonth());
        setAnioActual(today.getFullYear());
    };

    // Crear o editar
    const handleSave = async () => {
        if (!form.monto || form.monto <= 0 || !form.descripcion.trim()) {
            toast.error("Ingresa un monto válido y una descripción");
            return;
        }

        try {
            if (editingItem) {
                await finanzasStore.update(editingItem.id, {
                    monto: form.monto,
                    tipo: form.tipo,
                    descripcion: form.descripcion,
                    fecha_cobro: form.fecha_cobro,
                    proyecto_id: form.proyecto_id || null,
                    cobrado: form.cobrado,
                    es_recurrente: form.es_recurrente,
                });
                toast.success("Registro actualizado");
            } else if (form.tipo === "ingreso" && form.cuotas_totales > 1) {
                // Crear múltiples cuotas
                const montoCuota = Math.round((form.monto / form.cuotas_totales) * 100) / 100;
                const grupoId = crypto.randomUUID();
                const creaciones = [];

                for (let i = 1; i <= form.cuotas_totales; i++) {
                    const fecha = new Date(form.fecha_cobro);
                    fecha.setMonth(fecha.getMonth() + (i - 1));
                    const fechaStr = fecha.toISOString().split("T")[0];

                    creaciones.push(
                        finanzasStore.create({
                            monto: montoCuota,
                            tipo: "ingreso",
                            descripcion: `${form.descripcion} (Cuota ${i}/${form.cuotas_totales})`,
                            cuotas_totales: form.cuotas_totales,
                            cuota_actual: i,
                            fecha_cobro: fechaStr,
                            proyecto_id: form.proyecto_id || null,
                            cobrado: i === 1 ? form.cobrado : false, // Primera cuota según form, el resto pendientes
                            fecha_cobrado: (i === 1 && form.cobrado) ? fechaStr : null,
                            grupo_cuota: grupoId,
                            es_recurrente: false,
                        })
                    );
                }
                await Promise.all(creaciones);
                toast.success(`${form.cuotas_totales} cuotas registradas exitosamente`);
            } else {
                await finanzasStore.create({
                    monto: form.monto,
                    tipo: form.tipo,
                    descripcion: form.descripcion,
                    cuotas_totales: 1,
                    cuota_actual: 1,
                    fecha_cobro: form.fecha_cobro,
                    proyecto_id: form.proyecto_id || null,
                    cobrado: form.tipo === "ingreso" ? form.cobrado : true, // Gastos nacen como pagados
                    fecha_cobrado: form.cobrado ? form.fecha_cobro : null,
                    es_recurrente: form.es_recurrente,
                });
                toast.success("Registro guardado");
            }

            resetForm();
            await reload();
        } catch (e) {
            console.error(e);
            toast.error("Error al guardar registro");
        }
    };

    const resetForm = () => {
        setForm({
            monto: 0,
            tipo: "ingreso",
            descripcion: "",
            cuotas_totales: 1,
            fecha_cobro: new Date().toISOString().split("T")[0],
            proyecto_id: "",
            cobrado: true,
            es_recurrente: false,
        });
        setShowNew(false);
        setEditingItem(null);
    };

    const handleMarcarCobrado = async (item: Finanza, nuevoEstado: boolean) => {
        try {
            await finanzasStore.marcarCobrado(item.id, nuevoEstado);
            toast.success(nuevoEstado ? "¡Pago marcado como cobrado!" : "Pago marcado como pendiente");
            await reload();
        } catch {
            toast.error("Error al actualizar estado de pago");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar este registro financiero?")) return;
        try {
            await finanzasStore.delete(id);
            toast.success("Registro eliminado");
            await reload();
        } catch {
            toast.error("Error al eliminar");
        }
    };

    const openEdit = (f: Finanza) => {
        setEditingItem(f);
        setForm({
            monto: f.monto,
            tipo: f.tipo,
            descripcion: f.descripcion,
            cuotas_totales: f.cuotas_totales || 1,
            fecha_cobro: f.fecha_cobro || new Date().toISOString().split("T")[0],
            proyecto_id: f.proyecto_id || "",
            cobrado: f.cobrado ?? true,
            es_recurrente: f.es_recurrente ?? false,
        });
        setShowNew(true);
    };

    if (!mounted) {
        return (
            <div className="p-6 space-y-4 animate-pulse">
                <div className="h-10 w-48 bg-secondary/50 rounded-xl" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-secondary/40" />)}
                </div>
            </div>
        );
    }

    // --- CÁLCULOS MENSUALES PRECISOS ---
    // Filtrado de registros para el mes y año seleccionados
    const finanzasMes = finanzas.filter((f) => {
        const fecha = new Date(f.fecha_cobro || f.created_at);
        return fecha.getMonth() === mesActual && fecha.getFullYear() === anioActual;
    });

    // Ingresos efectivamente COBRADOS en el mes
    const ingresosCobradosMes = finanzasMes
        .filter((f) => f.tipo === "ingreso" && (f.cobrado ?? true))
        .reduce((sum, f) => sum + Number(f.monto), 0);

    // Ingresos PENDIENTES de cobro en el mes
    const ingresosPendientesMes = finanzasMes
        .filter((f) => f.tipo === "ingreso" && !(f.cobrado ?? true))
        .reduce((sum, f) => sum + Number(f.monto), 0);

    // Gastos y Herramientas del mes (ocasionles + recurrentes)
    const gastosMes = finanzasMes
        .filter((f) => f.tipo === "gasto" || f.tipo === "herramienta")
        .reduce((sum, f) => sum + Number(f.monto), 0);

    // Inversión en Ads del mes
    const adsMes = finanzasMes
        .filter((f) => f.tipo === "ads")
        .reduce((sum, f) => sum + Number(f.monto), 0);

    const totalGastosMes = gastosMes + adsMes;
    const balanceMes = ingresosCobradosMes - totalGastosMes;

    // Próximos cobros pendientes (históricos o futuros no cobrados)
    const cobrosPendientesTotal = finanzas
        .filter((f) => f.tipo === "ingreso" && !(f.cobrado ?? true))
        .sort((a, b) => new Date(a.fecha_cobro).getTime() - new Date(b.fecha_cobro).getTime());

    // Gastos recurrentes registrados
    const gastosRecurrentes = finanzas.filter((f) => f.es_recurrente && (f.tipo === "gasto" || f.tipo === "herramienta"));

    return (
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in pb-20">
            {/* Header + Selector de Mes */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground">Finanzas y Control Mensual</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">Flujo de caja, cobros parciales y gastos fijos</p>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {/* Control de Mes */}
                    <div className="flex items-center justify-between gap-1.5 sm:gap-2 bg-card border border-border rounded-xl p-1 shadow-sm flex-1 sm:flex-initial">
                        <button onClick={prevMes} className="p-1.5 sm:p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button onClick={resetHoy} className="px-2 sm:px-3 py-1 text-xs sm:text-sm font-bold text-foreground hover:text-primary transition-colors truncate">
                            {MESES[mesActual]} {anioActual}
                        </button>
                        <button onClick={nextMes} className="p-1.5 sm:p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    <button
                        onClick={() => { resetForm(); setShowNew(true); }}
                        className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20 shrink-0"
                    >
                        <Plus className="w-4 h-4" /> Nuevo Registro
                    </button>
                </div>
            </div>

            {/* KPI Cards del Mes */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <div className="rounded-xl sm:rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 sm:p-5 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <span className="text-[9px] sm:text-xs font-bold text-emerald-400 uppercase tracking-wider truncate">Ingresos Cobrados</span>
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                            <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                    </div>
                    <p className="text-base sm:text-2xl lg:text-3xl font-black text-emerald-400 truncate">{formatCurrency(ingresosCobradosMes)}</p>
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 hidden sm:flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3 text-emerald-400" /> Recibidos en {MESES[mesActual]}
                    </p>
                </div>

                <div className="rounded-xl sm:rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3.5 sm:p-5 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <span className="text-[9px] sm:text-xs font-bold text-rose-400 uppercase tracking-wider truncate">Gastos Totales</span>
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                    </div>
                    <p className="text-base sm:text-2xl lg:text-3xl font-black text-rose-400 truncate">{formatCurrency(totalGastosMes)}</p>
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 hidden sm:flex items-center gap-1">
                        <ArrowDownRight className="w-3 h-3 text-rose-400" /> Operativo + Ads en {MESES[mesActual]}
                    </p>
                </div>

                <div className="rounded-xl sm:rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 sm:p-5 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <span className="text-[9px] sm:text-xs font-bold text-amber-400 uppercase tracking-wider truncate">Por Cobrar del Mes</span>
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                    </div>
                    <p className="text-base sm:text-2xl lg:text-3xl font-black text-amber-400 truncate">{formatCurrency(ingresosPendientesMes)}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Cuotas pendientes de este mes</p>
                </div>

                <div className={cn("rounded-2xl border p-5 relative overflow-hidden", balanceMes >= 0 ? "border-primary/30 bg-primary/5" : "border-rose-500/30 bg-rose-500/5")}>
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Balance Neto</span>
                        <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                            <PieChart className="w-4 h-4" />
                        </div>
                    </div>
                    <p className={cn("text-3xl font-black", balanceMes >= 0 ? "text-primary" : "text-rose-400")}>
                        {formatCurrency(balanceMes)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">Cobrado neto del mes</p>
                </div>
            </div>

            {/* SECCIÓN 1: Cobros Pendientes (Acción Inmediata) */}
            {cobrosPendientesTotal.length > 0 && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            Cobros Pendientes ({cobrosPendientesTotal.length})
                        </h3>
                        <span className="text-xs font-bold text-amber-400">
                            Total por cobrar: {formatCurrency(cobrosPendientesTotal.reduce((s, f) => s + Number(f.monto), 0))}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {cobrosPendientesTotal.map((item) => {
                            const proy = item.proyecto_id ? proyectos.find(p => p.id === item.proyecto_id) : null;
                            const dias = daysFromNow(item.fecha_cobro);

                            return (
                                <div key={item.id} className="p-3.5 rounded-xl border border-border bg-card hover:border-amber-500/40 transition-all flex items-center justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs font-bold text-foreground truncate">{item.descripcion}</p>
                                            {proy && <span className="text-[9px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{proy.nombre}</span>}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            Fecha cobro: <strong className="text-foreground">{formatDate(item.fecha_cobro)}</strong>
                                            {dias < 0 ? <span className="text-rose-400 font-bold ml-1.5">(Vencido hace {Math.abs(dias)} días)</span> : <span className="text-amber-400 ml-1.5">(en {dias} días)</span>}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="text-sm font-bold text-emerald-400">{formatCurrency(item.monto)}</span>
                                        <button
                                            onClick={() => handleMarcarCobrado(item, true)}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 active:scale-95 transition-all shadow-md"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Cobrado
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* SECCIÓN 2: Movimientos del Mes */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                        <h3 className="text-base font-bold text-foreground">Movimientos de {MESES[mesActual]} {anioActual}</h3>
                        <p className="text-xs text-muted-foreground">{finanzasMes.length} registros en este período</p>
                    </div>
                </div>

                {finanzasMes.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                        <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-medium">No hay registros financieros en este mes</p>
                        <p className="text-xs opacity-60">Haz clic en &quot;Nuevo Registro&quot; para agregar ingresos o gastos.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {finanzasMes.map((f) => {
                            const proy = f.proyecto_id ? proyectos.find((p) => p.id === f.proyecto_id) : null;
                            const esIngreso = f.tipo === "ingreso";
                            const estaCobrado = f.cobrado ?? true;

                            return (
                                <div
                                    key={f.id}
                                    className={cn(
                                        "flex items-center justify-between gap-4 p-3.5 rounded-xl border transition-all group",
                                        !estaCobrado ? "bg-amber-500/5 border-amber-500/30" : "bg-secondary/30 border-border hover:border-primary/30"
                                    )}
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <span className={cn("text-[10px] px-2.5 py-1 rounded-full border font-bold uppercase tracking-wider shrink-0", TIPO_BADGE[f.tipo])}>
                                            {f.tipo}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-foreground truncate">{f.descripcion}</p>
                                                {f.es_recurrente && (
                                                    <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                                        <RefreshCw className="w-2.5 h-2.5" /> Recurrente
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                                <span>{formatDate(f.fecha_cobro)}</span>
                                                {proy && <span>• Proyecto: <strong className="text-foreground">{proy.nombre}</strong></span>}
                                                {esIngreso && (
                                                    <span className={cn("font-bold text-[10px] px-1.5 py-0.2 rounded", estaCobrado ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10")}>
                                                        {estaCobrado ? "Cobrado" : "Pendiente"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 shrink-0">
                                        <span className={cn("text-base font-black", esIngreso ? (estaCobrado ? "text-emerald-400" : "text-amber-400 opacity-60") : "text-rose-400")}>
                                            {esIngreso ? "+" : "-"}{formatCurrency(f.monto)}
                                        </span>

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {esIngreso && (
                                                <button
                                                    onClick={() => handleMarcarCobrado(f, !estaCobrado)}
                                                    className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                                                    title={estaCobrado ? "Marcar pendiente" : "Marcar cobrado"}
                                                >
                                                    <CheckCircle2 className={cn("w-4 h-4", estaCobrado ? "text-emerald-400" : "text-amber-400")} />
                                                </button>
                                            )}
                                            <button onClick={() => openEdit(f)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(f.id)} className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* SECCIÓN 3: Gastos Recurrentes Fijos */}
            {gastosRecurrentes.length > 0 && (
                <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5 space-y-3">
                    <h3 className="text-sm font-bold text-purple-300 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" /> Gastos Fijos Recurrentes (IA, Hosting, Herramientas)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {gastosRecurrentes.map((g) => (
                            <div key={g.id} className="p-3 rounded-xl bg-card border border-border flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-foreground">{g.descripcion}</p>
                                    <span className="text-[10px] text-muted-foreground capitalize">{g.tipo}</span>
                                </div>
                                <span className="text-sm font-bold text-rose-400">-{formatCurrency(g.monto)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* MODAL CREAR / EDITAR */}
            {showNew && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl animate-fade-in space-y-5">
                        <div className="flex items-center justify-between border-b border-border pb-4">
                            <h3 className="text-lg font-bold text-foreground">{editingItem ? "Editar Registro Financiero" : "Nuevo Registro Financiero"}</h3>
                            <button onClick={resetForm} className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Monto *</label>
                                    <input
                                        type="number"
                                        value={form.monto || ""}
                                        onChange={(e) => setForm({ ...form, monto: Number(e.target.value) })}
                                        className="w-full h-11 px-3 rounded-xl bg-secondary border border-border text-sm font-bold text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Tipo *</label>
                                    <select
                                        value={form.tipo}
                                        onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoFinanza })}
                                        className="w-full h-11 px-3 rounded-xl bg-secondary border border-border text-sm font-medium text-foreground outline-none"
                                    >
                                        <option value="ingreso">💰 Ingreso</option>
                                        <option value="gasto">📉 Gasto Ocasional</option>
                                        <option value="herramienta">🛠️ Herramienta / Software</option>
                                        <option value="ads">📢 Inversión Ads</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Descripción *</label>
                                <input
                                    value={form.descripcion}
                                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                                    className="w-full h-11 px-3 rounded-xl bg-secondary border border-border text-sm text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
                                    placeholder="Ej: Pago web Cliente X, Suscripción OpenAI..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Fecha de Cobro / Pago</label>
                                    <input
                                        type="date"
                                        value={form.fecha_cobro}
                                        onChange={(e) => setForm({ ...form, fecha_cobro: e.target.value })}
                                        className="w-full h-11 px-3 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">Proyecto Vinculado</label>
                                    <select
                                        value={form.proyecto_id}
                                        onChange={(e) => setForm({ ...form, proyecto_id: e.target.value })}
                                        className="w-full h-11 px-3 rounded-xl bg-secondary border border-border text-sm text-foreground outline-none"
                                    >
                                        <option value="">Sin proyecto</option>
                                        {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Opciones especiales para Ingreso */}
                            {form.tipo === "ingreso" && !editingItem && (
                                <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-foreground">¿Pago en cuotas?</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={12}
                                            value={form.cuotas_totales}
                                            onChange={(e) => setForm({ ...form, cuotas_totales: Math.max(1, Number(e.target.value)) })}
                                            className="w-20 h-9 px-3 rounded-lg bg-card border border-border text-xs font-bold text-center"
                                        />
                                    </div>

                                    {form.cuotas_totales > 1 && (
                                        <p className="text-[11px] text-muted-foreground">
                                            Se crearán {form.cuotas_totales} cuotas mensuales de <strong className="text-emerald-400">{formatCurrency(form.monto / form.cuotas_totales)}</strong> cada una.
                                        </p>
                                    )}

                                    <div className="flex items-center justify-between pt-1">
                                        <label className="text-xs font-bold text-foreground">¿El primer pago ya fue cobrado?</label>
                                        <input
                                            type="checkbox"
                                            checked={form.cobrado}
                                            onChange={(e) => setForm({ ...form, cobrado: e.target.checked })}
                                            className="w-4 h-4 rounded text-primary focus:ring-primary"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Opción Recurrente para Gastos */}
                            {form.tipo !== "ingreso" && (
                                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border">
                                    <div>
                                        <p className="text-xs font-bold text-foreground">Gasto Fijo Recurrente</p>
                                        <p className="text-[10px] text-muted-foreground">Ej: Hosting, dominios, herramientas de IA que se pagan cada mes</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={form.es_recurrente}
                                        onChange={(e) => setForm({ ...form, es_recurrente: e.target.checked })}
                                        className="w-4 h-4 rounded text-primary focus:ring-primary"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={resetForm} className="px-5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary">Cancelar</button>
                            <button onClick={handleSave} className="px-6 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:opacity-90">
                                {editingItem ? "Actualizar" : "Guardar Registro"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
