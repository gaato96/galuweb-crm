"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ClipboardList, Plus, Upload, Download, RefreshCw, Search, Target,
    Table2, Columns3, BarChart3, Loader2, ExternalLink, Instagram, Phone,
    AlertTriangle, CheckCircle2, Clock, Stethoscope, UtensilsCrossed, Globe,
    ScanSearch, Copy, Trash2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Prospecto, EstadoProspecto, ClasificacionWeb, ScraperBusqueda, Sistema } from "@/lib/types";
import {
    ESTADO_PROSPECTO_LABELS, ESTADO_PROSPECTO_COLORS, CLASIFICACION_WEB_LABELS,
    QUIEN_LEYO_LABELS, SISTEMA_LABELS,
} from "@/lib/types";
import { prospectosStore, scraperStore, mensajeError, type ResultadoImportacion } from "@/lib/store";
import {
    calcularNivelDato, normalizarEscaneo, normalizar, proximaAccion, hoyISO,
    prospectoVacio, fueEnviado, respondio, tasaPorNivelDato, tasaPorRubro,
    tasaPorQuienLeyo, diagnosticoEmbudo, diasDesde,
    NIVEL_DATO_COLORS, PASO_MENSAJE_LABELS, motivoFueraDeCola, compararParaCola,
    detectarDuplicados, reseñasSanas, type CorteMetrica,
} from "@/lib/prospeccion";
import { calcularRampaVivoMenu, avisoDiaVivoMenu } from "@/lib/vivomenu-mensajes";
import { resumenEscaneo, type EscaneoAutomatico } from "@/lib/escaneo-auto";
import ProspectoModal from "./prospecto-modal";
import ImportarPanel from "./importar-panel";

type Vista = "cola" | "planilla" | "embudo" | "metricas";

const VISTAS: { id: Vista; label: string; icon: typeof Target }[] = [
    { id: "cola", label: "Cola del día", icon: Target },
    { id: "planilla", label: "Planilla", icon: Table2 },
    { id: "embudo", label: "Embudo", icon: Columns3 },
    { id: "metricas", label: "Métricas", icon: BarChart3 },
];

const SISTEMA_ICONS: Record<Sistema, typeof Globe> = { galu: Globe, vivomenu: UtensilsCrossed };

const COLUMNAS_EMBUDO: EstadoProspecto[] = [
    "sin_calificar", "calificado", "enviado", "fu1", "fu2", "fu3", "respondio", "revision_enviada", "reunion", "cliente",
];

/**
 * Las once columnas no entran en una pantalla normal, y leer una fila obligaba a
 * deslizar de costado. Se ordenan por lo que hace falta para decidir a quién
 * escribir: el negocio, el dato y el estado siempre; el resto va apareciendo a
 * medida que hay ancho. Ninguna se pierde — en pantalla chica están en las
 * tarjetas, y el detalle completo está en la ficha.
 */
const COLUMNAS_PLANILLA: { label: string; oculta: string }[] = [
    { label: "Envío", oculta: "hidden 2xl:table-cell" },
    { label: "Negocio", oculta: "" },
    { label: "Rubro", oculta: "hidden xl:table-cell" },
    { label: "Ciudad", oculta: "hidden 2xl:table-cell" },
    { label: "Canal", oculta: "hidden lg:table-cell" },
    { label: "Clasif. web", oculta: "hidden xl:table-cell" },
    { label: "Dato usado", oculta: "" },
    { label: "Nivel", oculta: "" },
    { label: "Leyó", oculta: "hidden 2xl:table-cell" },
    { label: "Estado", oculta: "" },
    { label: "Score", oculta: "" },
];

/** Objetivo diario de Galu: 10 mensajes por bloque de trabajo (doc 08). */
const OBJETIVO_DIARIO_GALU = 10;

export default function ProspeccionPage() {
    const [prospectos, setProspectos] = useState<Prospecto[]>([]);
    const [busquedas, setBusquedas] = useState<ScraperBusqueda[]>([]);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState<string | null>(null);

    const [sistemaActivo, setSistemaActivo] = useState<Sistema>("galu");
    const [vista, setVista] = useState<Vista>("cola");
    const [busqueda, setBusqueda] = useState("");
    const [filtroRubro, setFiltroRubro] = useState("");
    const [filtroEstado, setFiltroEstado] = useState<EstadoProspecto | "">("");
    const [filtroSegmento, setFiltroSegmento] = useState<ClasificacionWeb | "">("");
    const [filtroNivel, setFiltroNivel] = useState<string>("");

    const [seleccionado, setSeleccionado] = useState<Prospecto | null>(null);
    const [mostrarImportar, setMostrarImportar] = useState(false);
    const [recalculando, setRecalculando] = useState(false);
    const [escaneoLote, setEscaneoLote] = useState<{ hechos: number; total: number } | null>(null);
    const [mostrarDuplicados, setMostrarDuplicados] = useState(false);

    // ─── Carga ───
    const cargar = useCallback(async () => {
        setCargando(true);
        setErrorCarga(null);
        try {
            const data = await prospectosStore.getAll();
            setProspectos(data);
        } catch (e) {
            const msg = mensajeError(e);
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

    // Cada sistema tiene su propia cola de trabajo, ritmo y métricas — pero
    // conviven en la misma tabla para reusar scraping, escalera de datos y score.
    const prospectosDelSistema = useMemo(
        () => prospectos.filter((p) => p.sistema === sistemaActivo),
        [prospectos, sistemaActivo]
    );

    const rampaVivoMenu = useMemo(
        () => (sistemaActivo === "vivomenu" ? calcularRampaVivoMenu(prospectosDelSistema) : null),
        [sistemaActivo, prospectosDelSistema]
    );
    const objetivoDiario = rampaVivoMenu?.porDia ?? OBJETIVO_DIARIO_GALU;
    const avisoDia = sistemaActivo === "vivomenu" ? avisoDiaVivoMenu() : null;

    const rubros = useMemo(
        () => Array.from(new Set(prospectosDelSistema.map((p) => p.rubro).filter(Boolean))).sort(),
        [prospectosDelSistema]
    );

    const filtrados = useMemo(() => {
        const q = normalizar(busqueda);
        return prospectosDelSistema.filter((p) => {
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
    }, [prospectosDelSistema, busqueda, filtroRubro, filtroEstado, filtroSegmento, filtroNivel]);

    /**
     * Orden de trabajo de §8: primero el segmento, después el score.
     * Los ya contactados y los descartados salen de la cola.
     */
    const { cola, fueraDeCola } = useMemo(() => {
        const pendientes = filtrados.filter(
            (p) => p.estado === "sin_calificar" || p.estado === "calificado"
        );
        // Los que no dan el volumen mínimo salen de la cola, pero se cuentan aparte:
        // un filtro que no se ve es un filtro en el que no se puede confiar.
        const descartables = pendientes.filter((p) => motivoFueraDeCola(p) !== null);
        const trabajables = pendientes
            .filter((p) => motivoFueraDeCola(p) === null)
            .sort(compararParaCola(sistemaActivo));
        return { cola: trabajables, fueraDeCola: descartables };
    }, [filtrados, sistemaActivo]);

    /** Follow-ups que tocan hoy, según la cadencia del sistema activo. */
    const followUpsPendientes = useMemo(
        () =>
            prospectosDelSistema
                .map((p) => ({ p, accion: proximaAccion(p) }))
                .filter((x) => x.accion?.vencido)
                .sort((a, b) => (b.accion?.dias ?? 0) - (a.accion?.dias ?? 0)),
        [prospectosDelSistema]
    );

    /**
     * El recorrido de las flechas se CONGELA al abrir una ficha y no se recalcula
     * mientras el modal está abierto.
     *
     * Si se derivara en vivo de la cola, registrar el envío echaría al prospecto de
     * la lista en el mismo gesto (pasa a "enviado" y la cola solo tiene sin calificar
     * y calificados): la ficha quedaría fuera de su propio recorrido y las flechas y
     * el "Guardar y seguir" desaparecerían justo cuando hacen falta, que es para
     * pasar al siguiente. Trabajar el bloque del día implica ir cambiando de estado,
     * así que la lista tiene que sobrevivir a esos cambios.
     */
    const [recorridoIds, setRecorridoIds] = useState<string[]>([]);

    const abrirProspecto = useCallback((p: Prospecto, lista: Prospecto[]) => {
        const ids = lista.map((x) => x.id);
        // Los de "fuera de la cola" se abren desde la misma vista pero no están en
        // la cola: sin esto quedarían fuera de su propio recorrido. Se abren solos.
        setRecorridoIds(ids.includes(p.id) ? ids : [p.id]);
        setSeleccionado(p);
    }, []);

    /** Los ids del recorrido resueltos contra el estado actual (y sin los borrados). */
    const listaNavegable = useMemo(() => {
        if (recorridoIds.length === 0) return [];
        const porId = new Map(prospectos.map((p) => [p.id, p]));
        return recorridoIds.map((id) => porId.get(id)).filter((p): p is Prospecto => !!p);
    }, [recorridoIds, prospectos]);

    const indiceSeleccionado = useMemo(
        () => (seleccionado ? listaNavegable.findIndex((p) => p.id === seleccionado.id) : -1),
        [seleccionado, listaNavegable]
    );

    const enviadosHoy = prospectosDelSistema.filter((p) => p.fecha_envio === hoyISO()).length;
    const enviadosSemana = prospectosDelSistema.filter((p) => p.fecha_envio && diasDesde(p.fecha_envio) < 7).length;
    const totalEnviados = prospectosDelSistema.filter(fueEnviado).length;
    const totalRespondio = prospectosDelSistema.filter(respondio).length;
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
                { ...prospectoVacio(sistemaActivo), negocio: "Nuevo prospecto" },
                prospectos
            );
            setProspectos((prev) => [creado, ...prev]);
            setSeleccionado(creado);
        } catch (e) {
            toast.error(mensajeError(e));
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
            toast.error(mensajeError(e));
        }
    };

    /** Un solo lugar para reportar el resultado, con el detalle de lo que no entró. */
    const reportarImportacion = (r: ResultadoImportacion, sufijo: string) => {
        const partes = [`${r.insertados.length} prospectos ${sufijo}`];
        if (r.duplicados > 0) partes.push(`${r.duplicados} ya estaban o venían sin nombre`);
        if (r.fallidos.length > 0) partes.push(`${r.fallidos.length} con error`);

        if (r.fallidos.length > 0) {
            console.warn("[prospeccion] Registros rechazados:", r.fallidos);
            toast.warning(partes.join(" · "), {
                description: `Primero: ${r.fallidos[0].negocio} — ${r.fallidos[0].motivo}`,
                duration: 10000,
            });
        } else if (r.insertados.length === 0) {
            toast.info(partes.join(" · "));
        } else {
            toast.success(partes.join(" · "));
        }
    };

    const importarFilas = async (items: Partial<Prospecto>[]) => {
        try {
            const r = await prospectosStore.createBulk(items, prospectos);
            await cargar();
            setMostrarImportar(false);
            reportarImportacion(r, "importados");
        } catch (e) {
            console.error("[prospeccion] Error al importar filas:", e);
            toast.error(mensajeError(e), { duration: 12000 });
        }
    };

    const importarScraper = async (b: ScraperBusqueda, sistema: Sistema) => {
        const lista = Array.isArray(b.prospectos) ? b.prospectos : [];
        if (lista.length === 0) {
            toast.error("Esa búsqueda del Scraper no tiene prospectos guardados. Volvé a correrla desde el Scraper.");
            return;
        }
        try {
            const r = await prospectosStore.importarDesdeScraper(lista, prospectos, sistema);
            await cargar();
            setMostrarImportar(false);
            reportarImportacion(r, "traídos del Scraper");
        } catch (e) {
            console.error("[prospeccion] Error al importar del Scraper:", e);
            toast.error(mensajeError(e), { duration: 12000 });
        }
    };

    const diagnosticar = async () => {
        const t = toast.loading("Probando lectura y escritura sobre la tabla...");
        const r = await prospectosStore.diagnosticar();
        toast.dismiss(t);
        if (r.ok) toast.success(r.detalle);
        else toast.error(r.detalle, { duration: 20000 });
        console.log("[prospeccion] Diagnóstico:", r);
    };

    /**
     * Escaneo del bloque del día. La ruta procesa de a pocos a propósito, así que
     * acá se manda en tandas: se ve el progreso, y lo que ya se escaneó queda
     * guardado aunque una tanda falle o se corte la conexión a la mitad.
     *
     * A diferencia del escaneo de a uno (que deja todo en el borrador para
     * revisar), este SÍ guarda: el sentido es llegar a la cola con los veinte ya
     * escaneados. Como el escaneo nunca pisa lo cargado a mano, guardar es seguro.
     */
    const TANDA = 5;
    const escanearBloque = async (delBloque: Prospecto[]) => {
        if (delBloque.length === 0) return;
        setEscaneoLote({ hechos: 0, total: delBloque.length });

        const conSenial: string[] = [];
        let sinSenial = 0;
        let fallidos = 0;

        try {
            for (let i = 0; i < delBloque.length; i += TANDA) {
                const tanda = delBloque.slice(i, i + TANDA);
                try {
                    const res = await fetch("/api/prospeccion/escanear", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ prospectos: tanda }),
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error || "Error al escanear");

                    for (const r of (json.resultados || []) as EscaneoAutomatico[]) {
                        if (r.agregadas.length === 0) { sinSenial++; continue; }
                        try {
                            await guardar(r.prospecto_id, { ...r.campos, escaneo: r.escaneo });
                            conSenial.push(resumenEscaneo(r));
                        } catch {
                            fallidos++;
                        }
                    }
                } catch (e) {
                    fallidos += tanda.length;
                    console.error("[escaneo lote]", e);
                }
                setEscaneoLote({ hechos: Math.min(i + TANDA, delBloque.length), total: delBloque.length });
            }

            if (conSenial.length > 0) {
                toast.success(
                    `${conSenial.length} de ${delBloque.length} con señales nuevas. Abrí cada uno para revisar antes de mandar.`,
                    { duration: 8000 }
                );
                console.info("[escaneo lote]\n" + conSenial.join("\n"));
            } else if (fallidos === 0) {
                toast.info(`Sin señales automáticas en los ${sinSenial}. Quedan para escaneo de Instagram a mano.`);
            }
            if (fallidos > 0) toast.error(`${fallidos} no se pudieron escanear. Probá de nuevo con esos.`);
        } finally {
            setEscaneoLote(null);
        }
    };

    const recalcular = async () => {
        setRecalculando(true);
        try {
            const actualizados = await prospectosStore.recalcularScores(prospectos);
            setProspectos([...actualizados].sort((a, b) => b.score - a.score));
            toast.success("Scores recalculados sobre la distribución actual de cada rubro");
        } catch (e) {
            toast.error(mensajeError(e));
        } finally {
            setRecalculando(false);
        }
    };

    const eliminarDuplicados = async (ids: string[]) => {
        try {
            await prospectosStore.deleteMany(ids);
            setProspectos((prev) => prev.filter((p) => !ids.includes(p.id)));
            toast.success(`${ids.length} ${ids.length === 1 ? "duplicado eliminado" : "duplicados eliminados"}`);
            setMostrarDuplicados(false);
        } catch (e) {
            toast.error(mensajeError(e));
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
                    <BotonHeader onClick={diagnosticar} icon={Stethoscope} label="Diagnóstico" />
                    <BotonHeader onClick={() => setMostrarDuplicados(true)} icon={Copy} label="Duplicados" />
                </div>
            </div>

            {/* Sistema de prospección — Galu y VivoMenu comparten planilla, no guion de mensajes */}
            <div className="flex gap-1.5">
                {(Object.keys(SISTEMA_LABELS) as Sistema[]).map((s) => {
                    const Icon = SISTEMA_ICONS[s];
                    const cant = prospectos.filter((p) => p.sistema === s).length;
                    return (
                        <button
                            key={s}
                            onClick={() => setSistemaActivo(s)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all",
                                sistemaActivo === s
                                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                            )}
                        >
                            <Icon className="w-4 h-4" />
                            {SISTEMA_LABELS[s]}
                            <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] tabular-nums", sistemaActivo === s ? "bg-black/20" : "bg-secondary")}>
                                {cant}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Aviso operativo de VivoMenu: rampa de volumen + días sin envío (§7) */}
            {sistemaActivo === "vivomenu" && rampaVivoMenu && (
                <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.06] p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <UtensilsCrossed className="w-4 h-4 text-cyan-300 shrink-0" />
                    <p className="text-xs sm:text-sm text-cyan-100 flex-1">
                        <span className="font-bold">Semana {rampaVivoMenu.semana}</span> del sistema VivoMenu — objetivo{" "}
                        <span className="font-bold">{rampaVivoMenu.porDia}/día · {rampaVivoMenu.porSemana}/semana</span>
                        {rampaVivoMenu.esTecho && " (techo)"}. Calentando el número para no activar el bloqueo de WhatsApp.
                    </p>
                    {avisoDia && (
                        <p className="text-xs text-amber-300 font-semibold sm:max-w-xs">{avisoDia}</p>
                    )}
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <Kpi label="En la planilla" valor={prospectosDelSistema.length} detalle={`${cola.length} sin contactar`} />
                <Kpi
                    label="Enviados hoy"
                    valor={enviadosHoy}
                    detalle={`objetivo ${objetivoDiario}`}
                    tono={enviadosHoy >= objetivoDiario ? "ok" : enviadosHoy > 0 ? "medio" : "neutro"}
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
                    {vista === "cola" && (
                        <VistaCola
                            cola={cola}
                            fueraDeCola={fueraDeCola}
                            onAbrir={(p) => abrirProspecto(p, cola)}
                            objetivoDiario={objetivoDiario}
                            esVivoMenu={sistemaActivo === "vivomenu"}
                            onEscanearBloque={escanearBloque}
                            escaneoLote={escaneoLote}
                            totalDelSistema={prospectosDelSistema.length}
                            yaTrabajados={
                                prospectosDelSistema.filter(
                                    (p) => p.estado !== "sin_calificar" && p.estado !== "calificado"
                                ).length
                            }
                        />
                    )}
                    {vista === "planilla" && <VistaPlanilla prospectos={filtrados} onAbrir={(p) => abrirProspecto(p, filtrados)} onCambiarEstado={(id, estado) => guardar(id, { estado })} />}
                    {vista === "embudo" && <VistaEmbudo prospectos={filtrados} onAbrir={(p) => abrirProspecto(p, filtrados)} />}
                    {vista === "metricas" && <VistaMetricas prospectos={prospectosDelSistema} />}
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
                    navegacion={
                        indiceSeleccionado >= 0
                            ? {
                                  indice: indiceSeleccionado,
                                  total: listaNavegable.length,
                                  anterior: listaNavegable[indiceSeleccionado - 1] ?? null,
                                  siguiente: listaNavegable[indiceSeleccionado + 1] ?? null,
                                  onIr: (destino) => setSeleccionado(destino),
                              }
                            : undefined
                    }
                />
            )}
            {mostrarDuplicados && (
                <ModalDuplicados
                    prospectos={prospectos}
                    onEliminar={eliminarDuplicados}
                    onCerrar={() => setMostrarDuplicados(false)}
                />
            )}
            {mostrarImportar && (
                <ImportarPanel
                    busquedasScraper={busquedas}
                    sistemaInicial={sistemaActivo}
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

function VistaCola({
    cola, onAbrir, objetivoDiario, fueraDeCola, esVivoMenu, onEscanearBloque, escaneoLote,
    totalDelSistema, yaTrabajados,
}: {
    cola: Prospecto[];
    onAbrir: (p: Prospecto) => void;
    objetivoDiario: number;
    fueraDeCola: Prospecto[];
    esVivoMenu: boolean;
    onEscanearBloque: (delBloque: Prospecto[]) => Promise<void>;
    escaneoLote: { hechos: number; total: number } | null;
    /** Cuántos hay cargados en este sistema, más allá de si entran a la cola. */
    totalDelSistema: number;
    /** Los que ya salieron de la cola por estar contactados o descartados. */
    yaTrabajados: number;
}) {
    const [verFuera, setVerFuera] = useState(false);

    if (cola.length === 0 && fueraDeCola.length === 0) {
        // Una cola vacía tiene tres causas muy distintas y el mensaje genérico
        // ("importá una planilla") solo acierta en una. Decir cuál es evita salir
        // a buscar el problema al lugar equivocado — que fue exactamente lo que
        // pasó con VivoMenu: había prospectos, pero no en este sistema.
        const sistema = esVivoMenu ? "VivoMenu" : "Galu";
        if (totalDelSistema === 0) {
            return (
                <Vacio
                    titulo={`No hay ningún prospecto cargado en ${sistema}`}
                    detalle={`La planilla tiene prospectos, pero ninguno de ${sistema}. Al importar del Scraper o de Sheets hay que elegir el sistema arriba de todo: si quedó en el otro, los prospectos existen pero no se ven acá.`}
                />
            );
        }
        if (yaTrabajados > 0) {
            return (
                <Vacio
                    titulo="La cola está al día"
                    detalle={`Los ${yaTrabajados} prospectos de ${sistema} ya están contactados o descartados. Traé una búsqueda nueva del Scraper para seguir, o mirá los follow-ups que tocan hoy.`}
                />
            );
        }
        return (
            <Vacio
                titulo="No hay nadie en la cola"
                detalle="Importá la planilla de Google Sheets o traé una búsqueda del Scraper para empezar."
            />
        );
    }

    const bloque = cola.slice(0, objetivoDiario);
    const resto = cola.slice(objetivoDiario);

    return (
        <div className="space-y-5">
            <div>
                <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        El bloque de hoy — los {Math.min(objetivoDiario, bloque.length)} de arriba
                    </p>
                    <button
                        type="button"
                        onClick={() => onEscanearBloque(bloque)}
                        disabled={!!escaneoLote || bloque.length === 0}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-[11px] font-bold hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                    >
                        {escaneoLote
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <ScanSearch className="w-3.5 h-3.5" />}
                        {escaneoLote
                            ? `Escaneando ${escaneoLote.hechos}/${escaneoLote.total}...`
                            : `Escanear los ${bloque.length}`}
                    </button>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                    {esVivoMenu
                        ? "Ordenado por score. Acá casi todos están en Instagram-como-web, así que separar por segmento no distingue nada."
                        : "Ordenado por segmento y después por score: primero Instagram-como-web, después sin web, y al final los que ya tienen una."}
                    {" "}El escaneo trae de una la ficha de Google, las reseñas y la búsqueda por rubro; lo que encuentra queda guardado y el Instagram sigue siendo a mano.
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
                        {resto.slice(0, 40).map((p, i) => <FilaCola key={p.id} p={p} indice={objetivoDiario + i + 1} onAbrir={onAbrir} />)}
                    </div>
                    {resto.length > 40 && (
                        <p className="text-xs text-muted-foreground text-center mt-3">
                            {resto.length - 40} más. Calificar toda la lista antes de mandar el primer mensaje es el error
                            que te deja tres semanas haciendo research sin hablar con nadie.
                        </p>
                    )}
                </div>
            )}

            {fueraDeCola.length > 0 && (
                <div className="rounded-xl border border-border bg-secondary/20 p-3.5">
                    <button
                        onClick={() => setVerFuera((v) => !v)}
                        className="w-full flex items-center justify-between gap-3 text-left"
                    >
                        <span className="min-w-0">
                            <span className="block text-xs font-bold text-foreground">
                                {fueraDeCola.length} fuera de la cola
                            </span>
                            <span className="block text-[11px] text-muted-foreground mt-0.5">
                                {/* El motivo real, contado. Decir siempre "volumen bajo" mandaba a
                                    buscar el problema al lado equivocado cuando en realidad no había
                                    teléfono ni Instagram cargado. */}
                                {(() => {
                                    const sinCanal = fueraDeCola.filter(
                                        (p) => motivoFueraDeCola(p) === "sin canal de contacto"
                                    ).length;
                                    const pocasResenas = fueraDeCola.length - sinCanal;
                                    return [
                                        pocasResenas > 0 ? `${pocasResenas} con menos de 5 reseñas` : "",
                                        sinCanal > 0 ? `${sinCanal} sin teléfono ni Instagram cargado` : "",
                                    ].filter(Boolean).join(" · ");
                                })()}
                                . Siguen en la planilla, pero no gastan uno de los {objetivoDiario} mensajes del día.
                            </span>
                        </span>
                        <span className="shrink-0 text-[11px] font-bold text-primary">
                            {verFuera ? "Ocultar" : "Ver"}
                        </span>
                    </button>

                    {verFuera && (
                        <div className="grid gap-1.5 mt-3">
                            {fueraDeCola.slice(0, 30).map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => onAbrir(p)}
                                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border bg-card/50 hover:border-primary/40 text-left"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-xs font-semibold text-foreground truncate">{p.negocio}</span>
                                        <span className="block text-[11px] text-muted-foreground truncate">
                                            {[p.especialidad || p.rubro, p.ciudad].filter(Boolean).join(" · ")}
                                        </span>
                                    </span>
                                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary text-muted-foreground border border-border">
                                        {motivoFueraDeCola(p)}
                                    </span>
                                </button>
                            ))}
                            {fueraDeCola.length > 30 && (
                                <p className="text-[11px] text-muted-foreground text-center mt-1">
                                    y {fueraDeCola.length - 30} más
                                </p>
                            )}
                        </div>
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
                    {reseñasSanas(p.reviews_count) != null && ` · ${reseñasSanas(p.reviews_count)} reseñas`}
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
        <>
            {/* Mobile: tarjetas. Once columnas en un celular obligan a deslizar
                de costado para leer una fila entera, así que abajo de md no va tabla. */}
            <div className="md:hidden space-y-2">
                {prospectos.map((p) => {
                    const nivel = calcularNivelDato(normalizarEscaneo(p.escaneo));
                    return (
                        <div key={p.id} className="rounded-xl border border-border bg-card p-3 space-y-2.5">
                            <div className="flex items-start justify-between gap-3">
                                <button
                                    onClick={() => onAbrir(p)}
                                    className="min-w-0 flex-1 text-left"
                                >
                                    <span className="block text-sm font-bold text-foreground truncate">{p.negocio}</span>
                                    <span className="block text-[11px] text-muted-foreground truncate mt-0.5">
                                        {[p.especialidad || p.rubro, p.ciudad].filter(Boolean).join(" · ") || "Sin rubro"}
                                    </span>
                                </button>
                                <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-primary/15 text-primary border border-primary/30 tabular-nums">
                                    {p.score}
                                </span>
                            </div>

                            {p.dato_usado ? (
                                <p className="text-[11px] text-muted-foreground italic line-clamp-2">&ldquo;{p.dato_usado}&rdquo;</p>
                            ) : (
                                <p className="text-[11px] text-rose-400/80">Falta el dato de personalización</p>
                            )}

                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary text-muted-foreground border border-border">
                                    {p.canal === "whatsapp" ? <Phone className="w-3 h-3" /> : <Instagram className="w-3 h-3" />}
                                    {CLASIFICACION_WEB_LABELS[p.clasificacion_web]}
                                </span>
                                {nivel && (
                                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", NIVEL_DATO_COLORS[nivel])}>
                                        N{nivel}
                                    </span>
                                )}
                                {p.fecha_envio && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-muted-foreground border border-border tabular-nums">
                                        {p.fecha_envio}
                                    </span>
                                )}
                            </div>

                            <select
                                value={p.estado}
                                onChange={(e) => onCambiarEstado(p.id, e.target.value as EstadoProspecto)}
                                className={cn(
                                    "w-full px-2.5 py-2 rounded-lg text-[11px] font-bold border bg-transparent focus:outline-none",
                                    ESTADO_PROSPECTO_COLORS[p.estado]
                                )}
                            >
                                {(Object.keys(ESTADO_PROSPECTO_LABELS) as EstadoProspecto[]).map((e) => (
                                    <option key={e} value={e} className="bg-card text-foreground">{ESTADO_PROSPECTO_LABELS[e]}</option>
                                ))}
                            </select>
                        </div>
                    );
                })}
            </div>

            {/* Desktop: la tabla completa, donde sí entran las once columnas. */}
            <div className="hidden md:block rounded-2xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-xs">
                <thead className="bg-secondary/50 sticky top-0">
                    <tr className="text-left">
                        {COLUMNAS_PLANILLA.map((c) => (
                            <th key={c.label} className={cn("px-3 py-2.5 font-bold text-muted-foreground whitespace-nowrap", c.oculta)}>
                                {c.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {prospectos.map((p) => {
                        const nivel = calcularNivelDato(normalizarEscaneo(p.escaneo));
                        return (
                            <tr key={p.id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap hidden 2xl:table-cell">{p.fecha_envio || "—"}</td>
                                <td className="px-3 py-2">
                                    <button onClick={() => onAbrir(p)} className="font-bold text-foreground hover:text-primary text-left max-w-[220px] truncate block">
                                        {p.negocio}
                                    </button>
                                </td>
                                <td className="px-3 py-2 text-muted-foreground max-w-[130px] truncate hidden xl:table-cell">{p.especialidad || p.rubro || "—"}</td>
                                <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate hidden 2xl:table-cell">{p.ciudad || "—"}</td>
                                <td className="px-3 py-2 hidden lg:table-cell">
                                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                                        {p.canal === "whatsapp" ? <Phone className="w-3 h-3" /> : <Instagram className="w-3 h-3" />}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap hidden xl:table-cell">{CLASIFICACION_WEB_LABELS[p.clasificacion_web]}</td>
                                <td className="px-3 py-2 text-muted-foreground max-w-[220px] truncate" title={p.dato_usado}>{p.dato_usado || "—"}</td>
                                <td className="px-3 py-2">
                                    {nivel ? (
                                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold border", NIVEL_DATO_COLORS[nivel])}>N{nivel}</span>
                                    ) : <span className="text-muted-foreground">—</span>}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap hidden 2xl:table-cell">
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
        </>
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

function ModalDuplicados({
    prospectos, onEliminar, onCerrar,
}: {
    prospectos: Prospecto[];
    onEliminar: (ids: string[]) => Promise<void>;
    onCerrar: () => void;
}) {
    const grupos = useMemo(() => detectarDuplicados(prospectos), [prospectos]);
    const [eliminando, setEliminando] = useState(false);
    const totalABorrar = grupos.reduce((s, g) => s + g.borrar.length, 0);

    const confirmar = async () => {
        setEliminando(true);
        await onEliminar(grupos.flatMap((g) => g.borrar.map((p) => p.id)));
        setEliminando(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
            <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl my-4">
                <div className="flex items-center justify-between p-5 border-b border-border">
                    <div>
                        <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2">
                            <Copy className="w-5 h-5 text-primary" />
                            Duplicados por nombre
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Mismo negocio y mismo sistema. Se conserva el que tiene más avance en el embudo —
                            nunca se borra uno ya contactado a favor de uno en blanco.
                        </p>
                    </div>
                    <button onClick={onCerrar} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-5 space-y-3">
                    {grupos.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No encontré duplicados por nombre.</p>
                    ) : (
                        grupos.map((g) => (
                            <div key={g.clave} className="rounded-xl border border-border p-3 space-y-2">
                                <p className="text-sm font-bold text-foreground">{g.conservar.negocio}</p>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                                        Conserva
                                    </span>
                                    <span className="text-muted-foreground">
                                        {ESTADO_PROSPECTO_LABELS[g.conservar.estado]} · score {g.conservar.score}
                                    </span>
                                </div>
                                {g.borrar.map((p) => (
                                    <div key={p.id} className="flex items-center gap-2 text-xs pl-1">
                                        <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-bold">
                                            Borra
                                        </span>
                                        <span className="text-muted-foreground">
                                            {ESTADO_PROSPECTO_LABELS[p.estado]} · score {p.score} · cargado {p.created_at?.slice(0, 10)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>

                {grupos.length > 0 && (
                    <div className="flex items-center justify-between gap-3 p-5 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                            {grupos.length} {grupos.length === 1 ? "negocio duplicado" : "negocios duplicados"} — {totalABorrar}{" "}
                            {totalABorrar === 1 ? "fila se va a borrar" : "filas se van a borrar"}
                        </p>
                        <button
                            onClick={confirmar}
                            disabled={eliminando}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 disabled:opacity-50"
                        >
                            {eliminando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Eliminar {totalABorrar}
                        </button>
                    </div>
                )}
            </div>
        </div>
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
