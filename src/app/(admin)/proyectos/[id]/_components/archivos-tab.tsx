"use client";

import { useEffect, useState } from "react";
import {
    Upload, Loader2, Eye, EyeOff, Trash2, ExternalLink, Link2, Plus, Inbox, CheckCircle2,
    RotateCcw, FileText, Image as ImageIcon, Download, User, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import { archivosProyectoStore, cotizacionesStore, solicitudesStore, storageStore, mensajeError } from "@/lib/store";
import { registrarLog } from "@/lib/proyecto-acciones";
import { fechaCorta, nuevoId } from "@/lib/proyecto-gestion";
import type { ArchivoProyecto, CategoriaArchivo, Cotizacion, LinkProyecto } from "@/lib/types";
import { CATEGORIA_ARCHIVO_LABELS } from "@/lib/types";
import { ui, type ProyectoCtx } from "./ctx";

const esImagen = (a: { mime?: string; url: string }) => (a.mime || "").startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(a.url);

function inferirCategoria(file: File): CategoriaArchivo {
    const n = file.name.toLowerCase();
    if (n.includes("logo")) return "logo";
    if (n.includes("contrato")) return "contrato";
    if (n.includes("cotiz") || n.includes("presupuesto")) return "cotizacion";
    if (file.type.startsWith("image/")) return "imagen";
    if (file.type === "application/pdf" || /\.(docx?|xlsx?|txt|md)$/.test(n)) return "documento";
    return "otro";
}

function TarjetaArchivo({ a, onToggle, onDelete }: { a: ArchivoProyecto; onToggle: () => void; onDelete: () => void }) {
    return (
        <div className="group rounded-xl border border-border bg-secondary/20 overflow-hidden flex flex-col">
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="block h-24 bg-background/60 flex items-center justify-center overflow-hidden">
                {esImagen(a)
                    ? <img src={a.url} alt={a.nombre} className="w-full h-full object-cover" />
                    : <FileText className="w-8 h-8 text-muted-foreground" />}
            </a>
            <div className="p-2 space-y-1 flex-1 flex flex-col">
                <p className="text-[11px] font-semibold text-foreground truncate" title={a.nombre}>{a.nombre}</p>
                <div className="flex items-center justify-between gap-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground">{CATEGORIA_ARCHIVO_LABELS[a.categoria] || a.categoria}</span>
                    <span className="text-[9px] text-muted-foreground">{fechaCorta(a.created_at)}</span>
                </div>
                <div className="flex items-center justify-end gap-0.5 pt-1 mt-auto">
                    <button onClick={onToggle} title={a.visible_cliente ? "Visible en el portal (clic para ocultar)" : "Oculto al cliente (clic para mostrar)"} className={cn("p-1 rounded", a.visible_cliente ? "text-cyan-400" : "text-muted-foreground")}>
                        {a.visible_cliente ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" download className="p-1 rounded text-muted-foreground hover:text-foreground"><Download className="w-3.5 h-3.5" /></a>
                    <button onClick={onDelete} className="p-1 rounded text-muted-foreground hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
            </div>
        </div>
    );
}

export default function ArchivosTab({ ctx }: { ctx: ProyectoCtx }) {
    const { proyecto, cliente, archivos, solicitudes } = ctx;
    const [subiendo, setSubiendo] = useState(false);
    const [categoria, setCategoria] = useState<CategoriaArchivo | "auto">("auto");
    const [visible, setVisible] = useState(true);
    const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
    const [link, setLink] = useState({ titulo: "", url: "" });
    const [sol, setSol] = useState({ titulo: "", descripcion: "", fecha_limite: "" });

    useEffect(() => {
        if (proyecto.cliente_id) cotizacionesStore.getByCliente(proyecto.cliente_id).then(setCotizaciones).catch(() => setCotizaciones([]));
    }, [proyecto.cliente_id]);

    const deAgencia = archivos.filter((a) => a.subido_por === "agencia");
    const deCliente = archivos.filter((a) => a.subido_por === "cliente");
    const urlsCargadas = new Set(archivos.map((a) => a.url));

    const importables: { nombre: string; url: string; categoria: CategoriaArchivo }[] = [
        ...cotizaciones.filter((c) => c.pdf_url).map((c) => ({ nombre: `Cotización ${new Date(c.created_at).toLocaleDateString("es-AR")}.pdf`, url: c.pdf_url, categoria: "cotizacion" as const })),
        ...(cliente?.pdf_cotizacion_url ? [{ nombre: "Cotización (cliente).pdf", url: cliente.pdf_cotizacion_url, categoria: "cotizacion" as const }] : []),
        ...(proyecto.contrato_url ? [{ nombre: "Contrato.pdf", url: proyecto.contrato_url, categoria: "contrato" as const }] : []),
        ...(proyecto.logo_url ? [{ nombre: "Logo", url: proyecto.logo_url, categoria: "logo" as const }] : []),
    ].filter((x) => !urlsCargadas.has(x.url));

    const subir = async (files: FileList | null) => {
        if (!files?.length) return;
        setSubiendo(true);
        let ok = 0;
        for (const file of Array.from(files)) {
            try {
                const url = await storageStore.uploadArchivoProyecto(file, proyecto.id);
                await archivosProyectoStore.create({
                    proyecto_id: proyecto.id, nombre: file.name, url,
                    categoria: categoria === "auto" ? inferirCategoria(file) : categoria,
                    subido_por: "agencia", visible_cliente: visible, solicitud_id: null,
                    mime: file.type || "", tamano: file.size,
                });
                ok++;
            } catch (e) { toast.error(`${file.name}: ${mensajeError(e)}`); }
        }
        setSubiendo(false);
        if (ok) { toast.success(`${ok} archivo(s) subido(s)`); ctx.recargar("archivos"); }
    };

    const importar = async (x: { nombre: string; url: string; categoria: CategoriaArchivo }) => {
        try {
            await archivosProyectoStore.create({
                proyecto_id: proyecto.id, nombre: x.nombre, url: x.url, categoria: x.categoria,
                subido_por: "agencia", visible_cliente: true, solicitud_id: null, mime: x.url.endsWith(".pdf") ? "application/pdf" : "", tamano: null,
            });
            toast.success(`${x.nombre} compartido en el portal`);
            ctx.recargar("archivos");
        } catch (e) { toast.error(mensajeError(e)); }
    };

    const toggleVisible = async (a: ArchivoProyecto) => {
        try { await archivosProyectoStore.update(a.id, { visible_cliente: !a.visible_cliente }); ctx.recargar("archivos"); }
        catch (e) { toast.error(mensajeError(e)); }
    };

    const borrar = async (a: ArchivoProyecto) => {
        if (!confirm(`¿Quitar "${a.nombre}" del proyecto?`)) return;
        try { await archivosProyectoStore.delete(a.id); ctx.recargar("archivos"); }
        catch (e) { toast.error(mensajeError(e)); }
    };

    // Links
    const links = proyecto.links || [];
    const guardarLinks = (nuevos: LinkProyecto[], msg?: string) => ctx.guardarProyecto({ links: nuevos }, msg);
    const agregarLink = () => {
        if (!link.url.trim()) return;
        const url = /^https?:\/\//.test(link.url.trim()) ? link.url.trim() : `https://${link.url.trim()}`;
        guardarLinks([...links, { id: nuevoId("l"), titulo: link.titulo.trim() || url, url, visible_cliente: true }], "Link agregado");
        setLink({ titulo: "", url: "" });
    };

    // Solicitudes
    const crearSolicitud = async () => {
        if (!sol.titulo.trim()) { toast.error("Escribí qué le pedís al cliente"); return; }
        try {
            await solicitudesStore.create({
                proyecto_id: proyecto.id, titulo: sol.titulo.trim(), descripcion: sol.descripcion.trim(),
                estado: "pendiente", respuesta_cliente: "", fecha_limite: sol.fecha_limite || null, entregada_at: null,
            });
            setSol({ titulo: "", descripcion: "", fecha_limite: "" });
            toast.success("Pedido publicado en el portal del cliente");
            registrarLog(proyecto.id, `Pedido al cliente: ${sol.titulo.trim()}`);
            ctx.recargar("solicitudes", "logs");
        } catch (e) { toast.error(mensajeError(e)); }
    };

    const cambiarEstadoSolicitud = async (id: string, estado: "pendiente" | "aprobada") => {
        try { await solicitudesStore.update(id, { estado }); ctx.recargar("solicitudes"); }
        catch (e) { toast.error(mensajeError(e)); }
    };

    const borrarSolicitud = async (id: string) => {
        if (!confirm("¿Eliminar este pedido?")) return;
        try { await solicitudesStore.delete(id); ctx.recargar("solicitudes"); }
        catch (e) { toast.error(mensajeError(e)); }
    };

    return (
        <div className="space-y-5">
            {/* Pedidos al cliente */}
            <div className={cn(ui.card, "space-y-3")}>
                <h3 className={ui.h3}><Inbox className="w-4 h-4 text-cyan-400" /> Pedidos al cliente</h3>
                <p className="text-[11px] text-muted-foreground">Lo que le pidas acá aparece arriba de todo en su portal, con un botón para subir los archivos y dejarte un comentario.</p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input value={sol.titulo} onChange={(e) => setSol({ ...sol, titulo: e.target.value })} placeholder="Ej: Fotos del local y del equipo" className={cn(ui.input, "sm:col-span-2")} />
                    <input type="date" value={sol.fecha_limite} onChange={(e) => setSol({ ...sol, fecha_limite: e.target.value })} className={ui.input} title="Para cuándo lo necesitás" />
                    <button onClick={crearSolicitud} className={cn(ui.btn, ui.btnPrimary)}><Plus className="w-3.5 h-3.5" /> Pedir</button>
                    <textarea value={sol.descripcion} onChange={(e) => setSol({ ...sol, descripcion: e.target.value })} placeholder="Detalle opcional: formato, cantidad, ejemplos…" rows={2} className={cn(ui.textarea, "sm:col-span-4")} />
                </div>
                <div className="space-y-2">
                    {solicitudes.map((s) => {
                        const adjuntos = archivos.filter((a) => a.solicitud_id === s.id);
                        return (
                            <div key={s.id} className={cn("p-3 rounded-xl border space-y-2", s.estado === "entregada" ? "border-cyan-500/40 bg-cyan-500/5" : s.estado === "aprobada" ? "border-emerald-500/20 bg-emerald-500/5" : "border-border bg-secondary/20")}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-foreground">{s.titulo}</p>
                                        {s.descripcion && <p className="text-[11px] text-muted-foreground">{s.descripcion}</p>}
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                            {s.estado === "pendiente" ? "Esperando al cliente" : s.estado === "entregada" ? `Entregado ${s.entregada_at ? formatDate(s.entregada_at) : ""} — revisalo` : "Aprobado"}
                                            {s.fecha_limite && ` · para el ${fechaCorta(s.fecha_limite)}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {s.estado === "entregada" && (
                                            <>
                                                <button onClick={() => cambiarEstadoSolicitud(s.id, "aprobada")} className={cn(ui.btn, "bg-emerald-500 text-slate-950 hover:bg-emerald-400")}><CheckCircle2 className="w-3.5 h-3.5" /> Aprobar</button>
                                                <button onClick={() => cambiarEstadoSolicitud(s.id, "pendiente")} className={cn(ui.btn, ui.btnGhost)} title="Volver a pedir"><RotateCcw className="w-3.5 h-3.5" /></button>
                                            </>
                                        )}
                                        <button onClick={() => borrarSolicitud(s.id)} className="p-1 text-muted-foreground hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>
                                {s.respuesta_cliente && <p className="text-[11px] text-foreground bg-background/60 rounded-lg p-2 border border-border">💬 {s.respuesta_cliente}</p>}
                                {adjuntos.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {adjuntos.map((a) => (
                                            <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg bg-background border border-border text-cyan-300 hover:border-cyan-500/50">
                                                {esImagen(a) ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />} {a.nombre}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {solicitudes.length === 0 && <p className="text-xs text-muted-foreground italic">No le pediste nada todavía.</p>}
                </div>
            </div>

            {/* Archivos */}
            <div className={cn(ui.card, "space-y-4")}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className={ui.h3}><Upload className="w-4 h-4 text-primary" /> Archivos del proyecto ({archivos.length})</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                        <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaArchivo | "auto")} className="h-8 px-2 rounded-lg bg-background border border-border text-[11px] text-foreground">
                            <option value="auto">Categoría automática</option>
                            {Object.entries(CATEGORIA_ARCHIVO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <label className="flex items-center gap-1 text-[11px] text-foreground"><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} /> Visible al cliente</label>
                    </div>
                </div>

                <label
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); subir(e.dataTransfer.files); }}
                    className="flex flex-col items-center justify-center gap-1 p-6 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-xs text-primary font-bold cursor-pointer hover:bg-primary/10 transition-colors"
                >
                    {subiendo ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                    {subiendo ? "Subiendo…" : "Arrastrá archivos o hacé clic (cotizaciones, contrato, logos, imágenes…)"}
                    <input type="file" multiple className="hidden" onChange={(e) => { subir(e.target.files); e.target.value = ""; }} />
                </label>

                {importables.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">Compartir desde el CRM:</span>
                        {importables.map((x) => (
                            <button key={x.url} onClick={() => importar(x)} className={cn(ui.btn, ui.btnSecondary)}><Plus className="w-3 h-3" /> {x.nombre}</button>
                        ))}
                    </div>
                )}

                <div className="space-y-2">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Subidos por el cliente ({deCliente.length})</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {deCliente.map((a) => <TarjetaArchivo key={a.id} a={a} onToggle={() => toggleVisible(a)} onDelete={() => borrar(a)} />)}
                    </div>
                    {deCliente.length === 0 && <p className="text-xs text-muted-foreground italic">El cliente todavía no subió nada.</p>}
                </div>
                <div className="space-y-2">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Compartidos por vos ({deAgencia.length})</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {deAgencia.map((a) => <TarjetaArchivo key={a.id} a={a} onToggle={() => toggleVisible(a)} onDelete={() => borrar(a)} />)}
                    </div>
                </div>
            </div>

            {/* Links */}
            <div className={cn(ui.card, "space-y-3")}>
                <h3 className={ui.h3}><Link2 className="w-4 h-4 text-primary" /> Links del proyecto</h3>
                <p className="text-[11px] text-muted-foreground">Figma, versión de prueba, Drive, carpeta de fotos… Los visibles aparecen en el portal.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input value={link.titulo} onChange={(e) => setLink({ ...link, titulo: e.target.value })} placeholder="Título (ej: Versión de prueba)" className={ui.input} />
                    <input value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} onKeyDown={(e) => e.key === "Enter" && agregarLink()} placeholder="https://…" className={ui.input} />
                    <button onClick={agregarLink} className={cn(ui.btn, ui.btnPrimary, "shrink-0")}><Plus className="w-3.5 h-3.5" /> Agregar</button>
                </div>
                <div className="space-y-1.5">
                    {links.map((l) => (
                        <div key={l.id} className="flex items-center gap-2 p-2 rounded-xl border border-border bg-secondary/20">
                            <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">{l.titulo}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{l.url}</p>
                            </div>
                            <button onClick={() => guardarLinks(links.map((x) => x.id === l.id ? { ...x, visible_cliente: !x.visible_cliente } : x))} className={cn("p-1", l.visible_cliente ? "text-cyan-400" : "text-muted-foreground")} title="Visible en el portal">
                                {l.visible_cliente ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                            <a href={l.url} target="_blank" rel="noopener noreferrer" className="p-1 text-muted-foreground hover:text-foreground"><ExternalLink className="w-3.5 h-3.5" /></a>
                            <button onClick={() => guardarLinks(links.filter((x) => x.id !== l.id))} className="p-1 text-muted-foreground hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                    ))}
                    {links.length === 0 && <p className="text-xs text-muted-foreground italic">Sin links.</p>}
                </div>
            </div>
        </div>
    );
}
