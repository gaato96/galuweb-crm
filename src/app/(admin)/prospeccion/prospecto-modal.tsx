"use client";

import { useEffect, useMemo, useState } from "react";
import {
    X, Save, Trash2, Building2, Radar, MessageSquare, CalendarClock,
    Copy, Check, ExternalLink, AlertTriangle, Sparkles, UserPlus, Loader2, Instagram, Phone
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
    Prospecto, EstadoProspecto, ClasificacionWeb, FallaVerificable, QuienLeyo, CanalProspecto, DemandaBusqueda
} from "@/lib/types";
import {
    ESTADO_PROSPECTO_LABELS, ESTADO_PROSPECTO_COLORS, CLASIFICACION_WEB_LABELS,
    FALLA_LABELS, QUIEN_LEYO_LABELS,
} from "@/lib/types";
import {
    calcularNivelDato, calcularScore, normalizarEscaneo, sugerirDatoUsado,
    generarMensaje, alertasDescarte, proximaAccion, hoyISO, telefonoAWhatsapp,
    NIVEL_DATO_LABELS, NIVEL_DATO_COLORS, PASO_MENSAJE_LABELS,
    type PasoMensaje,
} from "@/lib/prospeccion";

type Tab = "datos" | "escaneo" | "mensajes" | "seguimiento";

const TABS: { id: Tab; label: string; icon: typeof Building2 }[] = [
    { id: "datos", label: "Datos", icon: Building2 },
    { id: "escaneo", label: "Escaneo", icon: Radar },
    { id: "mensajes", label: "Mensajes", icon: MessageSquare },
    { id: "seguimiento", label: "Seguimiento", icon: CalendarClock },
];

interface Props {
    prospecto: Prospecto;
    universo: Prospecto[];
    onGuardar: (cambios: Partial<Prospecto>) => Promise<void>;
    onEliminar: () => Promise<void>;
    onConvertirCliente: () => Promise<void>;
    onCerrar: () => void;
}

export default function ProspectoModal({
    prospecto, universo, onGuardar, onEliminar, onConvertirCliente, onCerrar,
}: Props) {
    const [tab, setTab] = useState<Tab>("datos");
    const [draft, setDraft] = useState<Prospecto>({
        ...prospecto,
        escaneo: normalizarEscaneo(prospecto.escaneo),
    });
    const [guardando, setGuardando] = useState(false);
    const [pasoMensaje, setPasoMensaje] = useState<PasoMensaje>("m1");
    const [mensajeEditado, setMensajeEditado] = useState("");
    const [copiado, setCopiado] = useState(false);
    const [generandoIA, setGenerandoIA] = useState(false);

    const set = <K extends keyof Prospecto>(campo: K, valor: Prospecto[K]) =>
        setDraft((d) => ({ ...d, [campo]: valor }));

    const nivel = calcularNivelDato(draft.escaneo);
    const desglose = useMemo(() => calcularScore(draft, universo), [draft, universo]);
    const alertas = useMemo(() => alertasDescarte(draft), [draft]);

    // El mensaje se regenera al cambiar de paso o al cambiar el escaneo, salvo que el usuario lo haya editado.
    useEffect(() => {
        setMensajeEditado(generarMensaje(pasoMensaje, draft));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pasoMensaje, prospecto.id]);

    const guardar = async (extra: Partial<Prospecto> = {}) => {
        if (!draft.negocio.trim()) {
            toast.error("El nombre del negocio es obligatorio");
            return;
        }
        setGuardando(true);
        try {
            const escaneo = normalizarEscaneo(draft.escaneo);
            await onGuardar({
                ...draft,
                ...extra,
                escaneo,
                dato_usado: draft.dato_usado.trim() || sugerirDatoUsado(escaneo),
            });
            toast.success("Prospecto guardado");
        } catch (e) {
            console.error(e);
            toast.error(e instanceof Error ? e.message : "No se pudo guardar");
        } finally {
            setGuardando(false);
        }
    };

    const toggleFalla = (falla: FallaVerificable) => {
        const actuales = draft.escaneo.fallas;
        const nuevas = actuales.includes(falla)
            ? actuales.filter((f) => f !== falla)
            : [...actuales, falla];
        set("escaneo", { ...draft.escaneo, fallas: nuevas });
    };

    const copiarMensaje = () => {
        navigator.clipboard.writeText(mensajeEditado);
        setCopiado(true);
        toast.success("Mensaje copiado");
        setTimeout(() => setCopiado(false), 2000);
    };

    // Abre el canal y registra el envío en el mismo gesto: si no se marca, la planilla miente.
    const abrirCanalYRegistrar = async () => {
        const wa = draft.telefono_wa || telefonoAWhatsapp(draft.telefono);
        const url =
            draft.canal === "whatsapp" && wa
                ? `https://wa.me/${wa}?text=${encodeURIComponent(mensajeEditado)}`
                : draft.instagram_url || draft.maps_url;

        if (!url) {
            toast.error("No hay canal de contacto cargado (ni WhatsApp publicado ni Instagram)");
            return;
        }
        if (draft.canal === "instagram") {
            navigator.clipboard.writeText(mensajeEditado);
            toast.info("Mensaje copiado — pegalo en el DM");
        }
        window.open(url.startsWith("http") ? url : `https://${url}`, "_blank", "noopener,noreferrer");

        const avance: Partial<Prospecto> =
            pasoMensaje === "m1"
                ? { estado: "enviado", fecha_envio: hoyISO(), mensaje_enviado: mensajeEditado }
                : pasoMensaje === "fu1"
                  ? { estado: "fu1", fecha_fu1: hoyISO() }
                  : pasoMensaje === "fu2"
                    ? { estado: "fu2", fecha_fu2: hoyISO() }
                    : pasoMensaje === "m2"
                      ? { estado: "revision_enviada" }
                      : {};

        if (Object.keys(avance).length > 0) {
            setDraft((d) => ({ ...d, ...avance }));
            await guardar(avance);
        }
    };

    const generarConIA = async () => {
        setGenerandoIA(true);
        try {
            const res = await fetch("/api/gemini/mensaje-prospecto", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prospecto: draft, paso: pasoMensaje }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Error al generar el mensaje");
            setMensajeEditado(json.mensaje);
            toast.success("Mensaje reescrito con IA sobre la misma estructura");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "No se pudo generar");
        } finally {
            setGenerandoIA(false);
        }
    };

    const accion = proximaAccion(draft);

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
            <div className="bg-card border border-border rounded-2xl w-full max-w-4xl shadow-2xl my-4">
                {/* ── Cabecera ── */}
                <div className="flex items-start justify-between gap-4 p-5 border-b border-border">
                    <div className="min-w-0 flex-1">
                        <input
                            value={draft.negocio}
                            onChange={(e) => set("negocio", e.target.value)}
                            placeholder="Nombre del negocio"
                            className="w-full bg-transparent text-xl font-extrabold text-foreground focus:outline-none placeholder:text-muted-foreground/40"
                        />
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-bold border", ESTADO_PROSPECTO_COLORS[draft.estado])}>
                                {ESTADO_PROSPECTO_LABELS[draft.estado]}
                            </span>
                            {nivel && (
                                <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-bold border", NIVEL_DATO_COLORS[nivel])}>
                                    {NIVEL_DATO_LABELS[nivel]}
                                </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/15 text-primary border border-primary/30">
                                Score {desglose.total}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-secondary text-muted-foreground border border-border">
                                {CLASIFICACION_WEB_LABELS[draft.clasificacion_web]}
                            </span>
                        </div>
                    </div>
                    <button onClick={onCerrar} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Tabs ── */}
                <div className="flex gap-1 px-5 pt-3 border-b border-border overflow-x-auto">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg border-b-2 transition-all whitespace-nowrap",
                                tab === t.id
                                    ? "border-primary text-primary bg-primary/5"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <t.icon className="w-4 h-4" />
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="p-5 space-y-5">
                    {/* ══════════ DATOS ══════════ */}
                    {tab === "datos" && (
                        <div className="space-y-5">
                            <div className="grid sm:grid-cols-2 gap-4">
                                <Campo label="Rubro" hint="Para el análisis de tasa por rubro">
                                    <input value={draft.rubro} onChange={(e) => set("rubro", e.target.value)} className={inputCls} placeholder="Ej: Odontólogos" />
                                </Campo>
                                <Campo label="Especialidad" hint="Define si hay demanda de búsqueda">
                                    <input value={draft.especialidad} onChange={(e) => set("especialidad", e.target.value)} className={inputCls} placeholder="Ej: Ortodoncia" />
                                </Campo>
                                <Campo label="Ciudad">
                                    <input value={draft.ciudad} onChange={(e) => set("ciudad", e.target.value)} className={inputCls} placeholder="San Miguel de Tucumán" />
                                </Campo>
                                <Campo label="Dirección">
                                    <input value={draft.direccion} onChange={(e) => set("direccion", e.target.value)} className={inputCls} />
                                </Campo>
                                <Campo label="Contacto (si se conoce)">
                                    <input value={draft.contacto_nombre} onChange={(e) => set("contacto_nombre", e.target.value)} className={inputCls} placeholder="Dr. / Sra. ..." />
                                </Campo>
                                <Campo label="Cant. de profesionales" hint="1-3 = decide uno solo, ideal">
                                    <input
                                        type="number" min={1}
                                        value={draft.cant_profesionales ?? ""}
                                        onChange={(e) => set("cant_profesionales", e.target.value ? Number(e.target.value) : null)}
                                        className={inputCls}
                                    />
                                </Campo>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4">
                                <Campo label="Teléfono">
                                    <input
                                        value={draft.telefono}
                                        onChange={(e) => {
                                            set("telefono", e.target.value);
                                            set("telefono_wa", telefonoAWhatsapp(e.target.value));
                                        }}
                                        className={inputCls}
                                        placeholder="0381 15 4123456"
                                    />
                                    {draft.telefono && (
                                        <p className={cn("text-[11px] mt-1", draft.telefono_wa ? "text-emerald-400" : "text-amber-400")}>
                                            {draft.telefono_wa ? `wa.me/${draft.telefono_wa}` : "No se pudo normalizar a formato WhatsApp"}
                                        </p>
                                    )}
                                </Campo>
                                <Campo label="Instagram">
                                    <input value={draft.instagram_url} onChange={(e) => set("instagram_url", e.target.value)} className={inputCls} placeholder="https://instagram.com/..." />
                                </Campo>
                                <Campo label="Sitio web">
                                    <input value={draft.sitio_web_url} onChange={(e) => set("sitio_web_url", e.target.value)} className={inputCls} />
                                </Campo>
                                <Campo label="Link de Google Maps">
                                    <input value={draft.maps_url} onChange={(e) => set("maps_url", e.target.value)} className={inputCls} />
                                </Campo>
                                <Campo label="Rating">
                                    <input
                                        type="number" step="0.1" min={0} max={5}
                                        value={draft.rating ?? ""}
                                        onChange={(e) => set("rating", e.target.value ? Number(e.target.value) : null)}
                                        className={inputCls}
                                    />
                                </Campo>
                                <Campo label="Cantidad de reseñas" hint="El umbral es relativo al rubro, no absoluto">
                                    <input
                                        type="number" min={0}
                                        value={draft.reviews_count ?? ""}
                                        onChange={(e) => set("reviews_count", e.target.value ? Number(e.target.value) : null)}
                                        className={inputCls}
                                    />
                                </Campo>
                            </div>

                            <Campo label="Notas">
                                <textarea value={draft.notas} onChange={(e) => set("notas", e.target.value)} rows={3} className={cn(inputCls, "resize-y")} />
                            </Campo>
                        </div>
                    )}

                    {/* ══════════ ESCANEO ══════════ */}
                    {tab === "escaneo" && (
                        <div className="space-y-5">
                            {alertas.length > 0 && (
                                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
                                    <p className="text-xs font-bold text-amber-300 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        Señales de descarte rápido
                                    </p>
                                    {alertas.map((a, i) => (
                                        <p key={i} className="text-xs text-amber-200/80">
                                            <span className="font-semibold">{a.regla}:</span> {a.detalle}
                                        </p>
                                    ))}
                                </div>
                            )}

                            <div className="grid sm:grid-cols-3 gap-4">
                                <Campo label="Clasificación web" hint="Define el ángulo del mensaje">
                                    <select value={draft.clasificacion_web} onChange={(e) => set("clasificacion_web", e.target.value as ClasificacionWeb)} className={inputCls}>
                                        {(Object.keys(CLASIFICACION_WEB_LABELS) as ClasificacionWeb[]).map((c) => (
                                            <option key={c} value={c}>{CLASIFICACION_WEB_LABELS[c]}</option>
                                        ))}
                                    </select>
                                </Campo>
                                <Campo label="Demanda de búsqueda" hint="Si es baja, usar ángulo de credibilidad">
                                    <select value={draft.demanda_busqueda} onChange={(e) => set("demanda_busqueda", e.target.value as DemandaBusqueda)} className={inputCls}>
                                        <option value="sin_definir">Sin definir</option>
                                        <option value="alta">Alta — se busca en Google</option>
                                        <option value="baja">Baja — llega por red y referencia</option>
                                    </select>
                                </Campo>
                                <Campo label="Días desde el último post de IG" hint="60+ días = cuenta que nadie mira">
                                    <input
                                        type="number" min={0}
                                        value={draft.dias_ultimo_post ?? ""}
                                        onChange={(e) => set("dias_ultimo_post", e.target.value ? Number(e.target.value) : null)}
                                        className={inputCls}
                                    />
                                </Campo>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4">
                                <Campo label="Canal de contacto" hint="Lo define si el WhatsApp está publicado por el negocio">
                                    <select value={draft.canal} onChange={(e) => set("canal", e.target.value as CanalProspecto)} className={inputCls}>
                                        <option value="instagram">Instagram DM</option>
                                        <option value="whatsapp">WhatsApp</option>
                                    </select>
                                </Campo>
                                <div className="flex flex-col justify-end gap-2 pb-1">
                                    <Checkbox
                                        checked={draft.whatsapp_publicado}
                                        onChange={(v) => {
                                            set("whatsapp_publicado", v);
                                            if (v) set("canal", "whatsapp");
                                        }}
                                        label="El WhatsApp está publicado por el negocio"
                                    />
                                    <Checkbox
                                        checked={draft.es_whatsapp_business === true}
                                        onChange={(v) => set("es_whatsapp_business", v ? true : false)}
                                        label="Es WhatsApp Business (con horarios / catálogo)"
                                    />
                                </div>
                            </div>

                            {/* La escalera del dato */}
                            <div className="rounded-xl border border-border bg-background/40 p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-foreground">La escalera del dato</h3>
                                    <span className="text-[11px] text-muted-foreground">Se toma el nivel más alto que encuentres</span>
                                </div>

                                {/* Nivel 1 */}
                                <div className={cn("rounded-lg border p-3 space-y-2", nivel === 1 ? "border-emerald-500/40 bg-emerald-500/5" : "border-border")}>
                                    <Checkbox
                                        checked={draft.escaneo.tiene_queja_cliente}
                                        onChange={(v) => set("escaneo", { ...draft.escaneo, tiene_queja_cliente: v })}
                                        label="N1 — Hay una queja pública de un cliente sobre el problema que resolvés"
                                        strong
                                    />
                                    <textarea
                                        value={draft.escaneo.queja_textual}
                                        onChange={(e) => set("escaneo", { ...draft.escaneo, queja_textual: e.target.value })}
                                        rows={2}
                                        placeholder='Cita textual, con fecha si podés: "llamé tres veces y no me contestaron" (feb 2026)'
                                        className={cn(inputCls, "resize-y text-xs")}
                                    />
                                    <p className="text-[11px] text-muted-foreground">Filtrá las reseñas de Google por menor puntaje. Es el dato más fuerte y no requiere que tenga web.</p>
                                </div>

                                {/* Nivel 2 */}
                                <div className={cn("rounded-lg border p-3 space-y-2", nivel === 2 ? "border-cyan-500/40 bg-cyan-500/5" : "border-border")}>
                                    <p className="text-xs font-bold text-foreground">N2 — Fallas verificables en 10 segundos</p>
                                    <div className="grid sm:grid-cols-2 gap-1.5">
                                        {(Object.keys(FALLA_LABELS) as FallaVerificable[]).map((f) => (
                                            <Checkbox
                                                key={f}
                                                checked={draft.escaneo.fallas.includes(f)}
                                                onChange={() => toggleFalla(f)}
                                                label={FALLA_LABELS[f]}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">&quot;No tiene web&quot; acá es contexto, no dato — casi nadie tiene.</p>
                                </div>

                                {/* Niveles 3 y 4 */}
                                <div className="grid sm:grid-cols-2 gap-3">
                                    <div className={cn("rounded-lg border p-3 space-y-2", nivel === 3 ? "border-amber-500/40 bg-amber-500/5" : "border-border")}>
                                        <p className="text-xs font-bold text-foreground">N3 — Hito reciente</p>
                                        <input
                                            value={draft.escaneo.hito_reciente}
                                            onChange={(e) => set("escaneo", { ...draft.escaneo, hito_reciente: e.target.value })}
                                            placeholder="Abrieron la sucursal de Yerba Buena"
                                            className={cn(inputCls, "text-xs")}
                                        />
                                    </div>
                                    <div className={cn("rounded-lg border p-3 space-y-2", nivel === 4 ? "border-slate-500/40 bg-slate-500/5" : "border-border")}>
                                        <p className="text-xs font-bold text-foreground">N4 — Detalle de su trabajo</p>
                                        <input
                                            value={draft.escaneo.detalle_trabajo}
                                            onChange={(e) => set("escaneo", { ...draft.escaneo, detalle_trabajo: e.target.value })}
                                            placeholder="El caso de implantes que publicaron"
                                            className={cn(inputCls, "text-xs")}
                                        />
                                    </div>
                                </div>

                                <Campo label="Dato usado (el texto que va al mensaje)">
                                    <div className="flex gap-2">
                                        <input
                                            value={draft.dato_usado}
                                            onChange={(e) => set("dato_usado", e.target.value)}
                                            placeholder={sugerirDatoUsado(draft.escaneo) || "El dato textual, no 'vi su Instagram'"}
                                            className={inputCls}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => set("dato_usado", sugerirDatoUsado(draft.escaneo))}
                                            className="px-3 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground whitespace-nowrap"
                                        >
                                            Autocompletar
                                        </button>
                                    </div>
                                </Campo>

                                {!nivel && (
                                    <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-lg p-3">
                                        Sin dato de personalización. Si buscarlo te lleva más de 2 minutos, salteá el candidato: un mensaje
                                        genérico consume el prospecto para siempre y te enseña un dato falso sobre la tasa de respuesta del rubro.
                                    </p>
                                )}
                            </div>

                            {/* Desglose del score */}
                            <div className="rounded-xl border border-border bg-background/40 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-foreground">Cómo se compone el score</h3>
                                    <span className="text-lg font-extrabold text-primary">{desglose.total}</span>
                                </div>
                                <div className="space-y-1">
                                    {desglose.partes.map((p, i) => (
                                        <div key={i} className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">{p.concepto}</span>
                                            <span className={cn("font-bold tabular-nums", p.puntos > 0 ? "text-emerald-400" : p.puntos < 0 ? "text-rose-400" : "text-muted-foreground")}>
                                                {p.puntos > 0 ? "+" : ""}{p.puntos}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══════════ MENSAJES ══════════ */}
                    {tab === "mensajes" && (
                        <div className="space-y-4">
                            <div className="flex gap-1.5 flex-wrap">
                                {(Object.keys(PASO_MENSAJE_LABELS) as PasoMensaje[]).map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => { setPasoMensaje(p); setMensajeEditado(generarMensaje(p, draft)); }}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all",
                                            pasoMensaje === p
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-card border-border text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {PASO_MENSAJE_LABELS[p]}
                                    </button>
                                ))}
                            </div>

                            {pasoMensaje === "m1" && (
                                <p className="text-[11px] text-muted-foreground bg-secondary/40 border border-border rounded-lg p-3">
                                    {nivel && nivel <= 2
                                        ? "Nivel 1-2: va la versión completa (dato · consecuencia · permiso). Nunca el caso de éxito, el precio, un link ni un pedido de reunión."
                                        : "Nivel 3-4 o sin dato: va la versión corta, sin diagnóstico de la consecuencia. Un mensaje largo apoyado en un dato flojo se lee como plantilla."}
                                </p>
                            )}

                            <textarea
                                value={mensajeEditado}
                                onChange={(e) => setMensajeEditado(e.target.value)}
                                rows={11}
                                className={cn(inputCls, "resize-y leading-relaxed")}
                            />

                            <div className="flex items-center gap-2 flex-wrap">
                                <button onClick={copiarMensaje} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-secondary/60 hover:bg-secondary text-xs font-bold text-foreground">
                                    {copiado ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copiado ? "Copiado" : "Copiar"}
                                </button>
                                <button
                                    onClick={generarConIA}
                                    disabled={generandoIA}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary/20 text-xs font-bold text-primary disabled:opacity-50"
                                >
                                    {generandoIA ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                    Reescribir con IA
                                </button>
                                <button
                                    onClick={abrirCanalYRegistrar}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold shadow-lg ml-auto"
                                >
                                    {draft.canal === "whatsapp" ? <Phone className="w-3.5 h-3.5" /> : <Instagram className="w-3.5 h-3.5" />}
                                    Abrir {draft.canal === "whatsapp" ? "WhatsApp" : "Instagram"} y registrar envío
                                </button>
                            </div>

                            <p className="text-[11px] text-muted-foreground">
                                El botón de la derecha abre el canal y deja registrado el paso en la planilla. Si no se registra, las métricas de las 3 semanas no sirven.
                            </p>
                        </div>
                    )}

                    {/* ══════════ SEGUIMIENTO ══════════ */}
                    {tab === "seguimiento" && (
                        <div className="space-y-5">
                            {accion && (
                                <div className={cn(
                                    "rounded-xl border p-4",
                                    accion.vencido ? "border-amber-500/40 bg-amber-500/10" : "border-border bg-background/40"
                                )}>
                                    <p className={cn("text-xs font-bold", accion.vencido ? "text-amber-300" : "text-muted-foreground")}>
                                        {accion.vencido
                                            ? `Toca ${PASO_MENSAJE_LABELS[accion.paso]} — pasaron ${accion.dias} días`
                                            : `${PASO_MENSAJE_LABELS[accion.paso]} en ${(accion.paso === "fu1" ? 3 : 7) - accion.dias} días`}
                                    </p>
                                </div>
                            )}

                            <div className="grid sm:grid-cols-2 gap-4">
                                <Campo label="Estado">
                                    <select value={draft.estado} onChange={(e) => set("estado", e.target.value as EstadoProspecto)} className={inputCls}>
                                        {(Object.keys(ESTADO_PROSPECTO_LABELS) as EstadoProspecto[]).map((e) => (
                                            <option key={e} value={e}>{ESTADO_PROSPECTO_LABELS[e]}</option>
                                        ))}
                                    </select>
                                </Campo>
                                <Campo label="¿Quién leyó?" hint="Si nunca llega al decisor, hay que reescribir el mensaje">
                                    <select
                                        value={draft.quien_leyo ?? ""}
                                        onChange={(e) => set("quien_leyo", (e.target.value || null) as QuienLeyo | null)}
                                        className={inputCls}
                                    >
                                        <option value="">Sin definir</option>
                                        {(Object.keys(QUIEN_LEYO_LABELS) as QuienLeyo[]).map((q) => (
                                            <option key={q} value={q}>{QUIEN_LEYO_LABELS[q]}</option>
                                        ))}
                                    </select>
                                </Campo>
                                <Campo label="Fecha de envío (M1)">
                                    <input type="date" value={draft.fecha_envio ?? ""} onChange={(e) => set("fecha_envio", e.target.value || null)} className={inputCls} />
                                </Campo>
                                <Campo label="Fecha de respuesta">
                                    <input type="date" value={draft.fecha_respuesta ?? ""} onChange={(e) => set("fecha_respuesta", e.target.value || null)} className={inputCls} />
                                </Campo>
                                <Campo label="Fecha FU1">
                                    <input type="date" value={draft.fecha_fu1 ?? ""} onChange={(e) => set("fecha_fu1", e.target.value || null)} className={inputCls} />
                                </Campo>
                                <Campo label="Fecha FU2">
                                    <input type="date" value={draft.fecha_fu2 ?? ""} onChange={(e) => set("fecha_fu2", e.target.value || null)} className={inputCls} />
                                </Campo>
                            </div>

                            <Campo label="URL de la revisión" hint="galuweb.com/revision/[negocio] — noindex, sin gate">
                                <div className="flex gap-2">
                                    <input value={draft.revision_url} onChange={(e) => set("revision_url", e.target.value)} className={inputCls} placeholder="https://galuweb.com/revision/..." />
                                    {draft.revision_url && (
                                        <a href={draft.revision_url} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground">
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    )}
                                </div>
                            </Campo>

                            {draft.estado === "descartado" && (
                                <Campo label="Motivo del descarte">
                                    <input value={draft.motivo_descarte} onChange={(e) => set("motivo_descarte", e.target.value)} className={inputCls} />
                                </Campo>
                            )}

                            <div className="pt-2 border-t border-border">
                                <button
                                    onClick={onConvertirCliente}
                                    disabled={!!draft.cliente_id}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-bold disabled:opacity-40"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    {draft.cliente_id ? "Ya está en el pipeline de clientes" : "Pasar al pipeline de clientes"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Pie ── */}
                <div className="flex items-center justify-between gap-3 p-5 border-t border-border">
                    <button
                        onClick={async () => {
                            if (!window.confirm(`¿Eliminar "${draft.negocio}" de la planilla?`)) return;
                            await onEliminar();
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10"
                    >
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                    </button>
                    <div className="flex items-center gap-2">
                        <button onClick={onCerrar} className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground">
                            Cancelar
                        </button>
                        <button
                            onClick={() => guardar()}
                            disabled={guardando}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-lg disabled:opacity-50"
                        >
                            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Guardar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Primitivas locales ───────────────────────────────────────

const inputCls =
    "w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/40";

function Campo({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{label}</label>
            {children}
            {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
        </div>
    );
}

function Checkbox({
    checked, onChange, label, strong,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; strong?: boolean }) {
    return (
        <label className="flex items-start gap-2 cursor-pointer group">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-input bg-background accent-primary cursor-pointer shrink-0"
            />
            <span className={cn(
                "text-xs leading-snug transition-colors",
                checked ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
                strong && "font-bold"
            )}>
                {label}
            </span>
        </label>
    );
}
