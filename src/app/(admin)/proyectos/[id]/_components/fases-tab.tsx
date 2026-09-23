"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Plus, Trash2, CalendarRange, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { tareasStore } from "@/lib/store";
import { fasesDe } from "@/lib/proyectos-estado";
import { aISO, distribuirPlazos, fasesIniciales, textoDiasFase } from "@/lib/proyecto-gestion";
import type { FaseProyecto } from "@/lib/types";
import { PRIORIDAD_COLORS } from "@/lib/types";
import { ui, type ProyectoCtx } from "./ctx";
import ChecklistFase from "./checklist-fase";
import { alternarFase } from "./acciones-fase";

export default function FasesTab({ ctx }: { ctx: ProyectoCtx }) {
    const { proyecto, tareas, setTareas } = ctx;
    const hoy = aISO(new Date());
    const fases = fasesDe(proyecto);
    const idxActual = fases.findIndex((f) => !f.completada);
    const [abiertas, setAbiertas] = useState<Set<number>>(new Set(idxActual >= 0 ? [idxActual] : []));
    const [nuevaFase, setNuevaFase] = useState("");

    const nombresFases = new Set(fases.map((f) => f.nombre));
    const sinFase = tareas.filter((t) => !t.fase || !nombresFases.has(t.fase));

    const guardarFases = (nuevas: FaseProyecto[], msg?: string) => ctx.guardarProyecto({ fases: nuevas }, msg);

    const toggleAbierta = (i: number) => {
        const s = new Set(abiertas);
        if (s.has(i)) s.delete(i); else s.add(i);
        setAbiertas(s);
    };

    const cambiarFecha = (i: number, fecha: string) => {
        guardarFases(fases.map((f, j) => (j === i ? { ...f, fecha_limite: fecha || null } : f)));
    };

    const redistribuir = () => {
        const inicio = proyecto.fecha_inicio || proyecto.created_at.slice(0, 10);
        if (!proyecto.fecha_entrega) { toast.error("Primero cargá la fecha de entrega (botón Editar proyecto)"); return; }
        guardarFases(distribuirPlazos(fases, proyecto.tipo_proyecto, inicio, proyecto.fecha_entrega), "Plazos de las fases recalculados");
    };

    const mover = (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= fases.length) return;
        const copia = [...fases];
        [copia[i], copia[j]] = [copia[j], copia[i]];
        guardarFases(copia);
    };

    const agregarFase = () => {
        const nombre = nuevaFase.trim();
        if (!nombre) return;
        if (nombresFases.has(nombre)) { toast.error("Ya existe una fase con ese nombre"); return; }
        guardarFases([...fases, { nombre, completada: false, fecha_limite: proyecto.fecha_entrega || null }], "Fase agregada");
        setNuevaFase("");
    };

    const borrarFase = (i: number) => {
        const f = fases[i];
        const cant = tareas.filter((t) => t.fase === f.nombre).length;
        if (!confirm(`¿Eliminar la fase "${f.nombre}"?${cant ? ` Sus ${cant} tareas quedan en "Sin fase".` : ""}`)) return;
        guardarFases(fases.filter((_, j) => j !== i), "Fase eliminada");
    };

    const aplicarPlantilla = () => {
        if (!confirm("Esto reemplaza las fases actuales por las de la plantilla. ¿Seguir?")) return;
        guardarFases(fasesIniciales(proyecto.tipo_proyecto, proyecto.fecha_inicio || proyecto.created_at.slice(0, 10), proyecto.fecha_entrega), "Plantilla aplicada");
    };

    const asignarFase = async (tareaId: string, fase: string) => {
        const f = fases.find((x) => x.nombre === fase);
        const cambios = { fase: fase || null, ...(f?.fecha_limite ? { fecha_vencimiento: f.fecha_limite } : {}) };
        setTareas(tareas.map((t) => (t.id === tareaId ? { ...t, ...cambios } : t)));
        try { await tareasStore.update(tareaId, cambios); } catch { toast.error("No se pudo mover la tarea"); ctx.recargar("tareas"); }
    };

    const toggleTarea = async (id: string) => {
        const t = tareas.find((x) => x.id === id);
        if (!t) return;
        const estado = t.estado === "completada" ? "pendiente" : "completada";
        setTareas(tareas.map((x) => (x.id === id ? { ...x, estado } : x)));
        try { await tareasStore.update(id, { estado }); } catch { ctx.recargar("tareas"); }
    };

    return (
        <div className="space-y-4">
            <div className={cn(ui.card, "flex items-center justify-between gap-3 flex-wrap")}>
                <div>
                    <h3 className="text-base font-bold text-foreground">Roadmap y checklist por fase</h3>
                    <p className="text-xs text-muted-foreground">Cada fase tiene su plazo y sus tareas. Al completar una fase se carga el checklist de la siguiente.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={redistribuir} className={cn(ui.btn, ui.btnSecondary)}><CalendarRange className="w-3.5 h-3.5 text-primary" /> Recalcular plazos</button>
                    <button onClick={aplicarPlantilla} className={cn(ui.btn, ui.btnSecondary)}><RotateCcw className="w-3.5 h-3.5" /> Plantilla</button>
                </div>
            </div>

            <div className="space-y-3">
                {fases.map((fase, i) => {
                    const abierta = abiertas.has(i);
                    const deFase = tareas.filter((t) => t.fase === fase.nombre);
                    const hechas = deFase.filter((t) => t.estado === "completada").length;
                    const dias = textoDiasFase(fase, hoy);
                    const esActual = i === idxActual;
                    return (
                        <div key={`${fase.nombre}-${i}`} className={cn("rounded-2xl border transition-all", fase.completada ? "bg-emerald-500/5 border-emerald-500/20" : esActual ? "bg-card border-amber-500/40 shadow-lg shadow-amber-500/5" : "bg-card border-border")}>
                            <div className="flex items-center gap-3 p-3 sm:p-4">
                                <button onClick={() => alternarFase(ctx, i)} title={fase.completada ? "Reabrir fase" : "Completar fase"} className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border font-bold text-xs transition-all", fase.completada ? "bg-emerald-500 text-slate-950 border-emerald-400" : "bg-secondary text-muted-foreground border-border hover:border-emerald-400")}>
                                    {fase.completada ? <Check className="w-4 h-4 stroke-[3]" /> : i + 1}
                                </button>
                                <button onClick={() => toggleAbierta(i)} className="flex-1 min-w-0 text-left">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={cn("text-sm font-bold", fase.completada ? "text-emerald-400" : "text-foreground")}>{fase.nombre}</span>
                                        {esActual && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold uppercase">Actual</span>}
                                        {dias && <span className={cn("text-[10px] font-bold", dias.vencida ? "text-rose-400" : "text-muted-foreground")}>{dias.texto}</span>}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="h-1 w-24 rounded-full bg-secondary overflow-hidden">
                                            <div className="h-full bg-emerald-500" style={{ width: `${deFase.length ? (hechas / deFase.length) * 100 : 0}%` }} />
                                        </div>
                                        <span className="text-[10px] text-muted-foreground">{hechas}/{deFase.length} tareas</span>
                                    </div>
                                </button>
                                <input
                                    type="date"
                                    value={fase.fecha_limite || ""}
                                    onChange={(e) => cambiarFecha(i, e.target.value)}
                                    className="hidden sm:block h-8 px-2 rounded-lg bg-background border border-border text-[11px] text-foreground"
                                    title="Plazo de la fase"
                                />
                                <div className="flex items-center">
                                    <button onClick={() => mover(i, -1)} className="p-1 text-muted-foreground hover:text-foreground"><ArrowUp className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => mover(i, 1)} className="p-1 text-muted-foreground hover:text-foreground"><ArrowDown className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => borrarFase(i)} className="p-1 text-muted-foreground hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => toggleAbierta(i)} className="p-1 text-muted-foreground">
                                        {abierta ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            {abierta && (
                                <div className="px-3 sm:px-4 pb-4 pt-1 border-t border-border/60 space-y-3">
                                    <label className="sm:hidden flex items-center gap-2 text-[11px] text-muted-foreground pt-2">
                                        Plazo:
                                        <input type="date" value={fase.fecha_limite || ""} onChange={(e) => cambiarFecha(i, e.target.value)} className="h-8 px-2 rounded-lg bg-background border border-border text-[11px] text-foreground" />
                                    </label>
                                    <div className="pt-2"><ChecklistFase ctx={ctx} fase={fase} /></div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="flex gap-2">
                <input value={nuevaFase} onChange={(e) => setNuevaFase(e.target.value)} onKeyDown={(e) => e.key === "Enter" && agregarFase()} placeholder="Nombre de una fase nueva…" className={ui.input} />
                <button onClick={agregarFase} className={cn(ui.btn, ui.btnPrimary, "shrink-0")}><Plus className="w-3.5 h-3.5" /> Fase</button>
            </div>

            {sinFase.length > 0 && (
                <div className={cn(ui.card, "space-y-2")}>
                    <h3 className={ui.h3}>Tareas sin fase ({sinFase.length})</h3>
                    <p className="text-[11px] text-muted-foreground">Asignalas a una fase para que aparezcan en su checklist.</p>
                    {sinFase.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 p-2 rounded-xl bg-secondary/30 border border-border">
                            <button onClick={() => toggleTarea(t.id)} className={cn("w-5 h-5 rounded-md flex items-center justify-center border shrink-0", t.estado === "completada" ? "bg-emerald-500 border-emerald-400 text-slate-950" : "bg-card border-border")}>
                                {t.estado === "completada" && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>
                            <span className={cn("text-xs flex-1 truncate", t.estado === "completada" ? "line-through text-muted-foreground" : "text-foreground font-semibold")}>{t.titulo}</span>
                            <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border", PRIORIDAD_COLORS[t.prioridad])}>{t.prioridad}</span>
                            <select value="" onChange={(e) => asignarFase(t.id, e.target.value)} className="h-7 px-1.5 rounded-lg bg-background border border-border text-[11px] text-foreground max-w-[120px]">
                                <option value="">Mover a…</option>
                                {fases.map((f) => <option key={f.nombre} value={f.nombre}>{f.nombre}</option>)}
                            </select>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
