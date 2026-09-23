"use client";

import { useState } from "react";
import { Check, Plus, Sparkles, Trash2, Loader2, Wand2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { tareasStore, mensajeError } from "@/lib/store";
import { cargarChecklistFase } from "@/lib/proyecto-acciones";
import { briefAMarkdown, tareasPlantillaDeFase, configDeFase, fechaCorta } from "@/lib/proyecto-gestion";
import type { FaseProyecto, TareaPlantilla, Prioridad } from "@/lib/types";
import { PRIORIDAD_COLORS } from "@/lib/types";
import { ui, type ProyectoCtx } from "./ctx";

const normal = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function ChecklistFase({ ctx, fase, compacto = false }: { ctx: ProyectoCtx; fase: FaseProyecto; compacto?: boolean }) {
    const { proyecto, tareas, setTareas, cliente } = ctx;
    const [nueva, setNueva] = useState("");
    const [prioridad, setPrioridad] = useState<Prioridad>("media");
    const [cargando, setCargando] = useState(false);
    const [pensando, setPensando] = useState(false);
    const [sugerencias, setSugerencias] = useState<TareaPlantilla[]>([]);

    const delaFase = tareas
        .filter((t) => t.fase === fase.nombre)
        .sort((a, b) => Number(a.estado === "completada") - Number(b.estado === "completada") || a.created_at.localeCompare(b.created_at));
    const hechas = delaFase.filter((t) => t.estado === "completada").length;
    const titulosExistentes = new Set(tareas.map((t) => normal(t.titulo)));
    const recomendadas = tareasPlantillaDeFase(proyecto.tipo_proyecto, fase.nombre).filter((t) => !titulosExistentes.has(normal(t.titulo)));
    const sugeridasPendientes = sugerencias.filter((t) => !titulosExistentes.has(normal(t.titulo)));

    const toggle = async (id: string) => {
        const t = tareas.find((x) => x.id === id);
        if (!t) return;
        const estado = t.estado === "completada" ? "pendiente" : "completada";
        setTareas(tareas.map((x) => (x.id === id ? { ...x, estado } : x)));
        try { await tareasStore.update(id, { estado }); }
        catch (e) { toast.error("No se pudo actualizar: " + mensajeError(e)); ctx.recargar("tareas"); }
    };

    const borrar = async (id: string) => {
        setTareas(tareas.filter((x) => x.id !== id));
        try { await tareasStore.delete(id); } catch { ctx.recargar("tareas"); }
    };

    const agregar = async () => {
        if (!nueva.trim()) return;
        try {
            const creada = await tareasStore.create({
                proyecto_id: proyecto.id, titulo: nueva.trim(), descripcion: "", prioridad, estado: "pendiente",
                categoria: "otro", fase: fase.nombre, ...(fase.fecha_limite ? { fecha_vencimiento: fase.fecha_limite } : {}),
            });
            setTareas([creada, ...tareas]);
            setNueva("");
        } catch (e) { toast.error("Error al crear tarea: " + mensajeError(e)); }
    };

    const cargar = async (plantillas: TareaPlantilla[]) => {
        setCargando(true);
        try {
            const creadas = await cargarChecklistFase(proyecto, fase, tareas, plantillas);
            setTareas([...creadas, ...tareas]);
            toast.success(creadas.length ? `${creadas.length} tareas agregadas a "${fase.nombre}"` : "Ya estaban todas cargadas");
        } catch (e) { toast.error("Error al cargar tareas: " + mensajeError(e)); }
        finally { setCargando(false); }
    };

    const sugerirIA = async () => {
        setPensando(true);
        try {
            const res = await fetch("/api/gemini/tareas-fase", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fase: fase.nombre,
                    descripcionFase: configDeFase(proyecto.tipo_proyecto, fase.nombre)?.descripcion,
                    tipo: proyecto.tipo_proyecto,
                    nombre: proyecto.nombre,
                    descripcion: proyecto.descripcion,
                    briefResumen: proyecto.brief && proyecto.brief.estado !== "borrador" ? briefAMarkdown(proyecto.brief, proyecto, cliente) : "",
                    existentes: tareas.map((t) => t.titulo),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error de IA");
            setSugerencias(data.tareas);
            toast.success(`${data.tareas.length} tareas sugeridas`);
        } catch (e) { toast.error(mensajeError(e)); }
        finally { setPensando(false); }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[11px] text-muted-foreground">
                    <strong className="text-foreground">{hechas}/{delaFase.length}</strong> tareas hechas
                    {fase.fecha_limite && <> · plazo <strong className="text-foreground">{fechaCorta(fase.fecha_limite)}</strong></>}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                    {recomendadas.length > 0 && (
                        <button disabled={cargando} onClick={() => cargar(recomendadas)} className={cn(ui.btn, ui.btnSecondary)}>
                            {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListChecks className="w-3.5 h-3.5 text-primary" />}
                            Cargar recomendadas ({recomendadas.length})
                        </button>
                    )}
                    <button disabled={pensando} onClick={sugerirIA} className={cn(ui.btn, ui.btnSecondary)} title="La IA arma tareas específicas para este proyecto usando la descripción y el brief">
                        {pensando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                        Sugerir con IA
                    </button>
                </div>
            </div>

            <div className="space-y-1.5">
                {delaFase.map((t) => {
                    const hecha = t.estado === "completada";
                    return (
                        <div key={t.id} className={cn("group flex items-start gap-2.5 p-2.5 rounded-xl border transition-all", hecha ? "bg-emerald-500/5 border-emerald-500/15" : "bg-secondary/30 border-border hover:border-primary/30")}>
                            <button onClick={() => toggle(t.id)} className={cn("mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border shrink-0 transition-all", hecha ? "bg-emerald-500 border-emerald-400 text-slate-950" : "bg-card border-border hover:border-primary")}>
                                {hecha && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>
                            <div className="min-w-0 flex-1">
                                <p className={cn("text-xs font-semibold", hecha ? "line-through text-muted-foreground" : "text-foreground")}>{t.titulo}</p>
                                {!compacto && t.descripcion && !hecha && <p className="text-[11px] text-muted-foreground mt-0.5">{t.descripcion}</p>}
                            </div>
                            {!hecha && (
                                <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border shrink-0", PRIORIDAD_COLORS[t.prioridad])}>{t.prioridad}</span>
                            )}
                            <button onClick={() => borrar(t.id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-rose-400 shrink-0 transition-opacity">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    );
                })}
                {delaFase.length === 0 && (
                    <p className="text-xs text-muted-foreground italic py-2">
                        Todavía no hay tareas en esta fase. Cargá las recomendadas, pedile sugerencias a la IA o escribí la tuya abajo.
                    </p>
                )}
            </div>

            <div className="flex gap-2">
                <input
                    value={nueva}
                    onChange={(e) => setNueva(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }}
                    placeholder="Nueva tarea simple… (Enter para agregar)"
                    className={ui.input}
                />
                <select value={prioridad} onChange={(e) => setPrioridad(e.target.value as Prioridad)} className="h-9 px-2 rounded-xl bg-background border border-border text-xs text-foreground">
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                </select>
                <button onClick={agregar} className={cn(ui.btn, ui.btnPrimary, "shrink-0")}><Plus className="w-3.5 h-3.5" /></button>
            </div>

            {sugeridasPendientes.length > 0 && (
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5"><Wand2 className="w-3.5 h-3.5" /> Sugeridas por IA</p>
                        <div className="flex gap-1.5">
                            <button disabled={cargando} onClick={() => cargar(sugeridasPendientes)} className={cn(ui.btn, "bg-amber-500 text-slate-950 hover:bg-amber-400")}>Agregar todas</button>
                            <button onClick={() => setSugerencias([])} className={cn(ui.btn, ui.btnGhost)}>Descartar</button>
                        </div>
                    </div>
                    {sugeridasPendientes.map((s, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 text-xs">
                            <div className="min-w-0">
                                <p className="font-semibold text-foreground">{s.titulo}</p>
                                {s.descripcion && <p className="text-[11px] text-muted-foreground">{s.descripcion}</p>}
                            </div>
                            <button onClick={() => cargar([s])} className="text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-lg shrink-0">+ Agregar</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
