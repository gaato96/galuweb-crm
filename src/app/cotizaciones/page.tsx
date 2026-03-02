"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, X, FileText, Sparkles, Send } from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { cotizacionesStore, clientesStore } from "@/lib/store";
import type { Cotizacion, CotizacionItem, EstadoCotizacion, Cliente } from "@/lib/types";
import { toast } from "sonner";

const ESTADO_BADGE: Record<EstadoCotizacion, string> = {
    borrador: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    enviada: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    aceptada: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    rechazada: "bg-rose-500/20 text-rose-300 border-rose-500/30",
};

export default function CotizacionesPage() {
    const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [mounted, setMounted] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showAI, setShowAI] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [aiLoading, setAiLoading] = useState(false);

    // Form state
    const [clienteId, setClienteId] = useState("");
    const [items, setItems] = useState<CotizacionItem[]>([{ descripcion: "", precio: 0 }]);
    const [notas, setNotas] = useState("");

    const reload = async () => {
        try {
            const [q, c] = await Promise.all([
                cotizacionesStore.getAll(),
                clientesStore.getAll()
            ]);
            setCotizaciones(q);
            setClientes(c);
        } catch (error) {
            console.error("Error reloading quotes:", error);
        }
    };
    useEffect(() => { reload().then(() => setMounted(true)); }, []);

    const addItem = () => setItems([...items, { descripcion: "", precio: 0 }]);
    const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
    const updateItem = (i: number, field: keyof CotizacionItem, value: string | number) => {
        const updated = [...items];
        if (field === "precio") updated[i][field] = Number(value);
        else updated[i][field] = value as string;
        setItems(updated);
    };
    const total = items.reduce((sum, item) => sum + item.precio, 0);

    const handleSave = async () => {
        if (!clienteId) { toast.error("Selecciona un cliente"); return; }
        if (items.length === 0 || !items[0].descripcion) { toast.error("Agrega al menos un ítem"); return; }
        try {
            await cotizacionesStore.create({
                cliente_id: clienteId,
                total,
                items: items.filter((i) => i.descripcion),
                estado: "borrador",
                pdf_url: "",
                notas,
            });
            setShowNew(false);
            setItems([{ descripcion: "", precio: 0 }]);
            setClienteId("");
            setNotas("");
            await reload();
            toast.success("Cotización creada");
        } catch (error) {
            toast.error("Error al guardar cotización");
        }
    };

    const handleAIGenerate = async () => {
        if (!transcript.trim()) { toast.error("Pega una transcripción o notas"); return; }
        setAiLoading(true);
        // Simulate AI generation (replace with actual API call later)
        await new Promise((r) => setTimeout(r, 1500));
        const generated: CotizacionItem[] = [
            { descripcion: "Diseño UI/UX personalizado", precio: 800 },
            { descripcion: "Desarrollo Frontend Responsive", precio: 1200 },
            { descripcion: "Integración de funcionalidades", precio: 600 },
            { descripcion: "Optimización SEO On-Page", precio: 400 },
            { descripcion: "Hosting y Deploy", precio: 300 },
        ];
        setItems(generated);
        setShowAI(false);
        setShowNew(true);
        setAiLoading(false);
        toast.success("Ítems generados por IA — revisa y ajusta los precios");
    };

    const updateEstado = async (id: string, estado: EstadoCotizacion) => {
        try {
            await cotizacionesStore.update(id, { estado });
            await reload();
            toast.success(`Cotización marcada como ${estado}`);
        } catch (error) {
            toast.error("Error al actualizar estado");
        }
    };

    if (!mounted) {
        return <div className="space-y-3 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl skeleton" />)}</div>;
    }

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Cotizaciones</h2>
                    <p className="text-sm text-muted-foreground">{cotizaciones.length} cotizaciones</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowAI(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground hover:border-primary/30 transition-colors">
                        <Sparkles className="w-4 h-4 text-amber-400" /> Generar con IA
                    </button>
                    <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                        <Plus className="w-4 h-4" /> Nueva
                    </button>
                </div>
            </div>

            {/* AI Transcript Modal */}
            {showAI && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-foreground flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-400" /> Generar Cotización con IA</h3>
                            <button onClick={() => setShowAI(false)} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5 text-muted-foreground" /></button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">Pega la transcripción de tu reunión o notas sueltas. La IA generará los ítems con precios sugeridos.</p>
                        <textarea
                            value={transcript}
                            onChange={(e) => setTranscript(e.target.value)}
                            rows={8}
                            placeholder="El cliente necesita una landing page para su restaurante, con menú digital, formulario de contacto..."
                            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                        />
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setShowAI(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancelar</button>
                            <button onClick={handleAIGenerate} disabled={aiLoading} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                                {aiLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                {aiLoading ? "Generando..." : "Generar Ítems"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Quote Form */}
            {showNew && (
                <div className="rounded-xl border border-primary/30 bg-card p-5 space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-foreground">Nueva Cotización</h3>
                        <button onClick={() => setShowNew(false)} className="p-1 rounded-lg hover:bg-secondary"><X className="w-4 h-4 text-muted-foreground" /></button>
                    </div>
                    <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                        <option value="">Seleccionar cliente...</option>
                        {clientes.map((c) => (<option key={c.id} value={c.id}>{c.nombre} — {c.negocio}</option>))}
                    </select>
                    {/* Items Table */}
                    <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_120px_40px] gap-2 text-[10px] text-muted-foreground uppercase">
                            <span>Descripción</span><span>Precio</span><span></span>
                        </div>
                        {items.map((item, i) => (
                            <div key={i} className="grid grid-cols-[1fr_120px_40px] gap-2">
                                <input value={item.descripcion} onChange={(e) => updateItem(i, "descripcion", e.target.value)} className="h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Descripción del servicio..." />
                                <input type="number" value={item.precio || ""} onChange={(e) => updateItem(i, "precio", e.target.value)} className="h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="0" />
                                <button onClick={() => removeItem(i)} className="h-9 flex items-center justify-center rounded-lg hover:bg-destructive/20"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                            </div>
                        ))}
                        <button onClick={addItem} className="text-xs text-primary hover:underline">+ Agregar ítem</button>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <span className="text-sm font-medium text-foreground">Total</span>
                        <span className="text-lg font-bold text-primary">{formatCurrency(total)}</span>
                    </div>
                    <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Notas adicionales..." className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                    <div className="flex justify-end">
                        <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:opacity-90">Guardar Cotización</button>
                    </div>
                </div>
            )}

            {/* Cotizaciones List */}
            <div className="space-y-3">
                {cotizaciones.map((q) => {
                    const cliente = clientes.find((c) => c.id === q.cliente_id);
                    return (
                        <div key={q.id} className="rounded-xl border border-border bg-card p-4 card-hover">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h4 className="text-sm font-semibold text-foreground">{cliente?.nombre || "Cliente"}</h4>
                                    <p className="text-xs text-muted-foreground">{cliente?.negocio} · {formatDate(q.created_at)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={cn("text-[10px] px-2.5 py-1 rounded-full border font-medium capitalize", ESTADO_BADGE[q.estado])}>{q.estado}</span>
                                    <span className="text-base font-bold text-foreground">{formatCurrency(q.total)}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
                                {q.items.map((item, i) => (
                                    <div key={i} className="flex justify-between text-xs px-2 py-1.5 rounded bg-secondary/50">
                                        <span className="text-muted-foreground">{item.descripcion}</span>
                                        <span className="text-foreground font-medium">{formatCurrency(item.precio)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-1.5">
                                {(["borrador", "enviada", "aceptada", "rechazada"] as EstadoCotizacion[]).map((e) => (
                                    <button
                                        key={e}
                                        onClick={() => updateEstado(q.id, e)}
                                        className={cn("px-2 py-1 rounded text-[10px] capitalize transition-colors",
                                            q.estado === e ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-secondary"
                                        )}
                                    >{e}</button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
