"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Server, Globe, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { infraestructuraStore, clientesStore } from "@/lib/store";
import type { Infraestructura, TipoInfraestructura, Cliente } from "@/lib/types";
import { toast } from "sonner";

// --- Nuevo Registro Modal ---
function NuevoRegistroModal({
    open,
    onClose,
    onSave,
    clientes
}: {
    open: boolean;
    onClose: () => void;
    onSave: (data: Partial<Infraestructura>) => void;
    clientes: Cliente[];
}) {
    const [form, setForm] = useState({
        cliente_id: "",
        tipo: "dominio" as TipoInfraestructura,
        nombre: "",
        proveedor: "",
        fecha_vencimiento: "",
        costo: 0,
    });

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Server className="w-5 h-5 text-primary" />
                        Nuevo Registro
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Tipo *</label>
                            <select 
                                value={form.tipo} 
                                onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoInfraestructura })} 
                                className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                <option value="dominio">Dominio</option>
                                <option value="hosting">Hosting</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Cliente Asignado *</label>
                            <select 
                                value={form.cliente_id} 
                                onChange={(e) => setForm({ ...form, cliente_id: e.target.value })} 
                                className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                <option value="">Seleccionar...</option>
                                {clientes.map(c => (
                                    <option key={c.id} value={c.id}>{c.nombre} ({c.negocio})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                            Nombre {form.tipo === 'dominio' ? '(ej: midominio.com)' : '(ej: VPS Hostinger)'} *
                        </label>
                        <input 
                            value={form.nombre} 
                            onChange={(e) => setForm({ ...form, nombre: e.target.value })} 
                            className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" 
                        />
                    </div>

                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Proveedor (ej: DonDominio, Hostinger) *</label>
                        <input 
                            value={form.proveedor} 
                            onChange={(e) => setForm({ ...form, proveedor: e.target.value })} 
                            className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" 
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Fecha de Vencimiento *</label>
                            <input 
                                type="date"
                                value={form.fecha_vencimiento} 
                                onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })} 
                                className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" 
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Costo Anual / Renovación</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                <input 
                                    type="number"
                                    min="0"
                                    value={form.costo} 
                                    onChange={(e) => setForm({ ...form, costo: Number(e.target.value) })} 
                                    className="w-full h-10 pl-8 pr-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={() => {
                            if (!form.nombre.trim() || !form.cliente_id || !form.proveedor || !form.fecha_vencimiento) {
                                toast.error("Completa todos los campos obligatorios (*)");
                                return;
                            }
                            onSave(form);
                            setForm({ cliente_id: "", tipo: "dominio", nombre: "", proveedor: "", fecha_vencimiento: "", costo: 0 });
                            onClose();
                        }}
                        className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
                    >
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Main Page ---
export default function InfraestructuraPage() {
    const [registros, setRegistros] = useState<Infraestructura[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [mounted, setMounted] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [search, setSearch] = useState("");
    const [filterTipo, setFilterTipo] = useState<TipoInfraestructura | "todos">("todos");

    const reload = async () => {
        try {
            const [dataRegistros, dataClientes] = await Promise.all([
                infraestructuraStore.getAll(),
                clientesStore.getAll()
            ]);
            setRegistros(dataRegistros);
            setClientes(dataClientes);
        } catch (error) {
            console.error("Error reloading infraestructura:", error);
            toast.error("Error al cargar registros");
        }
    };

    useEffect(() => {
        reload().then(() => setMounted(true));
    }, []);

    const handleCreate = async (data: Partial<Infraestructura>) => {
        try {
            await infraestructuraStore.create(data as Omit<Infraestructura, "id" | "created_at">);
            await reload();
            toast.success("Registro añadido");
        } catch {
            toast.error("Error al crear registro");
        }
    };

    const handleDelete = async (id: string, nombre: string) => {
        if (!confirm(`¿Estás seguro de eliminar el registro de ${nombre}?`)) return;
        try {
            await infraestructuraStore.delete(id);
            await reload();
            toast.success("Registro eliminado");
        } catch {
            toast.error("Error al eliminar");
        }
    };

    // Calculate expirations
    const calculateStatus = (fechaStr: string | null) => {
        if (!fechaStr) return { color: "text-muted-foreground bg-secondary", icon: null, text: "Sin fecha" };
        const vencimiento = new Date(fechaStr);
        const hoy = new Date();
        const diffTime = vencimiento.getTime() - hoy.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { color: "text-rose-500 bg-rose-500/10 border border-rose-500/20", icon: <AlertTriangle className="w-3.5 h-3.5" />, text: `Vencido (hace ${Math.abs(diffDays)}d)` };
        if (diffDays <= 30) return { color: "text-amber-500 bg-amber-500/10 border border-amber-500/20", icon: <AlertTriangle className="w-3.5 h-3.5" />, text: `Próximo a vencer (${diffDays}d)` };
        return { color: "text-emerald-500 bg-emerald-500/10 border border-emerald-500/20", icon: <CheckCircle2 className="w-3.5 h-3.5" />, text: `Vigente (${diffDays}d)` };
    };

    const filtered = registros.filter((r) => {
        const matchSearch = r.nombre.toLowerCase().includes(search.toLowerCase()) || r.proveedor.toLowerCase().includes(search.toLowerCase()) || r.cliente?.nombre.toLowerCase().includes(search.toLowerCase());
        const matchTipo = filterTipo === "todos" || r.tipo === filterTipo;
        return matchSearch && matchTipo;
    });

    if (!mounted) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-[100px] rounded-xl skeleton" />
                <div className="h-[400px] rounded-xl skeleton" />
            </div>
        );
    }

    return (
        <div className="space-y-5 animate-fade-in max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Hostings & Dominios</h2>
                    <p className="text-sm text-muted-foreground">Control de infraestructura de clientes</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-secondary p-1 rounded-lg">
                        <button
                            onClick={() => setFilterTipo("todos")}
                            className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", filterTipo === "todos" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setFilterTipo("dominio")}
                            className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", filterTipo === "dominio" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                        >
                            Dominios
                        </button>
                        <button
                            onClick={() => setFilterTipo("hosting")}
                            className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", filterTipo === "hosting" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                        >
                            Hostings
                        </button>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar..."
                            className="w-[180px] h-9 pl-9 pr-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                    <button
                        onClick={() => setShowNew(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                        <Plus className="w-4 h-4" /> Nuevo
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b border-border">
                            <tr>
                                <th className="px-6 py-4 font-medium">Nombre</th>
                                <th className="px-6 py-4 font-medium">Cliente</th>
                                <th className="px-6 py-4 font-medium">Proveedor</th>
                                <th className="px-6 py-4 font-medium">Vencimiento</th>
                                <th className="px-6 py-4 font-medium text-right">Costo</th>
                                <th className="px-6 py-4 font-medium text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                                        No se encontraron registros de infraestructura.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((item) => {
                                    const status = calculateStatus(item.fecha_vencimiento);
                                    return (
                                        <tr key={item.id} className="hover:bg-secondary/30 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("p-2 rounded-lg", item.tipo === 'dominio' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500')}>
                                                        {item.tipo === 'dominio' ? <Globe className="w-4 h-4" /> : <Server className="w-4 h-4" />}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-foreground">{item.nombre}</div>
                                                        <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{item.tipo}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-medium text-foreground">{item.cliente?.nombre || 'Desconocido'}</span>
                                                <div className="text-[11px] text-muted-foreground">{item.cliente?.negocio}</div>
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground">
                                                {item.proveedor}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col items-start gap-1">
                                                    <span className="text-foreground">
                                                        {item.fecha_vencimiento ? new Date(item.fecha_vencimiento).toLocaleDateString("es-AR") : "No definida"}
                                                    </span>
                                                    {item.fecha_vencimiento && (
                                                        <span className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold", status.color)}>
                                                            {status.icon} {status.text}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-foreground">
                                                ${item.costo.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDelete(item.id, item.nombre)}
                                                    className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Eliminar registro"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <NuevoRegistroModal 
                open={showNew} 
                onClose={() => setShowNew(false)} 
                onSave={handleCreate} 
                clientes={clientes} 
            />
        </div>
    );
}
