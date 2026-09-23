"use client";

import { useEffect, useState } from "react";
import { X, Save, Upload, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { clientesStore, proyectosStore, storageStore, mensajeError } from "@/lib/store";
import { registrarLog } from "@/lib/proyecto-acciones";
import { distribuirPlazos } from "@/lib/proyecto-gestion";
import { fasesDe } from "@/lib/proyectos-estado";
import type { Cliente, EstadoProyecto, Proyecto, TipoProyecto } from "@/lib/types";
import { TIPO_PROYECTO_LABELS } from "@/lib/types";
import { ui, type ProyectoCtx } from "./ctx";

export default function EditarProyectoModal({ ctx, onClose }: { ctx: ProyectoCtx; onClose: () => void }) {
    const router = useRouter();
    const { proyecto } = ctx;
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [subiendo, setSubiendo] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [recalcular, setRecalcular] = useState(true);
    const [form, setForm] = useState({
        nombre: proyecto.nombre,
        tipo_proyecto: proyecto.tipo_proyecto,
        cliente_id: proyecto.cliente_id || "",
        estado: proyecto.estado,
        descripcion: proyecto.descripcion || "",
        fecha_inicio: proyecto.fecha_inicio || proyecto.created_at.slice(0, 10),
        fecha_entrega: proyecto.fecha_entrega || "",
        figma_url: proyecto.figma_url || "",
        calendly_url: proyecto.calendly_url || "",
        contrato_url: proyecto.contrato_url || "",
        slug_portal: proyecto.slug_portal,
        stack_tecnologico: proyecto.stack_tecnologico || "",
    });

    useEffect(() => { clientesStore.getAll().then(setClientes).catch(() => {}); }, []);

    const fechasCambiaron = form.fecha_inicio !== (proyecto.fecha_inicio || proyecto.created_at.slice(0, 10)) || form.fecha_entrega !== (proyecto.fecha_entrega || "");

    const subirContrato = async (file: File) => {
        setSubiendo(true);
        try { setForm({ ...form, contrato_url: await storageStore.uploadContrato(file) }); toast.success("Contrato subido"); }
        catch (e) { toast.error(mensajeError(e)); }
        finally { setSubiendo(false); }
    };

    const guardar = async () => {
        if (!form.nombre.trim()) { toast.error("El nombre es requerido"); return; }
        if (form.fecha_entrega && form.fecha_entrega < form.fecha_inicio) { toast.error("La entrega no puede ser antes del inicio"); return; }
        const slug = form.slug_portal.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)/g, "");
        if (!slug) { toast.error("El link del portal no puede quedar vacío"); return; }
        setGuardando(true);
        const cambios: Partial<Proyecto> = {
            nombre: form.nombre.trim(),
            tipo_proyecto: form.tipo_proyecto,
            cliente_id: form.cliente_id || null,
            estado: form.estado,
            descripcion: form.descripcion,
            fecha_inicio: form.fecha_inicio || null,
            fecha_entrega: form.fecha_entrega || null,
            figma_url: form.figma_url.trim(),
            calendly_url: form.calendly_url.trim(),
            contrato_url: form.contrato_url.trim(),
            slug_portal: slug,
            stack_tecnologico: form.stack_tecnologico,
        };
        if (fechasCambiaron && recalcular && form.fecha_entrega) {
            cambios.fases = distribuirPlazos(fasesDe(proyecto), form.tipo_proyecto, form.fecha_inicio, form.fecha_entrega);
        }
        const ok = await ctx.guardarProyecto(cambios, "Proyecto actualizado");
        setGuardando(false);
        if (!ok) return;
        if (form.fecha_entrega !== (proyecto.fecha_entrega || "")) {
            registrarLog(proyecto.id, "Fecha de entrega actualizada", form.fecha_entrega || "Sin fecha");
        }
        if (form.estado !== proyecto.estado) registrarLog(proyecto.id, `Proyecto ${form.estado}`);
        ctx.recargar("logs");
        onClose();
    };

    const eliminar = async () => {
        if (!confirm(`¿Eliminar "${proyecto.nombre}"? Se borran sus archivos y pedidos; las tareas y cobros quedan sin proyecto.`)) return;
        try { await proyectosStore.delete(proyecto.id); toast.success("Proyecto eliminado"); router.push("/proyectos"); }
        catch (e) { toast.error(mensajeError(e)); }
    };

    const campo = (label: string, el: React.ReactNode, cls = "") => (
        <div className={cls}><label className={ui.label}>{label}</label>{el}</div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4">
            <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-2xl animate-fade-in space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="text-lg font-bold text-foreground">Editar proyecto</h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {campo("Nombre", <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={ui.input} />, "sm:col-span-2")}
                    {campo("Cliente", (
                        <select value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })} className={ui.input}>
                            <option value="">Sin cliente</option>
                            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.negocio ? ` — ${c.negocio}` : ""}</option>)}
                        </select>
                    ))}
                    {campo("Tipo", (
                        <select value={form.tipo_proyecto} onChange={(e) => setForm({ ...form, tipo_proyecto: e.target.value as TipoProyecto })} className={ui.input}>
                            {Object.entries(TIPO_PROYECTO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    ))}
                    {campo("Inicio", <input type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} className={ui.input} />)}
                    {campo("Entrega", <input type="date" value={form.fecha_entrega} onChange={(e) => setForm({ ...form, fecha_entrega: e.target.value })} className={ui.input} />)}
                    {fechasCambiaron && form.fecha_entrega && (
                        <label className="sm:col-span-2 flex items-center gap-2 text-xs text-foreground">
                            <input type="checkbox" checked={recalcular} onChange={(e) => setRecalcular(e.target.checked)} /> Recalcular los plazos de las fases pendientes
                        </label>
                    )}
                    {campo("Estado", (
                        <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoProyecto })} className={ui.input}>
                            <option value="activo">Activo</option>
                            <option value="pausado">Pausado</option>
                            <option value="finalizado">Finalizado</option>
                        </select>
                    ))}
                    {campo("Stack / herramientas", <input value={form.stack_tecnologico} onChange={(e) => setForm({ ...form, stack_tecnologico: e.target.value })} placeholder="Ej: Next.js + Supabase, WordPress…" className={ui.input} />)}
                    {campo("Descripción", <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={3} className={ui.textarea} />, "sm:col-span-2")}
                    {campo("Link de Figma (aprobación de diseño en el portal)", <input value={form.figma_url} onChange={(e) => setForm({ ...form, figma_url: e.target.value })} placeholder="https://figma.com/…" className={ui.input} />, "sm:col-span-2")}
                    {campo("Link para agendar reunión (Calendly)", <input value={form.calendly_url} onChange={(e) => setForm({ ...form, calendly_url: e.target.value })} placeholder="https://calendly.com/…" className={ui.input} />, "sm:col-span-2")}
                    {campo("Contrato", (
                        <div className="flex gap-2">
                            <input value={form.contrato_url} onChange={(e) => setForm({ ...form, contrato_url: e.target.value })} placeholder="URL del contrato o subí el PDF" className={ui.input} />
                            <label className={cn(ui.btn, ui.btnSecondary, "cursor-pointer shrink-0")}>
                                {subiendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) subirContrato(f); }} />
                            </label>
                        </div>
                    ), "sm:col-span-2")}
                    {campo("Link del portal", (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span className="shrink-0">/portal/</span>
                            <input value={form.slug_portal} onChange={(e) => setForm({ ...form, slug_portal: e.target.value })} className={ui.input} />
                        </div>
                    ), "sm:col-span-2")}
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                    <button onClick={eliminar} className={cn(ui.btn, "text-rose-400 hover:bg-rose-500/10")}><Trash2 className="w-3.5 h-3.5" /> Eliminar</button>
                    <div className="flex gap-2">
                        <button onClick={onClose} className={cn(ui.btn, ui.btnGhost)}>Cancelar</button>
                        <button disabled={guardando} onClick={guardar} className={cn(ui.btn, ui.btnPrimary, "px-5 py-2")}>
                            {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
