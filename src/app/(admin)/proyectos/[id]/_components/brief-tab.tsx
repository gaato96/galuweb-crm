"use client";

import { useEffect, useState } from "react";
import {
    Sparkles, Loader2, Save, Send, Copy, Eye, Plus, Trash2, ArrowUp, ArrowDown, FileDown,
    FileText, ClipboardList, MessageCircle, CheckCircle2, Paperclip, Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, descargarTexto } from "@/lib/utils";
import { proyectosStore, mensajeError } from "@/lib/store";
import { registrarLog } from "@/lib/proyecto-acciones";
import {
    briefAMarkdown, briefPlantilla, nuevoId, progresoBrief, tieneRespuesta,
} from "@/lib/proyecto-gestion";
import type { BriefPregunta, BriefProyecto, TipoPreguntaBrief } from "@/lib/types";
import { ui, type ProyectoCtx } from "./ctx";
import { nombreArchivoMd, upsertDoc } from "./docs-util";

const TIPO_LABELS: Record<TipoPreguntaBrief, string> = {
    texto: "Texto corto",
    parrafo: "Párrafo",
    opcion: "Una opción",
    multiple: "Varias opciones",
    archivo: "Subir archivo",
};

const ESTADO_BRIEF: Record<string, string> = {
    borrador: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    enviado: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    completado: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

/** Conserva las respuestas más nuevas de la base al guardar cambios en las preguntas. */
function fusionarRespuestas(borrador: BriefProyecto, enBase: BriefProyecto | null | undefined): BriefProyecto {
    if (!enBase) return borrador;
    const respuestas = new Map<string, BriefPregunta["respuesta"]>();
    enBase.secciones.forEach((s) => s.preguntas.forEach((q) => { if (tieneRespuesta(q)) respuestas.set(q.id, q.respuesta); }));
    return {
        ...borrador,
        estado: enBase.estado === "completado" ? "completado" : borrador.estado,
        completado_at: enBase.completado_at ?? borrador.completado_at,
        secciones: borrador.secciones.map((s) => ({
            ...s,
            preguntas: s.preguntas.map((q) => (respuestas.has(q.id) ? { ...q, respuesta: respuestas.get(q.id) } : q)),
        })),
    };
}

export default function BriefTab({ ctx }: { ctx: ProyectoCtx }) {
    const { proyecto, cliente } = ctx;
    const [borrador, setBorrador] = useState<BriefProyecto | null>(proyecto.brief || null);
    const [sucio, setSucio] = useState(false);
    const [modo, setModo] = useState<"respuestas" | "editar">(proyecto.brief?.estado === "borrador" || !proyecto.brief ? "editar" : "respuestas");
    const [descripcionIA, setDescripcionIA] = useState(proyecto.descripcion || "");
    const [generando, setGenerando] = useState(false);
    const [generandoCtx, setGenerandoCtx] = useState(false);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        if (!sucio) setBorrador(proyecto.brief || null);
    }, [proyecto.brief, sucio]);

    const progreso = progresoBrief(borrador);

    const editar = (fn: (b: BriefProyecto) => BriefProyecto) => {
        if (!borrador) return;
        setBorrador(fn(structuredClone(borrador)));
        setSucio(true);
    };

    const guardar = async (cambios: Partial<BriefProyecto> = {}, mensaje = "Brief guardado"): Promise<boolean> => {
        if (!borrador) return false;
        setGuardando(true);
        try {
            const actual = await proyectosStore.getById(proyecto.id);
            const final = { ...fusionarRespuestas(borrador, actual?.brief), ...cambios, actualizado_at: new Date().toISOString() };
            const ok = await ctx.guardarProyecto({ brief: final }, mensaje);
            if (ok) { setBorrador(final); setSucio(false); }
            return ok;
        } finally { setGuardando(false); }
    };

    const reemplazar = (nuevo: BriefProyecto) => {
        if (borrador && progresoBrief(borrador).respondidas > 0 && !confirm("El brief actual tiene respuestas del cliente. ¿Reemplazarlo igual?")) return false;
        setBorrador(nuevo);
        setSucio(true);
        setModo("editar");
        return true;
    };

    const generarConIA = async () => {
        if (!descripcionIA.trim()) { toast.error("Describí el proyecto para que la IA arme el brief"); return; }
        setGenerando(true);
        try {
            const res = await fetch("/api/gemini/generar-brief", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    descripcion: descripcionIA, tipo: proyecto.tipo_proyecto, nombre: proyecto.nombre,
                    cliente: cliente?.nombre, negocio: cliente?.negocio,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error de IA");
            if (reemplazar(data.brief)) {
                toast.success(`Brief generado: ${progresoBrief(data.brief).total} preguntas. Revisalo y guardalo.`);
                if (!proyecto.descripcion && descripcionIA.trim()) ctx.guardarProyecto({ descripcion: descripcionIA.trim() });
            }
        } catch (e) { toast.error(mensajeError(e)); }
        finally { setGenerando(false); }
    };

    const enviar = async () => {
        if (sucio || borrador?.estado === "borrador") {
            const ok = await guardar({ estado: borrador?.estado === "completado" ? "completado" : "enviado" }, "Brief publicado en el portal");
            if (!ok) return;
            registrarLog(proyecto.id, "Brief enviado al cliente");
        }
        await navigator.clipboard.writeText(ctx.portalUrl).catch(() => {});
        toast.success("Link del portal copiado. El cliente ve el brief ahí.");
    };

    const mensajeWhatsApp = `Hola${cliente?.nombre ? ` ${cliente.nombre.split(" ")[0]}` : ""}! 👋 Te comparto el portal de tu proyecto "${proyecto.nombre}". Ahí vas a encontrar un formulario (brief) para conocer mejor tu negocio: podés completarlo de a poco, se guarda solo. También podés subir tu logo, fotos y todo el material.\n\n${ctx.portalUrl}`;
    const telCliente = cliente?.tel?.replace(/\D/g, "");

    const guardarDocumento = async (id: string, titulo: string, contenido: string) => {
        const docs = upsertDoc(proyecto.documentos || [], { id, titulo, categoria: "estrategia", contenido });
        return ctx.guardarProyecto({ documentos: docs });
    };

    const generarBriefMd = async () => {
        if (!borrador) return;
        const md = briefAMarkdown(borrador, proyecto, cliente);
        await guardarDocumento("doc_brief", "Brief", md);
        descargarTexto(nombreArchivoMd(`BRIEF-${proyecto.nombre}`), md);
        toast.success("BRIEF.md generado y guardado en Docs");
    };

    const generarContexto = async () => {
        if (!borrador) return;
        setGenerandoCtx(true);
        try {
            const briefMd = briefAMarkdown(borrador, proyecto, cliente);
            const res = await fetch("/api/gemini/contexto-proyecto", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ briefMarkdown: briefMd, nombre: proyecto.nombre, tipo: proyecto.tipo_proyecto, stack: proyecto.stack_tecnologico }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error de IA");
            const docs = upsertDoc(upsertDoc(proyecto.documentos || [], { id: "doc_brief", titulo: "Brief", categoria: "estrategia", contenido: briefMd }),
                { id: "doc_contexto", titulo: "CONTEXTO", categoria: "estrategia", contenido: data.markdown });
            await ctx.guardarProyecto({ documentos: docs });
            descargarTexto("CONTEXTO.md", data.markdown);
            registrarLog(proyecto.id, "CONTEXTO.md generado con IA a partir del brief");
            toast.success("CONTEXTO.md generado, descargado y guardado en Docs");
        } catch (e) { toast.error(mensajeError(e)); }
        finally { setGenerandoCtx(false); }
    };

    // ── Sin brief todavía ────────────────────────────────────────
    const generador = (
        <div className={cn(ui.card, "space-y-3 border-primary/30")}>
            <h3 className={ui.h3}><Sparkles className="w-4 h-4 text-amber-400" /> Generar brief con IA</h3>
            <p className="text-xs text-muted-foreground">Contale a la IA de qué se trata el proyecto (rubro, qué hay que construir, funcionalidades, objetivos). Arma un formulario específico que el cliente completa desde el portal.</p>
            <textarea value={descripcionIA} onChange={(e) => setDescripcionIA(e.target.value)} rows={5} placeholder="Ej: Web institucional para un estudio contable de Córdoba con 3 socios. Quieren captar pymes, mostrar servicios (impuestos, sueldos, sociedades), sumar un blog y que los contacten por WhatsApp. Tienen logo pero no fotos…" className={ui.textarea} />
            <div className="flex flex-wrap gap-2">
                <button disabled={generando} onClick={generarConIA} className={cn(ui.btn, ui.btnPrimary)}>
                    {generando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    {generando ? "Generando…" : borrador ? "Regenerar con IA" : "Generar brief"}
                </button>
                <button onClick={() => reemplazar(briefPlantilla(proyecto.tipo_proyecto))} className={cn(ui.btn, ui.btnSecondary)}>
                    <ClipboardList className="w-3.5 h-3.5" /> Usar plantilla base
                </button>
            </div>
        </div>
    );

    if (!borrador) return <div className="space-y-4">{generador}</div>;

    return (
        <div className="space-y-4">
            {/* Barra de estado */}
            <div className={cn(ui.card, "space-y-3")}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-foreground">Brief del proyecto</h3>
                            <span className={cn("text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase", ESTADO_BRIEF[borrador.estado])}>{borrador.estado}</span>
                            {borrador.generado_con_ia && <span className="text-[9px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 font-bold uppercase flex items-center gap-1"><Sparkles className="w-2.5 h-2.5" /> IA</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {progreso.respondidas}/{progreso.total} respondidas
                            {progreso.faltanRequeridas.length > 0 && ` · faltan ${progreso.faltanRequeridas.length} obligatorias`}
                            {borrador.completado_at && ` · completado el ${new Date(borrador.completado_at).toLocaleDateString("es-AR")}`}
                        </p>
                        <div className="h-1.5 w-48 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${progreso.pct}%` }} />
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {sucio && (
                            <button disabled={guardando} onClick={() => guardar()} className={cn(ui.btn, "bg-amber-500 text-slate-950 hover:bg-amber-400")}>
                                {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar cambios
                            </button>
                        )}
                        <button disabled={guardando} onClick={enviar} className={cn(ui.btn, ui.btnPrimary)}>
                            <Send className="w-3.5 h-3.5" /> {borrador.estado === "borrador" ? "Publicar en el portal" : "Copiar link"}
                        </button>
                        {telCliente && borrador.estado !== "borrador" && (
                            <a href={`https://wa.me/${telCliente}?text=${encodeURIComponent(mensajeWhatsApp)}`} target="_blank" rel="noopener noreferrer" className={cn(ui.btn, "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25")}>
                                <MessageCircle className="w-3.5 h-3.5" /> Enviar por WhatsApp
                            </a>
                        )}
                        <a href={ctx.portalUrl} target="_blank" rel="noopener noreferrer" className={cn(ui.btn, ui.btnSecondary)}><Eye className="w-3.5 h-3.5" /> Ver portal</a>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
                    <div className="flex items-center rounded-xl bg-secondary p-1 border border-border">
                        {(["respuestas", "editar"] as const).map((m) => (
                            <button key={m} onClick={() => setModo(m)} className={cn("px-3 py-1 rounded-lg text-xs font-bold transition-all", modo === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                                {m === "respuestas" ? "Respuestas" : "Editar preguntas"}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1" />
                    <button onClick={generarBriefMd} className={cn(ui.btn, ui.btnSecondary)} title="Descarga el brief con sus respuestas y lo guarda en Docs">
                        <FileDown className="w-3.5 h-3.5 text-cyan-400" /> BRIEF.md
                    </button>
                    <button disabled={generandoCtx || progreso.respondidas === 0} onClick={generarContexto} className={cn(ui.btn, ui.btnSecondary)} title="La IA convierte las respuestas en un documento de contexto para desarrollar con Claude Code">
                        {generandoCtx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-amber-400" />} CONTEXTO.md con IA
                    </button>
                </div>
            </div>

            {modo === "respuestas" ? (
                <div className="space-y-4">
                    {borrador.secciones.map((s) => (
                        <div key={s.id} className={cn(ui.card, "space-y-3")}>
                            <h3 className="text-sm font-black text-foreground">{s.titulo}</h3>
                            {s.preguntas.map((q) => (
                                <div key={q.id} className="space-y-1">
                                    <p className="text-xs font-bold text-primary">{q.pregunta}{q.requerida && " *"}</p>
                                    {!tieneRespuesta(q) ? (
                                        <p className="text-xs text-muted-foreground italic">Sin responder</p>
                                    ) : q.tipo === "archivo" ? (
                                        <div className="flex flex-wrap gap-2">
                                            {(Array.isArray(q.respuesta) ? q.respuesta : [String(q.respuesta)]).map((url, i) => (
                                                /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url)
                                                    ? <a key={i} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-border" /></a>
                                                    : <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:underline flex items-center gap-1"><Paperclip className="w-3 h-3" /> Archivo {i + 1}</a>
                                            ))}
                                        </div>
                                    ) : Array.isArray(q.respuesta) ? (
                                        <div className="flex flex-wrap gap-1">{q.respuesta.map((r) => <span key={r} className="text-[11px] px-2 py-0.5 rounded-full bg-secondary border border-border text-foreground">{r}</span>)}</div>
                                    ) : (
                                        <p className="text-xs text-foreground whitespace-pre-wrap bg-secondary/30 border border-border/60 rounded-lg p-2.5">{q.respuesta}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                    {borrador.estado === "completado" && (
                        <p className="text-xs text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> El cliente envió el brief. Generá el CONTEXTO.md para arrancar a desarrollar.</p>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {generador}

                    <div className={cn(ui.card, "space-y-2")}>
                        <label className={ui.label}>Mensaje de bienvenida (lo ve el cliente)</label>
                        <textarea value={borrador.intro || ""} onChange={(e) => editar((b) => ({ ...b, intro: e.target.value }))} rows={2} className={ui.textarea} />
                    </div>

                    {borrador.secciones.map((s, si) => (
                        <div key={s.id} className={cn(ui.card, "space-y-3")}>
                            <div className="flex items-center gap-2">
                                <input value={s.titulo} onChange={(e) => editar((b) => { b.secciones[si].titulo = e.target.value; return b; })} className={cn(ui.input, "font-bold text-sm")} />
                                <button onClick={() => editar((b) => { if (si > 0) [b.secciones[si - 1], b.secciones[si]] = [b.secciones[si], b.secciones[si - 1]]; return b; })} className="p-1 text-muted-foreground hover:text-foreground"><ArrowUp className="w-4 h-4" /></button>
                                <button onClick={() => editar((b) => { if (si < b.secciones.length - 1) [b.secciones[si + 1], b.secciones[si]] = [b.secciones[si], b.secciones[si + 1]]; return b; })} className="p-1 text-muted-foreground hover:text-foreground"><ArrowDown className="w-4 h-4" /></button>
                                <button onClick={() => confirm(`¿Eliminar la sección "${s.titulo}"?`) && editar((b) => { b.secciones.splice(si, 1); return b; })} className="p-1 text-muted-foreground hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <input value={s.descripcion || ""} onChange={(e) => editar((b) => { b.secciones[si].descripcion = e.target.value; return b; })} placeholder="Descripción corta de la sección (opcional)" className={ui.input} />

                            <div className="space-y-2">
                                {s.preguntas.map((q, qi) => (
                                    <div key={q.id} className="p-3 rounded-xl border border-border bg-secondary/20 space-y-2">
                                        <div className="flex items-start gap-2">
                                            <span className="text-[10px] font-bold text-muted-foreground mt-2.5 w-5 shrink-0">{qi + 1}.</span>
                                            <textarea value={q.pregunta} onChange={(e) => editar((b) => { b.secciones[si].preguntas[qi].pregunta = e.target.value; return b; })} rows={1} className={cn(ui.textarea, "font-semibold")} />
                                            <div className="flex flex-col">
                                                <button onClick={() => editar((b) => { const ps = b.secciones[si].preguntas; if (qi > 0) [ps[qi - 1], ps[qi]] = [ps[qi], ps[qi - 1]]; return b; })} className="p-0.5 text-muted-foreground hover:text-foreground"><ArrowUp className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => editar((b) => { const ps = b.secciones[si].preguntas; if (qi < ps.length - 1) [ps[qi + 1], ps[qi]] = [ps[qi], ps[qi + 1]]; return b; })} className="p-0.5 text-muted-foreground hover:text-foreground"><ArrowDown className="w-3.5 h-3.5" /></button>
                                            </div>
                                            <button onClick={() => editar((b) => { b.secciones[si].preguntas.splice(qi, 1); return b; })} className="p-1 text-muted-foreground hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-7">
                                            <select value={q.tipo} onChange={(e) => editar((b) => {
                                                const pq = b.secciones[si].preguntas[qi];
                                                pq.tipo = e.target.value as TipoPreguntaBrief;
                                                if ((pq.tipo === "opcion" || pq.tipo === "multiple") && !pq.opciones?.length) pq.opciones = ["Opción 1", "Opción 2"];
                                                return b;
                                            })} className={ui.input}>
                                                {Object.entries(TIPO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                            </select>
                                            <input value={q.ayuda || ""} onChange={(e) => editar((b) => { b.secciones[si].preguntas[qi].ayuda = e.target.value; return b; })} placeholder="Ayuda / ejemplo (opcional)" className={cn(ui.input, "sm:col-span-2")} />
                                            {(q.tipo === "opcion" || q.tipo === "multiple") && (
                                                <input
                                                    value={(q.opciones || []).join(", ")}
                                                    onChange={(e) => editar((b) => { b.secciones[si].preguntas[qi].opciones = e.target.value.split(",").map((x) => x.trim()).filter(Boolean); return b; })}
                                                    placeholder="Opciones separadas por coma"
                                                    className={cn(ui.input, "sm:col-span-3")}
                                                />
                                            )}
                                            <label className="flex items-center gap-1.5 text-[11px] text-foreground">
                                                <input type="checkbox" checked={Boolean(q.requerida)} onChange={(e) => editar((b) => { b.secciones[si].preguntas[qi].requerida = e.target.checked; return b; })} /> Obligatoria
                                            </label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => editar((b) => { b.secciones[si].preguntas.push({ id: nuevoId("q"), pregunta: "Nueva pregunta", tipo: "parrafo" }); return b; })} className={cn(ui.btn, ui.btnGhost)}>
                                <Plus className="w-3.5 h-3.5" /> Pregunta
                            </button>
                        </div>
                    ))}
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => editar((b) => { b.secciones.push({ id: nuevoId("s"), titulo: "Nueva sección", preguntas: [{ id: nuevoId("q"), pregunta: "Nueva pregunta", tipo: "parrafo" }] }); return b; })} className={cn(ui.btn, ui.btnSecondary)}>
                            <Plus className="w-3.5 h-3.5" /> Sección
                        </button>
                        {sucio && (
                            <button disabled={guardando} onClick={() => guardar()} className={cn(ui.btn, "bg-amber-500 text-slate-950 hover:bg-amber-400")}>
                                <Save className="w-3.5 h-3.5" /> Guardar cambios
                            </button>
                        )}
                        <button onClick={async () => { await navigator.clipboard.writeText(ctx.portalUrl); toast.success("Link copiado"); }} className={cn(ui.btn, ui.btnGhost)}>
                            <Copy className="w-3.5 h-3.5" /> Link del portal
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
