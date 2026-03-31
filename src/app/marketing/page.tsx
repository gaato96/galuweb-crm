"use client";

import { useEffect, useState } from "react";
import {
    Plus, Megaphone, CheckCircle2, Circle, Clock, Trash2, X, Sparkles,
    Instagram, Video, Layers, Smartphone, Copy, Layout, Palette,
    ArrowRight, Lightbulb, PlayCircle, Edit3, Send
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tareasStore } from "@/lib/store";
import type { Tarea, Prioridad, CategoriaTarea, EstadoTarea } from "@/lib/types";
import { toast } from "sonner";

type WorkflowStage = "idea" | "guion" | "produccion" | "revision" | "listo" | "publicado";

const STAGES: { id: WorkflowStage; label: string; icon: any; color: string }[] = [
    { id: "idea", label: "Banco de Ideas", icon: Lightbulb, color: "text-amber-400 bg-amber-400/10" },
    { id: "guion", label: "Guionización", icon: Edit3, color: "text-blue-400 bg-blue-400/10" },
    { id: "produccion", label: "Producción", icon: PlayCircle, color: "text-purple-400 bg-purple-400/10" },
    { id: "revision", label: "Edición/Revisión", icon: Layers, color: "text-rose-400 bg-rose-400/10" },
    { id: "listo", label: "Listo / Programado", icon: CheckCircle2, color: "text-emerald-400 bg-emerald-400/10" },
    { id: "publicado", label: "Publicado", icon: Send, color: "text-slate-400 bg-slate-400/10" },
];

const FORMATOS = [
    { id: "reel", label: "Reel", icon: Video },
    { id: "carrusel", label: "Carrusel", icon: Layers },
    { id: "imagen", label: "Post Estático", icon: Layout },
    { id: "story", label: "Story", icon: Smartphone },
];

const PLATAFORMAS = [
    { id: "instagram", label: "Instagram", icon: Instagram },
    { id: "tiktok", label: "TikTok", icon: Video },
];

export default function MarketingPage() {
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [mounted, setMounted] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [editing, setEditing] = useState<Tarea | null>(null);
    const [promptView, setPromptView] = useState<Tarea | null>(null);

    const [form, setForm] = useState({
        titulo: "",
        descripcion: "",
        idea_contenido: "",
        hook: "",
        guion: "",
        notas_visuales: "",
        formato: "reel",
        plataformas: ["instagram"],
        workflow_stage: "idea" as WorkflowStage,
        prioridad: "media" as Prioridad,
    });

    const reload = async () => {
        try {
            const data = await tareasStore.getMarketing();
            setTareas(data);
        } catch {
            console.error("Error reloading marketing tasks");
        }
    };

    useEffect(() => { reload().then(() => setMounted(true)); }, []);

    const handleSave = async () => {
        if (!form.titulo.trim()) { toast.error("Título requerido"); return; }
        try {
            const payload = {
                ...form,
                categoria: "contenido" as CategoriaTarea,
                proyecto_id: null,
                estado: (form.workflow_stage === "publicado" ? "completada" : "en_progreso") as EstadoTarea
            };

            if (editing) {
                await tareasStore.update(editing.id, payload);
                toast.success("Contenido actualizado");
            } else {
                await tareasStore.create(payload);
                toast.success("Idea guardada en el banco");
            }

            resetForm();
            await reload();
        } catch (e) {
            toast.error("Error al guardar");
            console.error(e);
        }
    };

    const resetForm = () => {
        setForm({
            titulo: "",
            descripcion: "",
            idea_contenido: "",
            hook: "",
            guion: "",
            notas_visuales: "",
            formato: "reel",
            plataformas: ["instagram"],
            workflow_stage: "idea",
            prioridad: "media",
        });
        setShowNew(false);
        setEditing(null);
    };

    const deleteContent = async (id: string) => {
        if (!confirm("¿Eliminar este contenido?")) return;
        try {
            await tareasStore.delete(id);
            await reload();
            toast.success("Eliminado");
        } catch { toast.error("Error al eliminar"); }
    };

    const moveStage = async (tarea: Tarea, nextStage: WorkflowStage) => {
        try {
            await tareasStore.update(tarea.id, {
                workflow_stage: nextStage,
                estado: (nextStage === "publicado" ? "completada" : "en_progreso") as EstadoTarea
            });
            await reload();
        } catch { toast.error("Error al mover etapa"); }
    };

    if (!mounted) {
        return <div className="p-8 space-y-4 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-secondary/50 rounded-xl" />)}</div>;
    }

    const renderCard = (t: Tarea) => {
        const FormatIcon = FORMATOS.find(f => f.id === t.formato)?.icon || Video;

        return (
            <div key={t.id} className="group relative bg-card border border-border hover:border-primary/40 rounded-xl p-4 transition-all shadow-sm hover:shadow-md flex flex-col gap-3">
                <div className="flex items-start justify-between">
                    <div className="flex gap-1.5">
                        {t.plataformas?.includes("instagram") && <Instagram className="w-3.5 h-3.5 text-pink-500" />}
                        {t.plataformas?.includes("tiktok") && <div className="w-3.5 h-3.5 flex items-center justify-center text-cyan-400 font-bold text-[8px] border border-cyan-400 rounded-sm">TT</div>}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => {
                            setEditing(t);
                            setForm({
                                titulo: t.titulo,
                                descripcion: t.descripcion || "",
                                idea_contenido: t.idea_contenido || "",
                                hook: t.hook || "",
                                guion: t.guion || "",
                                notas_visuales: t.notas_visuales || "",
                                formato: t.formato || "reel",
                                plataformas: t.plataformas || ["instagram"],
                                workflow_stage: (t.workflow_stage as WorkflowStage) || "idea",
                                prioridad: t.prioridad || "media",
                            });
                            setShowNew(true);
                        }} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
                            <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteContent(t.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-bold text-foreground leading-tight mb-1">{t.titulo}</h4>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 italic">"{t.idea_contenido || "Sin idea definida"}"</p>
                </div>

                <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-[10px] text-muted-foreground font-medium uppercase">
                            <FormatIcon className="w-3 h-3" /> {t.formato || "reel"}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {t.idea_contenido && (
                            <button onClick={() => setPromptView(t)} className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors" title="Generar Prompt IA">
                                <Sparkles className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <button
                            onClick={() => {
                                const currentIndex = STAGES.findIndex(s => s.id === (t.workflow_stage || "idea"));
                                if (currentIndex < STAGES.length - 1) {
                                    moveStage(t, STAGES[currentIndex + 1].id);
                                }
                            }}
                            className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                            title="Siguiente etapa"
                        >
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-foreground flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <Megaphone className="w-7 h-7" />
                        </div>
                        Marketing Studio
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Gestión estratégica de contenido para Instagram y TikTok</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowNew(true); }}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20"
                >
                    <Plus className="w-5 h-5" /> Nueva Idea de Contenido
                </button>
            </div>

            {/* Stages Pipeline */}
            <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {STAGES.slice(0, 5).map((stage) => {
                    const stageTasks = tareas.filter(t => (t.workflow_stage || "idea") === stage.id);
                    const Icon = stage.icon;
                    return (
                        <div key={stage.id} className="flex flex-col gap-4">
                            <div className={cn("flex items-center justify-between p-3 rounded-xl border border-border bg-card/50", stage.color)}>
                                <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-wider">{stage.label}</span>
                                </div>
                                <span className="text-[10px] font-black bg-foreground/10 px-2 py-0.5 rounded-full">{stageTasks.length}</span>
                            </div>
                            <div className="flex flex-col gap-3 min-h-[100px]">
                                {stageTasks.map(renderCard)}
                                {stageTasks.length === 0 && (
                                    <div className="border-2 border-dashed border-border/40 rounded-xl py-8 flex items-center justify-center">
                                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Vacío</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Editor Modal / Drawer */}
            {showNew && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="w-full max-w-4xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden animate-slide-up">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-secondary/30">
                            <div>
                                <h3 className="text-xl font-bold text-foreground">{editing ? "Editar Contenido" : "Crear Nueva Estrategia"}</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">Define los pilares de tu próximo posteo viral</p>
                            </div>
                            <button onClick={resetForm} className="p-2 rounded-xl hover:bg-secondary transition-colors">
                                <X className="w-6 h-6 text-muted-foreground" />
                            </button>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            {/* Left Side: Basic Info */}
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Título de la Estrategia</label>
                                    <input
                                        value={form.titulo}
                                        onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                                        className="w-full h-12 px-4 rounded-xl bg-secondary border border-border focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all text-sm font-medium"
                                        placeholder="Ej: Tutorial de Diseño Web en 60s"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Formato</label>
                                        <select
                                            value={form.formato}
                                            onChange={(e) => setForm({ ...form, formato: e.target.value })}
                                            className="w-full h-11 px-3 rounded-xl bg-secondary border border-border text-sm outline-none"
                                        >
                                            {FORMATOS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Etapa actual</label>
                                        <select
                                            value={form.workflow_stage}
                                            onChange={(e) => setForm({ ...form, workflow_stage: e.target.value as WorkflowStage })}
                                            className="w-full h-11 px-3 rounded-xl bg-secondary border border-border text-sm outline-none"
                                        >
                                            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Plataformas</label>
                                    <div className="flex gap-3">
                                        {PLATAFORMAS.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => {
                                                    const current = form.plataformas;
                                                    setForm({ ...form, plataformas: current.includes(p.id) ? current.filter(x => x !== p.id) : [...current, p.id] });
                                                }}
                                                className={cn(
                                                    "flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border transition-all text-sm font-bold",
                                                    form.plataformas.includes(p.id)
                                                        ? "bg-primary/10 border-primary text-primary"
                                                        : "bg-secondary border-border text-muted-foreground"
                                                )}
                                            >
                                                <p.icon className="w-4 h-4" /> {p.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Notas Visuales (B-Roll, Edición)</label>
                                    <textarea
                                        value={form.notas_visuales}
                                        onChange={(e) => setForm({ ...form, notas_visuales: e.target.value })}
                                        rows={4}
                                        className="w-full p-4 rounded-xl bg-secondary border border-border focus:ring-2 focus:ring-primary/40 outline-none transition-all text-sm resize-none"
                                        placeholder="Grabación en exterior, usar texto en pantalla para los puntos clave..."
                                    />
                                </div>
                            </div>

                            {/* Right Side: Content & Script */}
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-violet-400 uppercase tracking-widest px-1">La Idea (Concepto Central)</label>
                                    <textarea
                                        value={form.idea_contenido}
                                        onChange={(e) => setForm({ ...form, idea_contenido: e.target.value })}
                                        rows={3}
                                        className="w-full p-4 rounded-xl bg-violet-500/5 border border-violet-500/20 focus:border-violet-500/50 outline-none transition-all text-sm font-medium italic resize-none"
                                        placeholder="Describe brevemente de qué trata este contenido..."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-emerald-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                        <Palette className="w-3 h-3" /> El Gancho (Hook)
                                    </label>
                                    <input
                                        value={form.hook}
                                        onChange={(e) => setForm({ ...form, hook: e.target.value })}
                                        className="w-full h-11 px-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 focus:border-emerald-500/50 outline-none transition-all text-sm font-bold text-emerald-400 placeholder:text-emerald-500/30"
                                        placeholder="Los primeros 3 segundos decisivos"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Guion Completo</label>
                                    <textarea
                                        value={form.guion}
                                        onChange={(e) => setForm({ ...form, guion: e.target.value })}
                                        rows={8}
                                        className="w-full p-4 rounded-xl bg-secondary border border-border focus:ring-2 focus:ring-primary/40 outline-none transition-all text-sm resize-none"
                                        placeholder="Pega aquí el guion generado o escribe tu borrador..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-border bg-secondary/10 flex items-center justify-between">
                            <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-violet-400" /> Usa la IA para pulir el guion</div>
                            </div>
                            <div className="flex gap-3 w-full md:w-auto">
                                <button onClick={resetForm} className="flex-1 md:flex-none px-6 py-3 rounded-xl text-sm font-bold text-muted-foreground hover:bg-secondary transition-colors">Cancelar</button>
                                <button onClick={handleSave} className="flex-1 md:flex-none px-8 py-3 rounded-xl text-sm font-black bg-primary text-primary-foreground hover:shadow-xl hover:shadow-primary/30 active:scale-95 transition-all">
                                    {editing ? "Actualizar Contenido" : "Crear Estrategia"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Prompt Modal (Reused and Improved) */}
            {promptView && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                    <div className="w-full max-w-3xl flex flex-col max-h-[90vh] rounded-[2.5rem] border border-violet-500/30 bg-card p-8 shadow-2xl animate-fade-in relative">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-2xl bg-violet-600 shadow-[0_0_20px_rgba(139,92,246,0.5)]">
                                    <Sparkles className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-foreground">Content Prompt Master</h3>
                                    <p className="text-xs text-muted-foreground tracking-widest uppercase mt-0.5">Optimizado para {promptView.formato} en {promptView.plataformas?.join(" & ")}</p>
                                </div>
                            </div>
                            <button onClick={() => setPromptView(null)} className="p-2 rounded-xl hover:bg-secondary transition-colors">
                                <X className="w-7 h-7 text-muted-foreground" />
                            </button>
                        </div>

                        <div className="p-1 rounded-2xl bg-gradient-to-br from-violet-600/20 via-transparent to-cyan-500/20 mb-6 flex-1 overflow-hidden flex flex-col">
                            <textarea
                                readOnly
                                className="w-full flex-1 p-6 bg-secondary/80 text-sm font-mono text-foreground leading-relaxed outline-none resize-none custom-scrollbar"
                                value={`Actúa como un experto en creación de contenido viral en redes sociales (Instagram Reels y TikTok).\n\nVoy a darte una idea de contenido y some detalles clave. Tu tarea es generar un guion profesional y persuasivo.\n\n--- CONTEXTO ---\nIdea Central: "${promptView.idea_contenido}"\nFormato: ${promptView.formato}\nCanales: ${promptView.plataformas?.join(", ")}\nGancho sugerido: "${promptView.hook || 'Genera uno tú que sea impactante'}"\nNotas Visuales/Edición: "${promptView.notas_visuales || 'Usa tu criterio experto para que sea dinámico'}"\n\n--- ESTRUCTURA DEL GUION ---\n1. HOOK (0-3 segundos): Una frase que obligue a detener el scroll.\n2. PROBLEMA: Conecta con un dolor real de mi audiencia.\n3. TRANSFORMACIÓN: Explica brevemente cómo nuestra solución (o este tip) resuelve el problema.\n4. PASO A PASO / TIPS: Desarrollo del contenido de forma rápida y digerible.\n5. CTA (Call to Action): Una instrucción clara (Sígueme, comenta, agenda asesoría).\n\n--- SUGERENCIAS DE PRODUCCIÓN ---\n- Dame 3 sugerencias de texto que deberían aparecer en pantalla (Overlays).\n- Dime qué tipo de música o tendencia de audio encajaría mejor.\n- Sugiere locaciones o ángulos de cámara para que el video no sea estático.`}
                            />
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between pt-4 border-t border-border/50">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium italic">
                                <Lightbulb className="w-4 h-4 text-amber-400" /> Pega esto en Claude, Gemini o ChatGPT para obtener el mejor resultado.
                            </div>
                            <div className="flex gap-3 w-full md:w-auto">
                                <button onClick={() => setPromptView(null)} className="flex-1 md:flex-none px-6 py-3 rounded-2xl text-sm font-bold bg-secondary hover:bg-secondary/70 transition-all">Cerrar</button>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(`Actúa como un experto en creación de contenido viral en redes sociales (Instagram Reels y TikTok).\n\nVoy a darte una idea de contenido y some detalles clave. Tu tarea es generar un guion profesional y persuasivo.\n\n--- CONTEXTO ---\nIdea Central: "${promptView.idea_contenido}"\nFormato: ${promptView.formato}\nCanales: ${promptView.plataformas?.join(", ")}\nGancho sugerido: "${promptView.hook || 'Genera uno tú que sea impactante'}"\nNotas Visuales/Edición: "${promptView.notas_visuales || 'Usa tu criterio experto para que sea dinámico'}"\n\n--- ESTRUCTURA DEL GUION ---\n1. HOOK (0-3 segundos): Una frase que obligue a detener el scroll.\n2. PROBLEMA: Conecta con un dolor real de mi audiencia.\n3. TRANSFORMACIÓN: Explica brevemente cómo nuestra solución (o este tip) resuelve el problema.\n4. PASO A PASO / TIPS: Desarrollo del contenido de forma rápida y digerible.\n5. CTA (Call to Action): Una instrucción clara (Sígueme, comenta, agenda asesoría).\n\n--- SUGERENCIAS DE PRODUCCIÓN ---\n- Dame 3 sugerencias de texto que deberían aparecer en pantalla (Overlays).\n- Dime qué tipo de música o tendencia de audio encajaría mejor.\n- Sugiere locaciones o ángulos de cámara para que el video no sea estático.`);
                                        toast.success("Prompt Maestro copiado", { icon: "✨" });
                                    }}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-violet-600 text-white font-black hover:shadow-[0_0_20px_rgba(139,92,246,0.6)] active:scale-95 transition-all"
                                >
                                    <Copy className="w-5 h-5" /> Copiar Prompt Maestro
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {tareas.length === 0 && !showNew && (
                <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border/60 rounded-3xl bg-secondary/5">
                    <div className="p-6 rounded-full bg-secondary/50 mb-6">
                        <Lightbulb className="w-16 h-16 text-muted-foreground/30" />
                    </div>
                    <h3 className="text-2xl font-black text-foreground mb-2">Comienza tu Estrategia</h3>
                    <p className="text-muted-foreground text-center max-w-sm mb-8 px-4">
                        Aún no tienes ideas en tu banco de marketing. Crea tu primera pieza para empezar a dominar las redes sociales.
                    </p>
                    <button
                        onClick={() => setShowNew(true)}
                        className="px-8 py-4 bg-foreground text-background font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl"
                    >
                        Empezar Ahora
                    </button>
                </div>
            )}
        </div>
    );
}
