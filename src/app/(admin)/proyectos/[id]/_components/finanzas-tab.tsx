"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Plus, Trash2, ExternalLink, Wallet, TrendingDown, Save } from "lucide-react";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";
import { finanzasStore, mensajeError } from "@/lib/store";
import { registrarLog } from "@/lib/proyecto-acciones";
import { aISO, fechaCorta, generarPlanCobro, resumenCobros } from "@/lib/proyecto-gestion";
import type { TipoFinanza } from "@/lib/types";
import { ui, type ProyectoCtx } from "./ctx";

export default function FinanzasTab({ ctx }: { ctx: ProyectoCtx }) {
    const { proyecto, finanzas } = ctx;
    const hoy = aISO(new Date());
    const [monto, setMonto] = useState<number>(Number(proyecto.monto_total) || 0);
    const r = resumenCobros(finanzas, Number(proyecto.monto_total) || 0, hoy);
    const gastos = finanzas.filter((f) => f.tipo !== "ingreso");
    const totalGastos = gastos.reduce((s, f) => s + Number(f.monto), 0);

    const [plan, setPlan] = useState({ anticipoPct: finanzas.length ? 0 : 50, cuotas: 1, fecha: hoy, cobrado: false });
    const montoPlan = r.sinPlanificar > 0 ? r.sinPlanificar : 0;
    const preview = useMemo(() => generarPlanCobro({
        proyectoId: proyecto.id, nombreProyecto: proyecto.nombre, monto: montoPlan,
        anticipoPct: plan.anticipoPct, cuotas: plan.cuotas, fechaPrimerCobro: plan.fecha, anticipoCobrado: plan.cobrado,
    }), [proyecto.id, proyecto.nombre, montoPlan, plan]);

    const [nuevo, setNuevo] = useState({ monto: 0, tipo: "ingreso" as TipoFinanza, descripcion: "", fecha: hoy, cobrado: false });
    const [guardando, setGuardando] = useState(false);

    const guardarMonto = async () => {
        if (await ctx.guardarProyecto({ monto_total: monto }, "Monto actualizado")) {
            registrarLog(proyecto.id, "Monto del proyecto actualizado", formatCurrency(monto));
        }
    };

    const crearPlan = async () => {
        if (!preview.length) return;
        setGuardando(true);
        try {
            await finanzasStore.createBulk(preview);
            toast.success(`${preview.length} cobros agregados a Finanzas`);
            await ctx.recargar("finanzas");
        } catch (e) { toast.error("Error: " + mensajeError(e)); }
        finally { setGuardando(false); }
    };

    const agregarMovimiento = async () => {
        if (!nuevo.monto || nuevo.monto <= 0) { toast.error("Monto inválido"); return; }
        const esIngreso = nuevo.tipo === "ingreso";
        const cobrado = esIngreso ? nuevo.cobrado : true;
        setGuardando(true);
        try {
            await finanzasStore.create({
                proyecto_id: proyecto.id,
                monto: nuevo.monto,
                tipo: nuevo.tipo,
                descripcion: nuevo.descripcion.trim() || `${proyecto.nombre} — ${esIngreso ? "Cobro" : "Gasto"}`,
                cuotas_totales: 1,
                cuota_actual: 1,
                fecha_cobro: nuevo.fecha,
                cobrado,
                fecha_cobrado: cobrado ? nuevo.fecha : null,
                es_recurrente: false,
                grupo_cuota: null,
            });
            setNuevo({ monto: 0, tipo: "ingreso", descripcion: "", fecha: hoy, cobrado: false });
            toast.success("Movimiento agregado");
            await ctx.recargar("finanzas");
        } catch (e) { toast.error("Error: " + mensajeError(e)); }
        finally { setGuardando(false); }
    };

    const alternarCobrado = async (id: string, cobrado: boolean, descripcion: string, m: number) => {
        try {
            await finanzasStore.marcarCobrado(id, cobrado);
            if (cobrado) registrarLog(proyecto.id, "Cobro registrado", `${descripcion} — ${formatCurrency(m)}`);
            await ctx.recargar("finanzas", "logs");
        } catch (e) { toast.error("Error: " + mensajeError(e)); }
    };

    const borrar = async (id: string) => {
        if (!confirm("¿Eliminar este movimiento de Finanzas?")) return;
        try { await finanzasStore.delete(id); await ctx.recargar("finanzas"); }
        catch (e) { toast.error("Error: " + mensajeError(e)); }
    };

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className={cn(ui.card, "space-y-2")}>
                    <p className={ui.label}>Monto del proyecto</p>
                    <div className="flex gap-1.5">
                        <input type="number" min={0} value={monto || ""} onChange={(e) => setMonto(Number(e.target.value))} className={cn(ui.input, "font-bold text-sm")} />
                        {monto !== (Number(proyecto.monto_total) || 0) && (
                            <button onClick={guardarMonto} className={cn(ui.btn, ui.btnPrimary)}><Save className="w-3.5 h-3.5" /></button>
                        )}
                    </div>
                </div>
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <p className={ui.label}>Cobrado</p>
                    <p className="text-xl font-black text-emerald-400">{formatCurrency(r.cobrado)}</p>
                    <p className="text-[10px] text-muted-foreground">{r.pctCobrado}% del total</p>
                </div>
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                    <p className={ui.label}>Por cobrar</p>
                    <p className="text-xl font-black text-amber-400">{formatCurrency(r.pendiente)}</p>
                    <p className="text-[10px] text-muted-foreground">{r.vencidos.length ? <span className="text-rose-400 font-bold">{r.vencidos.length} vencido(s)</span> : r.proximo ? `Próximo ${fechaCorta(r.proximo.fecha_cobro)}` : "Nada pendiente"}</p>
                </div>
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                    <p className={ui.label}>Margen</p>
                    <p className="text-xl font-black text-primary">{formatCurrency(r.planificado - totalGastos)}</p>
                    <p className="text-[10px] text-muted-foreground">Gastos vinculados: {formatCurrency(totalGastos)}</p>
                </div>
            </div>

            {r.sinPlanificar > 0 && (
                <div className={cn(ui.card, "border-amber-500/30 space-y-3")}>
                    <h3 className={ui.h3}><Wallet className="w-4 h-4 text-amber-400" /> Falta planificar {formatCurrency(r.sinPlanificar)}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <label className={ui.label}>Anticipo %</label>
                            <input type="number" min={0} max={100} value={plan.anticipoPct} onChange={(e) => setPlan({ ...plan, anticipoPct: Number(e.target.value) })} className={ui.input} />
                        </div>
                        <div>
                            <label className={ui.label}>Cuotas</label>
                            <input type="number" min={1} max={24} value={plan.cuotas} onChange={(e) => setPlan({ ...plan, cuotas: Math.max(1, Number(e.target.value)) })} className={ui.input} />
                        </div>
                        <div>
                            <label className={ui.label}>1er cobro</label>
                            <input type="date" value={plan.fecha} onChange={(e) => setPlan({ ...plan, fecha: e.target.value })} className={ui.input} />
                        </div>
                        <label className="flex items-center gap-2 text-xs text-foreground self-end h-9">
                            <input type="checkbox" checked={plan.cobrado} onChange={(e) => setPlan({ ...plan, cobrado: e.target.checked })} /> 1º ya cobrado
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {preview.map((c, i) => (
                            <span key={i} className="text-[10px] px-2 py-1 rounded-lg bg-secondary border border-border">
                                {c.descripcion.split(" — ")[1]} · <strong>{formatCurrency(c.monto)}</strong> · {fechaCorta(c.fecha_cobro)}
                            </span>
                        ))}
                    </div>
                    <button disabled={guardando} onClick={crearPlan} className={cn(ui.btn, ui.btnPrimary)}>Crear {preview.length} cobros en Finanzas</button>
                </div>
            )}

            <div className={cn(ui.card, "space-y-3")}>
                <div className="flex items-center justify-between">
                    <h3 className={ui.h3}>Movimientos del proyecto ({finanzas.length})</h3>
                    <Link href="/finanzas" className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1">Ir a Finanzas <ExternalLink className="w-3 h-3" /></Link>
                </div>
                <div className="space-y-1.5">
                    {finanzas.map((f) => {
                        const ingreso = f.tipo === "ingreso";
                        const cobrado = f.cobrado ?? true;
                        const vencido = ingreso && !cobrado && f.fecha_cobro < hoy;
                        return (
                            <div key={f.id} className={cn("group flex items-center gap-3 p-2.5 rounded-xl border", vencido ? "border-rose-500/30 bg-rose-500/5" : !cobrado ? "border-amber-500/20 bg-amber-500/5" : "border-border bg-secondary/30")}>
                                {ingreso ? (
                                    <button onClick={() => alternarCobrado(f.id, !cobrado, f.descripcion, Number(f.monto))} title={cobrado ? "Marcar pendiente" : "Marcar cobrado"}>
                                        {cobrado ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Circle className="w-5 h-5 text-amber-400" />}
                                    </button>
                                ) : <TrendingDown className="w-5 h-5 text-rose-400" />}
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-foreground truncate">{f.descripcion}</p>
                                    <p className={cn("text-[10px]", vencido ? "text-rose-400 font-bold" : "text-muted-foreground")}>
                                        {fechaCorta(f.fecha_cobro)} · {ingreso ? (cobrado ? "Cobrado" : vencido ? "Vencido" : "Pendiente") : f.tipo}
                                    </p>
                                </div>
                                <span className={cn("text-sm font-black", ingreso ? (cobrado ? "text-emerald-400" : "text-amber-400") : "text-rose-400")}>
                                    {ingreso ? "+" : "-"}{formatCurrency(Number(f.monto))}
                                </span>
                                <button onClick={() => borrar(f.id)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        );
                    })}
                    {finanzas.length === 0 && <p className="text-xs text-muted-foreground italic py-3">No hay movimientos vinculados a este proyecto.</p>}
                </div>

                <div className="pt-3 border-t border-border grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
                    <div className="col-span-2">
                        <label className={ui.label}>Descripción</label>
                        <input value={nuevo.descripcion} onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })} placeholder="Ej: Pago extra, hosting, plugin…" className={ui.input} />
                    </div>
                    <div>
                        <label className={ui.label}>Tipo</label>
                        <select value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value as TipoFinanza })} className={ui.input}>
                            <option value="ingreso">Cobro</option>
                            <option value="gasto">Gasto</option>
                            <option value="herramienta">Herramienta</option>
                            <option value="ads">Ads</option>
                        </select>
                    </div>
                    <div>
                        <label className={ui.label}>Monto</label>
                        <input type="number" min={0} value={nuevo.monto || ""} onChange={(e) => setNuevo({ ...nuevo, monto: Number(e.target.value) })} className={ui.input} />
                    </div>
                    <div>
                        <label className={ui.label}>Fecha</label>
                        <input type="date" value={nuevo.fecha} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} className={ui.input} />
                    </div>
                    <div className="flex items-center gap-2">
                        {nuevo.tipo === "ingreso" && (
                            <label className="flex items-center gap-1 text-[10px] text-foreground"><input type="checkbox" checked={nuevo.cobrado} onChange={(e) => setNuevo({ ...nuevo, cobrado: e.target.checked })} /> Cobrado</label>
                        )}
                        <button disabled={guardando} onClick={agregarMovimiento} className={cn(ui.btn, ui.btnPrimary, "ml-auto")}><Plus className="w-3.5 h-3.5" /></button>
                    </div>
                </div>
            </div>
        </div>
    );
}
