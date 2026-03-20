"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Clock, ExternalLink, MessageCircle, Calendar, FileText, Zap } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { proyectosStore, tareasStore, clientesStore, cotizacionesStore } from "@/lib/store";
import type { Proyecto, Tarea, Cliente, Cotizacion } from "@/lib/types";

export default function PortalClient({ slug }: { slug: string }) {
    const [proyecto, setProyecto] = useState<Proyecto | null>(null);
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [cliente, setCliente] = useState<Cliente | null>(null);
    const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
    const [mounted, setMounted] = useState(false);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const allProyectos = await proyectosStore.getAll();
                const found = allProyectos.find((p) => p.slug_portal === slug);
                if (!found) {
                    setNotFound(true);
                    setMounted(true);
                    return;
                }
                setProyecto(found);

                const [pts, foundCliente] = await Promise.all([
                    tareasStore.getByProyecto(found.id),
                    found.cliente_id ? clientesStore.getById(found.cliente_id) : Promise.resolve(null)
                ]);

                setTareas(pts);
                setCliente(foundCliente || null);

                if (foundCliente) {
                    const quotes = await cotizacionesStore.getByCliente(foundCliente.id);
                    setCotizaciones(quotes);
                }
            } catch (error) {
                console.error("Error loading portal data:", error);
            } finally {
                setMounted(true);
            }
        };
        load();
    }, [slug]);

    if (!mounted) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
                    <p className="text-muted-foreground">Proyecto no encontrado</p>
                </div>
            </div>
        );
    }

    if (!proyecto) return null;

    const completed = tareas.filter((t) => t.estado === "completada").length;
    const total = tareas.length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    const TIPO_LABEL: Record<string, string> = {
        landing: "Landing Page",
        institucional: "Web Institucional",
        ecommerce: "E-Commerce",
    };

    // Phase calculation
    const phases = [
        { label: "Diseño", tasks: tareas.filter((t) => t.categoria === "diseno") },
        { label: "Contenido", tasks: tareas.filter((t) => t.categoria === "contenido") },
        { label: "Desarrollo", tasks: tareas.filter((t) => t.categoria === "dev") },
        { label: "SEO", tasks: tareas.filter((t) => t.categoria === "seo") },
    ].filter((p) => p.tasks.length > 0);

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border glass sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20">
                            <Zap className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-sm font-bold gradient-text">Galu CRM</span>
                    </div>
                    <span className="text-xs text-muted-foreground">Portal del Cliente</span>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8 space-y-8 animate-fade-in">
                {/* Project Header */}
                <div className="text-center">
                    <span className="text-xs text-primary uppercase tracking-widest font-medium">{TIPO_LABEL[proyecto.tipo_proyecto]}</span>
                    <h1 className="text-3xl font-bold text-foreground mt-1">{proyecto.nombre}</h1>
                    {cliente && <p className="text-muted-foreground mt-1">{cliente.nombre} · {cliente.negocio}</p>}
                </div>

                {/* Progress Overview */}
                <div className="rounded-2xl border border-border bg-card p-6 glow-primary">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold text-foreground">Progreso del Proyecto</h2>
                        <span className="text-2xl font-bold text-primary">{progress}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-secondary overflow-hidden mb-4">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-primary via-purple-400 to-cyan-400 transition-all duration-700"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-sm text-muted-foreground">{completed} de {total} tareas completadas</p>
                </div>

                {/* Phase Timeline */}
                <div className="rounded-2xl border border-border bg-card p-6">
                    <h2 className="text-lg font-semibold text-foreground mb-5">Fases del Proyecto</h2>
                    <div className="relative">
                        {phases.map((phase, i) => {
                            const phaseCompleted = phase.tasks.filter((t) => t.estado === "completada").length;
                            const phaseTotal = phase.tasks.length;
                            const phaseProgress = phaseTotal > 0 ? Math.round((phaseCompleted / phaseTotal) * 100) : 0;
                            const isComplete = phaseProgress === 100;
                            const isActive = phaseProgress > 0 && phaseProgress < 100;

                            return (
                                <div key={phase.label} className="flex gap-4 mb-6 last:mb-0">
                                    <div className="flex flex-col items-center">
                                        <div className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                                            isComplete ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" :
                                                isActive ? "bg-primary/20 border-primary text-primary animate-pulse-soft" :
                                                    "bg-secondary border-border text-muted-foreground"
                                        )}>
                                            {isComplete ? <CheckCircle2 className="w-5 h-5" /> :
                                                isActive ? <Clock className="w-5 h-5" /> :
                                                    <Circle className="w-5 h-5" />}
                                        </div>
                                        {i < phases.length - 1 && (
                                            <div className={cn("w-0.5 flex-1 mt-2", isComplete ? "bg-emerald-500/40" : "bg-border")} />
                                        )}
                                    </div>
                                    <div className="flex-1 pt-1.5">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="text-sm font-semibold text-foreground">{phase.label}</h3>
                                            <span className="text-xs text-muted-foreground">{phaseCompleted}/{phaseTotal}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                            <div className={cn("h-full rounded-full transition-all", isComplete ? "bg-emerald-500" : "bg-primary/60")} style={{ width: `${phaseProgress}%` }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Figma */}
                    {proyecto.figma_url && (
                        <a href={proyecto.figma_url} target="_blank" rel="noopener"
                            className="flex items-center gap-4 p-5 rounded-2xl border border-border bg-card card-hover group">
                            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                <ExternalLink className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Diseño en Figma</h3>
                                <p className="text-xs text-muted-foreground">Ver el diseño de tu proyecto</p>
                            </div>
                        </a>
                    )}

                    {/* Calendly */}
                    {proyecto.calendly_url && (
                        <a href={proyecto.calendly_url} target="_blank" rel="noopener"
                            className="flex items-center gap-4 p-5 rounded-2xl border border-border bg-card card-hover group">
                            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Agendar Reunión</h3>
                                <p className="text-xs text-muted-foreground">Elige un horario disponible</p>
                            </div>
                        </a>
                    )}

                    {/* WhatsApp */}
                    {cliente?.tel && (
                        <a href={`https://wa.me/${cliente.tel.replace(/\D/g, "")}`} target="_blank" rel="noopener"
                            className="flex items-center gap-4 p-5 rounded-2xl border border-border bg-card card-hover group">
                            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                <MessageCircle className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Contactar por WhatsApp</h3>
                                <p className="text-xs text-muted-foreground">Enviar mensaje directo</p>
                            </div>
                        </a>
                    )}

                    {/* Cotización */}
                    {cotizaciones.length > 0 && (
                        <div className="flex items-center gap-4 p-5 rounded-2xl border border-border bg-card">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-foreground">Cotización</h3>
                                <p className="text-xs text-muted-foreground">{formatCurrency(cotizaciones[0].total)} · {cotizaciones[0].items.length} ítems</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Cotización Detail */}
                {cotizaciones.length > 0 && (
                    <div className="rounded-2xl border border-border bg-card p-6">
                        <h2 className="text-lg font-semibold text-foreground mb-4">Detalle de Cotización</h2>
                        <div className="space-y-2 mb-4">
                            {cotizaciones[0].items.map((item, i) => (
                                <div key={i} className="flex justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                                    <span className="text-sm text-foreground">{item.descripcion}</span>
                                    <span className="text-sm font-semibold text-foreground">{formatCurrency(item.precio)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                            <span className="text-sm font-semibold text-foreground">Total</span>
                            <span className="text-lg font-bold text-primary">{formatCurrency(cotizaciones[0].total)}</span>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center py-8 border-t border-border">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-primary" />
                        <span className="text-sm font-bold gradient-text">Galu CRM</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Powered by tu Agencia Web</p>
                </div>
            </main>
        </div>
    );
}
