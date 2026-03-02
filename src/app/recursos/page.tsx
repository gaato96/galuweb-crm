"use client";

import { useEffect, useState } from "react";
import { Plus, ExternalLink, X, Tag, Play, Link2, BookOpen, Sparkles, Puzzle, GraduationCap, Trash2 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { recursosStore } from "@/lib/store";
import type { Recurso, TipoRecurso } from "@/lib/types";
import { toast } from "sonner";

const TIPO_ICON: Record<TipoRecurso, React.ElementType> = {
    link: Link2,
    video: Play,
    archivo: BookOpen,
    curso: GraduationCap,
    plugin: Puzzle,
    inspiracion: Sparkles,
};

const TIPO_COLOR: Record<TipoRecurso, string> = {
    link: "bg-blue-500/20 text-blue-300",
    video: "bg-rose-500/20 text-rose-300",
    archivo: "bg-slate-500/20 text-slate-300",
    curso: "bg-emerald-500/20 text-emerald-300",
    plugin: "bg-purple-500/20 text-purple-300",
    inspiracion: "bg-amber-500/20 text-amber-300",
};

export default function RecursosPage() {
    const [recursos, setRecursos] = useState<Recurso[]>([]);
    const [mounted, setMounted] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [filterTag, setFilterTag] = useState("");
    const [filterTipo, setFilterTipo] = useState<string>("todos");
    const [form, setForm] = useState({ titulo: "", url: "", tipo: "link" as TipoRecurso, tags: "", descripcion: "" });

    const reload = async () => {
        try {
            const data = await recursosStore.getAll();
            setRecursos(data);
        } catch (error) {
            console.error("Error reloading resources:", error);
        }
    };
    useEffect(() => { reload().then(() => setMounted(true)); }, []);

    const handleCreate = async () => {
        if (!form.titulo.trim()) { toast.error("Título requerido"); return; }
        try {
            await recursosStore.create({
                ...form,
                tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
            });
            setForm({ titulo: "", url: "", tipo: "link", tags: "", descripcion: "" });
            setShowNew(false);
            await reload();
            toast.success("Recurso guardado");
        } catch (error) {
            toast.error("Error al guardar recurso");
        }
    };

    const deleteRecurso = async (id: string) => {
        try {
            await recursosStore.delete(id);
            await reload();
            toast.success("Recurso eliminado");
        } catch (error) {
            toast.error("Error al eliminar recurso");
        }
    };

    const allTags = Array.from(new Set(recursos.flatMap((r) => r.tags)));

    let filtered = recursos;
    if (filterTipo !== "todos") filtered = filtered.filter((r) => r.tipo === filterTipo);
    if (filterTag) filtered = filtered.filter((r) => r.tags.includes(filterTag));

    if (!mounted) {
        return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">{[...Array(6)].map((_, i) => <div key={i} className="h-48 rounded-xl skeleton" />)}</div>;
    }

    const isYoutube = (url: string) => url.includes("youtube.com") || url.includes("youtu.be");
    const getYoutubeId = (url: string) => {
        const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        return match ? match[1] : null;
    };

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Recursos</h2>
                    <p className="text-sm text-muted-foreground">Tu biblioteca de herramientas y referencias</p>
                </div>
                <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                    <Plus className="w-4 h-4" /> Nuevo
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setFilterTipo("todos")} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", filterTipo === "todos" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                    Todos
                </button>
                {(["link", "video", "curso", "plugin", "inspiracion", "archivo"] as TipoRecurso[]).map((tipo) => {
                    const Icon = TIPO_ICON[tipo];
                    return (
                        <button key={tipo} onClick={() => setFilterTipo(tipo)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize", filterTipo === tipo ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                            <Icon className="w-3.5 h-3.5" /> {tipo}
                        </button>
                    );
                })}
            </div>
            {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                    {allTags.map((tag) => (
                        <button key={tag} onClick={() => setFilterTag(filterTag === tag ? "" : tag)} className={cn("px-2 py-0.5 rounded text-[10px] font-medium transition-colors", filterTag === tag ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                            #{tag}
                        </button>
                    ))}
                </div>
            )}

            {/* New Resource Form */}
            {showNew && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold text-foreground">Nuevo Recurso</h3>
                            <button onClick={() => setShowNew(false)} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5 text-muted-foreground" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Título *</label>
                                <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">URL</label>
                                <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                                    <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoRecurso })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                                        <option value="link">Link</option>
                                        <option value="video">Video</option>
                                        <option value="archivo">Archivo</option>
                                        <option value="curso">Curso</option>
                                        <option value="plugin">Plugin</option>
                                        <option value="inspiracion">Inspiración</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Tags (comma separated)</label>
                                    <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="diseño, figma, ui" className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Descripción</label>
                                <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancelar</button>
                            <button onClick={handleCreate} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:opacity-90">Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Masonry Grid */}
            <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                {filtered.map((r) => {
                    const Icon = TIPO_ICON[r.tipo];
                    const ytId = isYoutube(r.url) ? getYoutubeId(r.url) : null;
                    return (
                        <div key={r.id} className="break-inside-avoid rounded-xl border border-border bg-card overflow-hidden card-hover group">
                            {/* Video embed */}
                            {ytId && (
                                <div className="aspect-video w-full">
                                    <iframe
                                        src={`https://www.youtube.com/embed/${ytId}`}
                                        className="w-full h-full"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                </div>
                            )}
                            <div className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg", TIPO_COLOR[r.tipo])}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {r.url && (
                                            <a href={r.url} target="_blank" rel="noopener" className="p-1 rounded hover:bg-secondary transition-colors">
                                                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                                            </a>
                                        )}
                                        <button onClick={() => deleteRecurso(r.id)} className="p-1 rounded hover:bg-destructive/20 opacity-0 group-hover:opacity-100 transition-all">
                                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                        </button>
                                    </div>
                                </div>
                                <h4 className="text-sm font-semibold text-foreground mb-1">{r.titulo}</h4>
                                {r.descripcion && <p className="text-xs text-muted-foreground mb-2">{r.descripcion}</p>}
                                <div className="flex flex-wrap gap-1">
                                    {r.tags.map((tag) => (
                                        <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] bg-secondary text-muted-foreground">#{tag}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {filtered.length === 0 && (
                    <div className="col-span-3 py-12 text-center text-muted-foreground">
                        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No hay recursos. Empieza a guardar tus herramientas y referencias.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
