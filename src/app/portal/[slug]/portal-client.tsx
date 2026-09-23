"use client";

import { useEffect, useState } from "react";
import {
    CheckCircle2, Circle, Clock, ExternalLink, MessageCircle, Calendar, FileText, LifeBuoy, Check,
    X as XIcon, Upload, Loader2, ClipboardList, FolderOpen, Home, Inbox, Link2, Download, Palette,
    Image as ImageIcon, Send, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    proyectosStore, clientesStore, ticketsStore, archivosProyectoStore, solicitudesStore,
    storageStore, logsProyectoStore, mensajeError,
} from "@/lib/store";
import { aISO, fechaCorta, infoPlazo, progresoBrief } from "@/lib/proyecto-gestion";
import { fasesDe } from "@/lib/proyectos-estado";
import type { ArchivoProyecto, CategoriaArchivo, Proyecto, SolicitudProyecto } from "@/lib/types";
import { CATEGORIA_ARCHIVO_LABELS, TIPO_PROYECTO_LABELS } from "@/lib/types";
import BriefForm from "./brief-form";

type Tab = "inicio" | "brief" | "archivos" | "ayuda";

const WHATSAPP_AGENCIA = (process.env.NEXT_PUBLIC_AGENCIA_WHATSAPP || "").replace(/\D/g, "");
const esImagen = (a: { mime?: string; url: string }) => (a.mime || "").startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(a.url);

function GaluLogo({ className }: { className?: string }) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/icon-512x512.png" alt="Galu Diseño Web" className={cn("w-auto object-contain select-none", className)} draggable={false} />;
}

function Seccion({ titulo, icono: Icono, children, accion }: { titulo: string; icono: typeof Home; children: React.ReactNode; accion?: React.ReactNode }) {
    return (
        <section className="rounded-3xl border border-white/10 bg-card/70 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2"><Icono className="w-5 h-5 text-amber-400" /> {titulo}</h2>
                {accion}
            </div>
            {children}
        </section>
    );
}

function SolicitudCard({ s, proyecto, onEntregada }: { s: SolicitudProyecto; proyecto: Proyecto; onEntregada: () => void }) {
    const [archivos, setArchivos] = useState<{ nombre: string; url: string }[]>([]);
    const [comentario, setComentario] = useState("");
    const [subiendo, setSubiendo] = useState(false);
    const [enviando, setEnviando] = useState(false);

    const subir = async (files: FileList | null) => {
        if (!files?.length) return;
        setSubiendo(true);
        for (const file of Array.from(files)) {
            try {
                const url = await storageStore.uploadArchivoProyecto(file, proyecto.id);
                await archivosProyectoStore.create({
                    proyecto_id: proyecto.id, nombre: file.name, url,
                    categoria: file.type.startsWith("image/") ? "imagen" : "documento",
                    subido_por: "cliente", visible_cliente: true, solicitud_id: s.id, mime: file.type || "", tamano: file.size,
                });
                setArchivos((a) => [...a, { nombre: file.name, url }]);
            } catch (e) { toast.error(`${file.name}: ${mensajeError(e)}`); }
        }
        setSubiendo(false);
    };

    const entregar = async () => {
        if (!archivos.length && !comentario.trim()) { toast.error("Subí un archivo o dejanos un comentario"); return; }
        setEnviando(true);
        try {
            await solicitudesStore.update(s.id, { estado: "entregada", entregada_at: new Date().toISOString(), respuesta_cliente: comentario.trim() });
            logsProyectoStore.create({ proyecto_id: proyecto.id, titulo: `El cliente entregó: ${s.titulo}`, descripcion: `${archivos.length} archivo(s). ${comentario.trim()}`, fecha: aISO(new Date()) }).catch(() => {});
            toast.success("¡Listo! Lo recibimos.");
            onEntregada();
        } catch (e) { toast.error(mensajeError(e)); }
        finally { setEnviando(false); }
    };

    return (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 space-y-3">
            <div>
                <p className="text-sm font-bold text-foreground">{s.titulo}</p>
                {s.descripcion && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{s.descripcion}</p>}
                {s.fecha_limite && <p className="text-[11px] text-amber-300 mt-1">Lo necesitamos para el {fechaCorta(s.fecha_limite)}</p>}
            </div>
            <label className="flex items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 border-dashed border-white/15 text-sm text-muted-foreground hover:border-amber-400/50 hover:text-amber-300 cursor-pointer transition">
                {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {subiendo ? "Subiendo…" : "Subir archivos"}
                <input type="file" multiple className="hidden" onChange={(e) => { subir(e.target.files); e.target.value = ""; }} />
            </label>
            {archivos.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {archivos.map((a) => <span key={a.url} className="text-[11px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-foreground flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400" /> {a.nombre}</span>)}
                </div>
            )}
            <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} placeholder="Comentario (opcional)" className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-foreground outline-none focus:border-amber-400/60 resize-none" />
            <button disabled={enviando || subiendo} onClick={entregar} className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-amber-400 text-slate-950 text-sm font-bold hover:bg-amber-300 disabled:opacity-60">
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar
            </button>
        </div>
    );
}

export default function PortalClient({ slug }: { slug: string }) {
    const [proyecto, setProyecto] = useState<Proyecto | null>(null);
    const [cliente, setCliente] = useState<{ id: string; nombre: string; negocio: string } | null>(null);
    const [archivos, setArchivos] = useState<ArchivoProyecto[]>([]);
    const [solicitudes, setSolicitudes] = useState<SolicitudProyecto[]>([]);
    const [estado, setEstado] = useState<"cargando" | "ok" | "no_existe" | "error">("cargando");
    const [tab, setTab] = useState<Tab>("inicio");
    const [showTicket, setShowTicket] = useState(false);
    const [ticketForm, setTicketForm] = useState({ asunto: "", descripcion: "" });
    const [cambiosFigma, setCambiosFigma] = useState<string | null>(null);
    const [procesandoFigma, setProcesandoFigma] = useState(false);
    const [subiendo, setSubiendo] = useState(false);
    const [categoriaSubida, setCategoriaSubida] = useState<CategoriaArchivo>("imagen");

    const cargarMaterial = async (id: string) => {
        const [a, s] = await Promise.all([
            archivosProyectoStore.getByProyecto(id, true).catch(() => []),
            solicitudesStore.getByProyecto(id).catch(() => []),
        ]);
        setArchivos(a);
        setSolicitudes(s);
    };

    const cargar = async () => {
        try {
            const p = await proyectosStore.getPortal(slug);
            if (!p) { setEstado("no_existe"); return; }
            setProyecto(p);
            const [c] = await Promise.all([
                p.cliente_id ? clientesStore.getPublico(p.cliente_id) : Promise.resolve(null),
                cargarMaterial(p.id),
            ]);
            setCliente(c);
            setEstado("ok");
        } catch (e) {
            console.error("Error cargando el portal:", e);
            setEstado("error");
        }
    };

    useEffect(() => { cargar(); }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

    if (estado === "cargando") {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
                <GaluLogo className="h-14 opacity-90" />
                <div className="animate-spin w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (estado !== "ok" || !proyecto) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
                <GaluLogo className="h-14" />
                <h1 className="text-2xl font-bold text-foreground">{estado === "no_existe" ? "Proyecto no encontrado" : "No pudimos cargar el portal"}</h1>
                <p className="text-sm text-muted-foreground max-w-sm">{estado === "no_existe" ? "Revisá que el link esté completo o pedinos uno nuevo." : "Probá recargar la página en unos minutos."}</p>
            </div>
        );
    }

    const fases = fasesDe(proyecto);
    const completadas = fases.filter((f) => f.completada).length;
    const progreso = fases.length ? Math.round((completadas / fases.length) * 100) : 0;
    const idxActual = fases.findIndex((f) => !f.completada);
    const plazo = infoPlazo(proyecto, progreso);
    const brief = proyecto.brief && proyecto.brief.estado !== "borrador" ? proyecto.brief : null;
    const briefProg = progresoBrief(brief);
    const pendientes = solicitudes.filter((s) => s.estado === "pendiente");
    const links = (proyecto.links || []).filter((l) => l.visible_cliente);
    const deAgencia = archivos.filter((a) => a.subido_por === "agencia");
    const deCliente = archivos.filter((a) => a.subido_por === "cliente");
    const figmaPendiente = Boolean(proyecto.figma_url) && !proyecto.figma_aprobado;
    const cantPendientes = pendientes.length + (brief && brief.estado !== "completado" ? 1 : 0) + (figmaPendiente ? 1 : 0);
    const primerNombre = cliente?.nombre?.split(" ")[0];

    const aprobarFigma = async (aprobado: boolean) => {
        if (!aprobado && !cambiosFigma?.trim()) { toast.error("Contanos qué te gustaría cambiar"); return; }
        setProcesandoFigma(true);
        try {
            const comentarios = aprobado ? "Aprobado desde el portal." : cambiosFigma!.trim();
            await proyectosStore.updateSinRetorno(proyecto.id, { figma_aprobado: aprobado, figma_comentarios: comentarios });
            logsProyectoStore.create({ proyecto_id: proyecto.id, titulo: aprobado ? "El cliente aprobó el diseño" : "El cliente pidió cambios en el diseño", descripcion: comentarios, fecha: aISO(new Date()) }).catch(() => {});
            setProyecto({ ...proyecto, figma_aprobado: aprobado, figma_comentarios: comentarios });
            setCambiosFigma(null);
            toast.success(aprobado ? "¡Diseño aprobado! Gracias." : "Recibimos tus comentarios.");
        } catch { toast.error("No se pudo enviar. Probá de nuevo."); }
        finally { setProcesandoFigma(false); }
    };

    const subirMaterial = async (files: FileList | null) => {
        if (!files?.length) return;
        setSubiendo(true);
        let ok = 0;
        for (const file of Array.from(files)) {
            try {
                const url = await storageStore.uploadArchivoProyecto(file, proyecto.id);
                await archivosProyectoStore.create({
                    proyecto_id: proyecto.id, nombre: file.name, url, categoria: categoriaSubida,
                    subido_por: "cliente", visible_cliente: true, solicitud_id: null, mime: file.type || "", tamano: file.size,
                });
                ok++;
            } catch (e) { toast.error(`${file.name}: ${mensajeError(e)}`); }
        }
        setSubiendo(false);
        if (ok) {
            toast.success(`${ok} archivo(s) subido(s). ¡Gracias!`);
            logsProyectoStore.create({ proyecto_id: proyecto.id, titulo: `El cliente subió ${ok} archivo(s)`, descripcion: CATEGORIA_ARCHIVO_LABELS[categoriaSubida], fecha: aISO(new Date()) }).catch(() => {});
            cargarMaterial(proyecto.id);
        }
    };

    const crearTicket = async () => {
        if (!ticketForm.asunto.trim() || !cliente) return;
        try {
            await ticketsStore.create({ cliente_id: cliente.id, proyecto_id: proyecto.id, asunto: ticketForm.asunto, descripcion: ticketForm.descripcion, prioridad: "media" });
            toast.success("Consulta enviada. Te respondemos a la brevedad.");
            setShowTicket(false);
            setTicketForm({ asunto: "", descripcion: "" });
        } catch { toast.error("No se pudo enviar la consulta"); }
    };

    const TABS: { id: Tab; label: string; icon: typeof Home; badge?: number; oculto?: boolean }[] = [
        { id: "inicio", label: "Inicio", icon: Home, badge: cantPendientes || undefined },
        { id: "brief", label: "Brief", icon: ClipboardList, oculto: !brief },
        { id: "archivos", label: "Archivos", icon: FolderOpen },
        { id: "ayuda", label: "Contacto", icon: MessageCircle },
    ];

    return (
        <div className="min-h-screen bg-background">
            <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-gradient-to-b from-amber-400/[0.07] to-transparent" />

            <header className="sticky top-0 z-20 border-b border-white/5 bg-background/80 backdrop-blur-xl">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <GaluLogo className="h-10" />
                    <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Portal de proyecto</span>
                </div>
                <nav className="max-w-3xl mx-auto px-2 sm:px-6 flex gap-1 overflow-x-auto scrollbar-none">
                    {TABS.filter((t) => !t.oculto).map((t) => (
                        <button key={t.id} onClick={() => { setTab(t.id); window.scrollTo({ top: 0 }); }}
                            className={cn("relative flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-semibold border-b-2 transition shrink-0",
                                tab === t.id ? "border-amber-400 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                            <t.icon className="w-4 h-4" /> {t.label}
                            {t.badge && <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center">{t.badge}</span>}
                        </button>
                    ))}
                </nav>
            </header>

            <main className="relative max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 animate-fade-in">
                {tab === "inicio" && (
                    <>
                        {/* Hero */}
                        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-card via-card to-amber-400/[0.06] p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                {proyecto.logo_url ? (
                                    <img src={proyecto.logo_url} alt="" className="w-14 h-14 rounded-2xl object-contain bg-white p-1.5 shrink-0" />
                                ) : (
                                    <div className="w-14 h-14 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-300 font-black text-lg shrink-0">{proyecto.nombre.slice(0, 2).toUpperCase()}</div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-[11px] uppercase tracking-widest text-amber-400 font-bold">{TIPO_PROYECTO_LABELS[proyecto.tipo_proyecto]}</p>
                                    <h1 className="text-2xl sm:text-3xl font-black text-foreground leading-tight">{proyecto.nombre}</h1>
                                    {cliente && <p className="text-sm text-muted-foreground">{cliente.negocio || cliente.nombre}</p>}
                                </div>
                            </div>

                            {primerNombre && <p className="text-sm text-foreground/90">¡Hola {primerNombre}! Acá vas a ver cómo avanza tu proyecto, lo que necesitamos de vos y todo el material compartido.</p>}

                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Avance</p>
                                    <p className="text-3xl font-black text-foreground">{progreso}%</p>
                                    <div className="h-2 rounded-full bg-white/10 overflow-hidden mt-2">
                                        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-700" style={{ width: `${progreso}%` }} />
                                    </div>
                                </div>
                                <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Entrega estimada</p>
                                    <p className="text-xl sm:text-2xl font-black text-foreground">{proyecto.fecha_entrega ? fechaCorta(proyecto.fecha_entrega) : "A definir"}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {plazo.estado === "entregado" ? "¡Proyecto entregado!" : plazo.diasRestantes !== null && plazo.diasRestantes >= 0 ? `Faltan ${plazo.diasRestantes} días` : idxActual >= 0 ? `Fase: ${fases[idxActual].nombre}` : ""}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Pendientes */}
                        {cantPendientes > 0 && (
                            <Seccion titulo="Lo que necesitamos de vos" icono={Inbox}>
                                <div className="space-y-3">
                                    {brief && brief.estado !== "completado" && (
                                        <button onClick={() => setTab("brief")} className="w-full text-left rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 flex items-center gap-4 hover:bg-amber-400/15 transition">
                                            <div className="w-11 h-11 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0"><ClipboardList className="w-5 h-5" /></div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-foreground">Completar el brief</p>
                                                <p className="text-xs text-muted-foreground">{briefProg.respondidas ? `Vas ${briefProg.respondidas} de ${briefProg.total}. Se guarda solo.` : `${briefProg.total} preguntas para conocer tu negocio. Se guarda solo.`}</p>
                                            </div>
                                            <ArrowRight className="w-5 h-5 text-amber-400 shrink-0" />
                                        </button>
                                    )}
                                    {pendientes.map((s) => <SolicitudCard key={s.id} s={s} proyecto={proyecto} onEntregada={() => cargarMaterial(proyecto.id)} />)}
                                    {figmaPendiente && (
                                        <div className="rounded-2xl border border-purple-400/30 bg-purple-400/5 p-4 space-y-3">
                                            <a href={proyecto.figma_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
                                                <div className="w-11 h-11 rounded-xl bg-purple-400/20 flex items-center justify-center shrink-0"><Palette className="w-5 h-5 text-purple-300" /></div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold text-foreground group-hover:text-purple-300">Revisar y aprobar el diseño</p>
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1">Abrir en Figma <ExternalLink className="w-3 h-3" /></p>
                                                </div>
                                            </a>
                                            {proyecto.figma_comentarios && proyecto.figma_aprobado === false && proyecto.figma_comentarios !== "Aprobado desde el portal." && (
                                                <p className="text-xs text-muted-foreground bg-white/5 rounded-lg p-2">Tus últimos comentarios: {proyecto.figma_comentarios}</p>
                                            )}
                                            {cambiosFigma === null ? (
                                                <div className="flex gap-2">
                                                    <button disabled={procesandoFigma} onClick={() => aprobarFigma(true)} className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold hover:bg-emerald-400"><Check className="w-4 h-4" /> Aprobar</button>
                                                    <button onClick={() => setCambiosFigma("")} className="flex-1 h-10 rounded-xl border border-white/15 text-sm font-semibold text-foreground hover:border-purple-400/50">Pedir cambios</button>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <textarea autoFocus value={cambiosFigma} onChange={(e) => setCambiosFigma(e.target.value)} rows={3} placeholder="¿Qué te gustaría cambiar?" className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-foreground outline-none focus:border-purple-400/60 resize-none" />
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setCambiosFigma(null)} className="px-4 h-10 rounded-xl text-sm text-muted-foreground">Cancelar</button>
                                                        <button disabled={procesandoFigma} onClick={() => aprobarFigma(false)} className="flex-1 h-10 rounded-xl bg-purple-400 text-slate-950 text-sm font-bold">Enviar comentarios</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Seccion>
                        )}

                        {/* Fases */}
                        <Seccion titulo="Etapas del proyecto" icono={Clock}>
                            <ol className="relative">
                                {fases.map((f, i) => {
                                    const activa = i === idxActual;
                                    return (
                                        <li key={`${f.nombre}-${i}`} className="flex gap-4 pb-5 last:pb-0">
                                            <div className="flex flex-col items-center">
                                                <div className={cn("w-9 h-9 rounded-full flex items-center justify-center border-2 shrink-0",
                                                    f.completada ? "bg-emerald-500/15 border-emerald-500 text-emerald-400" : activa ? "bg-amber-400/15 border-amber-400 text-amber-300 animate-pulse-soft" : "bg-white/[0.03] border-white/10 text-muted-foreground")}>
                                                    {f.completada ? <CheckCircle2 className="w-4 h-4" /> : activa ? <Clock className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                                                </div>
                                                {i < fases.length - 1 && <div className={cn("w-0.5 flex-1 mt-1.5", f.completada ? "bg-emerald-500/40" : "bg-white/10")} />}
                                            </div>
                                            <div className="flex-1 pt-1.5 flex items-start justify-between gap-2">
                                                <div>
                                                    <p className={cn("text-sm font-semibold", f.completada ? "text-muted-foreground" : "text-foreground")}>{f.nombre}</p>
                                                    <p className="text-xs text-muted-foreground">{f.completada ? "Completada" : activa ? "En proceso" : "Próximamente"}</p>
                                                </div>
                                                {(f.completada ? f.fecha_completada : f.fecha_limite) && (
                                                    <span className="text-[11px] text-muted-foreground shrink-0">{fechaCorta(f.completada ? f.fecha_completada : f.fecha_limite)}</span>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        </Seccion>

                        {(links.length > 0 || proyecto.figma_aprobado) && (
                            <Seccion titulo="Links" icono={Link2}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {proyecto.figma_url && proyecto.figma_aprobado && (
                                        <a href={proyecto.figma_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-amber-400/40 transition">
                                            <Palette className="w-5 h-5 text-purple-300 shrink-0" />
                                            <span className="text-sm font-semibold text-foreground flex-1">Diseño aprobado</span>
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        </a>
                                    )}
                                    {links.map((l) => (
                                        <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-amber-400/40 transition">
                                            <Link2 className="w-5 h-5 text-amber-400 shrink-0" />
                                            <span className="text-sm font-semibold text-foreground flex-1 truncate">{l.titulo}</span>
                                            <ExternalLink className="w-4 h-4 text-muted-foreground" />
                                        </a>
                                    ))}
                                </div>
                            </Seccion>
                        )}
                    </>
                )}

                {tab === "brief" && brief && (
                    <Seccion titulo="Brief del proyecto" icono={ClipboardList}>
                        <BriefForm proyecto={proyecto} slug={slug} onCompletado={() => setProyecto({ ...proyecto, brief: { ...brief, estado: "completado" } })} />
                    </Seccion>
                )}

                {tab === "archivos" && (
                    <>
                        <Seccion titulo="Documentos del proyecto" icono={FileText}>
                            {proyecto.contrato_url && !deAgencia.some((a) => a.url === proyecto.contrato_url) && (
                                <a href={proyecto.contrato_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-amber-400/40">
                                    <FileText className="w-5 h-5 text-amber-400" /><span className="text-sm font-semibold text-foreground flex-1">Contrato de servicios</span><Download className="w-4 h-4 text-muted-foreground" />
                                </a>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {deAgencia.map((a) => (
                                    <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-amber-400/40 transition">
                                        {esImagen(a) ? <img src={a.url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" /> : <div className="w-10 h-10 rounded-lg bg-amber-400/10 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-amber-400" /></div>}
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-foreground truncate">{a.nombre}</p>
                                            <p className="text-[11px] text-muted-foreground">{CATEGORIA_ARCHIVO_LABELS[a.categoria]} · {fechaCorta(a.created_at)}</p>
                                        </div>
                                        <Download className="w-4 h-4 text-muted-foreground shrink-0" />
                                    </a>
                                ))}
                            </div>
                            {deAgencia.length === 0 && !proyecto.contrato_url && <p className="text-sm text-muted-foreground">Todavía no compartimos documentos.</p>}
                        </Seccion>

                        <Seccion titulo="Tu material" icono={ImageIcon}>
                            <p className="text-sm text-muted-foreground -mt-2">Logo, fotos, textos, videos… todo lo que quieras que usemos.</p>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <select value={categoriaSubida} onChange={(e) => setCategoriaSubida(e.target.value as CategoriaArchivo)} className="h-11 px-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-foreground">
                                    {(["logo", "imagen", "documento", "otro"] as CategoriaArchivo[]).map((c) => <option key={c} value={c}>{CATEGORIA_ARCHIVO_LABELS[c]}</option>)}
                                </select>
                                <label className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-amber-400 text-slate-950 text-sm font-bold hover:bg-amber-300 cursor-pointer">
                                    {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {subiendo ? "Subiendo…" : "Subir archivos"}
                                    <input type="file" multiple className="hidden" onChange={(e) => { subirMaterial(e.target.files); e.target.value = ""; }} />
                                </label>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                {deCliente.map((a) => (
                                    <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-xl overflow-hidden border border-white/10 bg-white/[0.02] flex flex-col items-center justify-center p-1 hover:border-amber-400/40" title={a.nombre}>
                                        {esImagen(a) ? <img src={a.url} alt={a.nombre} className="w-full h-full object-cover rounded-lg" /> : <><FileText className="w-6 h-6 text-muted-foreground" /><span className="text-[9px] text-muted-foreground truncate w-full text-center mt-1">{a.nombre}</span></>}
                                    </a>
                                ))}
                            </div>
                            {deCliente.length === 0 && <p className="text-xs text-muted-foreground">Todavía no subiste archivos.</p>}
                        </Seccion>
                    </>
                )}

                {tab === "ayuda" && (
                    <Seccion titulo="¿Necesitás algo?" icono={MessageCircle}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {WHATSAPP_AGENCIA && (
                                <a href={`https://wa.me/${WHATSAPP_AGENCIA}?text=${encodeURIComponent(`Hola! Te escribo por el proyecto "${proyecto.nombre}".`)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-emerald-400/40 transition">
                                    <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center"><MessageCircle className="w-5 h-5 text-emerald-400" /></div>
                                    <div><p className="text-sm font-bold text-foreground">WhatsApp</p><p className="text-xs text-muted-foreground">Escribinos directo</p></div>
                                </a>
                            )}
                            {proyecto.calendly_url && (
                                <a href={proyecto.calendly_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-blue-400/40 transition">
                                    <div className="w-11 h-11 rounded-xl bg-blue-500/15 flex items-center justify-center"><Calendar className="w-5 h-5 text-blue-400" /></div>
                                    <div><p className="text-sm font-bold text-foreground">Agendar reunión</p><p className="text-xs text-muted-foreground">Elegí un horario</p></div>
                                </a>
                            )}
                            {cliente && (
                                <button onClick={() => setShowTicket(true)} className="text-left flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-amber-400/40 transition">
                                    <div className="w-11 h-11 rounded-xl bg-amber-400/15 flex items-center justify-center"><LifeBuoy className="w-5 h-5 text-amber-400" /></div>
                                    <div><p className="text-sm font-bold text-foreground">Enviar una consulta</p><p className="text-xs text-muted-foreground">Cambios, dudas o problemas</p></div>
                                </button>
                            )}
                        </div>
                    </Seccion>
                )}

                <footer className="pt-8 pb-4 flex flex-col items-center gap-2 border-t border-white/5">
                    <GaluLogo className="h-9 opacity-80" />
                    <p className="text-[11px] text-muted-foreground">Diseño y desarrollo web · Portal privado de tu proyecto</p>
                </footer>
            </main>

            {showTicket && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:px-4">
                    <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-white/10 bg-card p-6 shadow-2xl animate-fade-in relative space-y-4">
                        <button onClick={() => setShowTicket(false)} className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/5 text-muted-foreground hover:text-foreground"><XIcon className="w-4 h-4" /></button>
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2"><LifeBuoy className="w-5 h-5 text-amber-400" /> Nueva consulta</h3>
                        <input placeholder="Asunto (ej: Cambiar una foto)" value={ticketForm.asunto} onChange={(e) => setTicketForm({ ...ticketForm, asunto: e.target.value })} className="w-full h-11 px-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-foreground outline-none focus:border-amber-400/60" />
                        <textarea rows={4} placeholder="Contanos con detalle…" value={ticketForm.descripcion} onChange={(e) => setTicketForm({ ...ticketForm, descripcion: e.target.value })} className="w-full p-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-foreground outline-none focus:border-amber-400/60 resize-none" />
                        <button onClick={crearTicket} className="w-full h-11 rounded-xl bg-amber-400 text-slate-950 font-bold hover:bg-amber-300">Enviar</button>
                    </div>
                </div>
            )}
        </div>
    );
}
