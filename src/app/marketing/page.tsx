"use client";

import { useEffect, useState } from "react";
import { Plus, Megaphone, CheckCircle2, Circle, Clock, Trash2, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { tareasStore } from "@/lib/store";
import type { Tarea, Prioridad, CategoriaTarea, EstadoTarea } from "@/lib/types";
import { PRIORIDAD_COLORS } from "@/lib/types";
import { toast } from "sonner";

export default function MarketingPage() {
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [mounted, setMounted] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [promptView, setPromptView] = useState<Tarea | null>(null);
    const [form, setForm] = useState({
        titulo: "",
        descripcion: "",
        prioridad: "media" as Prioridad,
        categoria: "marketing" as CategoriaTarea,
        idea_contenido: "",
        guion: "",
        editado: false,
        publicado: false
    });

    const reload = async () => {
        try {
            const data = await tareasStore.getMarketing();
            setTareas(data);
        } catch {
            console.error("Error reloading marketing tasks:");
        }
    };
    useEffect(() => { reload().then(() => setMounted(true)); }, []);

    const handleCreate = async () => {
        if (!form.titulo.trim()) { toast.error("Título requerido"); return; }
        try {
            await tareasStore.create({ ...form, proyecto_id: null, estado: "pendiente" });
            setForm({
                titulo: "",
                descripcion: "",
                prioridad: "media",
                categoria: "marketing",
                idea_contenido: "",
                guion: "",
                editado: false,
                publicado: false
            });
            setShowNew(false);
            await reload();
            toast.success("Tarea de marketing creada");
        } catch {
            toast.error("Error al crear tarea");
        }
    };

    const toggleTarea = async (id: string, estado: EstadoTarea) => {
        const next = estado === "completada" ? "pendiente" : estado === "pendiente" ? "en_progreso" : "completada";
        try {
            await tareasStore.update(id, { estado: next });
            await reload();
        } catch {
            toast.error("Error al actualizar tarea");
        }
    };

    const deleteTarea = async (id: string) => {
        try {
            await tareasStore.delete(id);
            await reload();
            toast.success("Tarea eliminada");
        } catch {
            toast.error("Error al eliminar tarea");
        }
    };

    if (!mounted) {
        return <div className="space-y-3 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-lg skeleton" />)}</div>;
    }

    const pendientes = tareas.filter((t) => t.estado === "pendiente");
    const enProgreso = tareas.filter((t) => t.estado === "en_progreso");
    const completadas = tareas.filter((t) => t.estado === "completada");

    const ICON_MAP = { pendiente: Circle, en_progreso: Clock, completada: CheckCircle2 };

    const renderTarea = (t: Tarea) => {
        const Icon = ICON_MAP[t.estado];
        return (
            <div key={t.id} className={cn("flex items-center gap-3 p-3 rounded-lg border transition-all group", t.estado === "completada" ? "bg-emerald-500/5 border-emerald-500/20" : "bg-secondary/30 border-border hover:border-primary/30")}>
                <button onClick={() => toggleTarea(t.id, t.estado)}>
                    <Icon className={cn("w-5 h-5 shrink-0", t.estado === "completada" ? "text-emerald-400" : t.estado === "en_progreso" ? "text-blue-400" : "text-muted-foreground")} />
                </button>
                <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", t.estado === "completada" ? "text-muted-foreground line-through" : "text-foreground")}>{t.titulo}</p>
                    {(t.idea_contenido || t.guion) && (
                        <div className="mt-1 space-y-1">
                            {t.idea_contenido && <p className="text-[11px] text-muted-foreground italic">Idea: {t.idea_contenido}</p>}
                            {t.guion && <p className="text-[11px] text-primary/80">Guion listo</p>}
                        </div>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", PRIORIDAD_COLORS[t.prioridad])}>{t.prioridad}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{t.categoria}</span>
                        {t.editado && <span className="text-[10px] text-blue-400 font-medium">✨ Editado</span>}
                        {t.publicado && <span className="text-[10px] text-emerald-400 font-medium">🚀 Publicado</span>}
                    </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                        onClick={() => tareasStore.update(t.id, { editado: !t.editado }).then(reload)}
                        className={cn("p-1.5 rounded-lg border transition-colors", t.editado ? "bg-blue-500/20 border-blue-500/40 text-blue-400" : "bg-secondary border-border text-muted-foreground hover:text-foreground")}
                        title="Marcar como editado"
                    >
                        ✨
                    </button>
                    <button
                        onClick={() => tareasStore.update(t.id, { publicado: !t.publicado }).then(reload)}
                        className={cn("p-1.5 rounded-lg border transition-colors", t.publicado ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "bg-secondary border-border text-muted-foreground hover:text-foreground")}
                        title="Marcar como publicado"
                    >
                        🚀
                    </button>
                    <button onClick={() => deleteTarea(t.id)} className="p-1.5 rounded-lg hover:bg-destructive/20 transition-all ml-1">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                    {t.categoria === "contenido" && t.idea_contenido && (
                        <button onClick={() => setPromptView(t)} className="flex items-center gap-1.5 px-2 py-1 ml-2 text-[10px] rounded-lg border border-violet-500/30 text-violet-400 font-medium hover:bg-violet-500/10 transition-colors">
                            <Sparkles className="w-3 h-3" /> Script IA
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Marketing</h2>
                    <p className="text-sm text-muted-foreground">Tareas de contenido, ads y marketing de la agencia</p>
                </div>
                <button onClick={() => setShowNew(!showNew)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                    <Plus className="w-4 h-4" /> Nueva Tarea
                </button>
            </div>

            {/* Modal Prompt IA */}
            {promptView && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-2xl flex flex-col max-h-[90vh] rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in relative my-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-violet-400" /> Creador de Guion IA
                            </h3>
                            <button onClick={() => setPromptView(null)} className="p-1 rounded-lg hover:bg-secondary">
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        </div>

                        <p className="text-sm text-muted-foreground mb-4">
                            Copia este prompt optimizado y pégalo en ChatGPT o Gemini para generar un guion altamente conversivo basado en tu idea.
                        </p>

                        <textarea
                            readOnly
                            rows={15}
                            className="flex-1 w-full p-4 rounded-xl bg-secondary/50 border border-violet-500/20 text-sm font-mono text-foreground focus:outline-none resize-none mb-4"
                            value={`Actúa como un experto en creación de contenido viral y marketing digital.\nPor favor, crea un guion altamente conversivo (para un Reel de Instagram/TikTok o Carrusel) basado en la siguiente idea:\n\nIdea de contenido: "${promptView.idea_contenido}"\n\nEstructura el contenido obligatoriamente de la siguiente manera:\n1. Hook (Gancho visual/auditivo hiper llamativo que frene el scroll en los primeros 3 segundos).\n2. Énfasis del problema (Plantea un dolor o necesidad del cliente ideal).\n3. Solución propuesta (Presenta nuestro servicio o consejo de forma clara).\n4. Beneficios (Por qué esta solución cambia su situación).\n5. Call to Action (Un CTA claro para generar interacción o agendar reunión).\n\nAdicionalmente, dame recomendaciones visuales (qué debería aparecer en pantalla, B-roll a utilizar o diseño del carrusel).`}
                        />

                        <div className="flex justify-end gap-3 shrink-0">
                            <button onClick={() => setPromptView(null)} className="px-5 py-2.5 bg-secondary text-foreground text-sm font-medium rounded-xl hover:bg-secondary/80 transition-colors">
                                Cerrar
                            </button>
                            <button onClick={() => {
                                navigator.clipboard.writeText(`Actúa como un experto en creación de contenido viral y marketing digital.\nPor favor, crea un guion altamente conversivo (para un Reel de Instagram/TikTok o Carrusel) basado en la siguiente idea:\n\nIdea de contenido: "${promptView.idea_contenido}"\n\nEstructura el contenido obligatoriamente de la siguiente manera:\n1. Hook (Gancho visual/auditivo hiper llamativo que frene el scroll en los primeros 3 segundos).\n2. Énfasis del problema (Plantea un dolor o necesidad del cliente ideal).\n3. Solución propuesta (Presenta nuestro servicio o consejo de forma clara).\n4. Beneficios (Por qué esta solución cambia su situación).\n5. Call to Action (Un CTA claro para generar interacción o agendar reunión).\n\nAdicionalmente, dame recomendaciones visuales (qué debería aparecer en pantalla, B-roll a utilizar o diseño del carrusel).`);
                                toast.success("Prompt copiado al portapapeles");
                            }} className="px-5 py-2.5 bg-violet-600 text-white font-bold text-sm rounded-xl hover:bg-violet-500 transition-colors shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                                Copiar Prompt
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{pendientes.length}</p>
                    <p className="text-xs text-muted-foreground">Pendientes</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                    <p className="text-2xl font-bold text-blue-400">{enProgreso.length}</p>
                    <p className="text-xs text-muted-foreground">En Progreso</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-400">{completadas.length}</p>
                    <p className="text-xs text-muted-foreground">Completadas</p>
                </div>
            </div>

            {/* New Task Form */}
            {showNew && (
                <div className="p-4 rounded-xl bg-card border border-primary/30 space-y-3 animate-fade-in">
                    <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Título de la tarea..." className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción (opcional)..." className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    <div className="grid grid-cols-2 gap-3">
                        <select value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value as Prioridad })} className="h-9 px-2 rounded-lg bg-secondary border border-border text-xs text-foreground">
                            <option value="baja">Baja</option>
                            <option value="media">Media</option>
                            <option value="alta">Alta</option>
                        </select>
                        <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value as CategoriaTarea })} className="h-9 px-2 rounded-lg bg-secondary border border-border text-xs text-foreground">
                            <option value="marketing">Marketing</option>
                            <option value="contenido">Contenido</option>
                        </select>
                    </div>
                    {form.categoria === "contenido" && (
                        <div className="space-y-3 animate-slide-up">
                            <textarea
                                value={form.idea_contenido}
                                onChange={(e) => setForm({ ...form, idea_contenido: e.target.value })}
                                placeholder="Idea de contenido..."
                                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                rows={2}
                            />
                            <textarea
                                value={form.guion}
                                onChange={(e) => setForm({ ...form, guion: e.target.value })}
                                placeholder="Guion / Script..."
                                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                rows={3}
                            />
                        </div>
                    )}
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowNew(false)} className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-secondary">Cancelar</button>
                        <button onClick={handleCreate} className="px-3 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground hover:opacity-90">Guardar</button>
                    </div>
                </div>
            )}

            {/* Task Lists */}
            {enProgreso.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2"><Clock className="w-4 h-4" /> En Progreso</h3>
                    <div className="space-y-1.5">{enProgreso.map(renderTarea)}</div>
                </div>
            )}
            {pendientes.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Circle className="w-4 h-4" /> Pendientes</h3>
                    <div className="space-y-1.5">{pendientes.map(renderTarea)}</div>
                </div>
            )}
            {completadas.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Completadas</h3>
                    <div className="space-y-1.5">{completadas.map(renderTarea)}</div>
                </div>
            )}
            {tareas.length === 0 && !showNew && (
                <div className="py-12 text-center text-muted-foreground">
                    <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No hay tareas de marketing. Crea una nueva para empezar.</p>
                </div>
            )}
        </div>
    );
}
