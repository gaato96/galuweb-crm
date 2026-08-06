"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ClipboardList, Plus, Upload, Download, RefreshCw, Search, Target,
    Table2, Columns3, BarChart3, Loader2, ExternalLink, Instagram, Phone,
    AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Prospecto, EstadoProspecto, ClasificacionWeb, ScraperBusqueda } from "@/lib/types";
import {
    ESTADO_PROSPECTO_LABELS, ESTADO_PROSPECTO_COLORS, CLASIFICACION_WEB_LABELS,
    QUIEN_LEYO_LABELS,
} from "@/lib/types";
import { prospectosStore, scraperStore } from "@/lib/store";
import {
    calcularNivelDato, normalizarEscaneo, normalizar, proximaAccion, hoyISO,
    prospectoVacio, fueEnviado, respondio, tasaPorNivelDato, tasaPorRubro,
    tasaPorQuienLeyo, diagnosticoEmbudo, diasDesde, PRIORIDAD_SEGMENTO,
    NIVEL_DATO_COLORS, PASO_MENSAJE_LABELS,
    type CorteMetrica,
} from "@/lib/prospeccion";
import ProspectoModal from "./prospecto-modal";
import ImportarPanel from "./importar-panel";

type Vista = "cola" | "planilla" | "embudo" | "metricas";

const VISTAS: { id: Vista; label: string; icon: typeof Target }[] = [
    { id: "cola", label: "Cola del día", icon: Target },
    { id: "planilla", label: "Planilla", icon: Table2 },
    { id: "embudo", label: "Embudo", icon: Columns3 },
    { id: "metricas", label: "Métricas", icon: BarChart3 },
];

const COLUMNAS_EMBUDO: EstadoProspecto[] = [
    "sin_calificar", "calificado", "enviado", "fu1", "fu2", "respondio", "revision_enviada", "reunion", "cliente",
];

/** Objetivo diario del sistema: 10 mensajes por bloque de trabajo. */
const OBJETIVO_DIARIO = 10;

export default function ProspeccionPage() {
    const [prospectos, setProspectos] = useState<Prospecto[]>([]);
    const [busquedas, setBusquedas] = useState<ScraperBusqueda[]>([]);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState<string | null>(null);

    const [vista, setVista] = useState<Vista>("cola");
    const [busqueda, setBusqueda] = useState("");
    const [filtroRubro, setFiltroRubro] = useState("");
    const [filtroEstado, setFiltroEstado] = useState<EstadoProspecto | "">("");
    const [filtroSegmento, setFiltroSegmento] = useState<ClasificacionWeb | "">("");
    const [filtroNivel, setFiltroNivel] = useState<string>("");

    const [seleccionado, setSeleccionado] = useState<Prospecto | null>(null);
    const [mostrarImportar, setMostrarImportar] = useState(false);
    const [recalculando, setRecalculando] = useState(false);

    // ─── Carga ───
    const cargar = useCallback(async () => {
        setCargando(true);
        setErrorCarga(null);
        try {
            const data = await prospectosStore.getAll();
            setProspectos(data);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Error al cargar prospectos";
            setErrorCarga(msg);
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargar();
        scraperStore.getAllSearches().then(setBusquedas).catch(() => setBusquedas([]));
    }, [cargar]);

    // ─── Derivados ───
    const rubros = useMemo(
        () => Array.from(new Set(prospectos.map((p) => p.rubro).filter(Boolean))).sort(),
        [prospectos]
    );

    const filtrados = useMemo(() => {
        const q = normalizar(busqueda);
        return prospectos.filter((p) => {
            if (q && ![p.negocio, p.rubro, p.especialidad, p.ciudad, p.dato_usado, p.telefono].some(
                (v) => v && normalizar(v).includes(q)
            )) return false;
            if (filtroRubro && p.rubro !== filtroRubro) return false;
            if (filtroEstado && p.estado !== filtroEstado) return false;
            if (filtroSegmento && p.clasificacion_web !== filtroSegmento) return false;
            if (filtroNivel) {
                const n = calcularNivelDato(normalizarEscaneo(p.escaneo));
                if (filtroNivel === "sin" ? n !== null : String(n) !== filtroNivel) return false;
            }
            return true;
        });
    }, [prospectos, busqueda, filtroRubro, filtroEstado, filtroSegmento, filtroNivel]);

    /**
     * Orden de trabajo de §8: primero el segmento, después el score.
     * Los ya contactados y los descartados salen de la cola.
     */
    const cola = useMemo(() => {
        return filtrados
            .filter((p) => p.estado === "sin_calificar" || p.estado === "calificado")
            .sort((a, b) => {
                const segA = PRIORIDAD_SEGMENTO[a.clasificacion_web];
                const segB = PRIORIDAD_SEGMENTO[b.clasificacion_web];
                if (segA !== segB) return segA - segB;
                return b.score - a.score;
            });
    }, [filtrados]);

    /** Follow-ups que tocan hoy, según los plazos de 3-4 y 7-10 días. */
    const followUpsPendientes = useMemo(
        () =>
            prospectos
                .map((p) => ({ p, accion: proximaAccion(p) }))
                .filter((x) => x.accion?.vencido)
                .sort((a, b) => (b.accion?.dias ?? 0) - (a.accion?.dias ?? 0)),
        [prospectos]
    );

    const enviadosHoy = prospectos.filter((p) => p.fecha_envio === hoyISO()).length;
    const enviadosSemana = prospectos.filter((p) => p.fecha_envio && diasDesde(p.fecha_envio) < 7).length;
    const totalEnviados = prospectos.filter(fueEnviado).length;
    const totalRespondio = prospectos.filter(respondio).length;
    const tasaGlobal = totalEnviados ? totalRespondio / totalEnviados : 0;

    // ─── Acciones ───
    const guardar = async (id: string, cambios: Partial<Prospecto>) => {
        const actual = prospectos.find((p) => p.id === id);
        const actualizado = await prospectosStore.update(id, cambios, actual, prospectos);
        setProspectos((prev) => prev.map((p) => (p.id === id ? actualizado : p)));
        setSeleccionado((s) => (s && s.id === id ? actualizado : s));
    };

    const crearNuevo = async () => {
        try {
            const creado = await prospectosStore.create(
                { ...prospectoVacio(), negocio: "Nuevo prospecto" },
                prospectos
            );
            setProspectos((prev) => [creado, ...prev]);
            setSeleccionado(creado);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "No se pudo crear");
        }
    };

    const eliminar = async (id: string) => {
        await prospectosStore.delete(id);
        setProspectos((prev) => prev.filter((p) => p.id !== id));
        setSeleccionado(null);
        toast.success("Prospecto eliminado");
    };

    const convertirCliente = async (p: Prospecto) => {
        try {
            const cliente = await prospectosStore.convertirACliente(p);
            await cargar();
            setSeleccionado(null);
            toast.success(`${cliente.nombre} pasó al pipeline de clientes`);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "No se pudo convertir");
        }
    };

    const importarFilas = async (items: Partial<Prospecto>[]) => {
        try {
            const { insertados, duplicados } = await prospectosStore.createBulk(items, prospectos);
            await cargar();
            setMostrarImportar(false);
            toast.success(
                `${insertados.length} prospectos importados` +
                (duplicados > 0 ? ` · ${duplicados} salteados por duplicado o sin nombre` : "")
            );
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al importar");
        }
    };

    const importarScraper = async (b: ScraperBusqueda) => {
        try {
            const { insertados, duplicados } = await prospectosStore.importarDesdeScraper(b.prospectos, prospectos);
            await cargar();
            setMostrarImportar(false);
            toast.success(
                `${insertados.length} prospectos traídos del Scraper` +
                (duplicados > 0 ? ` · ${duplicados} ya estaban` : "")
            );
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al importar");
        }
    };

    const recalcular = async () => {
        setRecalculando(true);
        try {
            const actualizados = await prospectosStore.recalcularScores(prospectos);
            setProspectos([...actualizados].sort((a, b) => b.score - a.score));
            toast.success("Scores recalculados sobre la distribución actual de cada rubro");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "No se pudo recalcular");
        } finally {
            setRecalculando(false);
        }
    };

    const exportarCsv = () => {
        if (filtrados.length === 0) {
            toast.error("No hay prospectos para exportar");
            return;
        }
        const headers = [
            "Fecha de envío", "Negocio", "Rubro", "Especialidad", "Ciudad", "Link del perfil",
            "Canal", "Clasificación web", "Dato usado", "Nivel del dato", "Quién leyó", "Estado", "Score",
        ];
        const filas = filtrados.map((p) => [
            p.fecha_envio || "",
            p.negocio,
            p.rubro,
            p.especialidad,
            p.ciudad,
            p.instagram_url || p.maps_url || p.sitio_web_url,
            p.canal,
            CLASIFICACION_WEB_LABELS[p.clasificacion_web],
            p.dato_usado,
            p.nivel_dato ?? "",
            p.quien_leyo ? QUIEN_LEYO_LABELS[p.quien_leyo] : "",
            ESTADO_PROSPECTO_LABELS[p.estado],
            p.score,
        ]);

        const escapar = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const csv = [headers, ...filas].map((f) => f.map(escapar).join(",")).join("\r\n");
        // BOM para que Excel respete los acentos; Blob en vez de data: URI para listas largas.
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `prospeccion_${hoyISO()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Planilla exportada");
    };

    // ─── Render ───
    return (
        <div className="space-y-5 max-w-[1500px] mx-auto pb-12">
            {/* Cabecera */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-900/90 via-slate-900/40 to-slate-900/90 border border-primary/20 p-5 sm:p-6 rounded-2xl shadow-xl relative overflow-hidden">
                <div className="absolute -right-12 -top-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                <div className="z-10 space-y-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/20 text-primary border border-primary/30 uppercase tracking-wide">
                        Contacto en frío
                    </span>
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
                        <ClipboardList className="w-7 h-7 text-primary" />
                        Planilla de Prospectos
                    </h1>
                    <p className="text-sm text-muted-foreground max-w-2xl">
                        Pasá en limpio la prospección, escaneá cada negocio buscando el dato que hace funcionar el mensaje,
                        y llevá el registro del embudo hasta la reunión.
                    </p>
                </div>

                <div className="flex items-center gap-2 z-10 flex-wrap">
                    <BotonHeader onClick={() => setMostrarImportar(true)} icon={Upload} label="Importar" primario />
                    <BotonHeader onClick={crearNuevo} icon={Plus} label="Nuevo" />
                    <BotonHeader onClick={exportarCsv} icon={Download} label="Exportar" />
                    <BotonHeader onClick={recalcular} icon={RefreshCw} label="Recalcular" cargando={recalculando} />
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <Kpi label="En la planilla" valor={prospectos.length} detalle={`${cola.length} sin contactar`} />
                <Kpi
                    label="Enviados hoy"
                    valor={enviadosHoy}
                    detalle={`objetivo ${OBJETIVO_DIARIO}`}
                    tono={enviadosHoy >= OBJETIVO_DIARIO ? "ok" : enviadosHoy > 0 ? "medio" : "neutro"}
                />
                <Kpi label="Últimos 7 días" valor={enviadosSemana} detalle="mensajes 1 enviados" />
                <Kpi
                    label="Tasa de respuesta"
                    valor={`${Math.round(tasaGlobal * 100)}%`}
                    detalle={`${totalRespondio} de ${totalEnviados}`}
                    tono={totalEnviados >= 20 ? (tasaGlobal < 0.05 ? "alerta" : "ok") : "neutro"}
                />
                <Kpi
                    label="Follow-ups vencidos"
                    valor={followUpsPendientes.length}
                    detalle="tocan hoy o antes"
                    tono={followUpsPendientes.length > 0 ? "medio" : "neutro"}
                />
            </div>

            {/* Follow-ups que tocan */}
            {followUpsPendientes.length > 0 && vista !== "metricas" && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
                    <p className="text-xs font-bold text-amber-300 flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4" />
                        Follow-ups que tocan ({followUpsPendientes.length})
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {followUpsPendientes.slice(0, 12).map(({ p, accion }) => (
                            <button
                                key={p.id}
                                onClick={() => setSeleccionado(p)}
                                className="shrink-0 text-left px-3 py-2 rounded-lg border border-amber-500/25 bg-background/50 hover:border-amber-500/50 transition-colors min-w-[190px]"
                            >
                                <p className="text-xs font-bold text-foreground truncate">{p.negocio}</p>
                                <p className="text-[11px] text-amber-300/80">
                                    {accion && PASO_MENSAJE_LABELS[accion.paso]} · hace {accion?.dias} días
                                </p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Barra de vistas y filtros */}
            <div className="space-y-3">
                <div className="flex gap-1.5 flex-wrap">
                    {VISTAS.map((v) => (
                        <button
                            key={v.id}
                            onClick={() => setVista(v.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all",
                                vista === v.id
                                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                            )}
                        >
                            <v.icon className="w-4 h-4" />
                            {v.label}
                        </button>
                    ))}
                </div>

                {vista !== "metricas" && (
                    <div className="flex gap-2 flex-wrap items-center">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                placeholder="Buscar negocio, rubro, ciudad o dato usado..."
                                className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                        </div>
                        <select value={filtroRubro} onChange={(e) => setFiltroRubro(e.target.value)} className={selectCls}>
                            <option value="">Todos los rubros</option>
                            {rubros.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select value={filtroSegmento} onChange={(e) => setFiltroSegmento(e.target.value as ClasificacionWeb | "")} className={selectCls}>
                            <option value="">Todos los segmentos</option>
                            {(Object.keys(CLASIFICACION_WEB_LABELS) as ClasificacionWeb[]).map((c) => (
                                <option key={c} value={c}>{CLASIFICACION_WEB_LABELS[c]}</option>
                            ))}
                        </select>
                        <select value={filtroNivel} onChange={(e) => setFiltroNivel(e.target.value)} className={selectCls}>
                            <option value="">Todos los niveles</option>
                            <option value="1">Nivel 1</option>
                            <option value="2">Nivel 2</option>
                            <option value="3">Nivel 3</option>
                            <option value="4">Nivel 4</option>
                            <option value="sin">Sin dato</option>
                        </select>
                        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as EstadoProspecto | "")} className={selectCls}>
                            <option value="">Todos los estados</option>
                            {(Object.keys(ESTADO_PROSPECTO_LABELS) as EstadoProspecto[]).map((e) => (
                                <option key={e} value={e}>{ESTADO_PROSPECTO_LABELS[e]}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Estados de carga */}
            {cargando && (
                <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Cargando la planilla...</span>
                </div>
            )}

            {errorCarga && !cargando && (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5">
                    <p className="text-sm font-bold text-rose-300 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        No se pudo leer la tabla de prospectos
                    </p>
                    <p className="text-xs text-rose-200/80 mt-1">{errorCarga}</p>
                    <p className="text-xs text-muted-foreground mt-3">
                        Si dice que la relación no existe, falta correr la migración{" "}
                        <code className="px-1.5 py-0.5 rounded bg-background/60 text-foreground">supabase/migrations/20260806_prospectos.sql</code>{" "}
                        en el SQL Editor de Supabase.
                    </p>
                </div>
            )}

            {!cargando && !errorCarga && (
                <>
                    {vista === "cola" && <VistaCola cola={cola} onAbrir={setSeleccionado} />}
                    {vista === "planilla" && <VistaPlanilla prospectos={filtrados} onAbrir={setSeleccionado} onCambiarEstado={(id, estado) => guardar(id, { estado })} />}
                    {vista === "embudo" && <VistaEmbudo prospectos={filtrados} onAbrir={setSeleccionado} />}
                    {vista === "metricas" && <VistaMetricas prospectos={prospectos} />}
                </>
            )}

            {/* Modales */}
            {seleccionado && (
                <ProspectoModal
                    prospecto={seleccionado}
                    universo={prospectos}
                    onGuardar={(cambios) => guardar(seleccionado.id, cambios)}
                    onEliminar={() => eliminar(seleccionado.id)}
                    onConvertirCliente={() => convertirCliente(seleccionado)}
                    onCerrar={() => setSeleccionado(null)}
                />
            )}
            {mostrarImportar && (
                <ImportarPanel
                    busquedasScraper={busquedas}
                    onImportarFilas={importarFilas}
                    onImportarScraper={importarScraper}
                    onCerrar={() => setMostrarImportar(false)}
                />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// Vista: Cola del día
// ═══════════════════════════════════════════════════════════

function VistaCola({ cola, onAbrir }: { cola: Prospecto[]; onAbrir: (p: Prospecto) => void }) {
    if (cola.length === 0) {
        return (
            <Vacio
                titulo="No hay nadie en la cola"
                detalle="Importá la planilla de Google Sheets o traé una búsqueda del Scraper para empezar."
            />
        );
    }

    const bloque = cola.slice(0, OBJETIVO_DIARIO);
    const resto = cola.slice(OBJETIVO_DIARIO);

    return (
        <div className="space-y-5">
            <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">
                    El bloque de hoy — los {Math.min(OBJETIVO_DIARIO, bloque.length)} de arriba
                </p>
                <div className="grid gap-2">
                    {bloque.map((p, i) => <FilaCola key={p.id} p={p} indice={i + 1} onAbrir={onAbrir} destacado />)}
                </div>
            </div>

            {resto.length > 0 && (
                <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">
                        Siguientes en la fila ({resto.length})
                    </p>
                    <div className="grid gap-2">
                        {resto.slice(0, 40).map((p, i) => <FilaCola key={p.id} p={p} indice={OBJETIVO_DIARIO + i + 1} onAbrir={onAbrir} />)}
                    </div>
                    {resto.length > 40 && (
                        <p className="text-xs text-muted-foreground text-center mt-3">
                            {resto.length - 40} más. Calificar toda la lista antes de mandar el primer mensaje es el error
                            que te deja tres semanas haciendo research sin hablar con nadie.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

function FilaCola({ p, indice, onAbrir, destacado }: { p: Prospecto; indice: number; onAbrir: (p: Prospecto) => void; destacado?: boolean }) {
    const nivel = calcularNivelDato(normalizarEscaneo(p.escaneo));
    const link = p.instagram_url || p.maps_url || p.sitio_web_url;

    return (
        <div
            className={cn(
                "flex items-center gap-3 p-3 rounded-xl border bg-card transition-all hover:border-primary/40 cursor-pointer",
                destacado ? "border-primary/25" : "border-border"
            )}
            onClick={() => onAbrir(p)}
        >
            <span className={cn(
                "shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-extrabold",
                destacado ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
            )}>
                {indice}
            </span>

            <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground truncate">{p.negocio}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                    {[p.especialidad || p.rubro, p.ciudad].filter(Boolean).join(" · ")}
                    {p.reviews_count != null && ` · ${p.reviews_count} reseñas`}
                </p>
            </div>

            <div className="hidden md:block min-w-0 flex-1 max-w-[280px]">
                {p.dato_usado ? (
                    <p className="text-[11px] text-muted-foreground italic truncate" title={p.dato_usado}>&ldquo;{p.dato_usado}&rdquo;</p>
                ) : (
                    <p className="text-[11px] text-rose-400/80">Falta el dato de personalización</p>
                )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary text-muted-foreground border border-border hidden sm:inline">
                    {CLASIFICACION_WEB_LABELS[p.clasificacion_web]}
                </span>
                {nivel && (
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", NIVEL_DATO_COLORS[nivel])}>
                        N{nivel}
                    </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-primary/15 text-primary border border-primary/30 tabular-nums">
                    {p.score}
                </span>
                {link && (
                    <a
                        href={link.startsWith("http") ? link : `https://${link}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
                        title="Abrir perfil"
                    >
                        {p.instagram_url ? <Instagram className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                    </a>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// Vista: Planilla
// ═══════════════════════════════════════════════════════════

function VistaPlanilla({
    prospectos, onAbrir, onCambiarEstado,
}: {
    prospectos: Prospecto[];
    onAbrir: (p: Prospecto) => void;
    onCambiarEstado: (id: string, estado: EstadoProspecto) => void;
}) {
    if (prospectos.length === 0) return <Vacio titulo="Sin resultados" detalle="Probá quitando algún filtro." />;

    return (
        <div className="rounded-2xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-xs">
                <thead className="bg-secondary/50 sticky top-0">
                    <tr className="text-left">
                        {["Envío", "Negocio", "Rubro", "Ciudad", "Canal", "Clasif. web", "Dato usado", "Nivel", "Leyó", "Estado", "Score"].map((h) => (
                            <th key={h} className="px-3 py-2.5 font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {prospectos.map((p) => {
                        const nivel = calcularNivelDato(normalizarEscaneo(p.escaneo));
                        return (
                            <tr key={p.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{p.fecha_envio || "—"}</td>
                                <td className="px-3 py-2">
                                    <button onClick={() => onAbrir(p)} className="font-bold text-foreground hover:text-primary text-left max-w-[220px] truncate block">
                                        {p.negocio}
                                    </button>
                                </td>
                                <td className="px-3 py-2 text-muted-foreground max-w-[130px] truncate">{p.especialidad || p.rubro || "—"}</td>
                                <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{p.ciudad || "—"}</td>
                                <td className="px-3 py-2">
                                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                                        {p.canal === "whatsapp" ? <Phone className="w-3 h-3" /> : <Instagram className="w-3 h-3" />}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{CLASIFICACION_WEB_LABELS[p.clasificacion_web]}</td>
                                <td className="px-3 py-2 text-muted-foreground max-w-[220px] truncate" title={p.dato_usado}>{p.dato_usado || "—"}</td>
                                <td className="px-3 py-2">
                                    {nivel ? (
                                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold border", NIVEL_DATO_COLORS[nivel])}>N{nivel}</span>
                                    ) : <span className="text-muted-foreground">—</span>}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                                    {p.quien_leyo ? QUIEN_LEYO_LABELS[p.quien_leyo] : "—"}
                                </td>
                                <td className="px-3 py-2">
                                    <select
                                        value={p.estado}
                                        onChange={(e) => onCambiarEstado(p.id, e.target.value as EstadoProspecto)}
                                        className={cn(
                                            "px-2 py-1 rounded-lg text-[10px] font-bold border bg-transparent focus:outline-none cursor-pointer",
                                            ESTADO_PROSPECTO_COLORS[p.estado]
                                        )}
                                    >
                                        {(Object.keys(ESTADO_PROSPECTO_LABELS) as EstadoProspecto[]).map((e) => (
                                            <option key={e} value={e} className="bg-card text-foreground">{ESTADO_PROSPECTO_LABELS[e]}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-3 py-2 font-extrabold text-primary tabular-nums">{p.score}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// Vista: Embudo
// ═══════════════════════════════════════════════════════════

function VistaEmbudo({ prospectos, onAbrir }: { prospectos: Prospecto[]; onAbrir: (p: Prospecto) => void }) {
    return (
        <div className="flex gap-3 overflow-x-auto pb-3">
            {COLUMNAS_EMBUDO.map((estado) => {
                const items = prospectos.filter((p) => p.estado === estado);
                return (
                    <div key={estado} className="shrink-0 w-[250px] rounded-2xl border border-border bg-card/50 p-3">
                        <div className="flex items-center justify-between mb-3">
                            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", ESTADO_PROSPECTO_COLORS[estado])}>
                                {ESTADO_PROSPECTO_LABELS[estado]}
                            </span>
                            <span className="text-[11px] font-bold text-muted-foreground tabular-nums">{items.length}</span>
                        </div>
                        <div className="space-y-2 max-h-[62vh] overflow-y-auto custom-scrollbar">
                            {items.slice(0, 60).map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => onAbrir(p)}
                                    className="w-full text-left p-2.5 rounded-lg border border-border bg-background/50 hover:border-primary/40 transition-colors"
                                >
                                    <p className="text-xs font-bold text-foreground truncate">{p.negocio}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{p.especialidad || p.rubro || "Sin rubro"}</p>
                                    {p.dato_usado && (
                                        <p className="text-[10px] text-muted-foreground/70 italic truncate mt-1">{p.dato_usado}</p>
                                    )}
                                </button>
                            ))}
                            {items.length === 0 && <p className="text-[11px] text-muted-foreground/60 text-center py-4">Vacío</p>}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// Vista: Métricas — qué mirar a las 3 semanas
// ═══════════════════════════════════════════════════════════

function VistaMetricas({ prospectos }: { prospectos: Prospecto[] }) {
    const enviados = prospectos.filter(fueEnviado).length;
    const porNivel = tasaPorNivelDato(prospectos);
    const porRubro = tasaPorRubro(prospectos);
    const porLector = tasaPorQuienLeyo(prospectos);
    const diagnostico = diagnosticoEmbudo(prospectos);

    if (enviados === 0) {
        return <Vacio titulo="Todavía no hay mensajes enviados" detalle="Con ~90 mensajes mandados ya hay señal real." />;
    }

    return (
        <div className="space-y-5">
            {enviados < 90 && (
                <p className="text-xs text-muted-foreground bg-secondary/40 border border-border rounded-xl p-3">
                    Llevás <span className="font-bold text-foreground">{enviados}</span> mensajes enviados. Con ~90 ya hay señal
                    real: hasta ahí, leé estos números como tendencia, no como conclusión.
                </p>
            )}

            <div className="grid lg:grid-cols-3 gap-4">
                <TablaMetrica
                    titulo="1. Tasa por nivel de dato"
                    nota="Si los de nivel 1-2 no responden mucho mejor que los de 3-4, el problema no es el dato: es la consecuencia o el pedido."
                    cortes={porNivel}
                />
                <TablaMetrica
                    titulo="2. Tasa por rubro"
                    nota="Recién con volumen suficiente se concentra el esfuerzo en el rubro ganador."
                    cortes={porRubro}
                />
                <TablaMetrica
                    titulo="3. ¿Quién leyó?"
                    nota="Si casi todas las respuestas son de secretarias y ninguna llega al decisor, hay que apuntar el dolor a la secretaria."
                    cortes={porLector.map((c) => ({
                        ...c,
                        clave: QUIEN_LEYO_LABELS[c.clave as keyof typeof QUIEN_LEYO_LABELS] || c.clave,
                    }))}
                />
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-bold text-foreground mb-1">Dónde se corta el embudo</h3>
                <p className="text-xs text-muted-foreground mb-4">
                    Los síntomas marcados en ámbar son los que hoy dan positivo con tus números.
                </p>
                <div className="space-y-2">
                    {diagnostico.map((d, i) => (
                        <div
                            key={i}
                            className={cn(
                                "grid sm:grid-cols-3 gap-2 p-3 rounded-xl border text-xs",
                                d.activo ? "border-amber-500/40 bg-amber-500/[0.07]" : "border-border bg-background/30 opacity-60"
                            )}
                        >
                            <div className="flex items-start gap-2">
                                {d.activo
                                    ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                    : <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                                <span className={cn("font-bold", d.activo ? "text-amber-200" : "text-muted-foreground")}>{d.sintoma}</span>
                            </div>
                            <span className="text-muted-foreground">{d.causa}</span>
                            <span className={cn("font-semibold", d.activo ? "text-foreground" : "text-muted-foreground")}>{d.accion}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function TablaMetrica({ titulo, nota, cortes }: { titulo: string; nota: string; cortes: CorteMetrica[] }) {
    const max = Math.max(...cortes.map((c) => c.tasa), 0.01);
    return (
        <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="text-sm font-bold text-foreground">{titulo}</h3>
            <p className="text-[11px] text-muted-foreground mt-1 mb-3 leading-snug">{nota}</p>
            <div className="space-y-2">
                {cortes.length === 0 && <p className="text-xs text-muted-foreground">Sin datos todavía.</p>}
                {cortes.map((c) => (
                    <div key={c.clave} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground truncate max-w-[60%]" title={c.clave}>{c.clave}</span>
                            <span className="font-bold text-foreground tabular-nums">
                                {Math.round(c.tasa * 100)}% <span className="text-muted-foreground font-normal">({c.respondieron}/{c.enviados})</span>
                            </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(c.tasa / max) * 100}%` }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Primitivas ───

const selectCls =
    "px-3 py-2 bg-card border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer";

function BotonHeader({
    onClick, icon: Icon, label, primario, cargando,
}: { onClick: () => void; icon: typeof Plus; label: string; primario?: boolean; cargando?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={cargando}
            className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all disabled:opacity-50",
                primario
                    ? "bg-primary text-primary-foreground border-primary shadow-lg hover:bg-primary/90"
                    : "bg-secondary/70 border-border text-foreground hover:bg-secondary"
            )}
        >
            {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
            {label}
        </button>
    );
}

function Kpi({
    label, valor, detalle, tono = "neutro",
}: { label: string; valor: string | number; detalle?: string; tono?: "neutro" | "ok" | "medio" | "alerta" }) {
    const colores = {
        neutro: "text-foreground",
        ok: "text-emerald-400",
        medio: "text-amber-400",
        alerta: "text-rose-400",
    };
    return (
        <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className={cn("text-2xl font-extrabold mt-1 tabular-nums", colores[tono])}>{valor}</p>
            {detalle && <p className="text-[11px] text-muted-foreground mt-0.5">{detalle}</p>}
        </div>
    );
}

function Vacio({ titulo, detalle }: { titulo: string; detalle: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 py-16 px-6 text-center">
            <p className="text-sm font-bold text-foreground">{titulo}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">{detalle}</p>
        </div>
    );
}
