"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft, Eye, Copy, Upload, Plus, Trash2, Lock, Zap, Layers, DollarSign, ClipboardList,
    FolderOpen, BookOpen, ScrollText, Pencil, CalendarClock, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
    proyectosStore, tareasStore, clientesStore, logsProyectoStore, storageStore, finanzasStore,
    archivosProyectoStore, solicitudesStore, mensajeError,
} from "@/lib/store";
import { fasesDe } from "@/lib/proyectos-estado";
import { briefAMarkdown, fechaCorta, infoPlazo, ESTADO_PLAZO_COLORS } from "@/lib/proyecto-gestion";
import type {
    Proyecto, Tarea, Cliente, LogProyecto, Finanza, ArchivoProyecto, SolicitudProyecto,
} from "@/lib/types";
import { TIPO_PROYECTO_LABELS } from "@/lib/types";
import { ui, type PageTab, type ProyectoCtx, type Recargable } from "./_components/ctx";
import { upsertDoc } from "./_components/docs-util";
import ResumenTab from "./_components/resumen-tab";
import FasesTab from "./_components/fases-tab";
import FinanzasTab from "./_components/finanzas-tab";
import BriefTab from "./_components/brief-tab";
import ArchivosTab from "./_components/archivos-tab";
import DocsTab from "./_components/docs-tab";
import EditarProyectoModal from "./_components/editar-proyecto-modal";

const ESTADO_BADGE: Record<string, string> = {
    activo: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    pausado: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    finalizado: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export default function ProyectoDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [proyecto, setProyecto] = useState<Proyecto | null>(null);
    const [cliente, setCliente] = useState<Cliente | null>(null);
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [logs, setLogs] = useState<LogProyecto[]>([]);
    const [finanzas, setFinanzas] = useState<Finanza[]>([]);
    const [archivos, setArchivos] = useState<ArchivoProyecto[]>([]);
    const [solicitudes, setSolicitudes] = useState<SolicitudProyecto[]>([]);
    const [faltaMigracion, setFaltaMigracion] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<PageTab>("resumen");
    const [editando, setEditando] = useState(false);
    const [portalUrl, setPortalUrl] = useState("");

    const [logForm, setLogForm] = useState({ titulo: "", descripcion: "" });
    const [newAcceso, setNewAcceso] = useState({ servicio: "", url: "", usuario: "", password: "" });

    const recargar = useCallback(async (...que: Recargable[]) => {
        if (!id) return;
        const todo = que.length === 0;
        const tareasPendientes: Promise<unknown>[] = [];
        if (todo || que.includes("proyecto")) {
            tareasPendientes.push(proyectosStore.getById(id).then(async (p) => {
                if (!p) { router.push("/proyectos"); return; }
                setProyecto(p);
                setCliente(p.cliente_id ? await clientesStore.getById(p.cliente_id) : null);
            }));
        }
        if (todo || que.includes("tareas")) tareasPendientes.push(tareasStore.getByProyecto(id).then(setTareas).catch(() => {}));
        if (todo || que.includes("logs")) tareasPendientes.push(logsProyectoStore.getByProyecto(id).then(setLogs).catch(() => {}));
        if (todo || que.includes("finanzas")) tareasPendientes.push(finanzasStore.getByProyecto(id).then(setFinanzas).catch(() => {}));
        if (todo || que.includes("archivos")) {
            tareasPendientes.push(archivosProyectoStore.getByProyecto(id).then(setArchivos).catch(() => setFaltaMigracion(true)));
        }
        if (todo || que.includes("solicitudes")) {
            tareasPendientes.push(solicitudesStore.getByProyecto(id).then(setSolicitudes).catch(() => setFaltaMigracion(true)));
        }
        await Promise.all(tareasPendientes);
    }, [id, router]);

    useEffect(() => {
        setPortalUrl(`${window.location.origin}/portal/`);
        recargar().then(() => setMounted(true));
    }, [recargar]);

    // Brief completado por el cliente → el BRIEF.md queda guardado solo en Docs.
    useEffect(() => {
        if (!proyecto?.brief || proyecto.brief.estado !== "completado") return;
        const doc = (proyecto.documentos || []).find((d) => d.id === "doc_brief");
        if (doc && doc.updated_at >= (proyecto.brief.completado_at || "")) return;
        const docs = upsertDoc(proyecto.documentos || [], {
            id: "doc_brief", titulo: "Brief", categoria: "estrategia", contenido: briefAMarkdown(proyecto.brief, proyecto, cliente),
        });
        proyectosStore.update(proyecto.id, { documentos: docs }).then(setProyecto).catch(() => {});
    }, [proyecto, cliente]);

    if (!mounted) return (
        <div className="p-6 space-y-6 animate-pulse">
            <div className="h-16 bg-secondary/50 rounded-2xl" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <div key={i} className="h-32 rounded-2xl bg-secondary/30" />)}
            </div>
            <div className="h-[300px] rounded-2xl bg-secondary/30" />
        </div>
    );
    if (!proyecto) return null;

    const guardarProyecto = async (data: Partial<Proyecto>, mensaje?: string): Promise<boolean> => {
        try {
            const actualizado = await proyectosStore.update(proyecto.id, data);
            setProyecto(actualizado);
            if (data.cliente_id !== undefined && data.cliente_id !== proyecto.cliente_id) {
                setCliente(actualizado.cliente_id ? await clientesStore.getById(actualizado.cliente_id) : null);
            }
            if (mensaje) toast.success(mensaje);
            return true;
        } catch (e) {
            toast.error("No se pudo guardar: " + mensajeError(e));
            return false;
        }
    };

    const ctx: ProyectoCtx = {
        proyecto, cliente, tareas, logs, finanzas, archivos, solicitudes, setTareas,
        guardarProyecto, recargar, irA: setActiveTab, portalUrl: portalUrl + proyecto.slug_portal,
    };

    const fases = fasesDe(proyecto);
    const progreso = fases.length ? Math.round((fases.filter((f) => f.completada).length / fases.length) * 100) : 0;
    const plazo = infoPlazo(proyecto, progreso);
    const pendientesCliente = solicitudes.filter((s) => s.estado === "entregada").length;

    const handleUploadLogo = async (file: File) => {
        const toastId = toast.loading("Subiendo logo...");
        try {
            const url = await storageStore.uploadLogo(file);
            await guardarProyecto({ logo_url: url });
            toast.success("Logo guardado", { id: toastId });
        } catch (e) { toast.error("Error al subir logo: " + mensajeError(e), { id: toastId }); }
    };

    const agregarLog = async () => {
        if (!logForm.titulo.trim()) { toast.error("El título es requerido"); return; }
        try {
            await logsProyectoStore.create({ proyecto_id: proyecto.id, ...logForm, fecha: new Date().toLocaleDateString("en-CA") });
            setLogForm({ titulo: "", descripcion: "" });
            recargar("logs");
        } catch (e) { toast.error(mensajeError(e)); }
    };

    const agregarAcceso = async () => {
        if (!newAcceso.servicio || !newAcceso.usuario) { toast.error("Servicio y usuario son requeridos"); return; }
        if (await guardarProyecto({ accesos: [...(proyecto.accesos || []), newAcceso] }, "Credencial guardada")) {
            setNewAcceso({ servicio: "", url: "", usuario: "", password: "" });
        }
    };

    const TABS: { id: PageTab; label: string; icon: typeof Zap; count?: number; alerta?: boolean }[] = [
        { id: "resumen", label: "Resumen", icon: Zap },
        { id: "fases", label: "Fases y tareas", icon: Layers, count: tareas.filter((t) => t.estado !== "completada").length || undefined },
        { id: "finanzas", label: "Finanzas", icon: DollarSign, count: finanzas.length || undefined },
        { id: "brief", label: "Brief", icon: ClipboardList, alerta: proyecto.brief?.estado === "completado" && !(proyecto.documentos || []).some((d) => d.id === "doc_contexto") },
        { id: "archivos", label: "Archivos y pedidos", icon: FolderOpen, count: archivos.length || undefined, alerta: pendientesCliente > 0 },
        { id: "documentos", label: "Docs .md", icon: BookOpen, count: (proyecto.documentos || []).length || undefined },
        { id: "novedades", label: "Novedades", icon: ScrollText, count: logs.length || undefined },
        { id: "accesos", label: "Accesos", icon: Lock, count: (proyecto.accesos || []).length || undefined },
    ];

    return (
        <div className="p-3 sm:p-6 space-y-5 animate-fade-in pb-20 max-w-7xl mx-auto">
            {faltaMigracion && (
                <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs text-amber-200">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Falta aplicar la migración <code className="font-mono">supabase/migrations/20260923_gestion_proyectos.sql</code> en Supabase (SQL Editor). Sin ella no funcionan archivos, pedidos al cliente ni el checklist por fase.</span>
                </div>
            )}

            {/* Cabecera */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-card border border-border/80 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                    <button onClick={() => router.push("/proyectos")} className="p-2 rounded-xl bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shrink-0">
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="relative group shrink-0">
                        {proyecto.logo_url ? (
                            <img src={proyecto.logo_url} alt={proyecto.nombre} className="w-11 h-11 rounded-xl object-contain bg-secondary border border-border p-1" />
                        ) : (
                            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-sm">
                                {proyecto.nombre.slice(0, 2).toUpperCase()}
                            </div>
                        )}
                        <label htmlFor="logo-upload" className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" title="Subir logo del cliente">
                            <Upload className="w-3.5 h-3.5" />
                        </label>
                        <input type="file" accept="image/*" id="logo-upload" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadLogo(f); }} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-base sm:text-lg font-black text-foreground truncate">{proyecto.nombre}</h1>
                            <span className={cn("text-[9px] px-2.5 py-0.5 rounded-full border font-bold uppercase tracking-wider", ESTADO_BADGE[proyecto.estado])}>{proyecto.estado}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                            {cliente ? cliente.nombre : "Sin cliente"} · <strong className="text-foreground/80">{TIPO_PROYECTO_LABELS[proyecto.tipo_proyecto]}</strong>
                            {Number(proyecto.monto_total) > 0 && <> · {formatCurrency(Number(proyecto.monto_total))}</>}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <span className={cn("text-[11px] px-2.5 py-1.5 rounded-xl border font-bold flex items-center gap-1.5", ESTADO_PLAZO_COLORS[plazo.estado])}>
                        <CalendarClock className="w-3.5 h-3.5" />
                        {plazo.texto}{proyecto.fecha_entrega && plazo.estado !== "entregado" ? ` · ${fechaCorta(proyecto.fecha_entrega)}` : ""}
                    </span>
                    <button onClick={() => setEditando(true)} className={cn(ui.btn, ui.btnSecondary)}><Pencil className="w-3.5 h-3.5" /> Editar</button>
                    <a href={ctx.portalUrl} target="_blank" rel="noopener noreferrer" className={cn(ui.btn, ui.btnSecondary)}><Eye className="w-3.5 h-3.5 text-cyan-400" /> Portal</a>
                    <button onClick={() => { navigator.clipboard.writeText(ctx.portalUrl); toast.success("Link del portal copiado"); }} className={cn(ui.btn, "bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20")}>
                        <Copy className="w-3.5 h-3.5" /> Copiar link
                    </button>
                </div>
            </div>

            {/* Pestañas */}
            <div className="flex gap-1.5 bg-card/50 border border-border/80 p-1.5 rounded-2xl overflow-x-auto scrollbar-none">
                {TABS.map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={cn("relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 whitespace-nowrap",
                            activeTab === tab.id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60")}>
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                        {tab.count !== undefined && (
                            <span className={cn("text-[9px] px-1.5 rounded-full font-bold", activeTab === tab.id ? "bg-black/20 text-white" : "bg-primary/20 text-primary")}>{tab.count}</span>
                        )}
                        {tab.alerta && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
                    </button>
                ))}
            </div>

            {activeTab === "resumen" && <ResumenTab ctx={ctx} />}
            {activeTab === "fases" && <FasesTab ctx={ctx} />}
            {activeTab === "finanzas" && <FinanzasTab ctx={ctx} />}
            {activeTab === "brief" && <BriefTab ctx={ctx} />}
            {activeTab === "archivos" && <ArchivosTab ctx={ctx} />}
            {activeTab === "documentos" && <DocsTab ctx={ctx} />}

            {activeTab === "novedades" && (
                <div className={cn(ui.card, "space-y-4")}>
                    <h3 className="text-base font-bold text-foreground">Registro de novedades</h3>
                    <p className="text-xs text-muted-foreground -mt-2">Se registran solas cuando completás fases, cobrás, o el cliente completa el brief o sube material.</p>
                    <div className="p-3 rounded-xl border border-border bg-secondary/20 space-y-2">
                        <input value={logForm.titulo} onChange={(e) => setLogForm({ ...logForm, titulo: e.target.value })} placeholder="Nueva entrada (ej: Reunión con el cliente)…" className={ui.input} />
                        <textarea value={logForm.descripcion} onChange={(e) => setLogForm({ ...logForm, descripcion: e.target.value })} placeholder="Detalle opcional…" rows={2} className={ui.textarea} />
                        <div className="flex justify-end"><button onClick={agregarLog} className={cn(ui.btn, ui.btnPrimary)}><Plus className="w-3.5 h-3.5" /> Registrar</button></div>
                    </div>
                    <div className="space-y-2">
                        {logs.map((l) => (
                            <div key={l.id} className="group p-3 rounded-xl border border-border bg-card flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-foreground">{l.titulo}</p>
                                    {l.descripcion && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{l.descripcion}</p>}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[10px] text-muted-foreground">{formatDate(l.fecha)}</span>
                                    <button onClick={async () => { await logsProyectoStore.delete(l.id); recargar("logs"); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                            </div>
                        ))}
                        {logs.length === 0 && <p className="text-xs text-muted-foreground italic">Sin novedades.</p>}
                    </div>
                </div>
            )}

            {activeTab === "accesos" && (
                <div className={cn(ui.card, "space-y-4")}>
                    <div>
                        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /> Credenciales del proyecto</h3>
                        <p className="text-xs text-muted-foreground">Nunca se muestran en el portal del cliente.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                        <input placeholder="Servicio (ej: Hosting)" className={ui.input} value={newAcceso.servicio} onChange={(e) => setNewAcceso({ ...newAcceso, servicio: e.target.value })} />
                        <input placeholder="URL login" className={ui.input} value={newAcceso.url} onChange={(e) => setNewAcceso({ ...newAcceso, url: e.target.value })} />
                        <input placeholder="Usuario / key" className={ui.input} value={newAcceso.usuario} onChange={(e) => setNewAcceso({ ...newAcceso, usuario: e.target.value })} />
                        <input placeholder="Password" className={ui.input} value={newAcceso.password} onChange={(e) => setNewAcceso({ ...newAcceso, password: e.target.value })} />
                        <button onClick={agregarAcceso} className={cn(ui.btn, ui.btnPrimary)}><Plus className="w-3.5 h-3.5" /> Guardar</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {(proyecto.accesos || []).map((acc, i) => (
                            <div key={i} className="group p-3 rounded-xl border border-border bg-secondary/30 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-foreground truncate">{acc.servicio}</p>
                                    {acc.url && <a href={acc.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:underline truncate block">{acc.url}</a>}
                                    <p className="text-[11px] text-muted-foreground font-mono truncate">{acc.usuario} • {acc.password}</p>
                                </div>
                                <button onClick={() => guardarProyecto({ accesos: (proyecto.accesos || []).filter((_, j) => j !== i) }, "Credencial eliminada")} className="opacity-0 group-hover:opacity-100 p-1 text-rose-400">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {editando && <EditarProyectoModal ctx={ctx} onClose={() => setEditando(false)} />}
        </div>
    );
}
