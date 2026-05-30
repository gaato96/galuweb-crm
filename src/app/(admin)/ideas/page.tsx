"use client";

import { useEffect, useState } from "react";
import { 
    Plus, Lightbulb, Search, Trash2, Edit3, X, Star, ArrowUpRight, 
    Sparkles, Copy, MessageSquare, BrainCircuit, Code, Users, 
    Building2, Filter, AlertCircle, Smile, HelpCircle, Loader2
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { ideasStore, clientesStore } from "@/lib/store";
import type { Idea, CategoriaIdea, EstadoIdea } from "@/lib/types";
import { 
    CATEGORIA_IDEA_LABELS, CATEGORIA_IDEA_COLORS, 
    ESTADO_IDEA_LABELS, ESTADO_IDEA_COLORS 
} from "@/lib/types";
import { toast } from "sonner";

export default function IdeasPage() {
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [mounted, setMounted] = useState(false);
    
    // UI state
    const [showNew, setShowNew] = useState(false);
    const [editing, setEditing] = useState<Idea | null>(null);
    const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiResult, setAiResult] = useState<string>("");
    const [loadingAi, setLoadingAi] = useState(false);
    const [aiTab, setAiTab] = useState<"canvas" | "mvp" | "whatsapp">("canvas");
    const [phone, setPhone] = useState("");

    // Search and filters
    const [search, setSearch] = useState("");
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [sortBy, setSortBy] = useState<"recent" | "priority" | "impact" | "difficulty">("priority");

    // Form state
    const [form, setForm] = useState({
        titulo: "",
        categoria: "saas" as CategoriaIdea,
        descripcion: "",
        rubro: "",
        cliente_potencial: "",
        impacto: 3,
        dificultad: 3,
        estado: "borrador" as EstadoIdea,
        notas_adicionales: ""
    });

    const reload = async () => {
        try {
            const data = await ideasStore.getAll();
            setIdeas(data);
        } catch (error) {
            console.error("Error al cargar ideas:", error);
            toast.error("Error al cargar las ideas");
        }
    };

    useEffect(() => {
        reload().then(() => setMounted(true));
    }, []);

    const resetForm = () => {
        setForm({
            titulo: "",
            categoria: "saas",
            descripcion: "",
            rubro: "",
            cliente_potencial: "",
            impacto: 3,
            dificultad: 3,
            estado: "borrador",
            notas_adicionales: ""
        });
        setEditing(null);
        setShowNew(false);
    };

    const handleSave = async () => {
        if (!form.titulo.trim()) {
            toast.error("El título es obligatorio");
            return;
        }
        if (!form.descripcion.trim()) {
            toast.error("La descripción es obligatoria para poder detallar la idea");
            return;
        }

        try {
            if (editing) {
                await ideasStore.update(editing.id, form);
                toast.success("Idea actualizada con éxito");
            } else {
                await ideasStore.create(form);
                toast.success("Nueva idea agregada al banco");
            }
            resetForm();
            await reload();
        } catch (error: any) {
            console.error(error);
            toast.error("Error al guardar la idea: " + (error?.message || error?.details || JSON.stringify(error)));
        }
    };

    const handleEdit = (idea: Idea) => {
        setEditing(idea);
        setForm({
            titulo: idea.titulo,
            categoria: idea.categoria,
            descripcion: idea.descripcion,
            rubro: idea.rubro || "",
            cliente_potencial: idea.cliente_potencial || "",
            impacto: idea.impacto,
            dificultad: idea.dificultad,
            estado: idea.estado,
            notas_adicionales: idea.notas_adicionales || ""
        });
        setShowNew(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de que quieres eliminar esta idea del banco?")) return;
        try {
            await ideasStore.delete(id);
            toast.success("Idea eliminada");
            if (selectedIdea?.id === id) setSelectedIdea(null);
            await reload();
        } catch (error) {
            console.error(error);
            toast.error("Error al eliminar la idea");
        }
    };

    // Promote to CRM Lead
    const handlePromoteToLead = async (idea: Idea) => {
        if (!confirm(`¿Deseas promocionar esta idea y crear al contacto "${idea.cliente_potencial || "Cliente Potencial"}" en tu pipeline del CRM?`)) return;
        const toastId = toast.loading("Creando contacto en el pipeline...");
        try {
            await clientesStore.create({
                nombre: idea.cliente_potencial || "Cliente Potencial",
                negocio: idea.rubro || "Interesado en " + idea.titulo,
                email: "",
                tel: "",
                canal: "Ideas Galu",
                etapa: "contacto",
                info_investigacion: {
                    que_hace: idea.descripcion,
                    puntos_debiles: "Idea originada del banco de ideas. Notas: " + (idea.notas_adicionales || "Ninguna"),
                    soluciones: "Propuesta de servicio/software: " + idea.titulo,
                },
                msg_whatsapp: "",
                notas_seguimiento: [
                    { id: crypto.randomUUID(), fecha: new Date().toISOString(), texto: "Contacto creado a partir de la idea: " + idea.titulo }
                ]
            });
            
            // Mark idea as approved
            await ideasStore.update(idea.id, { estado: "aprobada" });
            toast.success("¡Lead creado con éxito en el CRM! La idea fue marcada como Aprobada.", { id: toastId });
            await reload();
        } catch (error) {
            console.error(error);
            toast.error("Error al promocionar a lead", { id: toastId });
        }
    };

    // Run AI Consult (Gemini API)
    const runAiConsult = async (idea: Idea) => {
        setSelectedIdea(idea);
        setAiResult("");
        setLoadingAi(true);
        setShowAiModal(true);
        setAiTab("canvas");
        
        try {
            const res = await fetch("/api/gemini", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ idea })
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Error al procesar con IA");
            }
            setAiResult(data.text);
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Error al comunicarse con Gemini");
            setShowAiModal(false);
        } finally {
            setLoadingAi(false);
        }
    };

    // Calculations
    const getPriorityScore = (idea: Idea) => {
        // Impact (1-5) / Difficulty (1-5)
        // High impact and Low difficulty is best.
        // E.g. Impact = 5, Difficulty = 1 => 5/1 = 5
        // E.g. Impact = 1, Difficulty = 5 => 1/5 = 0.2
        return Number((idea.impacto / idea.dificultad).toFixed(2));
    };

    // Filtering and Sorting
    const filteredIdeas = ideas
        .filter((idea) => {
            const matchesSearch = 
                idea.titulo.toLowerCase().includes(search.toLowerCase()) ||
                idea.descripcion.toLowerCase().includes(search.toLowerCase()) ||
                (idea.rubro && idea.rubro.toLowerCase().includes(search.toLowerCase())) ||
                (idea.cliente_potencial && idea.cliente_potencial.toLowerCase().includes(search.toLowerCase()));
            
            const matchesCategory = filterCategory === "all" || idea.categoria === filterCategory;
            const matchesStatus = filterStatus === "all" || idea.estado === filterStatus;

            return matchesSearch && matchesCategory && matchesStatus;
        })
        .sort((a, b) => {
            if (sortBy === "recent") {
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
            if (sortBy === "priority") {
                return getPriorityScore(b) - getPriorityScore(a);
            }
            if (sortBy === "impact") {
                return b.impacto - a.impacto;
            }
            if (sortBy === "difficulty") {
                return a.dificultad - b.dificultad; // Lower difficulty first
            }
            return 0;
        });

    // Parse Markdown Sections for AI Output
    const getAiSectionContent = (sectionIndex: number) => {
        if (!aiResult) return "Cargando análisis...";
        
        // Split by ### markdown header
        const sections = aiResult.split(/(?=###\s+\d+\.)/);
        
        if (sections.length > sectionIndex) {
            // Remove the header name from the content
            return sections[sectionIndex]
                .replace(/###\s+\d+\..*\n/, "")
                .trim();
        }
        
        return aiResult;
    };

    // Rating render helper
    const renderStars = (count: number, colorClass: string) => {
        return (
            <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                    <Star 
                        key={i} 
                        className={cn(
                            "w-3.5 h-3.5", 
                            i < count ? `${colorClass} fill-current` : "text-muted-foreground/30"
                        )} 
                    />
                ))}
            </div>
        );
    };

    // Stats calculations
    const totalIdeas = ideas.length;
    const quickWins = ideas.filter(i => getPriorityScore(i) >= 1.5).length;
    const activeResearch = ideas.filter(i => i.estado === "investigando").length;
    const approvedCount = ideas.filter(i => i.estado === "aprobada").length;

    if (!mounted) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-56 bg-secondary/30 rounded-2xl border border-border/50" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-foreground flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <Lightbulb className="w-7 h-7 animate-pulse-soft" />
                        </div>
                        Banco de Ideas
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Registra, analiza con IA y madura tus proyectos de software, servicios y SaaS</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowNew(true); }}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20"
                >
                    <Plus className="w-5 h-5" /> Nueva Idea
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-border bg-card">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Total de Ideas</p>
                    <h3 className="text-2xl font-bold mt-1 text-foreground">{totalIdeas}</h3>
                </div>
                <div className="p-4 rounded-xl border border-border bg-card">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">⚡ Quick Wins</p>
                    <h3 className="text-2xl font-bold mt-1 text-emerald-400">{quickWins}</h3>
                </div>
                <div className="p-4 rounded-xl border border-border bg-card">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Investigando</p>
                    <h3 className="text-2xl font-bold mt-1 text-cyan-400">{activeResearch}</h3>
                </div>
                <div className="p-4 rounded-xl border border-border bg-card">
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Aprobadas</p>
                    <h3 className="text-2xl font-bold mt-1 text-purple-400">{approvedCount}</h3>
                </div>
            </div>

            {/* Tool Bar / Filters */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[240px] max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por título, descripción o rubro..."
                            className="w-full h-11 pl-10 pr-4 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                        />
                    </div>

                    {/* Category Filter */}
                    <div className="flex items-center gap-1.5 bg-secondary border border-border rounded-xl px-3 py-1">
                        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="bg-transparent border-none text-xs text-foreground font-medium outline-none cursor-pointer h-9 py-1"
                        >
                            <option value="all">Todas las Categorías</option>
                            {Object.entries(CATEGORIA_IDEA_LABELS).map(([key, val]) => (
                                <option key={key} value={key}>{val}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-1.5 bg-secondary border border-border rounded-xl px-3 py-1">
                        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="bg-transparent border-none text-xs text-foreground font-medium outline-none cursor-pointer h-9 py-1"
                        >
                            <option value="all">Todos los Estados</option>
                            {Object.entries(ESTADO_IDEA_LABELS).map(([key, val]) => (
                                <option key={key} value={key}>{val}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Sorting */}
                <div className="flex items-center gap-2 self-end xl:self-auto">
                    <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Ordenar por:</span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="h-10 px-3 rounded-xl bg-secondary border border-border text-xs text-foreground font-semibold outline-none cursor-pointer focus:ring-2 focus:ring-primary/40"
                    >
                        <option value="priority">Prioridad (Quick Wins)</option>
                        <option value="recent">Más Recientes</option>
                        <option value="impact">Mayor Impacto</option>
                        <option value="difficulty">Menor Dificultad</option>
                    </select>
                </div>
            </div>

            {/* Ideas Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredIdeas.map((idea) => {
                    const score = getPriorityScore(idea);
                    // Quick Win badge
                    const isQuickWin = score >= 1.5;
                    
                    return (
                        <div 
                            key={idea.id} 
                            className="flex flex-col group rounded-2xl border border-border hover:border-primary/40 bg-card p-5 transition-all shadow-sm hover:shadow-lg relative overflow-hidden card-hover"
                        >
                            {/* Score banner */}
                            <div className="absolute top-0 right-0 left-0 h-[3px] bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className="flex items-start justify-between mb-3 gap-2">
                                <div className="flex flex-wrap gap-1.5">
                                    <span className={cn("text-[10px] px-2.5 py-0.5 rounded-full border font-bold uppercase tracking-wider", CATEGORIA_IDEA_COLORS[idea.categoria])}>
                                        {CATEGORIA_IDEA_LABELS[idea.categoria]}
                                    </span>
                                    <span className={cn("text-[10px] px-2 py-0.5 rounded-md border font-semibold", ESTADO_IDEA_COLORS[idea.estado])}>
                                        {ESTADO_IDEA_LABELS[idea.estado]}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button 
                                        onClick={() => handleEdit(idea)}
                                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                                        title="Editar idea"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(idea.id)}
                                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                        title="Eliminar idea"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 space-y-2">
                                <h4 className="text-base font-bold text-foreground line-clamp-1 leading-tight group-hover:text-primary transition-colors">
                                    {idea.titulo}
                                </h4>
                                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed whitespace-pre-line italic">
                                    &quot;{idea.descripcion}&quot;
                                </p>

                                {/* Meta details */}
                                {(idea.rubro || idea.cliente_potencial) && (
                                    <div className="pt-2 flex flex-col gap-1 border-t border-border/40 text-[11px]">
                                        {idea.rubro && (
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <Building2 className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                                                <span className="truncate">Rubro: <strong className="text-foreground">{idea.rubro}</strong></span>
                                            </div>
                                        )}
                                        {idea.cliente_potencial && (
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <Users className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                                                <span className="truncate">Target: <strong className="text-foreground">{idea.cliente_potencial}</strong></span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Impact & Difficulty Section */}
                            <div className="mt-4 pt-3 border-t border-border flex flex-col gap-2 bg-secondary/30 p-2.5 rounded-xl">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Impacto</span>
                                    {renderStars(idea.impacto, "text-amber-400")}
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Dificultad</span>
                                    {renderStars(idea.dificultad, "text-rose-400")}
                                </div>
                                <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
                                    <span className="text-xs text-muted-foreground font-bold flex items-center gap-1">
                                        Prioridad
                                        {isQuickWin && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-black">QUICK WIN</span>}
                                    </span>
                                    <span className={cn("text-xs font-black", isQuickWin ? "text-emerald-400" : "text-foreground")}>
                                        {score} pt
                                    </span>
                                </div>
                            </div>

                            {/* Core Actions */}
                            <div className="mt-4 pt-2 flex items-center justify-between gap-2 border-t border-border/30">
                                {idea.cliente_potencial && idea.estado !== "aprobada" ? (
                                    <button
                                        onClick={() => handlePromoteToLead(idea)}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/25 text-[11px] font-bold transition-all"
                                        title="Crear como lead en el pipeline"
                                    >
                                        Crear Lead <ArrowUpRight className="w-3 h-3" />
                                    </button>
                                ) : (
                                    <div className="text-[10px] text-muted-foreground">
                                        Creado: {formatDate(idea.created_at)}
                                    </div>
                                )}

                                <button
                                    onClick={() => runAiConsult(idea)}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 text-[11px] font-black transition-all"
                                >
                                    <BrainCircuit className="w-3.5 h-3.5" /> Analizar con IA
                                </button>
                            </div>
                        </div>
                    );
                })}

                {filteredIdeas.length === 0 && (
                    <div className="col-span-1 md:col-span-2 lg:col-span-3 py-20 text-center border-2 border-dashed border-border/60 rounded-3xl bg-secondary/5">
                        <Lightbulb className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4 animate-bounce-soft" />
                        <h3 className="text-xl font-bold text-foreground mb-1">No se encontraron ideas</h3>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto px-4">
                            Intenta cambiar los filtros de categoría/estado o escribe una nueva idea para tu banco.
                        </p>
                        <button
                            onClick={() => { setSearch(""); setFilterCategory("all"); setFilterStatus("all"); }}
                            className="mt-4 px-4 py-2 text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg"
                        >
                            Limpiar Filtros
                        </button>
                    </div>
                )}
            </div>

            {/* Create/Edit Idea Modal */}
            {showNew && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between mb-5 border-b border-border/40 pb-3">
                            <h3 className="text-lg font-bold text-foreground">
                                {editing ? "Editar Idea de Negocio" : "Registrar Nueva Idea"}
                            </h3>
                            <button onClick={resetForm} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            {/* Title */}
                            <div>
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-1">Título *</label>
                                <input 
                                    value={form.titulo} 
                                    onChange={(e) => setForm({ ...form, titulo: e.target.value })} 
                                    className="w-full h-11 px-3.5 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-semibold"
                                    placeholder="Ej: SaaS para Clínicas Dentales de Alta Gama"
                                />
                            </div>

                            {/* Category & Status */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-1">Categoría</label>
                                    <select 
                                        value={form.categoria} 
                                        onChange={(e) => setForm({ ...form, categoria: e.target.value as CategoriaIdea })}
                                        className="w-full h-11 px-3 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none cursor-pointer"
                                    >
                                        {Object.entries(CATEGORIA_IDEA_LABELS).map(([key, val]) => (
                                            <option key={key} value={key}>{val}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-1">Estado</label>
                                    <select 
                                        value={form.estado} 
                                        onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoIdea })}
                                        className="w-full h-11 px-3 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none cursor-pointer"
                                    >
                                        {Object.entries(ESTADO_IDEA_LABELS).map(([key, val]) => (
                                            <option key={key} value={key}>{val}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-1">Descripción de la Idea *</label>
                                <textarea 
                                    value={form.descripcion} 
                                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })} 
                                    rows={4} 
                                    className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none transition-all leading-relaxed"
                                    placeholder="Detalla de qué trata la idea, qué problema resuelve y cómo funcionará. Tómate el espacio necesario."
                                />
                            </div>

                            {/* Rubro & Target Customer */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-1">Rubro / Sector</label>
                                    <input 
                                        value={form.rubro} 
                                        onChange={(e) => setForm({ ...form, rubro: e.target.value })} 
                                        className="w-full h-11 px-3 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none"
                                        placeholder="Ej: Salud, Inmobiliario, Comercio"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-1">Cliente Objetivo / Target</label>
                                    <input 
                                        value={form.cliente_potencial} 
                                        onChange={(e) => setForm({ ...form, cliente_potencial: e.target.value })} 
                                        className="w-full h-11 px-3 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none"
                                        placeholder="Ej: Dr. García, Clínicas locales"
                                    />
                                </div>
                            </div>

                            {/* Impact & Difficulty Ratings (1-5 sliders/stars) */}
                            <div className="grid grid-cols-2 gap-4 p-3.5 rounded-xl border border-border bg-secondary/25">
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-1.5 flex items-center justify-between">
                                        <span>Impacto (1-5)</span>
                                        <span className="text-primary font-black">{form.impacto}</span>
                                    </label>
                                    <input 
                                        type="range" 
                                        min="1" 
                                        max="5" 
                                        value={form.impacto}
                                        onChange={(e) => setForm({ ...form, impacto: parseInt(e.target.value) })}
                                        className="w-full accent-primary cursor-pointer h-1.5 bg-secondary rounded-lg appearance-none"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1">Beneficio / Retorno esperado</p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-1.5 flex items-center justify-between">
                                        <span>Dificultad (1-5)</span>
                                        <span className="text-rose-400 font-black">{form.dificultad}</span>
                                    </label>
                                    <input 
                                        type="range" 
                                        min="1" 
                                        max="5" 
                                        value={form.dificultad}
                                        onChange={(e) => setForm({ ...form, dificultad: parseInt(e.target.value) })}
                                        className="w-full accent-rose-400 cursor-pointer h-1.5 bg-secondary rounded-lg appearance-none"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1">Horas / Complejidad técnica</p>
                                </div>
                            </div>

                            {/* Additional notes */}
                            <div>
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest block mb-1">Notas Adicionales / Referencias</label>
                                <textarea 
                                    value={form.notas_adicionales} 
                                    onChange={(e) => setForm({ ...form, notas_adicionales: e.target.value })} 
                                    rows={2} 
                                    className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none transition-all leading-relaxed"
                                    placeholder="Enlaces a competidores, tecnologías propuestas u observaciones..."
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 mt-6 border-t border-border/40 pt-4 bg-secondary/5 -mx-6 -mb-6 p-4 rounded-b-2xl">
                            <button 
                                onClick={resetForm} 
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-secondary transition-all"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSave} 
                                className="px-6 py-2.5 rounded-xl text-sm bg-primary text-primary-foreground font-black hover:opacity-95 active:scale-95 shadow-md shadow-primary/15 transition-all"
                            >
                                {editing ? "Actualizar Idea" : "Guardar Idea"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Consult / Gemini Assistant Modal */}
            {showAiModal && selectedIdea && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                    <div className="w-full max-w-3xl flex flex-col max-h-[90vh] rounded-[2rem] border border-primary/30 bg-card p-6 md:p-8 shadow-2xl animate-fade-in relative overflow-hidden">
                        
                        {/* Title bar */}
                        <div className="flex items-center justify-between mb-5 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-2xl bg-primary text-primary-foreground shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)] animate-pulse-soft">
                                    <BrainCircuit className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl md:text-2xl font-black text-foreground">Asistente de Idea Galu IA</h3>
                                    <p className="text-xs text-primary font-bold tracking-wider uppercase mt-0.5">Analizando: {selectedIdea.titulo}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => { setShowAiModal(false); setAiResult(""); }} 
                                className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {loadingAi ? (
                            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-4">
                                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                                <div>
                                    <p className="text-base font-bold text-foreground">Consultando a Gemini 1.5 Flash...</p>
                                    <p className="text-xs text-muted-foreground max-w-xs mt-1">Estructurando el Lean Canvas, MVP y el Pitch de WhatsApp.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col overflow-hidden min-h-[300px]">
                                {/* Tabs */}
                                <div className="flex border-b border-border shrink-0 mb-4 bg-secondary/35 p-1 rounded-xl">
                                    <button
                                        onClick={() => setAiTab("canvas")}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all",
                                            aiTab === "canvas" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <Code className="w-3.5 h-3.5" /> Lean Canvas
                                    </button>
                                    <button
                                        onClick={() => setAiTab("mvp")}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all",
                                            aiTab === "mvp" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <BrainCircuit className="w-3.5 h-3.5" /> MVP Requeridos
                                    </button>
                                    <button
                                        onClick={() => setAiTab("whatsapp")}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all",
                                            aiTab === "whatsapp" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Pitch
                                    </button>
                                </div>

                                {/* Content container */}
                                <div className="flex-1 overflow-y-auto bg-secondary/20 border border-border/60 rounded-2xl p-5 md:p-6 custom-scrollbar">
                                    {aiTab === "canvas" && (
                                        <div className="whitespace-pre-line text-sm leading-relaxed text-foreground prose prose-invert font-sans">
                                            {getAiSectionContent(0)}
                                        </div>
                                    )}
                                    {aiTab === "mvp" && (
                                        <div className="whitespace-pre-line text-sm leading-relaxed text-foreground prose prose-invert font-sans">
                                            {getAiSectionContent(1)}
                                        </div>
                                    )}
                                    {aiTab === "whatsapp" && (
                                        <div className="space-y-4">
                                            <div className="whitespace-pre-line text-sm leading-relaxed font-sans bg-card border border-border p-4 rounded-xl italic">
                                                {getAiSectionContent(2)}
                                            </div>
                                            
                                            {/* WhatsApp Web Direct Link Creator */}
                                            <div className="pt-4 border-t border-border flex flex-col md:flex-row items-end gap-3 bg-card p-4 rounded-xl">
                                                <div className="flex-1 w-full space-y-1">
                                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Número de WhatsApp (con código de país)</label>
                                                    <input
                                                        type="tel"
                                                        value={phone}
                                                        onChange={(e) => setPhone(e.target.value)}
                                                        placeholder="Ej: 5491122334455"
                                                        className="w-full h-11 px-3 rounded-xl bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                                    />
                                                </div>
                                                
                                                <div className="flex gap-2 w-full md:w-auto shrink-0">
                                                    <button
                                                        onClick={() => {
                                                            const pitch = getAiSectionContent(2);
                                                            navigator.clipboard.writeText(pitch);
                                                            toast.success("Pitch copiado al portapapeles");
                                                        }}
                                                        className="flex-1 md:flex-none flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-border bg-secondary hover:bg-secondary/70 text-xs font-bold transition-all text-foreground"
                                                    >
                                                        <Copy className="w-4 h-4" /> Copiar Pitch
                                                    </button>
                                                    
                                                    <a
                                                        href={`https://wa.me/${phone ? phone.replace(/[^0-9]/g, "") : ""}?text=${encodeURIComponent(
                                                            getAiSectionContent(2)
                                                                .replace(/\[Nombre\]/g, selectedIdea.cliente_potencial || "")
                                                                .replace(/\[Tu Nombre\]/g, "Galu")
                                                        )}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={cn(
                                                            "flex-1 md:flex-none flex items-center justify-center gap-2 h-11 px-6 rounded-xl text-xs font-black text-white transition-all shadow-md",
                                                            phone ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/10" : "bg-emerald-600/50 cursor-not-allowed pointer-events-none"
                                                        )}
                                                    >
                                                        Enviar WhatsApp <ArrowUpRight className="w-4 h-4" />
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Modal Footer */}
                                <div className="mt-4 pt-4 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-3 shrink-0">
                                    <p className="text-[11px] text-muted-foreground italic flex items-center gap-1.5 self-start md:self-center">
                                        <Sparkles className="w-3.5 h-3.5 text-primary" /> Generado con Gemini 1.5 Flash y optimizado para prospección ágil.
                                    </p>
                                    <button
                                        onClick={() => { setShowAiModal(false); setAiResult(""); }}
                                        className="w-full md:w-auto px-6 py-2 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/70 text-foreground transition-all"
                                    >
                                        Cerrar Análisis
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
