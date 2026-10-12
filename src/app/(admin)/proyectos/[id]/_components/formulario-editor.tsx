"use client";

import { useEffect, useState } from "react";
import {
    Sparkles, Loader2, Save, Send, Copy, Eye, Plus, Trash2, ArrowUp, ArrowDown, FileDown,
    FileText, ClipboardList, MessageCircle, CheckCircle2, Paperclip, Wand2, Hourglass, Flag, ClipboardPaste,
} from "lucide-react";
import { toast } from "sonner";
import { cn, descargarTexto } from "@/lib/utils";
import { proyectosStore, mensajeError } from "@/lib/store";
import { registrarLog } from "@/lib/proyecto-acciones";
import { fasesDe } from "@/lib/proyectos-estado";
import {
    briefAMarkdown, briefPlantilla, docIdFormulario, EJEMPLO_FORMULARIO_MD, formularioDesdeTexto, nuevoId, progresoBrief, reemplazarFormulario,
    respuestasClienteMarkdown, tieneRespuesta,
} from "@/lib/proyecto-gestion";
import type { BriefPregunta, BriefProyecto, FormularioProyecto, Proyecto, TipoPreguntaBrief } from "@/lib/types";
import { ui, type ProyectoCtx } from "./ctx";
import { nombreArchivoMd, upsertDoc } from "./docs-util";

const TIPO_LABELS: Record<TipoPreguntaBrief, string> = {
    texto: "Texto corto",
    parrafo: "Párrafo",
    opcion: "Una opción",
    multiple: "Varias opciones",
    archivo: "Subir archivo",
};

export const ESTADO_FORM: Record<string, string> = {
    borrador: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    enviado: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    completado: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

/** Conserva las respuestas más nuevas de la base al guardar cambios en las preguntas. */
function fusionarRespuestas<T extends BriefProyecto>(borrador: T, enBase: BriefProyecto | null | undefined): T {
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

/**
 * Edita el brief (`formId` null) o un formulario extra: preguntas, publicación
 * en el portal, respuestas del cliente y los .md que salen de ellas.
 */
export default function FormularioEditor({ ctx, formId, onSucio, onEliminado }: {
    ctx: ProyectoCtx;
    formId: string | null;
    onSucio?: (sucio: boolean) => void;
    onEliminado?: () => void;
}) {
    const { proyecto, cliente } = ctx;
    const esBrief = formId === null;
    const delProyecto = (p: Proyecto | null | undefined): BriefProyecto | FormularioProyecto | null =>
        esBrief ? p?.brief || null : (p?.formularios || []).find((f) => f.id === formId) || null;

    const [borrador, setBorrador] = useState<BriefProyecto | FormularioProyecto | null>(delProyecto(proyecto));
    const [sucio, setSucioLocal] = useState(false);
    const [modo, setModo] = useState<"respuestas" | "editar">(() => {
        const b = delProyecto(proyecto);
        return !b || b.estado === "borrador" ? "editar" : "respuestas";
    });
    const form = esBrief ? null : (borrador as FormularioProyecto | null);
    const [descripcionIA, setDescripcionIA] = useState(esBrief ? proyecto.descripcion || "" : form?.pedido_ia || "");
    const [fuente, setFuente] = useState<"ia" | "texto">("ia");
    const [textoPegado, setTextoPegado] = useState("");
    const [verEjemplo, setVerEjemplo] = useState(false);
    const [generando, setGenerando] = useState(false);
    const [generandoCtx, setGenerandoCtx] = useState(false);
    const [guardando, setGuardando] = useState(false);

    const setSucio = (v: boolean) => { setSucioLocal(v); onSucio?.(v); };

    useEffect(() => {
        if (!sucio) setBorrador(delProyecto(proyecto));
    }, [proyecto, sucio]); // eslint-disable-line react-hooks/exhaustive-deps

    const progreso = progresoBrief(borrador);
    const nombre = esBrief ? "brief" : "formulario";
    const fases = fasesDe(proyecto);

    const editar = (fn: (b: BriefProyecto) => BriefProyecto) => {
        if (!borrador) return;
        setBorrador(fn(structuredClone(borrador)));
        setSucio(true);
    };
    const editarForm = (cambios: Partial<FormularioProyecto>) => editar((b) => ({ ...b, ...cambios }));

    /** Guarda en la base sin pisar respuestas nuevas del cliente ni los otros formularios. */
    const guardar = async (cambios: Partial<FormularioProyecto> = {}, mensaje = esBrief ? "Brief guardado" : "Formulario guardado"): Promise<boolean> => {
        if (!borrador) return false;
        setGuardando(true);
        try {
            const enBase = await proyectosStore.getById(proyecto.id);
            const anterior = delProyecto(enBase) as FormularioProyecto | null;
            const final = { ...fusionarRespuestas(borrador, anterior), ...cambios, actualizado_at: new Date().toISOString() };
            const ok = esBrief
                ? await ctx.guardarProyecto({ brief: final }, mensaje)
                : await ctx.guardarProyecto({ formularios: reemplazarFormulario(enBase?.formularios || proyecto.formularios || [], final as FormularioProyecto) }, mensaje);
            if (ok) {
                setBorrador(final);
                setSucio(false);
                // Si cambió si frena o no, los plazos se acomodan.
                const f = final as FormularioProyecto;
                if (!esBrief && f.estado !== "borrador" && Boolean(anterior?.frena) !== Boolean(f.frena)) ctx.sincronizarEsperas();
            }
            return ok;
        } finally { setGuardando(false); }
    };

    const reemplazar = (nuevo: BriefProyecto) => {
        if (borrador && progresoBrief(borrador).respondidas > 0 && !confirm(`El ${nombre} actual tiene respuestas del cliente. ¿Reemplazarlo igual?`)) return false;
        // En un formulario se conservan título, fase, estado y demás: solo cambian las preguntas.
        setBorrador(esBrief || !borrador ? nuevo : { ...borrador, intro: nuevo.intro, secciones: nuevo.secciones, generado_con_ia: nuevo.generado_con_ia, pedido_ia: descripcionIA.trim() } as FormularioProyecto);
        setSucio(true);
        setModo("editar");
        return true;
    };

    const generarConIA = async () => {
        if (!descripcionIA.trim()) { toast.error(esBrief ? "Describí el proyecto para que la IA arme el brief" : "Contale a la IA qué necesitás saber"); return; }
        setGenerando(true);
        try {
            const res = await fetch("/api/gemini/generar-brief", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    descripcion: descripcionIA, tipo: proyecto.tipo_proyecto, nombre: proyecto.nombre,
                    cliente: cliente?.nombre, negocio: cliente?.negocio,
                    ...(form ? { formulario: { titulo: form.titulo, fase: form.fase }, respuestasPrevias: respuestasClienteMarkdown(proyecto, cliente, form.id) } : {}),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error de IA");
            if (reemplazar(data.brief)) {
                toast.success(`${esBrief ? "Brief" : "Formulario"} generado: ${progresoBrief(data.brief).total} preguntas. Revisalo y guardalo.`);
                if (esBrief && !proyecto.descripcion && descripcionIA.trim()) ctx.guardarProyecto({ descripcion: descripcionIA.trim() });
            }
        } catch (e) { toast.error(mensajeError(e)); }
        finally { setGenerando(false); }
    };

    /** Texto pegado (un .md propio) → preguntas, sin IA. */
    const convertirTexto = (agregar: boolean) => {
        const r = formularioDesdeTexto(textoPegado);
        const total = r.secciones.reduce((n, s) => n + s.preguntas.length, 0);
        if (!total) { toast.error("No encontré preguntas. Usá viñetas (- ¿pregunta?) o líneas que terminen en ?"); return; }
        if (agregar && borrador) {
            editar((b) => ({ ...b, secciones: [...b.secciones, ...r.secciones] }));
        } else {
            const base: BriefProyecto = borrador || { estado: "borrador", secciones: [], actualizado_at: new Date().toISOString(), completado_at: null };
            if (!reemplazar({ ...base, intro: r.intro ?? base.intro, secciones: r.secciones, generado_con_ia: false })) return;
        }
        setTextoPegado("");
        toast.success(`${r.secciones.length} sección${r.secciones.length === 1 ? "" : "es"} y ${total} pregunta${total === 1 ? "" : "s"}. Revisalas y guardá los cambios.`);
    };

    const enviar = async () => {
        if (sucio || borrador?.estado === "borrador") {
            const completado = borrador?.estado === "completado";
            const ok = await guardar({
                estado: completado ? "completado" : "enviado",
                // Desde acá se espera al cliente: si frena, hasta que lo complete los plazos se corren.
                enviado_at: borrador?.enviado_at || new Date().toISOString(),
            }, esBrief ? "Brief publicado en el portal" : "Formulario publicado en el portal");
            if (!ok) return;
            registrarLog(proyecto.id, esBrief ? "Brief enviado al cliente" : `Formulario enviado al cliente: ${form?.titulo}`);
            if (!completado && (esBrief || form?.frena)) ctx.sincronizarEsperas();
        }
        await navigator.clipboard.writeText(ctx.portalUrl).catch(() => {});
        toast.success(`Link del portal copiado. El cliente ve el ${nombre} ahí.`);
    };

    const eliminar = async () => {
        if (!form) return;
        const conRespuestas = progresoBrief(form).respondidas > 0;
        if (!confirm(conRespuestas ? `"${form.titulo}" tiene respuestas del cliente. ¿Eliminarlo igual? (Si ya se guardó en Docs, el .md queda ahí.)` : `¿Eliminar el formulario "${form.titulo}"?`)) return;
        const enBase = await proyectosStore.getById(proyecto.id);
        const ok = await ctx.guardarProyecto({ formularios: (enBase?.formularios || proyecto.formularios || []).filter((f) => f.id !== form.id) }, "Formulario eliminado");
        if (!ok) return;
        setSucio(false);
        if (form.frena) ctx.sincronizarEsperas();
        onEliminado?.();
    };

    const primerNombre = cliente?.nombre ? ` ${cliente.nombre.split(" ")[0]}` : "";
    const mensajeWhatsApp = esBrief
        ? `Hola${primerNombre}! 👋 Te comparto el portal de tu proyecto "${proyecto.nombre}". Ahí vas a encontrar un formulario (brief) para conocer mejor tu negocio: podés completarlo de a poco, se guarda solo. También podés subir tu logo, fotos y todo el material.\n\n${ctx.portalUrl}`
        : `Hola${primerNombre}! 👋 Te dejé un nuevo formulario en el portal de "${proyecto.nombre}": *${form?.titulo}*.${form?.fase ? ` Lo vamos a necesitar para la etapa de ${form.fase}, así que podés ir completándolo de a poco mientras avanzamos.` : ""} Se guarda solo, en la pestaña Formularios.\n\n${ctx.portalUrl}`;
    const telCliente = cliente?.tel?.replace(/\D/g, "");

    const titulo = esBrief ? "Brief" : `Formulario — ${form?.titulo || ""}`;
    const docId = esBrief ? "doc_brief" : docIdFormulario(formId!);

    const generarMd = async () => {
        if (!borrador) return;
        const md = briefAMarkdown(borrador, proyecto, cliente, esBrief ? "Brief" : `Formulario: ${form?.titulo}`);
        await ctx.guardarProyecto({ documentos: upsertDoc(proyecto.documentos || [], { id: docId, titulo, categoria: "estrategia", contenido: md }) });
        descargarTexto(nombreArchivoMd(esBrief ? `BRIEF-${proyecto.nombre}` : `${form?.titulo}-${proyecto.nombre}`), md);
        toast.success(`${esBrief ? "BRIEF.md" : ".md del formulario"} generado y guardado en Docs`);
    };

    // El CONTEXTO.md junta todo lo que respondió el cliente: brief y formularios.
    const conBorrador: Proyecto = !borrador ? proyecto : esBrief
        ? { ...proyecto, brief: borrador }
        : { ...proyecto, formularios: reemplazarFormulario(proyecto.formularios || [], borrador as FormularioProyecto) };
    const respuestasMd = respuestasClienteMarkdown(conBorrador, cliente);

    const generarContexto = async () => {
        if (!borrador) return;
        setGenerandoCtx(true);
        try {
            const res = await fetch("/api/gemini/contexto-proyecto", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ briefMarkdown: respuestasMd, nombre: proyecto.nombre, tipo: proyecto.tipo_proyecto, stack: proyecto.stack_tecnologico }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error de IA");
            const md = briefAMarkdown(borrador, proyecto, cliente, esBrief ? "Brief" : `Formulario: ${form?.titulo}`);
            const docs = upsertDoc(upsertDoc(proyecto.documentos || [], { id: docId, titulo, categoria: "estrategia", contenido: md }),
                { id: "doc_contexto", titulo: "CONTEXTO", categoria: "estrategia", contenido: data.markdown });
            await ctx.guardarProyecto({ documentos: docs });
            descargarTexto("CONTEXTO.md", data.markdown);
            registrarLog(proyecto.id, "CONTEXTO.md generado con IA a partir de las respuestas del cliente");
            toast.success("CONTEXTO.md generado, descargado y guardado en Docs");
        } catch (e) { toast.error(mensajeError(e)); }
        finally { setGenerandoCtx(false); }
    };

    // ── Armar las preguntas: con IA o pegando un texto propio ──────
    const generador = (
        <div className={cn(ui.card, "space-y-3 border-primary/30")}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className={ui.h3}>
                    {fuente === "ia" ? <Sparkles className="w-4 h-4 text-amber-400" /> : <ClipboardPaste className="w-4 h-4 text-cyan-400" />}
                    {fuente === "ia" ? (esBrief ? "Generar brief con IA" : "Armar las preguntas con IA") : "Pegar mis preguntas"}
                </h3>
                <div className="flex items-center rounded-xl bg-secondary p-1 border border-border">
                    {(["ia", "texto"] as const).map((f) => (
                        <button key={f} onClick={() => setFuente(f)} className={cn("px-3 py-1 rounded-lg text-xs font-bold transition-all", fuente === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                            {f === "ia" ? "Con IA" : "Pegar texto / .md"}
                        </button>
                    ))}
                </div>
            </div>

            {fuente === "ia" ? (
                <>
                    <p className="text-xs text-muted-foreground">
                        {esBrief
                            ? "Contale a la IA de qué se trata el proyecto (rubro, qué hay que construir, funcionalidades, objetivos). Arma un formulario específico que el cliente completa desde el portal."
                            : "Contale qué necesitás saber. La IA lee lo que el cliente ya respondió en el brief y en otros formularios, no repite preguntas y arma una sección por cada producto, curso o servicio que ya haya nombrado."}
                    </p>
                    <textarea
                        value={descripcionIA} onChange={(e) => setDescripcionIA(e.target.value)} rows={5} className={ui.textarea}
                        placeholder={esBrief
                            ? "Ej: Web institucional para un estudio contable de Córdoba con 3 socios. Quieren captar pymes, mostrar servicios (impuestos, sueldos, sociedades), sumar un blog y que los contacten por WhatsApp. Tienen logo pero no fotos…"
                            : "Ej: De cada curso que vende necesito: a quién va dirigido, duración y modalidad, precio y formas de pago, temario por módulo, qué certificado entrega, próximas fechas, testimonios de alumnos y fotos o videos para la página del curso…"}
                    />
                    <div className="flex flex-wrap gap-2">
                        <button disabled={generando} onClick={generarConIA} className={cn(ui.btn, ui.btnPrimary)}>
                            {generando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                            {generando ? "Generando…" : borrador && (esBrief || borrador.generado_con_ia) ? "Regenerar con IA" : "Generar preguntas"}
                        </button>
                        {esBrief && (
                            <button onClick={() => reemplazar(briefPlantilla(proyecto.tipo_proyecto))} className={cn(ui.btn, ui.btnSecondary)}>
                                <ClipboardList className="w-3.5 h-3.5" /> Usar plantilla base
                            </button>
                        )}
                    </div>
                </>
            ) : (
                <>
                    <p className="text-xs text-muted-foreground">
                        Pegá tus preguntas tal cual las tenés en el .md: los títulos <code className="font-mono text-foreground">##</code> son secciones, cada viñeta o línea con <code className="font-mono text-foreground">?</code> es una pregunta y las sub-viñetas son opciones. Sin IA: sale exactamente lo que escribiste.
                        {" "}<button onClick={() => setVerEjemplo(!verEjemplo)} className="font-bold text-cyan-400 hover:underline">{verEjemplo ? "Ocultar ejemplo" : "Ver ejemplo"}</button>
                    </p>
                    {verEjemplo && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <pre className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap p-3 rounded-xl bg-background border border-border text-foreground">{EJEMPLO_FORMULARIO_MD}</pre>
                            <ul className="text-[11px] text-muted-foreground space-y-1.5 p-3 rounded-xl bg-secondary/30 border border-border">
                                <li><strong className="text-foreground"># Título</strong> arriba de todo: el título del formulario (si hay ## debajo).</li>
                                <li><strong className="text-foreground">## Sección</strong> o una línea en <strong className="text-foreground">**negrita**</strong>: nueva sección (un paso del formulario).</li>
                                <li><strong className="text-foreground">- pregunta</strong>, <strong className="text-foreground">1. pregunta</strong> o una línea que termine en <strong className="text-foreground">?</strong>: una pregunta.</li>
                                <li>Sub-viñetas debajo: opciones de <strong className="text-foreground">una</strong> respuesta. Con <strong className="text-foreground">[ ]</strong>: de <strong className="text-foreground">varias</strong>.</li>
                                <li><strong className="text-foreground">&gt; texto</strong> o una línea suelta debajo: ayuda/ejemplo para el cliente.</li>
                                <li><strong className="text-foreground">*</strong> al final: obligatoria.</li>
                                <li><strong className="text-foreground">[archivo] [texto] [párrafo] [una] [varias]</strong>: fuerzan el tipo. &quot;Subí…&quot; ya se toma como archivo.</li>
                            </ul>
                        </div>
                    )}
                    <textarea value={textoPegado} onChange={(e) => setTextoPegado(e.target.value)} rows={10} className={cn(ui.textarea, "font-mono")} placeholder={"## Curso de Maquillaje\n- ¿A quién va dirigido?\n- ¿Cuál es la modalidad?\n    - Presencial\n    - Online"} />
                    <div className="flex flex-wrap gap-2">
                        <button disabled={!textoPegado.trim()} onClick={() => convertirTexto(false)} className={cn(ui.btn, ui.btnPrimary)}>
                            <ClipboardPaste className="w-3.5 h-3.5" /> {borrador && progresoBrief(borrador).total > 0 ? "Reemplazar las preguntas" : "Convertir en formulario"}
                        </button>
                        {borrador && progresoBrief(borrador).total > 0 && (
                            <button disabled={!textoPegado.trim()} onClick={() => convertirTexto(true)} className={cn(ui.btn, ui.btnSecondary)}>
                                <Plus className="w-3.5 h-3.5" /> Agregar al final
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );

    if (!borrador) return <div className="space-y-4">{esBrief ? generador : <p className="text-xs text-muted-foreground italic">Este formulario ya no existe.</p>}</div>;

    return (
        <div className="space-y-4">
            {/* Barra de estado */}
            <div className={cn(ui.card, "space-y-3")}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-foreground">{esBrief ? "Brief del proyecto" : form?.titulo}</h3>
                            <span className={cn("text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase", ESTADO_FORM[borrador.estado])}>{borrador.estado}</span>
                            {borrador.generado_con_ia && <span className="text-[9px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 font-bold uppercase flex items-center gap-1"><Sparkles className="w-2.5 h-2.5" /> IA</span>}
                            {form?.fase && <span className="text-[9px] px-2 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 font-bold uppercase flex items-center gap-1"><Flag className="w-2.5 h-2.5" /> Para: {form.fase}</span>}
                            {form?.frena && <span className="text-[9px] px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 font-bold uppercase flex items-center gap-1"><Hourglass className="w-2.5 h-2.5" /> Frena</span>}
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
                    <button onClick={generarMd} className={cn(ui.btn, ui.btnSecondary)} title={`Descarga el ${nombre} con sus respuestas y lo guarda en Docs`}>
                        <FileDown className="w-3.5 h-3.5 text-cyan-400" /> {esBrief ? "BRIEF.md" : "Descargar .md"}
                    </button>
                    <button disabled={generandoCtx || !respuestasMd} onClick={generarContexto} className={cn(ui.btn, ui.btnSecondary)} title="La IA convierte todas las respuestas del cliente (brief y formularios) en un documento de contexto para desarrollar con Claude Code">
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
                        <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            {esBrief
                                ? "El cliente envió el brief. Generá el CONTEXTO.md para arrancar a desarrollar."
                                : "El cliente envió el formulario y ya quedó guardado en Docs. Regenerá el CONTEXTO.md para sumarlo."}
                        </p>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {form && (
                        <div className={cn(ui.card, "space-y-3")}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className={ui.label}>Título (lo ve el cliente)</label>
                                    <input value={form.titulo} onChange={(e) => editarForm({ titulo: e.target.value })} className={ui.input} />
                                </div>
                                <div>
                                    <label className={ui.label}>Lo necesitás para la fase</label>
                                    <select value={form.fase || ""} onChange={(e) => editarForm({ fase: e.target.value || null })} className={ui.input}>
                                        <option value="">Sin fase en particular</option>
                                        {fases.map((f) => <option key={f.nombre} value={f.nombre}>{f.nombre}{f.completada ? " (completada)" : ""}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <label className="flex items-center gap-1.5 text-[11px] text-foreground">
                                    <input type="checkbox" checked={Boolean(form.frena)} onChange={(e) => editarForm({ frena: e.target.checked })} />
                                    Sin esto no puedo avanzar (frena el proyecto y corre los plazos hasta que lo complete)
                                </label>
                                <button onClick={eliminar} className={cn(ui.btn, "text-rose-400 hover:bg-rose-500/10")}><Trash2 className="w-3.5 h-3.5" /> Eliminar formulario</button>
                            </div>
                        </div>
                    )}

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
