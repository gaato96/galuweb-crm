"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Paperclip, Send, Upload, X, CheckCircle2, Cloud } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { archivosProyectoStore, logsProyectoStore, proyectosStore, storageStore, mensajeError } from "@/lib/store";
import { aISO, progresoBrief, tieneRespuesta } from "@/lib/proyecto-gestion";
import type { BriefPregunta, BriefProyecto, Proyecto } from "@/lib/types";

/** Aplica las respuestas locales sobre la versión más nueva del brief (por si la agencia editó preguntas). */
function aplicarRespuestas(base: BriefProyecto, local: BriefProyecto): BriefProyecto {
    const resp = new Map<string, BriefPregunta["respuesta"]>();
    local.secciones.forEach((s) => s.preguntas.forEach((q) => { if (q.respuesta !== undefined) resp.set(q.id, q.respuesta); }));
    return {
        ...base,
        estado: local.estado,
        completado_at: local.completado_at,
        actualizado_at: new Date().toISOString(),
        secciones: base.secciones.map((s) => ({ ...s, preguntas: s.preguntas.map((q) => (resp.has(q.id) ? { ...q, respuesta: resp.get(q.id) } : q)) })),
    };
}

const campoCls = "w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 transition";

function Pregunta({ q, proyecto, onChange }: { q: BriefPregunta; proyecto: Proyecto; onChange: (r: BriefPregunta["respuesta"]) => void }) {
    const [subiendo, setSubiendo] = useState(false);
    const lista = Array.isArray(q.respuesta) ? q.respuesta : q.respuesta ? [String(q.respuesta)] : [];

    const subir = async (files: FileList | null) => {
        if (!files?.length) return;
        setSubiendo(true);
        const urls: string[] = [];
        for (const file of Array.from(files)) {
            try {
                const url = await storageStore.uploadArchivoProyecto(file, proyecto.id);
                urls.push(url);
                await archivosProyectoStore.create({
                    proyecto_id: proyecto.id, nombre: file.name, url,
                    categoria: /logo/i.test(file.name) || /logo/i.test(q.pregunta) ? "logo" : file.type.startsWith("image/") ? "imagen" : "documento",
                    subido_por: "cliente", visible_cliente: true, solicitud_id: null, mime: file.type || "", tamano: file.size,
                });
            } catch (e) { toast.error(`${file.name}: ${mensajeError(e)}`); }
        }
        setSubiendo(false);
        if (urls.length) onChange([...lista, ...urls]);
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">
                {q.pregunta}{q.requerida && <span className="text-amber-400"> *</span>}
            </label>
            {q.ayuda && <p className="text-xs text-muted-foreground -mt-1">{q.ayuda}</p>}

            {q.tipo === "texto" && (
                <input value={String(q.respuesta || "")} onChange={(e) => onChange(e.target.value)} className={campoCls} />
            )}
            {q.tipo === "parrafo" && (
                <textarea value={String(q.respuesta || "")} onChange={(e) => onChange(e.target.value)} rows={4} className={cn(campoCls, "resize-y")} />
            )}
            {q.tipo === "opcion" && (
                <div className="flex flex-wrap gap-2">
                    {(q.opciones || []).map((o) => {
                        const activa = q.respuesta === o;
                        return (
                            <button key={o} type="button" onClick={() => onChange(activa ? "" : o)} className={cn("px-3.5 py-2 rounded-xl border text-sm transition", activa ? "bg-amber-400 text-slate-950 border-amber-400 font-bold" : "border-white/10 bg-white/[0.03] text-foreground hover:border-amber-400/50")}>
                                {o}
                            </button>
                        );
                    })}
                </div>
            )}
            {q.tipo === "multiple" && (
                <div className="flex flex-wrap gap-2">
                    {(q.opciones || []).map((o) => {
                        const activa = lista.includes(o);
                        return (
                            <button key={o} type="button" onClick={() => onChange(activa ? lista.filter((x) => x !== o) : [...lista, o])} className={cn("px-3.5 py-2 rounded-xl border text-sm transition flex items-center gap-1.5", activa ? "bg-amber-400/15 text-amber-300 border-amber-400/60 font-bold" : "border-white/10 bg-white/[0.03] text-foreground hover:border-amber-400/50")}>
                                {activa && <Check className="w-3.5 h-3.5" />} {o}
                            </button>
                        );
                    })}
                </div>
            )}
            {q.tipo === "archivo" && (
                <div className="space-y-2">
                    <label className="flex items-center justify-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] text-sm text-muted-foreground hover:border-amber-400/50 hover:text-amber-300 cursor-pointer transition">
                        {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {subiendo ? "Subiendo…" : "Tocá para subir archivos"}
                        <input type="file" multiple className="hidden" onChange={(e) => { subir(e.target.files); e.target.value = ""; }} />
                    </label>
                    {lista.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {lista.map((url, i) => (
                                <div key={url} className="relative group">
                                    {/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url)
                                        ? <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-white/10" />
                                        : <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 h-16 rounded-lg border border-white/10 text-xs text-amber-300"><Paperclip className="w-3.5 h-3.5" /> Archivo {i + 1}</a>}
                                    <button type="button" onClick={() => onChange(lista.filter((x) => x !== url))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><X className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function BriefForm({ proyecto, slug, onCompletado }: { proyecto: Proyecto; slug: string; onCompletado: () => void }) {
    const [brief, setBrief] = useState<BriefProyecto>(proyecto.brief!);
    const [paso, setPaso] = useState(0);
    const [estadoGuardado, setEstadoGuardado] = useState<"guardado" | "pendiente" | "guardando" | "error">("guardado");
    const [enviando, setEnviando] = useState(false);
    const [editandoCompletado, setEditandoCompletado] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const ultimo = useRef(brief);

    const persistir = async (local: BriefProyecto): Promise<boolean> => {
        setEstadoGuardado("guardando");
        try {
            const fresco = await proyectosStore.getPortal(slug);
            const final = aplicarRespuestas(fresco?.brief || local, local);
            await proyectosStore.updateSinRetorno(proyecto.id, { brief: final });
            setEstadoGuardado("guardado");
            return true;
        } catch (e) {
            console.error(e);
            setEstadoGuardado("error");
            return false;
        }
    };

    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    const responder = (qid: string, r: BriefPregunta["respuesta"]) => {
        const nuevo: BriefProyecto = {
            ...brief,
            secciones: brief.secciones.map((s) => ({ ...s, preguntas: s.preguntas.map((q) => (q.id === qid ? { ...q, respuesta: r } : q)) })),
        };
        setBrief(nuevo);
        ultimo.current = nuevo;
        setEstadoGuardado("pendiente");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => persistir(ultimo.current), 1200);
    };

    const progreso = progresoBrief(brief);
    const secciones = brief.secciones;
    const seccion = secciones[paso];
    const esUltimo = paso === secciones.length - 1;

    const enviar = async () => {
        if (progreso.faltanRequeridas.length) {
            const idx = secciones.findIndex((s) => s.preguntas.some((q) => q.requerida && !tieneRespuesta(q)));
            if (idx >= 0) setPaso(idx);
            toast.error(`Faltan ${progreso.faltanRequeridas.length} preguntas obligatorias (marcadas con *)`);
            return;
        }
        setEnviando(true);
        if (timer.current) clearTimeout(timer.current);
        const final: BriefProyecto = { ...ultimo.current, estado: "completado", completado_at: new Date().toISOString() };
        const ok = await persistir(final);
        setEnviando(false);
        if (!ok) { toast.error("No se pudo enviar. Revisá tu conexión y probá de nuevo."); return; }
        setBrief(final);
        setEditandoCompletado(false);
        logsProyectoStore.create({
            proyecto_id: proyecto.id, titulo: "El cliente completó el brief",
            descripcion: `${progreso.respondidas} de ${progreso.total} preguntas respondidas.`, fecha: aISO(new Date()),
        }).catch(() => {});
        toast.success("¡Gracias! Recibimos tus respuestas.");
        onCompletado();
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    if (brief.estado === "completado" && !editandoCompletado) {
        return (
            <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h3 className="text-xl font-bold text-foreground">¡Brief completo!</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">Ya tenemos todo lo que necesitamos para arrancar. Si te acordás de algo más, podés editar tus respuestas cuando quieras.</p>
                <button onClick={() => { setEditandoCompletado(true); setPaso(0); }} className="px-4 py-2 rounded-xl border border-white/10 text-sm text-foreground hover:border-amber-400/50">Editar respuestas</button>
            </div>
        );
    }

    if (!seccion) return null;

    return (
        <div className="space-y-5">
            {brief.intro && paso === 0 && <p className="text-sm text-muted-foreground leading-relaxed">{brief.intro}</p>}

            {/* Progreso */}
            <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Paso <strong className="text-foreground">{paso + 1}</strong> de {secciones.length} · {progreso.respondidas}/{progreso.total} respondidas</span>
                    <span className={cn("flex items-center gap-1", estadoGuardado === "error" ? "text-rose-400" : "text-muted-foreground")}>
                        {estadoGuardado === "guardando" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Cloud className="w-3 h-3" />}
                        {estadoGuardado === "guardado" ? "Guardado" : estadoGuardado === "guardando" ? "Guardando…" : estadoGuardado === "pendiente" ? "Sin guardar" : "Error al guardar"}
                    </span>
                </div>
                <div className="flex gap-1">
                    {secciones.map((s, i) => {
                        const completa = s.preguntas.every((q) => !q.requerida || tieneRespuesta(q)) && s.preguntas.some(tieneRespuesta);
                        return (
                            <button key={s.id} onClick={() => setPaso(i)} title={s.titulo} className={cn("h-1.5 flex-1 rounded-full transition", i === paso ? "bg-amber-400" : completa ? "bg-emerald-500/70" : "bg-white/10")} />
                        );
                    })}
                </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-card/80 p-5 sm:p-7 space-y-6">
                <div>
                    <h3 className="text-lg sm:text-xl font-bold text-foreground">{seccion.titulo}</h3>
                    {seccion.descripcion && <p className="text-sm text-muted-foreground mt-1">{seccion.descripcion}</p>}
                </div>
                {seccion.preguntas.map((q) => (
                    <Pregunta key={q.id} q={q} proyecto={proyecto} onChange={(r) => responder(q.id, r)} />
                ))}
            </div>

            <div className="flex items-center justify-between gap-3">
                <button disabled={paso === 0} onClick={() => { setPaso(paso - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground disabled:opacity-30">
                    <ChevronLeft className="w-4 h-4" /> Anterior
                </button>
                {esUltimo ? (
                    <button disabled={enviando} onClick={enviar} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-400 text-slate-950 text-sm font-bold hover:bg-amber-300 disabled:opacity-60 shadow-lg shadow-amber-400/20">
                        {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar brief
                    </button>
                ) : (
                    <button onClick={() => { if (timer.current) { clearTimeout(timer.current); persistir(ultimo.current); } setPaso(paso + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex items-center gap-1 px-5 py-2.5 rounded-xl bg-white/10 text-sm font-bold text-foreground hover:bg-white/15">
                        Siguiente <ChevronRight className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
