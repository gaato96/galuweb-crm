"use client";

import { useEffect, useMemo, useState } from "react";
import {
    X, Save, Trash2, Building2, Radar, MessageSquare, CalendarClock,
    Copy, Check, ExternalLink, AlertTriangle, Sparkles, UserPlus, Loader2, Instagram, Phone, MapPin,
    ScanSearch, CircleCheck, Hand, ChevronLeft, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
    Prospecto, EstadoProspecto, ClasificacionWeb, FallaVerificable, QuienLeyo, CanalProspecto, DemandaBusqueda
} from "@/lib/types";
import {
    ESTADO_PROSPECTO_LABELS, ESTADO_PROSPECTO_COLORS, CLASIFICACION_WEB_LABELS,
    FALLA_LABELS, QUIEN_LEYO_LABELS, SISTEMA_LABELS,
} from "@/lib/types";
import {
    calcularNivelDato, calcularScore, normalizarEscaneo, sugerirDatoUsado,
    generarMensaje, alertasDescarte, proximaAccion, hoyISO, telefonoAWhatsapp,
    NIVEL_DATO_LABELS, NIVEL_DATO_COLORS, PASO_MENSAJE_LABELS,
    type PasoMensaje,
} from "@/lib/prospeccion";
import {
    generarMensajeVivoMenu, PASO_VIVOMENU_LABELS, PASOS_SIN_FUENTE_TEXTUAL,
    type PasoMensajeVivoMenu,
} from "@/lib/vivomenu-mensajes";
import {
    detectarRubro, senialesPara, senialPrincipal, PATRON_LABELS, RUBRO_LABELS,
} from "@/lib/dolores-rubro";
import { pistaDemanda, chequeosDemanda } from "@/lib/demanda-busqueda";
import { atajosEscaneo } from "@/lib/escaneo-atajos";
import { FUENTE_LABELS, type EscaneoAutomatico } from "@/lib/escaneo-auto";

type Tab = "datos" | "escaneo" | "mensajes" | "seguimiento";
type PasoUI = PasoMensaje | PasoMensajeVivoMenu;

/** VivoMenu reusa el campo quien_leyo con otra etiqueta: "secretaria" = "empleado que atiende". */
const QUIEN_LEYO_LABELS_VIVOMENU: Record<QuienLeyo, string> = {
    dueno: "Dueño / decisor",
    secretaria: "Empleado (toma pedidos)",
    no_se: "No sé",
};

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
    /**
     * Posición en la lista que se está recorriendo, para pasar al siguiente sin cerrar.
     * Los destinos vienen resueltos como prospectos y no como un delta: al guardar,
     * el de al lado puede salir de la cola (cambia de estado) y los índices se corren,
     * así que un "+1" evaluado después de guardar saltaría a otro lado.
     */
    navegacion?: {
        indice: number;
        total: number;
        anterior: Prospecto | null;
        siguiente: Prospecto | null;
        onIr: (destino: Prospecto) => void;
    };
}

export default function ProspectoModal({
    prospecto, universo, onGuardar, onEliminar, onConvertirCliente, onCerrar, navegacion,
}: Props) {
    const [tab, setTab] = useState<Tab>("datos");
    const [draft, setDraft] = useState<Prospecto>({
        ...prospecto,
        escaneo: normalizarEscaneo(prospecto.escaneo),
        // Autocorrige cargas viejas: una cantidad de reseñas negativa nunca fue un dato
        // real, era un signo que se coló al pegar o al escribir. Al guardar queda arreglado.
        reviews_count: prospecto.reviews_count == null ? null : Math.abs(prospecto.reviews_count),
    });
    const [guardando, setGuardando] = useState(false);
    const esVivoMenu = draft.sistema === "vivomenu";
    const [pasoMensaje, setPasoMensaje] = useState<PasoUI>(esVivoMenu ? "primer_contacto" : "m1");
    const [mensajeEditado, setMensajeEditado] = useState("");
    const [copiado, setCopiado] = useState(false);
    const [copiadoWa, setCopiadoWa] = useState(false);
    const [generandoIA, setGenerandoIA] = useState(false);
    const [escaneando, setEscaneando] = useState(false);
    const [resultadoAuto, setResultadoAuto] = useState<EscaneoAutomatico | null>(null);

    const set = <K extends keyof Prospecto>(campo: K, valor: Prospecto[K]) =>
        setDraft((d) => ({ ...d, [campo]: valor }));

    const nivel = calcularNivelDato(draft.escaneo);
    const desglose = useMemo(() => calcularScore(draft, universo), [draft, universo]);
    const alertas = useMemo(() => alertasDescarte(draft), [draft]);

    // El catálogo de señales depende del rubro: el dolor lo define la economía del
    // negocio, no si tiene web.
    const rubroProsp = useMemo(() => detectarRubro(draft), [draft.rubro, draft.especialidad]);
    const senialesDelRubro = useMemo(() => senialesPara(rubroProsp), [rubroProsp]);
    // Se separan porque unas se miran y otras hay que salir a buscarlas escribiendo.
    const senialesFrias = useMemo(() => senialesDelRubro.filter((s) => !s.requiereContacto), [senialesDelRubro]);
    const senialesConContacto = useMemo(() => senialesDelRubro.filter((s) => s.requiereContacto), [senialesDelRubro]);
    const atajos = useMemo(() => atajosEscaneo(draft), [draft.negocio, draft.ciudad, draft.rubro, draft.especialidad, draft.sistema, draft.maps_url, draft.instagram_url]);
    const senialTitular = useMemo(() => senialPrincipal(draft.escaneo.fallas), [draft.escaneo.fallas]);

    // Los tres chequeos de demanda, ya armados con el término y la provincia del prospecto.
    const pista = useMemo(() => pistaDemanda(draft), [draft.rubro, draft.especialidad, draft.ciudad]);
    const chequeos = useMemo(() => chequeosDemanda(draft), [draft.rubro, draft.especialidad, draft.ciudad]);

    /** Un solo punto de generación: despacha al motor de Galu o al de VivoMenu según el sistema. */
    const generar = (paso: PasoUI, p: Prospecto): string =>
        p.sistema === "vivomenu"
            ? generarMensajeVivoMenu(paso as PasoMensajeVivoMenu, p)
            : generarMensaje(paso as PasoMensaje, p);

    const labelDePaso = (paso: PasoUI): string =>
        esVivoMenu ? PASO_VIVOMENU_LABELS[paso as PasoMensajeVivoMenu] : PASO_MENSAJE_LABELS[paso as PasoMensaje];

    /**
     * Al pasar a otro prospecto se recarga TODO el borrador, no solo el mensaje.
     *
     * El estado del borrador se inicializa una sola vez, al montar. Mientras el
     * modal se abría y cerraba por cada prospecto eso alcanzaba; con las flechas
     * de navegación el componente ya no se desmonta, así que sin esto la ficha
     * seguiría mostrando —y guardando— los datos del prospecto anterior sobre el
     * nuevo. El escaneo previo también se limpia: su evidencia era del otro.
     */
    useEffect(() => {
        const nuevo: Prospecto = {
            ...prospecto,
            escaneo: normalizarEscaneo(prospecto.escaneo),
            reviews_count: prospecto.reviews_count == null ? null : Math.abs(prospecto.reviews_count),
        };
        setDraft(nuevo);
        setResultadoAuto(null);
        const inicial: PasoUI = nuevo.sistema === "vivomenu" ? "primer_contacto" : "m1";
        setPasoMensaje(inicial);
        setMensajeEditado(generar(inicial, nuevo));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prospecto.id]);

    const guardar = async (extra: Partial<Prospecto> = {}) => {
        if (!draft.negocio.trim()) {
            toast.error("El nombre del negocio es obligatorio");
            return;
        }
        setGuardando(true);
        try {
            const escaneo = normalizarEscaneo(draft.escaneo);
            const completo: Prospecto = {
                ...draft,
                ...extra,
                escaneo,
                dato_usado: draft.dato_usado.trim() || sugerirDatoUsado(escaneo),
            };
            // Solo lo que cambió. Antes iba la fila entera (39 columnas) en cada
            // guardado, aunque se hubiera tocado una casilla: más para serializar,
            // más para mandar y más para escribir del otro lado. El score y el nivel
            // los recalcula el store con el prospecto ya fusionado, así que no hace
            // falta mandar todo para que salgan bien.
            await onGuardar(soloCambios(prospecto, completo));
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

    /**
     * Copia el número, no el link de wa.me.
     *
     * wa.me abre WhatsApp Web en una pestaña nueva, que pide confirmar, tarda en
     * cargar y no admite dos sesiones abiertas a la vez — o sea que cada mensaje
     * cuesta abrir, esperar, enviar y cerrar. Con el número en el portapapeles se
     * pega en el WhatsApp que ya está abierto y listo.
     */
    const copiarWhatsapp = () => {
        const wa = draft.telefono_wa || telefonoAWhatsapp(draft.telefono);
        if (!wa) {
            toast.error("No hay un número en formato WhatsApp para copiar");
            return;
        }
        navigator.clipboard.writeText(`+${wa}`);
        setCopiadoWa(true);
        toast.success(`+${wa} copiado`);
        setTimeout(() => setCopiadoWa(false), 2000);
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

        // Qué paso mueve qué estado — depende del sistema porque los pasos tienen nombres distintos.
        const primerContacto = esVivoMenu ? "primer_contacto" : "m1";
        const entregaOferta = esVivoMenu ? "interes_tibio" : "m2";
        const avance: Partial<Prospecto> =
            pasoMensaje === primerContacto
                ? { estado: "enviado", fecha_envio: hoyISO(), mensaje_enviado: mensajeEditado }
                : pasoMensaje === "fu1"
                  ? { estado: "fu1", fecha_fu1: hoyISO() }
                  : pasoMensaje === "fu2"
                    ? { estado: "fu2", fecha_fu2: hoyISO() }
                    : pasoMensaje === "fu3"
                      ? { estado: "fu3", fecha_fu3: hoyISO() }
                      : pasoMensaje === entregaOferta
                        ? { estado: "revision_enviada" }
                        : {};

        if (Object.keys(avance).length > 0) {
            setDraft((d) => ({ ...d, ...avance }));
            await guardar(avance);
        }
    };

    /**
     * Escaneo automático — trae de una lo que hoy son seis pestañas abiertas a mano:
     * la ficha de Google con el texto de las reseñas, la búsqueda por rubro (con el
     * control por nombre), un GET al sitio y la lectura de las reseñas.
     *
     * NO guarda: deja todo cargado en el borrador con su evidencia al lado, para
     * revisar y recién ahí guardar. Lo que ya estaba cargado a mano no se pisa.
     */
    const escanearAuto = async () => {
        setEscaneando(true);
        try {
            const res = await fetch("/api/prospeccion/escanear", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prospectos: [draft] }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "No se pudo escanear");

            const r: EscaneoAutomatico | undefined = json.resultados?.[0];
            if (!r) throw new Error("El escaneo no devolvió nada");

            setDraft((d) => ({ ...d, ...r.campos, escaneo: r.escaneo }));
            setResultadoAuto(r);

            if (r.agregadas.length > 0) {
                toast.success(
                    `${r.agregadas.length} ${r.agregadas.length === 1 ? "señal encontrada" : "señales encontradas"} — revisá y guardá`
                );
            } else {
                toast.info("Sin señales nuevas. Queda el escaneo de Instagram a mano.");
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "No se pudo escanear");
        } finally {
            setEscaneando(false);
        }
    };

    const generarConIA = async () => {
        setGenerandoIA(true);
        try {
            const res = await fetch("/api/gemini/mensaje-prospecto", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prospecto: draft, paso: pasoMensaje, sistema: draft.sistema }),
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6">
            {/* Alto acotado y una sola zona que scrollea: la cabecera (con los links a
                Maps e Instagram) y el pie (Guardar / Siguiente) quedan siempre a la
                vista. Antes había que bajar hasta el fondo y volver a subir para pasar
                al que seguía, veinte veces por bloque. */}
            <div className="bg-card border border-border rounded-2xl w-full max-w-4xl shadow-2xl max-h-[94vh] flex flex-col">
                {/* ── Cabecera ── */}
                <div className="flex items-start justify-between gap-4 p-5 border-b border-border shrink-0">
                    <div className="min-w-0 flex-1">
                        <input
                            value={draft.negocio}
                            onChange={(e) => set("negocio", e.target.value)}
                            placeholder="Nombre del negocio"
                            className="w-full bg-transparent text-xl font-extrabold text-foreground focus:outline-none placeholder:text-muted-foreground/40"
                        />
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                {SISTEMA_LABELS[draft.sistema]}
                            </span>
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
                        {(draft.maps_url || draft.instagram_url || draft.telefono) && (
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {(draft.telefono_wa || telefonoAWhatsapp(draft.telefono)) && (
                                    <button
                                        type="button"
                                        onClick={copiarWhatsapp}
                                        title="Copia el número para pegarlo en el WhatsApp que ya tenés abierto"
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25"
                                    >
                                        {copiadoWa ? <Check className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                                        {copiadoWa ? "Copiado" : `+${draft.telefono_wa || telefonoAWhatsapp(draft.telefono)}`}
                                    </button>
                                )}
                                {draft.maps_url && (
                                    <a
                                        href={conProtocolo(draft.maps_url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-secondary/60 border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                                    >
                                        <MapPin className="w-3.5 h-3.5" /> Maps
                                    </a>
                                )}
                                {draft.instagram_url && (
                                    <a
                                        href={conProtocolo(draft.instagram_url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-secondary/60 border border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                                    >
                                        <Instagram className="w-3.5 h-3.5" /> Instagram
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                    <button onClick={onCerrar} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Tabs ── */}
                <div className="flex gap-1 px-5 pt-3 border-b border-border overflow-x-auto shrink-0">
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

                <div className="p-5 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
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
                                        onChange={(e) =>
                                            set("reviews_count", e.target.value ? Math.abs(Number(e.target.value)) : null)
                                        }
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
                            {/* Escaneo automático — lo que no necesita ojo humano */}
                            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                            <ScanSearch className="w-4 h-4 text-primary" />
                                            Escaneo automático
                                        </h3>
                                        <p className="text-[11px] text-muted-foreground mt-0.5 max-w-prose">
                                            Mira la ficha de Google con el texto de las reseñas, busca
                                            &ldquo;{pista.consulta || "rubro en ciudad"}&rdquo; y abre el sitio web. Deja todo
                                            cargado acá abajo con la evidencia al lado; no guarda nada hasta que le des Guardar.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={escanearAuto}
                                        disabled={escaneando || !draft.negocio.trim()}
                                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                                    >
                                        {escaneando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
                                        {escaneando ? "Escaneando..." : "Escanear"}
                                    </button>
                                </div>

                                {resultadoAuto && (
                                    <div className="space-y-2.5 pt-1">
                                        {resultadoAuto.evidencias.length > 0 && (
                                            <div className="space-y-1.5">
                                                <p className="text-[11px] font-bold text-emerald-300 uppercase tracking-wide">
                                                    Lo que encontró
                                                </p>
                                                {resultadoAuto.evidencias.map((ev, i) => (
                                                    <div key={i} className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-2.5">
                                                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                            <CircleCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                            {FALLA_LABELS[ev.falla]}
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground mt-1">{ev.detalle}</p>
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary text-muted-foreground">
                                                                {FUENTE_LABELS[ev.fuente]}
                                                            </span>
                                                            {ev.url && (
                                                                <a
                                                                    href={ev.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                                                                >
                                                                    <ExternalLink className="w-3 h-3" />
                                                                    Verificar
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {resultadoAuto.escaneo.queja_textual && !prospecto.escaneo.queja_textual && (
                                            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5">
                                                <p className="text-[11px] font-bold text-emerald-300">
                                                    Queja de un cliente (nivel 1) — textual de una reseña
                                                </p>
                                                <p className="text-xs text-foreground mt-1 italic">
                                                    &ldquo;{resultadoAuto.escaneo.queja_textual}&rdquo;
                                                </p>
                                                <p className="text-[10px] text-muted-foreground mt-1">
                                                    Verificada carácter por carácter contra el texto de la reseña. Igual leela antes de mandarla.
                                                </p>
                                            </div>
                                        )}

                                        {resultadoAuto.pendientes.length > 0 && (
                                            <div className="space-y-1.5">
                                                <p className="text-[11px] font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                                                    <Hand className="w-3.5 h-3.5" />
                                                    Lo que queda a mano
                                                </p>
                                                {resultadoAuto.pendientes.map((t, i) => (
                                                    <p key={i} className="text-[11px] text-amber-200/70 leading-relaxed">
                                                        · {t}
                                                    </p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

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
                                <Campo label="Demanda de búsqueda" hint="Si es baja, no uses la señal de no aparecer: sería falsa">
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

                            {/* Atajos: los lugares donde se mira, ya armados */}
                            {atajos.length > 0 && (
                                <div className="rounded-xl border border-border bg-background/40 p-4 space-y-2.5">
                                    <div>
                                        <h3 className="text-sm font-bold text-foreground">Dónde mirar</h3>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            Abren en pestaña nueva con el nombre y la ciudad ya puestos.
                                        </p>
                                    </div>
                                    <div className="grid sm:grid-cols-2 gap-1.5">
                                        {atajos.map((a) => (
                                            <a
                                                key={a.id}
                                                href={a.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block rounded-lg border border-border p-2.5 hover:border-primary/40 transition-colors group"
                                            >
                                                <span className="flex items-center gap-1.5 text-xs font-bold text-foreground group-hover:text-primary">
                                                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                                    {a.label}
                                                </span>
                                                <span className="block text-[11px] text-muted-foreground mt-1">{a.busca}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Cómo verificar la demanda de búsqueda */}
                            <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-bold text-foreground">¿La gente busca este servicio?</h3>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">{pista.porque}</p>
                                    </div>
                                    {pista.sugerencia !== "sin_definir" && draft.demanda_busqueda !== pista.sugerencia && (
                                        <button
                                            type="button"
                                            onClick={() => set("demanda_busqueda", pista.sugerencia)}
                                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 whitespace-nowrap"
                                        >
                                            Marcar como {pista.sugerencia}
                                        </button>
                                    )}
                                </div>

                                {pista.consulta && (
                                    <p className="text-[11px] text-muted-foreground">
                                        Consulta a probar: <span className="font-mono text-foreground">&ldquo;{pista.consulta}&rdquo;</span>
                                    </p>
                                )}

                                <div className="space-y-1.5">
                                    {chequeos.map((c) => (
                                        <a
                                            key={c.id}
                                            href={c.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block rounded-lg border border-border p-2.5 hover:border-primary/40 transition-colors group"
                                        >
                                            <span className="flex items-center gap-1.5 text-xs font-bold text-foreground group-hover:text-primary">
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                {c.label}
                                            </span>
                                            <span className="block text-[11px] text-muted-foreground mt-1">{c.detalle}</span>
                                        </a>
                                    ))}
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
                                <div className={cn("rounded-lg border p-3 space-y-3", nivel === 2 ? "border-cyan-500/40 bg-cyan-500/5" : "border-border")}>
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <p className="text-xs font-bold text-foreground">N2 — Señales verificables en 10 segundos</p>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary text-muted-foreground border border-border">
                                            {RUBRO_LABELS[rubroProsp]}
                                        </span>
                                    </div>

                                    {senialesFrias.length > 0 && (
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                            Sin escribirles
                                        </p>
                                    )}
                                    <div className="space-y-1.5">
                                        {senialesFrias.map((s) => {
                                            const marcada = draft.escaneo.fallas.includes(s.id);
                                            const esTitular = marcada && senialTitular?.id === s.id;
                                            return (
                                                <div
                                                    key={s.id}
                                                    className={cn(
                                                        "rounded-lg border p-2.5 transition-colors",
                                                        esTitular
                                                            ? "border-cyan-500/50 bg-cyan-500/10"
                                                            : marcada
                                                              ? "border-border bg-secondary/40"
                                                              : "border-transparent hover:border-border"
                                                    )}
                                                >
                                                    <Checkbox
                                                        checked={marcada}
                                                        onChange={() => toggleFalla(s.id)}
                                                        label={s.label}
                                                    />
                                                    <div className="pl-6 mt-1 space-y-1">
                                                        <p className="text-[11px] text-muted-foreground">{s.donde}</p>
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-secondary text-muted-foreground border border-border">
                                                                {PATRON_LABELS[s.patron]}
                                                            </span>
                                                            {esTitular && (
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                                                    Va de titular en el mensaje
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {senialesConContacto.length > 0 && (
                                        <div className="pt-2 space-y-1.5">
                                            <div className="flex items-baseline gap-2 flex-wrap">
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-300">
                                                    Solo con la prueba de pedido
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    escribiles como cliente cualquiera
                                                </p>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                Mandales &ldquo;hola, tenés carta?&rdquo; desde un número que no uses para prospectar,
                                                un viernes entre 21 y 22. En dos minutos ves cuánto tardan, cómo te mandan la carta
                                                y cuántas idas y vueltas hace falta para cerrar un pedido. Si no hacés la prueba,
                                                el mensaje del día 3 no dice que la hiciste.
                                            </p>
                                            {senialesConContacto.map((s) => {
                                                const marcada = draft.escaneo.fallas.includes(s.id);
                                                const esTitular = marcada && senialTitular?.id === s.id;
                                                return (
                                                    <div
                                                        key={s.id}
                                                        className={cn(
                                                            "rounded-lg border p-2.5 transition-colors",
                                                            esTitular
                                                                ? "border-cyan-500/50 bg-cyan-500/10"
                                                                : marcada
                                                                  ? "border-border bg-secondary/40"
                                                                  : "border-amber-500/20 hover:border-amber-500/40"
                                                        )}
                                                    >
                                                        <Checkbox
                                                            checked={marcada}
                                                            onChange={() => toggleFalla(s.id)}
                                                            label={s.label}
                                                        />
                                                        <div className="pl-6 mt-1 space-y-1">
                                                            <p className="text-[11px] text-muted-foreground">{s.donde}</p>
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-secondary text-muted-foreground border border-border">
                                                                    {PATRON_LABELS[s.patron]}
                                                                </span>
                                                                {esTitular && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                                                        Va de titular en el mensaje
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <p className="text-[11px] text-muted-foreground">
                                        Marcá solo lo que <strong>viste</strong>. El dolor de fondo{" "}
                                        {rubroProsp === "gastronomia"
                                            ? "(cuánto se lleva la comisión, la plata que se pierde en pedidos mal tomados)"
                                            : "(turnos que no se presentan, tratamientos a medio hacer)"}{" "}
                                        no se afirma nunca: entra como lectura del rubro en la línea 2, armada a partir de
                                        la señal que va de titular.
                                    </p>
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
                                {(esVivoMenu
                                    ? (Object.keys(PASO_VIVOMENU_LABELS) as PasoMensajeVivoMenu[])
                                    : (Object.keys(PASO_MENSAJE_LABELS) as PasoMensaje[])
                                ).map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => { setPasoMensaje(p); setMensajeEditado(generar(p, draft)); }}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all",
                                            pasoMensaje === p
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-card border-border text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {labelDePaso(p)}
                                    </button>
                                ))}
                            </div>

                            {!esVivoMenu && pasoMensaje === "m1" && (
                                <div className="text-[11px] text-muted-foreground bg-secondary/40 border border-border rounded-lg p-3 space-y-1.5">
                                    <p>
                                        {nivel && nivel <= 2
                                            ? "Nivel 1-2: va la versión completa (dato · consecuencia · permiso). Nunca el caso de éxito, el precio, un link ni un pedido de reunión."
                                            : "Nivel 3-4 o sin dato: va la versión corta, sin diagnóstico de la consecuencia. Un mensaje largo apoyado en un dato flojo se lee como plantilla."}
                                    </p>
                                    {nivel === 2 && senialTitular && (
                                        <p>
                                            Línea 1: <strong className="text-foreground">{senialTitular.label}</strong>. Línea 2:
                                            la lectura de {RUBRO_LABELS[rubroProsp].toLowerCase()} para{" "}
                                            <strong className="text-foreground">{PATRON_LABELS[senialTitular.patron].toLowerCase()}</strong>.
                                            Si marcás otra señal más fuerte, cambian las dos.
                                        </p>
                                    )}
                                </div>
                            )}

                            {esVivoMenu && pasoMensaje === "primer_contacto" && (
                                <p className="text-[11px] text-muted-foreground bg-secondary/40 border border-border rounded-lg p-3">
                                    Lo lee un empleado tomando pedidos, no el dueño. La primera línea tiene que sacarlo del &quot;modo pedido&quot;
                                    antes que nada. El link va directo, sin pedir permiso — el permiso se pide recién en la pregunta final.
                                </p>
                            )}

                            {esVivoMenu && pasoMensaje === "fu1" && (
                                <p className="text-[11px] text-muted-foreground bg-secondary/40 border border-border rounded-lg p-3">
                                    El chequeo de 3 puntos sale del Escaneo (fallas + queja de reseña). Si faltan hallazgos reales,
                                    el mensaje te lo marca en vez de inventar observaciones — completá el Escaneo primero.
                                </p>
                            )}

                            {esVivoMenu && PASOS_SIN_FUENTE_TEXTUAL.includes(pasoMensaje as PasoMensajeVivoMenu) && (
                                <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg p-3">
                                    Este texto no viene citado del documento de VivoMenu — lo escribí en el mismo tono como punto de partida.
                                    Reemplazalo por el texto real de tu mensajes-en-frio.md cuando lo tengas a mano.
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
                                            ? `Toca ${labelDePaso(accion.paso)} — pasaron ${accion.dias} días`
                                            : `${labelDePaso(accion.paso)} pronto (${accion.dias} días desde el último toque)`}
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
                                            <option key={q} value={q}>
                                                {(esVivoMenu ? QUIEN_LEYO_LABELS_VIVOMENU : QUIEN_LEYO_LABELS)[q]}
                                            </option>
                                        ))}
                                    </select>
                                </Campo>
                                <Campo label="Fecha de envío (primer contacto)">
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
                                {esVivoMenu && (
                                    <Campo label="Fecha FU3 (día 14)">
                                        <input type="date" value={draft.fecha_fu3 ?? ""} onChange={(e) => set("fecha_fu3", e.target.value || null)} className={inputCls} />
                                    </Campo>
                                )}
                            </div>

                            <Campo
                                label={esVivoMenu ? "Link del menú armado" : "Link del análisis"}
                                hint={esVivoMenu ? "El demo/menú que se manda en el primer contacto y se personaliza en 'interés tibio'" : "galuweb.com/revision/[negocio] — noindex, sin gate"}
                            >
                                <div className="flex gap-2">
                                    <input
                                        value={draft.revision_url}
                                        onChange={(e) => set("revision_url", e.target.value)}
                                        className={inputCls}
                                        placeholder={esVivoMenu ? "https://vivomenu.com.ar/m/..." : "https://galuweb.com/revision/..."}
                                    />
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
                <div className="flex items-center justify-between gap-3 p-5 border-t border-border shrink-0 flex-wrap">
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
                    <div className="flex items-center gap-2 flex-wrap">
                        {navegacion && (
                            <div className="flex items-center gap-1 mr-1">
                                <button
                                    onClick={() => navegacion.anterior && navegacion.onIr(navegacion.anterior)}
                                    disabled={!navegacion.anterior}
                                    title="Anterior"
                                    className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-30"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="text-[11px] font-bold text-muted-foreground tabular-nums px-1">
                                    {navegacion.indice + 1}/{navegacion.total}
                                </span>
                                <button
                                    onClick={() => navegacion.siguiente && navegacion.onIr(navegacion.siguiente)}
                                    disabled={!navegacion.siguiente}
                                    title="Siguiente"
                                    className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-30"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        <button onClick={onCerrar} className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground">
                            Cerrar
                        </button>
                        <button
                            onClick={() => guardar()}
                            disabled={guardando}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/40 bg-primary/10 text-primary text-xs font-bold disabled:opacity-50"
                        >
                            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Guardar
                        </button>
                        {navegacion?.siguiente && (
                            <button
                                onClick={async () => {
                                    const destino = navegacion.siguiente;
                                    await guardar();
                                    if (destino) navegacion.onIr(destino);
                                }}
                                disabled={guardando}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-lg disabled:opacity-50"
                            >
                                Guardar y seguir
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Los campos en los que `nuevo` difiere de `anterior`. Los objetos (escaneo) se
 * comparan por contenido, no por referencia: el borrador siempre tiene una copia
 * nueva y por identidad darían distinto aunque nadie los haya tocado.
 *
 * Siempre se devuelve al menos un campo — si no cambió nada, se manda el estado,
 * porque un update vacío es un error en PostgREST y "guardar sin cambios" tiene
 * que seguir siendo una acción válida.
 */
function soloCambios(anterior: Prospecto, nuevo: Prospecto): Partial<Prospecto> {
    const cambios: Partial<Prospecto> = {};
    for (const clave of Object.keys(nuevo) as (keyof Prospecto)[]) {
        if (clave === "id" || clave === "created_at" || clave === "updated_at") continue;
        const a = anterior[clave];
        const b = nuevo[clave];
        const iguales =
            typeof b === "object" && b !== null ? JSON.stringify(a) === JSON.stringify(b) : a === b;
        if (!iguales) (cambios[clave] as unknown) = b;
    }
    if (Object.keys(cambios).length === 0) cambios.estado = nuevo.estado;
    return cambios;
}

// ─── Primitivas locales ───────────────────────────────────────

const inputCls =
    "w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/40";

const conProtocolo = (url: string) => (url.startsWith("http") ? url : `https://${url}`);

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
