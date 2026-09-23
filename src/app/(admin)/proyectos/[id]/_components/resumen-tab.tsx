"use client";

import {
    CalendarClock, Zap, DollarSign, Users, ChevronRight, CheckCircle2, AlertTriangle,
    ClipboardList, Inbox, ScrollText, ArrowRight,
} from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { fasesDe } from "@/lib/proyectos-estado";
import {
    aISO, fechaCorta, infoPlazo, progresoBrief, resumenCobros, textoDiasFase, ESTADO_PLAZO_COLORS,
} from "@/lib/proyecto-gestion";
import { ui, type ProyectoCtx } from "./ctx";
import ChecklistFase from "./checklist-fase";
import { alternarFase } from "./acciones-fase";

export default function ResumenTab({ ctx }: { ctx: ProyectoCtx }) {
    const { proyecto, tareas, finanzas, archivos, solicitudes, logs } = ctx;
    const hoy = aISO(new Date());
    const fases = fasesDe(proyecto);
    const completadas = fases.filter((f) => f.completada).length;
    const progreso = fases.length ? Math.round((completadas / fases.length) * 100) : 0;
    const idxActual = fases.findIndex((f) => !f.completada);
    const faseActual = idxActual >= 0 ? fases[idxActual] : null;
    const plazo = infoPlazo(proyecto, progreso, hoy);
    const cobros = resumenCobros(finanzas, Number(proyecto.monto_total) || 0, hoy);
    const brief = progresoBrief(proyecto.brief);
    const solicitudesPend = solicitudes.filter((s) => s.estado === "pendiente");
    const entregasNuevas = solicitudes.filter((s) => s.estado === "entregada");
    const archivosCliente = archivos.filter((a) => a.subido_por === "cliente");
    const tareasVencidas = tareas.filter((t) => t.estado !== "completada" && t.fecha_vencimiento && t.fecha_vencimiento < hoy);
    const tareasFaseActual = faseActual ? tareas.filter((t) => t.fase === faseActual.nombre) : [];
    const faseLista = tareasFaseActual.length > 0 && tareasFaseActual.every((t) => t.estado === "completada");

    const alertas: { texto: string; accion?: () => void; tono: "rose" | "amber" | "cyan" }[] = [];
    if (plazo.estado === "vencido") alertas.push({ texto: `La entrega venció el ${fechaCorta(proyecto.fecha_entrega)}. Reprogramá o cerrá el proyecto.`, tono: "rose" });
    if (plazo.estado === "atrasado") alertas.push({ texto: `Pasó el ${plazo.pctTiempo}% del tiempo y el avance es ${progreso}%.`, tono: "amber", accion: () => ctx.irA("fases") });
    if (!proyecto.fecha_entrega) alertas.push({ texto: "El proyecto no tiene fecha de entrega.", tono: "amber" });
    if (tareasVencidas.length) alertas.push({ texto: `${tareasVencidas.length} tarea${tareasVencidas.length > 1 ? "s" : ""} vencida${tareasVencidas.length > 1 ? "s" : ""}.`, tono: "rose", accion: () => ctx.irA("fases") });
    if (cobros.vencidos.length) alertas.push({ texto: `${cobros.vencidos.length} cobro${cobros.vencidos.length > 1 ? "s" : ""} vencido${cobros.vencidos.length > 1 ? "s" : ""} por ${formatCurrency(cobros.vencidos.reduce((s, f) => s + Number(f.monto), 0))}.`, tono: "rose", accion: () => ctx.irA("finanzas") });
    if (!proyecto.monto_total && !finanzas.length) alertas.push({ texto: "No cargaste cuánto cobrás por este proyecto.", tono: "amber", accion: () => ctx.irA("finanzas") });
    if (proyecto.brief?.estado === "borrador") alertas.push({ texto: "El brief todavía no se envió al cliente.", tono: "cyan", accion: () => ctx.irA("brief") });
    if (proyecto.brief?.estado === "completado" && !(proyecto.documentos || []).some((d) => d.id === "doc_contexto")) alertas.push({ texto: "El cliente completó el brief: generá el CONTEXTO.md para desarrollar.", tono: "cyan", accion: () => ctx.irA("brief") });
    if (entregasNuevas.length) alertas.push({ texto: `El cliente entregó ${entregasNuevas.length} pedido${entregasNuevas.length > 1 ? "s" : ""} para revisar.`, tono: "cyan", accion: () => ctx.irA("archivos") });

    const tonoCls = { rose: "border-rose-500/30 bg-rose-500/5 text-rose-300", amber: "border-amber-500/30 bg-amber-500/5 text-amber-300", cyan: "border-cyan-500/30 bg-cyan-500/5 text-cyan-300" };

    return (
        <div className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {/* Plazo */}
                <div className={cn("rounded-2xl border p-4 space-y-2", ESTADO_PLAZO_COLORS[plazo.estado])}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"><CalendarClock className="w-4 h-4" /> Entrega</span>
                        <span className="text-[10px] font-bold">{proyecto.fecha_entrega ? fechaCorta(proyecto.fecha_entrega) : "—"}</span>
                    </div>
                    <p className="text-2xl font-black text-foreground">{plazo.diasRestantes !== null && plazo.diasRestantes >= 0 ? `${plazo.diasRestantes} días` : plazo.texto}</p>
                    {plazo.pctTiempo !== null && (
                        <div className="space-y-1">
                            <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
                                <div className="absolute inset-y-0 left-0 bg-foreground/25" style={{ width: `${plazo.pctTiempo}%` }} />
                                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-cyan-400 rounded-full" style={{ width: `${progreso}%`, height: "50%", top: "25%" }} />
                            </div>
                            <p className="text-[10px] text-muted-foreground">Tiempo usado {plazo.pctTiempo}% · Avance {progreso}%</p>
                        </div>
                    )}
                </div>

                {/* Progreso */}
                <button onClick={() => ctx.irA("fases")} className="text-left rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-4 space-y-2 hover:border-primary/60 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5"><Zap className="w-4 h-4" /> Avance</span>
                        <ChevronRight className="w-4 h-4 text-primary" />
                    </div>
                    <p className="text-2xl font-black text-foreground">{progreso}%</p>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400" style={{ width: `${progreso}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{completadas} de {fases.length} fases · {tareas.filter((t) => t.estado !== "completada").length} tareas pendientes</p>
                </button>

                {/* Cobros */}
                <button onClick={() => ctx.irA("finanzas")} className="text-left rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2 hover:border-emerald-500/60 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5"><DollarSign className="w-4 h-4" /> Cobrado</span>
                        <ChevronRight className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-2xl font-black text-foreground">{formatCurrency(cobros.cobrado)}<span className="text-xs text-muted-foreground font-bold"> / {formatCurrency(cobros.total)}</span></p>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${cobros.pctCobrado}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                        {cobros.proximo ? <>Próximo: <strong className="text-foreground">{formatCurrency(Number(cobros.proximo.monto))}</strong> el {fechaCorta(cobros.proximo.fecha_cobro)}</> : cobros.total > 0 ? "Sin cobros pendientes" : "Sin monto cargado"}
                    </p>
                </button>

                {/* Cliente */}
                <button onClick={() => ctx.irA(proyecto.brief?.estado === "completado" ? "archivos" : "brief")} className="text-left rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-2 hover:border-cyan-500/60 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5"><Users className="w-4 h-4" /> Cliente</span>
                        <ChevronRight className="w-4 h-4 text-cyan-400" />
                    </div>
                    <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <ClipboardList className="w-4 h-4 text-cyan-400" />
                        Brief: {proyecto.brief ? (proyecto.brief.estado === "completado" ? "completo" : `${brief.pct}% ${proyecto.brief.estado === "enviado" ? "(enviado)" : "(borrador)"}`) : "sin crear"}
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Inbox className="w-3.5 h-3.5" /> {solicitudesPend.length} pedidos pendientes · {entregasNuevas.length} por revisar</p>
                    <p className="text-[11px] text-muted-foreground">{archivosCliente.length} archivos subidos por el cliente</p>
                </button>
            </div>

            {/* Alertas */}
            {alertas.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {alertas.map((a, i) => (
                        <button key={i} onClick={a.accion} disabled={!a.accion} className={cn("flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold text-left", tonoCls[a.tono], a.accion && "hover:brightness-125")}>
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span className="flex-1">{a.texto}</span>
                            {a.accion && <ArrowRight className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Fase actual con checklist */}
                <div className={cn(ui.card, "lg:col-span-2 space-y-4 border-amber-500/30")}>
                    {faseActual ? (
                        <>
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Fase actual · {idxActual + 1} de {fases.length}</p>
                                    <h3 className="text-lg font-black text-foreground">{faseActual.nombre}</h3>
                                    {(() => {
                                        const d = textoDiasFase(faseActual, hoy);
                                        return d ? <p className={cn("text-xs font-bold", d.vencida ? "text-rose-400" : "text-muted-foreground")}>{d.texto}</p> : null;
                                    })()}
                                </div>
                                <button
                                    onClick={() => alternarFase(ctx, idxActual)}
                                    className={cn(ui.btn, "px-4 py-2", faseLista ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400 animate-pulse-soft" : "bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25")}
                                >
                                    <CheckCircle2 className="w-4 h-4" /> Completar fase
                                </button>
                            </div>
                            <ChecklistFase ctx={ctx} fase={faseActual} compacto />
                        </>
                    ) : (
                        <div className="py-10 text-center space-y-2">
                            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                            <p className="text-sm font-bold text-foreground">Todas las fases completadas</p>
                            {proyecto.estado !== "finalizado" && (
                                <button onClick={() => ctx.guardarProyecto({ estado: "finalizado" }, "Proyecto finalizado")} className={cn(ui.btn, ui.btnPrimary)}>Marcar proyecto como finalizado</button>
                            )}
                        </div>
                    )}
                </div>

                {/* Roadmap compacto + actividad */}
                <div className="space-y-5">
                    <div className={cn(ui.card, "space-y-2")}>
                        <h3 className={ui.h3}>Roadmap</h3>
                        {fases.map((f, i) => {
                            const d = textoDiasFase(f, hoy);
                            return (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                    <span className={cn("w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold border shrink-0",
                                        f.completada ? "bg-emerald-500 text-slate-950 border-emerald-400" : i === idxActual ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "bg-secondary text-muted-foreground border-border")}>
                                        {f.completada ? "✓" : i + 1}
                                    </span>
                                    <span className={cn("flex-1 truncate", f.completada ? "text-muted-foreground line-through" : "text-foreground font-semibold")}>{f.nombre}</span>
                                    <span className={cn("text-[10px] shrink-0", d?.vencida ? "text-rose-400 font-bold" : "text-muted-foreground")}>
                                        {f.completada ? fechaCorta(f.fecha_completada) : f.fecha_limite ? fechaCorta(f.fecha_limite) : ""}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    <div className={cn(ui.card, "space-y-2")}>
                        <div className="flex items-center justify-between">
                            <h3 className={ui.h3}><ScrollText className="w-4 h-4 text-primary" /> Actividad</h3>
                            <button onClick={() => ctx.irA("novedades")} className="text-[10px] font-bold text-primary hover:underline">Ver todo</button>
                        </div>
                        {logs.slice(0, 5).map((l) => (
                            <div key={l.id} className="text-xs border-l-2 border-primary/40 pl-2">
                                <p className="font-semibold text-foreground">{l.titulo}</p>
                                <p className="text-[10px] text-muted-foreground">{formatDate(l.fecha)}</p>
                            </div>
                        ))}
                        {logs.length === 0 && <p className="text-xs text-muted-foreground italic">Sin actividad todavía.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
