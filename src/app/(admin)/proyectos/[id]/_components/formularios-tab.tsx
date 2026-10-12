"use client";

import { useState } from "react";
import { AlertTriangle, ClipboardList, ClipboardPaste, FilePlus2, Flag, Hourglass, Loader2, Plus, Sparkles, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { proyectosStore, mensajeError } from "@/lib/store";
import { fasesDe } from "@/lib/proyectos-estado";
import {
    EJEMPLO_FORMULARIO_MD, formularioDesdeTexto, nuevoFormulario, progresoBrief, respuestasClienteMarkdown,
} from "@/lib/proyecto-gestion";
import type { BriefProyecto, FormularioProyecto } from "@/lib/types";
import { ui, type ProyectoCtx } from "./ctx";
import FormularioEditor, { ESTADO_FORM } from "./formulario-editor";

type Fuente = "texto" | "ia" | "blanco";

const FUENTES: { id: Fuente; label: string; icon: typeof Plus }[] = [
    { id: "texto", label: "Pegar mi texto / .md", icon: ClipboardPaste },
    { id: "ia", label: "Con IA", icon: Sparkles },
    { id: "blanco", label: "En blanco", icon: Plus },
];

function NuevoFormulario({ ctx, onCreado, onCancelar }: { ctx: ProyectoCtx; onCreado: (id: string) => void; onCancelar: () => void }) {
    const { proyecto, cliente } = ctx;
    const fases = fasesDe(proyecto);
    const idx = fases.findIndex((f) => !f.completada);
    // Por defecto, la fase que viene: se pregunta mientras se trabaja en la actual.
    const faseSugerida = idx >= 0 ? (fases[idx + 1] || fases[idx]).nombre : "";

    const [titulo, setTitulo] = useState("");
    const [fase, setFase] = useState(faseSugerida);
    const [frena, setFrena] = useState(false);
    const [fuente, setFuente] = useState<Fuente>("texto");
    const [texto, setTexto] = useState("");
    const [pedido, setPedido] = useState("");
    const [creando, setCreando] = useState(false);

    const crear = async () => {
        let base: Partial<BriefProyecto> = {};
        let tituloFinal = titulo.trim();
        if (fuente === "texto") {
            const r = formularioDesdeTexto(texto);
            if (!r.secciones.length) { toast.error("No encontré preguntas. Usá viñetas (- ¿pregunta?) o líneas que terminen en ?"); return; }
            base = { secciones: r.secciones, ...(r.intro ? { intro: r.intro } : {}) };
            tituloFinal = tituloFinal || r.titulo || "";
        }
        if (!tituloFinal) { toast.error("Ponele un título (lo ve el cliente)"); return; }
        if (fuente === "ia" && !pedido.trim()) { toast.error("Contale a la IA qué necesitás saber"); return; }

        setCreando(true);
        try {
            if (fuente === "ia") {
                const res = await fetch("/api/gemini/generar-brief", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        descripcion: pedido, tipo: proyecto.tipo_proyecto, nombre: proyecto.nombre, cliente: cliente?.nombre, negocio: cliente?.negocio,
                        formulario: { titulo: tituloFinal, fase: fase || null }, respuestasPrevias: respuestasClienteMarkdown(proyecto, cliente),
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Error de IA");
                base = { intro: data.brief.intro, secciones: data.brief.secciones, generado_con_ia: true };
            }
            const nuevo: FormularioProyecto = {
                ...nuevoFormulario(tituloFinal, fase || null, base),
                frena,
                ...(fuente === "ia" ? { pedido_ia: pedido.trim() } : {}),
            };
            if (!nuevo.intro) nuevo.intro = `Unas preguntas más para seguir avanzando con tu proyecto. Podés completarlo de a poco: se guarda solo.`;
            const enBase = await proyectosStore.getById(proyecto.id);
            const ok = await ctx.guardarProyecto({ formularios: [...(enBase?.formularios || proyecto.formularios || []), nuevo] }, "Formulario creado. Revisalo y publicalo en el portal.");
            if (ok) onCreado(nuevo.id);
        } catch (e) { toast.error(mensajeError(e)); }
        finally { setCreando(false); }
    };

    return (
        <div className={cn(ui.card, "space-y-4 border-primary/40")}>
            <div className="flex items-center justify-between gap-2">
                <h3 className={ui.h3}><FilePlus2 className="w-4 h-4 text-primary" /> Nuevo formulario</h3>
                <button onClick={onCancelar} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className={ui.label}>Título (lo ve el cliente)</label>
                    <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={fuente === "texto" ? "Ej: Tus cursos en detalle (o el # de tu .md)" : "Ej: Tus cursos en detalle"} className={ui.input} />
                </div>
                <div>
                    <label className={ui.label}>Lo necesitás para la fase</label>
                    <select value={fase} onChange={(e) => setFase(e.target.value)} className={ui.input}>
                        <option value="">Sin fase en particular</option>
                        {fases.map((f) => <option key={f.nombre} value={f.nombre}>{f.nombre}{f.completada ? " (completada)" : ""}</option>)}
                    </select>
                </div>
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-foreground">
                <input type="checkbox" checked={frena} onChange={(e) => setFrena(e.target.checked)} />
                Sin esto no puedo avanzar (frena el proyecto y corre los plazos hasta que lo complete)
            </label>

            <div className="flex items-center rounded-xl bg-secondary p-1 border border-border w-fit max-w-full overflow-x-auto">
                {FUENTES.map((f) => (
                    <button key={f.id} onClick={() => setFuente(f.id)} className={cn("flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap", fuente === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                        <f.icon className="w-3.5 h-3.5" /> {f.label}
                    </button>
                ))}
            </div>

            {fuente === "texto" && (
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Pegá tus preguntas como las escribiste: <code className="font-mono text-foreground">##</code> para cada sección, una viñeta o línea con <code className="font-mono text-foreground">?</code> por pregunta y sub-viñetas para las opciones. Después las podés retocar una por una.</p>
                    <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={12} className={cn(ui.textarea, "font-mono")} placeholder={EJEMPLO_FORMULARIO_MD} />
                </div>
            )}
            {fuente === "ia" && (
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">La IA lee lo que el cliente ya respondió en el brief, no repite preguntas y arma una sección por cada producto, curso o servicio que ya haya nombrado.</p>
                    <textarea value={pedido} onChange={(e) => setPedido(e.target.value)} rows={5} className={ui.textarea} placeholder="Ej: De cada curso que vende necesito: a quién va dirigido, duración y modalidad, precio y formas de pago, temario por módulo, certificado, próximas fechas, testimonios y fotos o videos…" />
                </div>
            )}

            <div className="flex justify-end gap-2">
                <button onClick={onCancelar} className={cn(ui.btn, ui.btnGhost)}>Cancelar</button>
                <button disabled={creando} onClick={crear} className={cn(ui.btn, ui.btnPrimary)}>
                    {creando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : fuente === "ia" ? <Wand2 className="w-3.5 h-3.5" /> : <FilePlus2 className="w-3.5 h-3.5" />}
                    {creando ? (fuente === "ia" ? "Armando preguntas…" : "Creando…") : "Crear formulario"}
                </button>
            </div>
        </div>
    );
}

/** Pestaña Formularios: el brief y los formularios extra que se le van mandando al cliente. */
export default function FormulariosTab({ ctx }: { ctx: ProyectoCtx }) {
    const { proyecto } = ctx;
    const formularios = proyecto.formularios || [];
    // Sin la migración la columna no viene en la fila: el brief sigue andando igual.
    const sinColumna = proyecto.formularios === undefined;
    const [sel, setSel] = useState<string | null>(() => {
        const ultimo = formularios[formularios.length - 1];
        return proyecto.brief?.estado === "completado" && ultimo ? ultimo.id : null;
    });
    const [creando, setCreando] = useState(false);
    const [sucio, setSucio] = useState(false);

    const ir = (id: string | null, nuevo = false) => {
        if (sucio && !confirm("Tenés cambios sin guardar en este formulario. ¿Salir igual?")) return;
        setSucio(false);
        setSel(id);
        setCreando(nuevo);
    };

    const Chip = ({ id, titulo, form, extra }: { id: string | null; titulo: string; form: BriefProyecto | null | undefined; extra?: React.ReactNode }) => {
        const prog = progresoBrief(form);
        const activo = !creando && sel === id;
        return (
            <button onClick={() => ir(id)} className={cn("text-left rounded-xl border px-3 py-2 min-w-[150px] max-w-[260px] transition-all shrink-0",
                activo ? "border-primary bg-primary/10 shadow-md shadow-primary/10" : "border-border bg-card hover:border-primary/40")}>
                <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-foreground truncate flex-1">{titulo}</p>
                    {form && <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full border font-bold uppercase shrink-0", ESTADO_FORM[form.estado])}>{form.estado}</span>}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                    {form ? `${prog.respondidas}/${prog.total} respondidas` : "Sin crear"}
                    {extra}
                </p>
            </button>
        );
    };

    return (
        <div className="space-y-4">
            {sinColumna && (
                <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs text-amber-200">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Para crear formularios además del brief falta aplicar la migración <code className="font-mono">supabase/migrations/20261012_formularios.sql</code> en Supabase (SQL Editor). El brief funciona igual.</span>
                </div>
            )}

            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                <Chip id={null} titulo="Brief" form={proyecto.brief} extra={<ClipboardList className="w-3 h-3 ml-auto shrink-0" />} />
                {formularios.map((f) => (
                    <Chip key={f.id} id={f.id} titulo={f.titulo} form={f} extra={<>
                        {f.fase && <span className="flex items-center gap-0.5 text-cyan-400 truncate"><Flag className="w-2.5 h-2.5 shrink-0" /> {f.fase}</span>}
                        {f.frena && <Hourglass className="w-2.5 h-2.5 text-violet-400 shrink-0" />}
                    </>} />
                ))}
                {!sinColumna && (
                    <button onClick={() => ir(sel, true)} className={cn("rounded-xl border border-dashed px-4 py-2 text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all",
                        creando ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-primary hover:border-primary/50")}>
                        <Plus className="w-3.5 h-3.5" /> Nuevo formulario
                    </button>
                )}
            </div>

            {creando ? (
                <NuevoFormulario ctx={ctx} onCreado={(id) => { setSel(id); setCreando(false); }} onCancelar={() => setCreando(false)} />
            ) : (
                <FormularioEditor key={sel ?? "brief"} ctx={ctx} formId={sel} onSucio={setSucio} onEliminado={() => { setSucio(false); setSel(null); }} />
            )}
        </div>
    );
}
