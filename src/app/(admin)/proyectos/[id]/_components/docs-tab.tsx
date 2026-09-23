"use client";

import { useState } from "react";
import { BookOpen, Plus, FileUp, Eye, Edit3, Trash2, Save, Download, Files } from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate, descargarTexto, descargarMarkdownCombinado } from "@/lib/utils";
import MarkdownViewer from "@/components/markdown-viewer";
import type { DocumentoProyecto } from "@/lib/types";
import { ui, type ProyectoCtx } from "./ctx";
import { nombreArchivoMd, upsertDoc } from "./docs-util";

const DOC_CATEGORIA_BADGE: Record<string, string> = {
    estrategia: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    marketing: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    contenido: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    prospeccion: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    manual: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    otro: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

type Categoria = DocumentoProyecto["categoria"];

export default function DocsTab({ ctx }: { ctx: ProyectoCtx }) {
    const { proyecto } = ctx;
    const docs = proyecto.documentos || [];
    const [selectedId, setSelectedId] = useState<string | null>(docs[0]?.id || null);
    const [modo, setModo] = useState<"read" | "edit">("read");
    const [form, setForm] = useState<{ id?: string; titulo: string; categoria: Categoria; contenido: string }>({ titulo: "", categoria: "estrategia", contenido: "" });

    const activo = docs.find((d) => d.id === selectedId) || docs[0];

    const guardarDocs = (nuevos: DocumentoProyecto[], msg: string) => ctx.guardarProyecto({ documentos: nuevos }, msg);

    const abrirEditor = (doc?: DocumentoProyecto) => {
        setForm(doc ? { id: doc.id, titulo: doc.titulo, categoria: doc.categoria, contenido: doc.contenido } : { titulo: "Nuevo documento", categoria: "estrategia", contenido: "" });
        setModo("edit");
        if (!doc) setSelectedId(null);
    };

    const guardar = async () => {
        if (!form.titulo.trim()) { toast.error("El título es requerido"); return; }
        const id = form.id || `doc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        if (await guardarDocs(upsertDoc(docs, { id, titulo: form.titulo, categoria: form.categoria, contenido: form.contenido }), "Documento guardado")) {
            setSelectedId(id);
            setModo("read");
        }
    };

    const borrar = async (id: string) => {
        if (!confirm("¿Eliminar este documento?")) return;
        const resto = docs.filter((d) => d.id !== id);
        if (await guardarDocs(resto, "Documento eliminado")) setSelectedId(resto[0]?.id || null);
    };

    const importarMd = (file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const titulo = file.name.replace(/\.(md|txt)$/i, "");
            if (await guardarDocs(upsertDoc(docs, { id, titulo, categoria: "estrategia", contenido: String(e.target?.result || "") }), `"${titulo}" importado`)) setSelectedId(id);
        };
        reader.readAsText(file);
    };

    const editando = modo === "edit";

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className={cn(ui.card, "lg:col-span-1 space-y-3")}>
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5"><BookOpen className="w-4 h-4 text-primary" /> Docs ({docs.length})</h3>
                    <button onClick={() => abrirEditor()} className="p-1 rounded-lg hover:bg-secondary text-primary" title="Nuevo documento"><Plus className="w-4 h-4" /></button>
                </div>
                <label className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-xs font-bold text-primary hover:bg-primary/10 cursor-pointer">
                    <FileUp className="w-4 h-4" /> Importar .md
                    <input type="file" accept=".md,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importarMd(f); e.target.value = ""; }} />
                </label>
                {docs.length > 1 && (
                    <button onClick={() => descargarMarkdownCombinado(nombreArchivoMd(`${proyecto.nombre}-docs`), docs)} className={cn(ui.btn, ui.btnSecondary, "w-full")}>
                        <Files className="w-3.5 h-3.5" /> Descargar todo en un .md
                    </button>
                )}
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto custom-scrollbar">
                    {docs.map((doc) => (
                        <button key={doc.id} onClick={() => { setSelectedId(doc.id); setModo("read"); }}
                            className={cn("w-full text-left p-3 rounded-xl border text-xs transition-all flex flex-col gap-1", activo?.id === doc.id && !(editando && !form.id) ? "bg-primary/15 border-primary/40 text-primary" : "bg-secondary/20 border-border/60 hover:bg-secondary/50 text-foreground/90")}>
                            <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-bold">{doc.titulo}</span>
                                <span className={cn("text-[8px] px-1.5 rounded-full uppercase font-bold border shrink-0", DOC_CATEGORIA_BADGE[doc.categoria])}>{doc.categoria}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{formatDate(doc.updated_at)}</span>
                        </button>
                    ))}
                    {docs.length === 0 && <p className="py-6 text-center text-muted-foreground text-xs italic">Sin documentos. El BRIEF.md y el CONTEXTO.md se guardan acá cuando los generás desde la pestaña Brief.</p>}
                </div>
            </div>

            <div className={cn(ui.card, "lg:col-span-3 space-y-4")}>
                {editando ? (
                    <div className="space-y-3">
                        <div className="flex gap-2">
                            <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className={cn(ui.input, "font-bold text-sm")} />
                            <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value as Categoria })} className="h-9 px-2 rounded-xl bg-background border border-border text-xs text-foreground">
                                {Object.keys(DOC_CATEGORIA_BADGE).map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <textarea value={form.contenido} onChange={(e) => setForm({ ...form, contenido: e.target.value })} rows={20} className={cn(ui.textarea, "font-mono leading-relaxed")} />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setModo("read")} className={cn(ui.btn, ui.btnGhost)}>Cancelar</button>
                            <button onClick={guardar} className={cn(ui.btn, ui.btnPrimary)}><Save className="w-3.5 h-3.5" /> Guardar</button>
                        </div>
                    </div>
                ) : activo ? (
                    <>
                        <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-2">
                            <h2 className="text-lg font-black text-foreground">{activo.titulo}</h2>
                            <div className="flex items-center gap-1.5">
                                <button onClick={() => descargarTexto(nombreArchivoMd(activo.titulo), activo.contenido)} className={cn(ui.btn, ui.btnSecondary)}><Download className="w-3.5 h-3.5" /> .md</button>
                                <button onClick={async () => { await navigator.clipboard.writeText(activo.contenido); toast.success("Copiado"); }} className={cn(ui.btn, ui.btnSecondary)}>Copiar</button>
                                <button onClick={() => abrirEditor(activo)} className={cn(ui.btn, ui.btnSecondary)}><Edit3 className="w-3.5 h-3.5" /> Editar</button>
                                <button onClick={() => borrar(activo.id)} className="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <div className="p-4 rounded-2xl bg-secondary/15 border border-border/60 min-h-[400px]">
                            <MarkdownViewer content={activo.contenido} />
                        </div>
                    </>
                ) : (
                    <div className="py-20 text-center text-muted-foreground space-y-2">
                        <Eye className="w-10 h-10 mx-auto opacity-30" />
                        <p className="text-sm font-bold text-foreground">Seleccioná o creá un documento</p>
                    </div>
                )}
            </div>
        </div>
    );
}
