"use client";

import { useEffect, useState } from "react";
import { Plus, ClipboardList, X, Save } from "lucide-react";
import { formatDate, getInitials } from "@/lib/utils";
import { briefsStore, clientesStore } from "@/lib/store";
import type { Brief, BriefRespuesta, Cliente } from "@/lib/types";
import { BRIEF_QUESTIONS } from "@/lib/templates";
import { toast } from "sonner";

export default function BriefsPage() {
    const [briefs, setBriefs] = useState<Brief[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [mounted, setMounted] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [editing, setEditing] = useState<Brief | null>(null);
    const [clienteId, setClienteId] = useState("");
    const [respuestas, setRespuestas] = useState<BriefRespuesta[]>([]);

    const reload = async () => {
        try {
            const [b, c] = await Promise.all([
                briefsStore.getAll(),
                clientesStore.getAll()
            ]);
            setBriefs(b);
            setClientes(c);
        } catch (_error) {
            console.error("Error reloading briefs:", _error);
        }
    };
    useEffect(() => { reload().then(() => setMounted(true)); }, []);

    const startNew = () => {
        setRespuestas(BRIEF_QUESTIONS.map((q) => ({ pregunta: q, respuesta: "" })));
        setClienteId("");
        setEditing(null);
        setShowNew(true);
    };

    const startEdit = (brief: Brief) => {
        setRespuestas(brief.respuestas.length > 0 ? brief.respuestas : BRIEF_QUESTIONS.map((q) => ({ pregunta: q, respuesta: "" })));
        setClienteId(brief.cliente_id);
        setEditing(brief);
        setShowNew(true);
    };

    const handleSave = async () => {
        if (!clienteId) { toast.error("Selecciona un cliente"); return; }
        try {
            if (editing) {
                await briefsStore.update(editing.id, { respuestas });
                toast.success("Brief actualizado");
            } else {
                await briefsStore.create({ cliente_id: clienteId, respuestas });
                toast.success("Brief creado");
            }
            setShowNew(false);
            setEditing(null);
            await reload();
        } catch (_error) {
            toast.error("Error al guardar brief");
        }
    };

    const updateRespuesta = (i: number, value: string) => {
        const updated = [...respuestas];
        updated[i].respuesta = value;
        setRespuestas(updated);
    };

    if (!mounted) {
        return <div className="space-y-3 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl skeleton" />)}</div>;
    }

    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Briefs</h2>
                    <p className="text-sm text-muted-foreground">{briefs.length} briefs completados</p>
                </div>
                <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                    <Plus className="w-4 h-4" /> Nuevo Brief
                </button>
            </div>

            {/* Brief Form Modal */}
            {showNew && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
                    <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold text-foreground">{editing ? "Editar Brief" : "Nuevo Brief"}</h3>
                            <button onClick={() => setShowNew(false)} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5 text-muted-foreground" /></button>
                        </div>
                        {!editing && (
                            <div className="mb-5">
                                <label className="text-xs text-muted-foreground mb-1 block">Cliente</label>
                                <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                                    <option value="">Seleccionar cliente...</option>
                                    {clientes.map((c) => (<option key={c.id} value={c.id}>{c.nombre} — {c.negocio}</option>))}
                                </select>
                            </div>
                        )}
                        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-2">
                            {respuestas.map((r, i) => (
                                <div key={i}>
                                    <label className="text-xs text-primary font-medium mb-1 block">{i + 1}. {r.pregunta}</label>
                                    <textarea
                                        value={r.respuesta}
                                        onChange={(e) => updateRespuesta(i, e.target.value)}
                                        rows={2}
                                        placeholder="Respuesta del cliente..."
                                        className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancelar</button>
                            <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:opacity-90 flex items-center gap-2">
                                <Save className="w-4 h-4" /> Guardar Brief
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Briefs List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {briefs.map((b) => {
                    const cliente = clientes.find((c) => c.id === b.cliente_id);
                    const answered = b.respuestas.filter((r) => r.respuesta.trim()).length;
                    return (
                        <button
                            key={b.id}
                            onClick={() => startEdit(b)}
                            className="w-full text-left rounded-xl border border-border bg-card p-5 card-hover group"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/40 to-cyan-500/40 flex items-center justify-center text-xs font-bold text-foreground">
                                    {cliente ? getInitials(cliente.nombre) : "?"}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{cliente?.nombre || "Cliente"}</p>
                                    <p className="text-xs text-muted-foreground">{cliente?.negocio} · {formatDate(b.created_at)}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">{answered}/{b.respuestas.length} preguntas respondidas</span>
                                </div>
                                <div className="h-1.5 w-20 rounded-full bg-secondary overflow-hidden">
                                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${(answered / b.respuestas.length) * 100}%` }} />
                                </div>
                            </div>
                        </button>
                    );
                })}
                {briefs.length === 0 && (
                    <div className="col-span-2 py-12 text-center text-muted-foreground">
                        <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No hay briefs aún. Crea el primero para tus clientes.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
