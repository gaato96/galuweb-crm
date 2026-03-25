"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, MessageCircle, ArrowRight, X, GripVertical, Search, ShieldCheck } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { clientesStore, proyectosStore, tareasStore } from "@/lib/store";
import type { Cliente, EtapaCliente, TipoProyecto } from "@/lib/types";
import { ETAPA_LABELS, ETAPA_COLORS, FASES_PIPELINE } from "@/lib/types";
import { PROJECT_TEMPLATES } from "@/lib/templates";
import { slugify } from "@/lib/utils";
import { toast } from "sonner";
import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    useDraggable,
    useDroppable,
} from "@dnd-kit/core";
import { storageStore } from "@/lib/store";
import { Upload, FileText } from "lucide-react";

// --- Nuevo Cliente Modal ---
function NuevoClienteModal({
    open,
    onClose,
    onSave,
}: {
    open: boolean;
    onClose: () => void;
    onSave: (data: Partial<Cliente>) => void;
}) {
    const [form, setForm] = useState({
        nombre: "",
        negocio: "",
        email: "",
        tel: "",
        canal: "",
        mantenimiento_mensual: false,
    });

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-foreground">Nuevo Contacto</h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Nombre *</label>
                            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Negocio</label>
                            <input value={form.negocio} onChange={(e) => setForm({ ...form, negocio: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Teléfono</label>
                            <input value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Canal de Contacto</label>
                        <select value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value })} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                            <option value="">Seleccionar...</option>
                            <option value="Instagram">Instagram</option>
                            <option value="WhatsApp">WhatsApp</option>
                            <option value="Google">Google</option>
                            <option value="LinkedIn">LinkedIn</option>
                            <option value="Referido">Referido</option>
                            <option value="Email">Email</option>
                            <option value="Otro">Otro</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2 mt-2 p-3 bg-secondary/50 rounded-lg border border-border">
                        <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50"
                            checked={form.mantenimiento_mensual}
                            onChange={(e) => setForm({ ...form, mantenimiento_mensual: e.target.checked })}
                            id="mant-mensual"
                        />
                        <label htmlFor="mant-mensual" className="text-sm font-medium text-foreground cursor-pointer flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            Abona Mantenimiento Mensual
                        </label>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={() => {
                            if (!form.nombre.trim()) { toast.error("El nombre es obligatorio"); return; }
                            onSave({ ...form, etapa: "contacto" as EtapaCliente, info_investigacion: null, msg_whatsapp: "", notas_seguimiento: [] });
                            setForm({ nombre: "", negocio: "", email: "", tel: "", canal: "", mantenimiento_mensual: false });
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

// --- Nuevo Proyecto Modal ---
function NuevoProyectoModal({ open, onClose, cliente }: { open: boolean; onClose: () => void; cliente: Cliente | null }) {
    const [tipo, setTipo] = useState<TipoProyecto>("landing");
    const [nombre, setNombre] = useState("");

    useEffect(() => {
        if (cliente) setNombre(`${cliente.negocio} - Web`);
    }, [cliente]);

    if (!open || !cliente) return null;

    const handleCreate = async () => {
        if (!nombre.trim()) { toast.error("Nombre de proyecto requerido"); return; }
        try {
            const proyecto = await proyectosStore.create({
                cliente_id: cliente.id,
                nombre,
                descripcion: "",
                es_interno: false,
                accesos: [],
                tipo_proyecto: tipo,
                figma_url: "",
                calendly_url: "https://calendly.com/agencia/reunion",
                slug_portal: slugify(nombre + "-" + Date.now().toString(36)),
                estado: "activo",
            });
            // Auto-create tasks from template
            const template = PROJECT_TEMPLATES[tipo];
            await tareasStore.createBulk(
                template.map((t) => ({
                    proyecto_id: proyecto.id,
                    titulo: t.titulo,
                    descripcion: "",
                    prioridad: t.prioridad,
                    estado: "pendiente" as const,
                    categoria: t.categoria,
                }))
            );
            toast.success(`Proyecto "${nombre}" creado con ${template.length} tareas`);
            onClose();
        } catch (error) {
            toast.error("Error al crear el proyecto");
            console.error(error);
        }
    };

    const TIPOS = [
        { value: "landing" as const, label: "Landing Page", desc: "Página única de conversión" },
        { value: "institucional" as const, label: "Web Institucional", desc: "Sitio web completo multisección" },
        { value: "ecommerce" as const, label: "E-Commerce", desc: "Tienda online con pagos" },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-foreground">Nuevo Proyecto para {cliente.nombre}</h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Nombre del Proyecto</label>
                        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground mb-2 block">Tipo de Proyecto</label>
                        <div className="grid grid-cols-3 gap-3">
                            {TIPOS.map((t) => (
                                <button
                                    key={t.value}
                                    onClick={() => setTipo(t.value)}
                                    className={cn(
                                        "p-3 rounded-xl border text-left transition-all",
                                        tipo === t.value
                                            ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                                            : "border-border bg-secondary hover:border-primary/30"
                                    )}
                                >
                                    <p className="text-sm font-medium text-foreground">{t.label}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                        <p className="text-xs text-muted-foreground mb-1">Tareas que se crearán automáticamente:</p>
                        <p className="text-sm font-medium text-primary">{PROJECT_TEMPLATES[tipo].length} tareas</p>
                        <div className="mt-2 space-y-1 max-h-[120px] overflow-y-auto">
                            {PROJECT_TEMPLATES[tipo].map((t, i) => (
                                <p key={i} className="text-xs text-muted-foreground">• {t.titulo}</p>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancelar</button>
                    <button onClick={handleCreate} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:opacity-90">
                        Crear Proyecto
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Cliente Detail Modal ---
function ClienteDetailModal({
    open,
    onClose,
    cliente,
    onUpdate,
    onAdvance,
}: {
    open: boolean;
    onClose: () => void;
    cliente: Cliente | null;
    onUpdate: (id: string, data: Partial<Cliente>) => void;
    onAdvance: (cliente: Cliente) => void;
}) {
    const [inv, setInv] = useState({ que_hace: "", puntos_debiles: "", soluciones: "" });
    const [seguimiento, setSeguimiento] = useState("");
    const [waMsg, setWaMsg] = useState("");

    useEffect(() => {
        if (cliente?.info_investigacion) {
            setInv(cliente.info_investigacion);
        } else {
            setInv({ que_hace: "", puntos_debiles: "", soluciones: "" });
        }
        setWaMsg(cliente?.msg_whatsapp || "");
    }, [cliente]);

    if (!open || !cliente) return null;

    const generateWAMessage = () => {
        const msg = `Hola ${cliente.nombre}! 👋\n\nEstuve investigando sobre ${cliente.negocio} y me pareció muy interesante lo que hacen: ${inv.que_hace}.\n\nCreo que podrían mejorar en: ${inv.puntos_debiles}.\n\nTengo algunas ideas que podrían ayudarles: ${inv.soluciones}.\n\n¿Te gustaría que agendemos una reunión para conversarlo?`;
        setWaMsg(msg);
        onUpdate(cliente.id, { msg_whatsapp: msg });
        toast.success("Mensaje WA generado");
    };

    const saveInvestigation = () => {
        onUpdate(cliente.id, { info_investigacion: inv });
        toast.success("Investigación guardada");
    };

    const addSeguimiento = () => {
        if (!seguimiento.trim()) return;
        const notas = [...(cliente.notas_seguimiento || []), { id: crypto.randomUUID(), fecha: new Date().toISOString(), texto: seguimiento }];
        onUpdate(cliente.id, { notas_seguimiento: notas });
        setSeguimiento("");
        toast.success("Nota de seguimiento agregada");
    };

    const NEXT_ETAPA: Partial<Record<EtapaCliente, EtapaCliente>> = {
        contacto: "investigando",
        investigando: "calificado",
        calificado: "contactado",
        contactado: "cotizado",
        cotizado: "cliente_actual",
        cliente_actual: "cliente_finalizado",
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8">
            <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-11 h-11 rounded-full bg-gradient-to-br from-primary to-cyan-400 text-sm font-bold text-white">
                            {getInitials(cliente.nombre)}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">{cliente.nombre}</h3>
                            <p className="text-sm text-muted-foreground">{cliente.negocio}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {cliente.mantenimiento_mensual && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase">
                                <ShieldCheck className="w-3.5 h-3.5" /> Mantenimiento
                            </div>
                        )}
                        <span className={cn("text-xs px-2.5 py-1 rounded-full border font-medium", ETAPA_COLORS[cliente.etapa])}>
                            {ETAPA_LABELS[cliente.etapa]}
                        </span>
                        <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5 text-muted-foreground" /></button>
                    </div>
                </div>

                {/* Datos Básicos */}
                <div className="grid grid-cols-4 gap-3 mb-5 p-3 rounded-lg bg-secondary/50 border border-border">
                    <div><p className="text-[10px] text-muted-foreground uppercase">Email</p><p className="text-sm text-foreground truncate">{cliente.email || "—"}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase">Teléfono</p><p className="text-sm text-foreground">{cliente.tel || "—"}</p></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase">Canal</p><p className="text-sm text-foreground">{cliente.canal || "—"}</p></div>
                    <div className="flex items-center justify-end">
                        <button
                            onClick={() => {
                                onUpdate(cliente.id, { mantenimiento_mensual: !cliente.mantenimiento_mensual });
                                toast.success(cliente.mantenimiento_mensual ? "Mantenimiento desactivado" : "Mantenimiento activado");
                            }}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                                cliente.mantenimiento_mensual
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"
                                    : "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"
                            )}>
                            <ShieldCheck className="w-4 h-4" /> {cliente.mantenimiento_mensual ? "Abona Mantenimiento" : "Sin Mantenimiento"}
                        </button>
                    </div>
                </div>

                {/* Fase Investigación */}
                {(cliente.etapa === "investigando" || cliente.etapa === "contacto") && (
                    <div className="mb-5">
                        <h4 className="text-sm font-semibold text-foreground mb-3">Investigación del Negocio</h4>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">¿Qué hace el negocio?</label>
                                <textarea value={inv.que_hace} onChange={(e) => setInv({ ...inv, que_hace: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Puntos Débiles</label>
                                <textarea value={inv.puntos_debiles} onChange={(e) => setInv({ ...inv, puntos_debiles: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Soluciones Propuestas</label>
                                <textarea value={inv.soluciones} onChange={(e) => setInv({ ...inv, soluciones: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={saveInvestigation} className="px-3 py-2 rounded-lg text-xs bg-secondary border border-border text-foreground hover:bg-accent transition-colors">
                                    Guardar Investigación
                                </button>
                                <button onClick={generateWAMessage} className="px-3 py-2 rounded-lg text-xs bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5">
                                    <MessageCircle className="w-3.5 h-3.5" /> Generar Mensaje WA
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* WA Message Preview */}
                {waMsg && (
                    <div className="mb-5 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                        <p className="text-xs text-emerald-400 font-medium mb-1">Mensaje WhatsApp</p>
                        <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">{waMsg}</pre>
                    </div>
                )}

                {/* Calificado - Resumen visual */}
                {cliente.etapa === "calificado" && cliente.info_investigacion && (
                    <div className="mb-5">
                        <h4 className="text-sm font-semibold text-foreground mb-3">Resumen de Investigación</h4>
                        <div className="grid grid-cols-1 gap-3">
                            {[
                                { label: "Qué hace", value: cliente.info_investigacion.que_hace },
                                { label: "Puntos Débiles", value: cliente.info_investigacion.puntos_debiles },
                                { label: "Soluciones", value: cliente.info_investigacion.soluciones },
                            ].map((item) => (
                                <div key={item.label} className="p-3 rounded-lg bg-secondary/50 border border-border">
                                    <p className="text-[10px] text-primary uppercase font-medium mb-0.5">{item.label}</p>
                                    <p className="text-sm text-foreground">{item.value || "—"}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Seguimiento & Cotización */}
                {(cliente.etapa === "contactado" || cliente.etapa === "cotizado") && (
                    <div className="mb-5 space-y-4">
                        <div className="p-4 rounded-xl bg-secondary/30 border border-border">
                            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                <MessageCircle className="w-4 h-4 text-primary" /> Notas de Seguimiento
                            </h4>
                            <div className="flex gap-2 mb-3">
                                <input
                                    value={seguimiento}
                                    onChange={(e) => setSeguimiento(e.target.value)}
                                    placeholder="¿Qué se habló con el cliente?..."
                                    className="flex-1 h-10 px-3 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                                <button onClick={addSeguimiento} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">
                                    Agregar
                                </button>
                            </div>
                            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                                {(cliente.notas_seguimiento || []).length > 0 ? (
                                    (cliente.notas_seguimiento || []).map((n) => (
                                        <div key={n.id} className="p-3 rounded-lg bg-card border border-border/50 animate-fade-in">
                                            <p className="text-[10px] text-muted-foreground mb-1">{new Date(n.fecha).toLocaleString("es-AR", { dateStyle: 'short', timeStyle: 'short' })}</p>
                                            <p className="text-sm text-foreground leading-relaxed">{n.texto}</p>
                                        </div>
                                    )).reverse()
                                ) : (
                                    <p className="text-xs text-muted-foreground text-center py-4 italic">No hay notas de seguimiento aún</p>
                                )}
                            </div>
                        </div>

                        {cliente.etapa === "cotizado" && (
                            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                                <h4 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Cotización Formal (PDF)
                                </h4>
                                <div className="space-y-3">
                                    {cliente.pdf_cotizacion_url ? (
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-emerald-500/30">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-5 h-5 text-emerald-400" />
                                                <span className="text-sm font-medium text-foreground">Archivo adjunto</span>
                                            </div>
                                            <a
                                                href={cliente.pdf_cotizacion_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors"
                                            >
                                                Ver PDF
                                            </a>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic mb-2">No se ha adjuntado el PDF de la cotización aún.</p>
                                    )}

                                    <div className="flex items-center gap-3">
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            id="pdf-upload-detail"
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const toastId = toast.loading("Subiendo PDF...");
                                                    try {
                                                        const url = await storageStore.uploadCotizacion(file);
                                                        onUpdate(cliente.id, { pdf_cotizacion_url: url });
                                                        toast.success("PDF actualizado", { id: toastId });
                                                    } catch {
                                                        toast.error("Error al subir", { id: toastId });
                                                    }
                                                }
                                            }}
                                        />
                                        <label
                                            htmlFor="pdf-upload-detail"
                                            className="flex-1 flex items-center justify-center gap-2 h-10 rounded-lg border-2 border-dashed border-emerald-500/30 hover:border-emerald-500/50 cursor-pointer transition-all text-sm text-emerald-400 hover:bg-emerald-500/10"
                                        >
                                            <Upload className="w-4 h-4" />
                                            {cliente.pdf_cotizacion_url ? "Reemplazar PDF" : "Subir PDF de Cotización"}
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Action: Avanzar etapa */}
                {NEXT_ETAPA[cliente.etapa] && (
                    <div className="flex justify-end">
                        <button
                            onClick={() => onAdvance(cliente)}
                            className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:opacity-90 flex items-center gap-2"
                        >
                            Avanzar a {ETAPA_LABELS[NEXT_ETAPA[cliente.etapa]!]}
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Kanban Components ---
function DraggableClienteCard({ cliente, onClick }: { cliente: Cliente; onClick: () => void }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: cliente.id,
        data: { cliente },
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 100 : 1,
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "w-full text-left p-2.5 rounded-lg bg-secondary/50 border border-border hover:border-primary/30 transition-all group relative",
                isDragging && "opacity-50 border-primary shadow-2xl"
            )}
        >
            <div className="flex items-center gap-2">
                <div
                    {...listeners}
                    {...attributes}
                    className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-muted-foreground hover:text-foreground touch-none"
                >
                    <GripVertical className="w-3.5 h-3.5" />
                </div>
                <button
                    onClick={onClick}
                    className="flex-1 flex items-center gap-2 min-w-0"
                >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-cyan-500/40 flex items-center justify-center text-[10px] font-bold text-foreground shrink-0">
                        {getInitials(cliente.nombre)}
                    </div>
                    <div className="min-w-0 text-left flex-1">
                        <div className="flex items-center gap-1.5 justify-between">
                            <p className="text-sm font-medium text-foreground truncate">{cliente.nombre}</p>
                            {cliente.mantenimiento_mensual && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{cliente.negocio}</p>
                    </div>
                </button>
            </div>
        </div>
    );
}

function DroppableEtapaColumn({ etapa, children, count }: { etapa: EtapaCliente; children: React.ReactNode; count: number }) {
    const { setNodeRef, isOver } = useDroppable({
        id: etapa,
    });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "rounded-xl border border-border bg-card/50 p-3 min-h-[150px] transition-colors",
                isOver && "border-primary/50 bg-primary/5 shadow-inner shadow-primary/5"
            )}
        >
            <div className="flex items-center justify-between mb-3">
                <span className={cn("text-xs px-2.5 py-1 rounded-full border font-medium", ETAPA_COLORS[etapa])}>
                    {ETAPA_LABELS[etapa]}
                </span>
                <span className="text-xs text-muted-foreground">{count}</span>
            </div>
            <div className="space-y-2">
                {children}
            </div>
        </div>
    );
}

// --- Main Page ---
export default function ClientesPage() {
    const searchParams = useSearchParams();
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [mounted, setMounted] = useState(false);
    const [showNew, setShowNew] = useState(searchParams.get("new") === "true");
    const [showDetail, setShowDetail] = useState(false);
    const [showProject, setShowProject] = useState(false);
    const [selected, setSelected] = useState<Cliente | null>(null);
    const [search, setSearch] = useState("");

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const reload = async () => {
        try {
            const data = await clientesStore.getAll();
            setClientes(data);
        } catch (error) {
            console.error("Error reloading clients:", error);
        }
    };
    useEffect(() => {
        reload().then(() => setMounted(true));
    }, []);

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const clienteId = active.id as string;
        const newEtapa = over.id as EtapaCliente;
        const cliente = active.data.current?.cliente as Cliente;

        if (cliente && cliente.etapa !== newEtapa) {
            try {
                await clientesStore.update(clienteId, { etapa: newEtapa });
                await reload();
                toast.success(`${cliente.nombre} movido a ${ETAPA_LABELS[newEtapa]}`);
            } catch {
                toast.error("Error al mover cliente");
            }
        }
    };

    const handleCreate = async (data: Partial<Cliente>) => {
        try {
            await clientesStore.create(data as Omit<Cliente, "id" | "created_at">);
            await reload();
            toast.success("Contacto agregado");
        } catch {
            toast.error("Error al añadir contacto");
        }
    };

    const handleUpdate = async (id: string, data: Partial<Cliente>) => {
        try {
            await clientesStore.update(id, data);
            await reload();
            const updated = await clientesStore.getById(id);
            setSelected(updated);
        } catch {
            toast.error("Error al actualizar");
        }
    };

    const handleAdvance = async (cliente: Cliente) => {
        const NEXT: Partial<Record<EtapaCliente, EtapaCliente>> = {
            contacto: "investigando", investigando: "calificado", calificado: "contactado",
            contactado: "cotizado", cotizado: "cliente_actual", cliente_actual: "cliente_finalizado",
        };
        const next = NEXT[cliente.etapa];
        if (!next) return;

        try {
            if (next === "cliente_actual") {
                await clientesStore.update(cliente.id, { etapa: next });
                await reload();
                setShowDetail(false);
                const updated = await clientesStore.getById(cliente.id);
                setSelected(updated);
                setShowProject(true);
                return;
            }

            await clientesStore.update(cliente.id, { etapa: next });
            await reload();
            const updated = await clientesStore.getById(cliente.id);
            setSelected(updated);
            toast.success(`${cliente.nombre} → ${ETAPA_LABELS[next]}`);
        } catch {
            toast.error("Error al avanzar etapa");
        }
    };


    const filtered = clientes.filter(
        (c) =>
            c.nombre.toLowerCase().includes(search.toLowerCase()) ||
            c.negocio.toLowerCase().includes(search.toLowerCase())
    );

    if (!mounted) {
        return (
            <div className="space-y-4 animate-pulse">
                {[...Array(3)].map((_, i) => (<div key={i} className="h-[200px] rounded-xl skeleton" />))}
            </div>
        );
    }

    const FASES = [
        { label: "Prospección", key: "prospeccion" as const, color: "from-slate-600 to-blue-600" },
        { label: "Clasificación", key: "clasificacion" as const, color: "from-purple-600 to-amber-600" },
        { label: "Cierre", key: "cierre" as const, color: "from-emerald-600 to-gray-600" },
    ];

    return (
        <div className="space-y-5 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Pipeline de Clientes</h2>
                    <p className="text-sm text-muted-foreground">{clientes.length} contactos en total</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar cliente..."
                            className="w-[200px] h-9 pl-9 pr-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
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

            {/* Pipeline Board */}
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div className="space-y-6">
                    {FASES.map((fase) => (
                        <div key={fase.key}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className={cn("w-3 h-3 rounded-full bg-gradient-to-r", fase.color)} />
                                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{fase.label}</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {FASES_PIPELINE[fase.key].map((etapa) => {
                                    const etapaClientes = filtered.filter((c) => c.etapa === etapa);
                                    return (
                                        <DroppableEtapaColumn key={etapa} etapa={etapa} count={etapaClientes.length}>
                                            {etapaClientes.map((c) => (
                                                <DraggableClienteCard
                                                    key={c.id}
                                                    cliente={c}
                                                    onClick={() => { setSelected(c); setShowDetail(true); }}
                                                />
                                            ))}
                                            {etapaClientes.length === 0 && (
                                                <p className="text-xs text-muted-foreground text-center py-3 opacity-50">Sin contactos</p>
                                            )}
                                        </DroppableEtapaColumn>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </DndContext>

            {/* Modals */}
            <NuevoClienteModal open={showNew} onClose={() => setShowNew(false)} onSave={handleCreate} />
            <ClienteDetailModal
                open={showDetail}
                onClose={() => { setShowDetail(false); setSelected(null); }}
                cliente={selected}
                onUpdate={handleUpdate}
                onAdvance={handleAdvance}
            />
            <NuevoProyectoModal
                open={showProject}
                onClose={() => { setShowProject(false); setSelected(null); reload(); }}
                cliente={selected}
            />
        </div>
    );
}
