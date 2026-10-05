"use client";

import { useState } from "react";
import { Hourglass, Play, Plus, X, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { registrarLog } from "@/lib/proyecto-acciones";
import { aISO, diasDeEspera, fechaCorta, inicioDelProyecto, nuevoId } from "@/lib/proyecto-gestion";
import type { EsperaCliente } from "@/lib/types";
import { ui, type ProyectoCtx } from "./ctx";

const ORIGEN_LABEL: Record<EsperaCliente["origen"], string> = {
    brief: "Brief",
    solicitud: "Pedido",
    manual: "Manual",
};

const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? "" : "s"}`;

/**
 * Lo que el proyecto está esperando del cliente. Mientras haya algo abierto,
 * las fases pendientes y la entrega se corren un día por cada día de espera.
 */
export default function EsperasCliente({ ctx }: { ctx: ProyectoCtx }) {
    const { proyecto } = ctx;
    const hoy = aISO(new Date());
    const inicio = inicioDelProyecto(proyecto, hoy);
    const esperas = proyecto.esperas_cliente || [];
    const abiertas = esperas.filter((e) => !e.hasta);
    const cerradas = esperas.filter((e) => e.hasta);
    const corridos = proyecto.dias_espera_aplicados || 0;

    const [form, setForm] = useState<{ motivo: string; desde: string } | null>(null);
    const [verHistorial, setVerHistorial] = useState(false);
    const [ocupado, setOcupado] = useState(false);

    const editar = async (fn: (es: EsperaCliente[]) => EsperaCliente[], mensaje?: string) => {
        setOcupado(true);
        try { return await ctx.sincronizarEsperas(fn, mensaje); }
        finally { setOcupado(false); }
    };

    const pausar = async () => {
        if (!form?.motivo.trim()) return;
        const motivo = form.motivo.trim();
        const desde = form.desde && form.desde <= hoy ? form.desde : hoy;
        const ok = await editar(
            (es) => [...es, { id: nuevoId("e"), motivo, origen: "manual", desde, hasta: null }],
            "Proyecto en pausa: los plazos se corren hasta que llegue lo del cliente"
        );
        if (ok) {
            setForm(null);
            registrarLog(proyecto.id, `En pausa esperando al cliente: ${motivo}`);
        }
    };

    const reanudar = async (e: EsperaCliente) => {
        const dias = diasDeEspera([e], inicio, hoy);
        const ok = await editar(
            (es) => es.map((x) => (x.id === e.id ? { ...x, hasta: hoy } : x)),
            `Listo. Los plazos quedaron corridos ${plural(dias, "día")}`
        );
        if (!ok) return;
        const detalle = dias > 0 ? `Se esperó ${plural(dias, "día")}; los plazos se corrieron en consecuencia.` : "";
        registrarLog(proyecto.id, e.origen === "brief" ? "Se sigue sin esperar el brief" : `Se recibió del cliente: ${e.motivo}`, detalle);
    };

    // "No frenaba": la espera deja de contar y los plazos vuelven atrás.
    // La del brief se cierra sin días (si se borrara, se volvería a abrir sola).
    const quitar = (e: EsperaCliente) => {
        if (!confirm(`¿"${e.motivo}" no frena el proyecto? Los días que se corrieron por esta espera vuelven atrás.`)) return;
        editar(
            (es) => (e.origen === "brief" ? es.map((x) => (x.id === e.id ? { ...x, hasta: x.desde } : x)) : es.filter((x) => x.id !== e.id)),
            "Espera quitada"
        );
    };

    const cambiarDesde = (e: EsperaCliente, desde: string) => {
        if (!desde || desde > hoy) return;
        editar((es) => es.map((x) => (x.id === e.id ? { ...x, desde } : x)), "Fecha de la espera actualizada");
    };

    if (abiertas.length === 0 && !form) {
        return (
            <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 rounded-2xl border border-border bg-card">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Hourglass className="w-4 h-4 text-violet-400 shrink-0" />
                    {corridos > 0
                        ? <>Por esperas al cliente los plazos ya se corrieron <strong className="text-foreground">{plural(corridos, "día")}</strong>.</>
                        : "¿Falta algo del cliente para poder avanzar? Pausá los plazos hasta que llegue."}
                    {cerradas.length > 0 && (
                        <button onClick={() => setVerHistorial(!verHistorial)} className="text-[11px] font-bold text-violet-300 hover:underline">
                            {verHistorial ? "Ocultar" : "Ver"} historial
                        </button>
                    )}
                </p>
                <button onClick={() => setForm({ motivo: "", desde: hoy })} className={cn(ui.btn, "bg-violet-500/15 text-violet-300 border border-violet-500/30 hover:bg-violet-500/25")}>
                    <Hourglass className="w-3.5 h-3.5" /> Esperando al cliente
                </button>
                {verHistorial && <Historial cerradas={cerradas} inicio={inicio} hoy={hoy} />}
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-violet-500/40 bg-violet-500/5 p-4 sm:p-5 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h3 className="text-sm font-bold text-violet-200 flex items-center gap-2"><Hourglass className="w-4 h-4" /> Esperando al cliente</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        Mientras falte, las fases pendientes, sus tareas y la entrega se corren un día por cada día de espera.
                        {corridos > 0 && <> En total ya se corrieron <strong className="text-foreground">{plural(corridos, "día")}</strong>.</>}
                    </p>
                </div>
                {!form && (
                    <button onClick={() => setForm({ motivo: "", desde: hoy })} className={cn(ui.btn, ui.btnGhost)}><Plus className="w-3.5 h-3.5" /> Otra espera</button>
                )}
            </div>

            {abiertas.length > 0 && (
                <div className="space-y-2">
                    {abiertas.map((e) => {
                        const dias = diasDeEspera([e], inicio, hoy);
                        return (
                            <div key={e.id} className="flex items-center gap-2 flex-wrap p-3 rounded-xl border border-violet-500/30 bg-card">
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-bold uppercase shrink-0">{ORIGEN_LABEL[e.origen]}</span>
                                <div className="flex-1 min-w-[140px]">
                                    <p className="text-xs font-bold text-foreground">{e.motivo}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {dias > 0 ? `Hace ${plural(dias, "día")}` : "Desde hoy"}
                                        {e.desde < inicio && " · cuenta desde el inicio del proyecto"}
                                    </p>
                                </div>
                                <label className="flex items-center gap-1 text-[10px] text-muted-foreground" title="Desde cuándo se espera">
                                    Desde
                                    <input type="date" value={e.desde} max={hoy} disabled={ocupado} onChange={(ev) => cambiarDesde(e, ev.target.value)} className="h-7 px-1.5 rounded-lg bg-background border border-border text-[11px] text-foreground" />
                                </label>
                                <button onClick={() => reanudar(e)} disabled={ocupado} className={cn(ui.btn, "bg-emerald-500 text-slate-950 hover:bg-emerald-400")} title={e.origen === "brief" ? "Seguir sin esperar el brief" : "Ya llegó: reanudar"}>
                                    <Play className="w-3.5 h-3.5" /> {e.origen === "brief" ? "Seguir sin esperar" : "Ya llegó"}
                                </button>
                                <button onClick={() => quitar(e)} disabled={ocupado} className="p-1 text-muted-foreground hover:text-rose-400" title="No frenaba: quitar y volver atrás los plazos">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {form && (
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                    <input autoFocus value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} onKeyDown={(e) => e.key === "Enter" && pausar()} placeholder="Qué falta (ej: Aprobación del diseño, accesos al hosting)…" className={ui.input} />
                    <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        Desde
                        <input type="date" value={form.desde} max={hoy} onChange={(e) => setForm({ ...form, desde: e.target.value })} className="h-9 px-2 rounded-xl bg-background border border-border text-xs text-foreground" />
                    </label>
                    <button onClick={pausar} disabled={ocupado || !form.motivo.trim()} className={cn(ui.btn, "py-2 bg-violet-500 text-white hover:bg-violet-400")}><Hourglass className="w-3.5 h-3.5" /> Pausar plazos</button>
                    <button onClick={() => setForm(null)} className={cn(ui.btn, ui.btnGhost)}>Cancelar</button>
                </div>
            )}

            {cerradas.length > 0 && (
                <div>
                    <button onClick={() => setVerHistorial(!verHistorial)} className="text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1">
                        {verHistorial ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />} Esperas anteriores ({cerradas.length})
                    </button>
                    {verHistorial && <Historial cerradas={cerradas} inicio={inicio} hoy={hoy} />}
                </div>
            )}
        </div>
    );
}

function Historial({ cerradas, inicio, hoy }: { cerradas: EsperaCliente[]; inicio: string; hoy: string }) {
    return (
        <div className="w-full space-y-1 pt-2">
            {cerradas.map((e) => {
                const dias = diasDeEspera([e], inicio, hoy);
                return (
                    <div key={e.id} className="flex items-center justify-between gap-2 text-[11px] px-2 py-1.5 rounded-lg bg-secondary/30">
                        <span className="text-foreground truncate">{e.motivo}</span>
                        <span className="text-muted-foreground shrink-0">{fechaCorta(e.desde)} → {fechaCorta(e.hasta)} · {plural(dias, "día")}</span>
                    </div>
                );
            })}
        </div>
    );
}
