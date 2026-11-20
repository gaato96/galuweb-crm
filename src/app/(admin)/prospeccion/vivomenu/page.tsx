"use client";

// ============================================================
// VivoMenu · Locales — la prospección de locales de comida, desde el celular
// ============================================================
//
// Lo mismo que hace Sarvo · Turnos, para VivoMenu (repo menu-digital,
// marketing/notas/02b-adquisicion.md):
//
//   · Hoy          — los del día, con el mensaje ya escrito. La ficha de Google
//                    se lee sola (teléfono, si hace delivery o para llevar, si
//                    cerró): no hay que escanear ni completar nada. Un toque
//                    abre WhatsApp con el mensaje y lo marca como enviado.
//   · Seguir       — el día 3 y el día 8. A los tres días del último se cierra.
//   · Contestaron  — los que respondieron, con el mensaje de cada paso.
//
// La cola sale de los listados de VivoMenu salvo "Fuera del público" y
// "Revisar rubro", y se ordena por lo que dice Google de cada local (hace
// delivery o para llevar primero, solo salón al final), no por la categoría.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft, UtensilsCrossed, MessageCircle, Instagram, Clock, Reply, Loader2, X, ExternalLink, UserPlus, Undo2, Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, hoyISO } from "@/lib/utils";
import { prospectosStore, listasStore, mensajeError } from "@/lib/store";
import type { Prospecto, ListaProspeccion } from "@/lib/types";
import { proximaAccion, diasDesde } from "@/lib/prospeccion";
import {
    generarMensajeVivoMenu, canalVivo, vivoDe, prioridadVivo, calcularRampaVivoMenu, avisoDiaVivoMenu,
    PASO_VIVOMENU_LABELS, type PasoMensajeVivoMenu, type CanalVivo,
} from "@/lib/vivomenu-mensajes";
import { linkWhatsapp, type AppWhatsapp } from "@/lib/odontologia-mensajes";
import { nombreCorto } from "@/lib/turnos";
import { Tarjeta, Boton, Vacio, Pestanias } from "@/components/prospeccion/celular";

type Pestania = "hoy" | "seguir" | "contestaron";

const SISTEMA = "vivomenu" as const;
const SIN_CONTACTAR = ["sin_calificar", "calificado"];
const EN_CURSO = ["enviado", "fu1", "fu2"];
const DIAS_PARA_CERRAR = 3;
/** Cuántos de más se escanean sobre la cuota, para tener de dónde elegir. */
const MARGEN_ESCANEO = 4;
const TANDA = 12;

const abrirUrl = (u: string) => (u.startsWith("http") ? u : `https://${u}`);
const yaContactado = (p: Prospecto) => !!(p.fecha_envio || (p.mensaje_enviado || "").trim());
const listaExcluida = (l?: ListaProspeccion) => !!l && /fuera|revisar/i.test(l.nombre);

export default function VivoMenuLocalesPage() {
    const [universo, setUniverso] = useState<Prospecto[]>([]);
    const [listas, setListas] = useState<ListaProspeccion[]>([]);
    const [cargando, setCargando] = useState(true);
    const [pestania, setPestania] = useState<Pestania>("hoy");
    const [esAndroid, setEsAndroid] = useState(false);
    const [app, setApp] = useState<AppWhatsapp>("business");
    const [escaneando, setEscaneando] = useState<{ hechos: number; total: number } | null>(null);
    const [verMas, setVerMas] = useState(false);
    const autoEscaneado = useRef(false);
    const cerradosAuto = useRef(false);

    useEffect(() => {
        setEsAndroid(/android/i.test(navigator.userAgent));
        try {
            const guardada = localStorage.getItem("vivomenu-app-whatsapp");
            if (guardada === "personal" || guardada === "business") setApp(guardada);
        } catch { /* sin storage: queda Business */ }
    }, []);

    const cambiarApp = () => {
        const nueva: AppWhatsapp = app === "business" ? "personal" : "business";
        setApp(nueva);
        try { localStorage.setItem("vivomenu-app-whatsapp", nueva); } catch { /* nada */ }
        toast.success(`Los mensajes se abren en WhatsApp ${nueva === "business" ? "Business" : "común"}`);
    };

    const cargar = useCallback(async () => {
        try {
            const [todos, ls] = await Promise.all([prospectosStore.getAll(), listasStore.getAll().catch(() => [])]);
            setUniverso(todos);
            setListas(ls);
        } catch (e) {
            toast.error(mensajeError(e));
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const locales = useMemo(() => universo.filter((p) => p.sistema === SISTEMA), [universo]);
    const listaPorId = useMemo(() => new Map(listas.map((l) => [l.id, l])), [listas]);

    const guardar = useCallback(
        async (p: Prospecto, cambios: Partial<Prospecto>) => {
            setUniverso((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...cambios } : x)));
            try {
                const actualizado = await prospectosStore.update(p.id, cambios, p, locales);
                setUniverso((prev) => prev.map((x) => (x.id === p.id ? actualizado : x)));
                return actualizado;
            } catch (e) {
                setUniverso((prev) => prev.map((x) => (x.id === p.id ? p : x)));
                toast.error(`No se guardó ${nombreCorto(p.negocio)}: ${mensajeError(e)}`);
                return null;
            }
        },
        [locales]
    );

    // ─── Derivados ───────────────────────────────────────────

    const hoy = hoyISO();
    const rampa = useMemo(() => calcularRampaVivoMenu(locales), [locales]);
    const aviso = avisoDiaVivoMenu();
    const enviadosHoy = locales.filter((p) => p.fecha_envio === hoy).length;
    const restantesHoy = Math.max(0, rampa.porDia - enviadosHoy);

    /** Todos los que se le puede escribir, sin importar si ya se leyó su ficha. */
    const candidatos = useMemo(
        () =>
            locales.filter(
                (p) => SIN_CONTACTAR.includes(p.estado) && !yaContactado(p) && !listaExcluida(listaPorId.get(p.lista_id || ""))
            ),
        [locales, listaPorId]
    );

    /** Antes de leer la ficha: primero la lista de comida rápida, después las reseñas. */
    const ordenPrevio = useCallback(
        (p: Prospecto) => {
            const lista = listaPorId.get(p.lista_id || "");
            return (lista && /delivery|r[aá]pida|llevar/i.test(lista.nombre) ? 1000 : 0) + (p.reviews_count ?? 0);
        },
        [listaPorId]
    );

    const escaneados = useMemo(
        () => candidatos.filter((p) => vivoDe(p)).map((p) => ({ p, prioridad: prioridadVivo(p) })).sort((a, b) => b.prioridad - a.prioridad),
        [candidatos]
    );
    const sinEscanear = useMemo(
        () => candidatos.filter((p) => !vivoDe(p)).sort((a, b) => ordenPrevio(b) - ordenPrevio(a)),
        [candidatos, ordenPrevio]
    );

    const seguimientos = useMemo(
        () =>
            locales
                .map((p) => ({ p, accion: proximaAccion(p) }))
                .filter((x) => x.accion?.vencido && (x.accion.paso === "fu1" || x.accion.paso === "fu2")),
        [locales]
    );
    const enCurso = useMemo(() => locales.filter((p) => EN_CURSO.includes(p.estado)), [locales]);
    const contestaron = useMemo(() => locales.filter((p) => p.estado === "respondio" || p.estado === "reunion"), [locales]);
    const clientes = locales.filter((p) => p.estado === "cliente").length;

    // ─── Lectura automática de la ficha de Google ─────────────

    const escanear = useCallback(
        async (lista: Prospecto[]) => {
            if (lista.length === 0) return;
            setEscaneando({ hechos: 0, total: lista.length });
            let fallidos = 0;
            try {
                for (let i = 0; i < lista.length; i += TANDA) {
                    const tanda = lista.slice(i, i + TANDA);
                    try {
                        const res = await fetch("/api/prospeccion/escanear-vivomenu", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ prospectos: tanda }),
                        });
                        const json = await res.json();
                        if (!res.ok) throw new Error(json.error || "Error al leer las fichas");
                        if (json.aviso) toast.warning(json.aviso, { duration: 15000 });
                        for (const r of json.resultados as { prospecto_id: string; campos: Partial<Prospecto>; error?: string }[]) {
                            const actual = tanda.find((p) => p.id === r.prospecto_id);
                            if (!actual || r.error || Object.keys(r.campos).length === 0) {
                                fallidos++;
                                continue;
                            }
                            await guardar(actual, r.campos);
                        }
                    } catch (e) {
                        fallidos += tanda.length;
                        toast.error(mensajeError(e));
                        break; // si falla, es la configuración: no seguir gastando
                    }
                    setEscaneando({ hechos: Math.min(i + TANDA, lista.length), total: lista.length });
                }
            } finally {
                setEscaneando(null);
            }
            if (fallidos) toast.info(`${fallidos} sin ficha en Google: quedan para revisar a mano`);
        },
        [guardar]
    );

    // Al abrir: se leen solas las fichas de los que tocan hoy (y unos pocos más).
    useEffect(() => {
        if (cargando || autoEscaneado.current || aviso) return;
        autoEscaneado.current = true;
        const faltan = restantesHoy + MARGEN_ESCANEO - escaneados.length;
        if (faltan > 0 && sinEscanear.length > 0) escanear(sinEscanear.slice(0, faltan));
    }, [cargando, aviso, restantesHoy, escaneados.length, sinEscanear, escanear]);

    // El día 8 fue el último mensaje: a los tres días sin respuesta se cierra.
    useEffect(() => {
        if (cargando || cerradosAuto.current) return;
        cerradosAuto.current = true;
        const vencidos = locales.filter((p) => p.estado === "fu2" && p.fecha_fu2 && diasDesde(p.fecha_fu2) >= DIAS_PARA_CERRAR);
        if (vencidos.length === 0) return;
        vencidos.forEach((p) => guardar(p, { estado: "sin_respuesta" }));
        toast.info(`${vencidos.length} sin respuesta después del día 8: cerrados`);
    }, [cargando, locales, guardar]);

    // ─── Mandar ──────────────────────────────────────────────

    const abrir = (p: Prospecto, texto: string, canal: CanalVivo) => {
        if (canal === "whatsapp" && p.telefono_wa) {
            window.location.href = linkWhatsapp(p.telefono_wa, texto, app, esAndroid);
        } else if (p.instagram_url) {
            navigator.clipboard.writeText(texto).catch(() => {});
            toast.success("Mensaje copiado: pegalo en el mensaje directo");
            window.open(abrirUrl(p.instagram_url), "_blank", "noopener,noreferrer");
        } else {
            navigator.clipboard.writeText(texto).catch(() => {});
            toast.info("Sin WhatsApp ni Instagram: el mensaje quedó copiado");
        }
    };

    /** Primero se abre la app y después se guarda: al revés, Android bloquea la apertura. */
    const enviar = (p: Prospecto, paso: PasoMensajeVivoMenu, canal: CanalVivo, texto: string) => {
        abrir(p, texto, canal);
        if (paso === "primer_contacto") guardar(p, { estado: "enviado", fecha_envio: hoyISO(), mensaje_enviado: texto, canal });
        else if (paso === "fu1") guardar(p, { estado: "fu1", fecha_fu1: hoyISO() });
        else if (paso === "fu2") guardar(p, { estado: "fu2", fecha_fu2: hoyISO() });
        else if (paso === "no_interesa") guardar(p, { estado: "descartado", motivo_descarte: "Dijo que no" });
        else if (paso === "compromiso_visita") guardar(p, { estado: "reunion" });
    };

    const contesto = (p: Prospecto) => {
        guardar(p, { estado: "respondio", fecha_respuesta: hoyISO() });
        toast.success(`${nombreCorto(p.negocio)} pasó a "Contestaron"`);
    };

    const deshacerEnvio = (p: Prospecto) => guardar(p, { estado: "calificado", fecha_envio: null, mensaje_enviado: "" });

    const cliente = async (p: Prospecto) => {
        try {
            await prospectosStore.convertirACliente(p);
            await cargar();
            toast.success(`${nombreCorto(p.negocio)} pasó a Clientes`);
        } catch (e) {
            toast.error(mensajeError(e));
        }
    };

    const recientes = locales.filter(
        (p) => p.estado === "enviado" && p.fecha_envio === hoy && Date.now() - new Date(p.updated_at || 0).getTime() < 15 * 60_000
    );

    const listos = escaneados.map((x) => x.p);
    const visibles = verMas ? listos : listos.slice(0, Math.max(restantesHoy, 3));

    // ─── Pantalla ────────────────────────────────────────────

    return (
        <div className="max-w-2xl mx-auto space-y-4 pb-24">
            <div className="space-y-1">
                <Link href="/prospeccion" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="w-3.5 h-3.5" /> Prospección
                </Link>
                <div className="flex items-center justify-between gap-2">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
                        <UtensilsCrossed className="w-5 h-5 text-orange-300" />
                        VivoMenu · Locales
                    </h1>
                    <button onClick={cambiarApp} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" aria-label="Cambiar la app de WhatsApp">
                        <Settings2 className="w-3.5 h-3.5" /> {app === "business" ? "WA Business" : "WA común"}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <Contador valor={`${enviadosHoy}/${rampa.porDia}`} label={`Hoy · semana ${rampa.semana}`} />
                <Contador valor={String(contestaron.length)} label="Contestaron" />
                <Contador valor={String(clientes)} label="Clientes" />
            </div>

            {aviso && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200">{aviso}</p>}

            <Pestanias
                valor={pestania}
                onCambio={setPestania}
                opciones={[
                    { id: "hoy", label: "Hoy", cant: Math.min(listos.length, restantesHoy), icon: MessageCircle },
                    { id: "seguir", label: "Seguir", cant: seguimientos.length, icon: Clock },
                    { id: "contestaron", label: "Contestaron", cant: contestaron.length, icon: Reply },
                ]}
            />

            {escaneando && (
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-200 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    Leyendo las fichas de Google: {escaneando.hechos} de {escaneando.total}…
                </div>
            )}

            {recientes.length > 0 && (
                <div className="rounded-xl border border-border bg-card/60 p-3 space-y-2">
                    <p className="text-[11px] text-muted-foreground">Recién marcados como enviados:</p>
                    {recientes.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2">
                            <span className="text-xs text-foreground [overflow-wrap:anywhere]">{nombreCorto(p.negocio)}</span>
                            <button onClick={() => deshacerEnvio(p)} className="shrink-0 inline-flex items-center gap-1 text-[11px] text-amber-300">
                                <Undo2 className="w-3 h-3" /> Deshacer
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {cargando ? (
                <div className="flex justify-center py-16 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                </div>
            ) : pestania === "hoy" ? (
                <section className="space-y-3">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {restantesHoy > 0
                            ? `Te quedan ${restantesHoy} de los ${rampa.porDia} de hoy. Primero los que hacen delivery o para llevar según Google.`
                            : `Ya hiciste los ${rampa.porDia} de hoy. Los que siguen son para mañana.`}
                    </p>
                    {listos.length === 0 && !escaneando && (
                        <Vacio texto={sinEscanear.length ? "Preparando los de hoy…" : "No quedan locales sin contactar en los listados."} />
                    )}
                    {visibles.map((p) => (
                        <TarjetaLocal
                            key={p.id}
                            p={p}
                            onEnviar={(canal, texto) => enviar(p, "primer_contacto", canal, texto)}
                            onGuardar={(c) => guardar(p, c)}
                            onDescartar={() => guardar(p, { estado: "descartado", motivo_descarte: "No califica (visto desde el celular)" })}
                        />
                    ))}
                    {!verMas && listos.length > visibles.length && (
                        <button onClick={() => setVerMas(true)} className="w-full text-xs text-muted-foreground py-2">
                            Ver {listos.length - visibles.length} más
                        </button>
                    )}
                    {!escaneando && restantesHoy > 0 && listos.length < restantesHoy && sinEscanear.length > 0 && (
                        <Boton onClick={() => escanear(sinEscanear.slice(0, restantesHoy - listos.length + MARGEN_ESCANEO))} tono="neutro">
                            Preparar más locales
                        </Boton>
                    )}
                </section>
            ) : pestania === "seguir" ? (
                <section className="space-y-3">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Día 3 y día 8. Si alguno contestó, tocá &ldquo;Contestó&rdquo; y pasa a la otra pestaña.
                    </p>
                    {seguimientos.length === 0 && <Vacio texto="No hay seguimientos que toquen hoy." />}
                    {seguimientos.map(({ p, accion }) => {
                        const paso = accion!.paso as "fu1" | "fu2";
                        const canal: CanalVivo = p.canal === "instagram" ? "instagram" : canalVivo(p);
                        const texto = generarMensajeVivoMenu(paso, p, canal);
                        return (
                            <Tarjeta key={p.id} p={p} extra={<span />}>
                                <p className="text-[11px] text-sky-200/80">
                                    {PASO_VIVOMENU_LABELS[paso]} · hace {accion!.dias} días
                                </p>
                                <VerMensaje texto={texto} />
                                <div className="grid grid-cols-2 gap-2">
                                    <Boton onClick={() => enviar(p, paso, canal, texto)} tono={canal === "whatsapp" ? "business" : "instagram"} icon={canal === "whatsapp" ? MessageCircle : Instagram}>
                                        Enviar
                                    </Boton>
                                    <Boton onClick={() => contesto(p)} tono="ok" icon={Reply}>
                                        Contestó
                                    </Boton>
                                </div>
                            </Tarjeta>
                        );
                    })}
                    {enCurso.length > 0 && (
                        <details className="rounded-xl border border-border bg-card/40 p-3">
                            <summary className="text-xs text-muted-foreground cursor-pointer">
                                Esperando respuesta ({enCurso.length}): tocá si alguno contestó
                            </summary>
                            <div className="mt-3 space-y-2">
                                {enCurso.map((p) => (
                                    <div key={p.id} className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-foreground [overflow-wrap:anywhere]">
                                            {nombreCorto(p.negocio)} · {p.estado === "enviado" ? "mensaje 1" : p.estado === "fu1" ? "día 3" : "día 8"}
                                        </span>
                                        <button onClick={() => contesto(p)} className="shrink-0 text-[11px] font-bold text-emerald-300">
                                            Contestó
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </details>
                    )}
                </section>
            ) : (
                <section className="space-y-3">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Contestales lo antes posible: de 15 a 18 el dueño está libre, después entra al servicio. Cada botón abre
                        el chat con el mensaje de ese paso.
                    </p>
                    {contestaron.length === 0 && <Vacio texto="Todavía no contestó nadie." />}
                    {contestaron.map((p) => (
                        <TarjetaContesto
                            key={p.id}
                            p={p}
                            onEnviar={(paso, texto) => enviar(p, paso, canalVivo(p), texto)}
                            onGuardar={(c) => guardar(p, c)}
                            onCliente={() => cliente(p)}
                        />
                    ))}
                </section>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Piezas
// ─────────────────────────────────────────────────────────────

function Contador({ valor, label }: { valor: string; label: string }) {
    return (
        <div className="rounded-xl border border-border bg-card p-2.5 text-center">
            <p className="text-base font-extrabold tabular-nums text-foreground">{valor}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
        </div>
    );
}

function VerMensaje({ texto, abierto = false }: { texto: string; abierto?: boolean }) {
    return (
        <details className="text-[11px] text-muted-foreground" open={abierto}>
            <summary className="cursor-pointer select-none">Ver el mensaje</summary>
            <p className="whitespace-pre-line mt-2 leading-relaxed text-foreground/90 [overflow-wrap:anywhere]">{texto}</p>
        </details>
    );
}

function Chip({ children, tono = "neutro" }: { children: React.ReactNode; tono?: "neutro" | "ok" | "alerta" }) {
    const tonos = {
        neutro: "bg-secondary text-muted-foreground border-border",
        ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        alerta: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    };
    return <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", tonos[tono])}>{children}</span>;
}

function TarjetaLocal({
    p, onEnviar, onGuardar, onDescartar,
}: {
    p: Prospecto;
    onEnviar: (canal: CanalVivo, texto: string) => void;
    onGuardar: (c: Partial<Prospecto>) => void;
    onDescartar: () => void;
}) {
    const v = vivoDe(p);
    const [canal, setCanal] = useState<CanalVivo>(canalVivo(p));
    const [carta, setCarta] = useState(p.revision_url);
    const texto = generarMensajeVivoMenu("primer_contacto", { ...p, revision_url: carta }, canal);
    const sinCanal = !p.telefono_wa && !p.instagram_url;
    const busquedaIg = `https://www.google.com/search?q=${encodeURIComponent(`${p.negocio} Tucumán instagram`)}`;

    return (
        <Tarjeta p={p} extra={<span />}>
            <div className="flex flex-wrap gap-1.5">
                {v?.categoria && <Chip>{v.categoria}</Chip>}
                {v?.delivery && <Chip tono="ok">Delivery</Chip>}
                {v?.para_llevar && <Chip tono="ok">Para llevar</Chip>}
                {v && !v.delivery && !v.para_llevar && v.salon && <Chip tono="alerta">Solo salón</Chip>}
                {v && v.delivery === null && v.para_llevar === null && <Chip>Google no dice si hace delivery</Chip>}
                {p.reviews_count != null && <Chip>{p.reviews_count} reseñas{p.rating ? ` · ${p.rating}` : ""}</Chip>}
            </div>

            <div className="flex flex-wrap gap-3 text-[11px]">
                {p.maps_url && <a href={p.maps_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-300"><ExternalLink className="w-3 h-3" /> Maps</a>}
                {p.instagram_url && <a href={abrirUrl(p.instagram_url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-fuchsia-300"><Instagram className="w-3 h-3" /> Instagram</a>}
                {p.telefono && !p.telefono_wa && <span className="text-muted-foreground">Fijo: {p.telefono}</span>}
            </div>

            {sinCanal ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 space-y-2">
                    <p className="text-[11px] text-amber-200 leading-relaxed">
                        Google no tiene su WhatsApp. Buscá su Instagram y pegalo acá, o salteálo.
                    </p>
                    <a href={busquedaIg} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-sky-300">
                        <ExternalLink className="w-3 h-3" /> Buscar su Instagram
                    </a>
                    <input
                        placeholder="Pegá el link o el @ de su Instagram"
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground"
                        onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (!v) return;
                            const url = v.includes("instagram.com") ? v : `https://instagram.com/${v.replace(/^@/, "")}`;
                            onGuardar({ instagram_url: url, canal: "instagram" });
                            setCanal("instagram");
                        }}
                    />
                </div>
            ) : (
                <>
                    <VerMensaje texto={texto} />
                    <Boton
                        onClick={() => onEnviar(canal, texto)}
                        tono={canal === "whatsapp" ? "business" : "instagram"}
                        icon={canal === "whatsapp" ? MessageCircle : Instagram}
                    >
                        {canal === "whatsapp" ? "Mandar por WhatsApp" : "Copiar y abrir Instagram"}
                    </Boton>
                </>
            )}

            <details className="text-[11px] text-muted-foreground">
                <summary className="cursor-pointer select-none">Más opciones</summary>
                <div className="mt-2 space-y-2">
                    {p.telefono_wa && p.instagram_url && (
                        <button onClick={() => setCanal(canal === "whatsapp" ? "instagram" : "whatsapp")} className="text-[11px] font-bold text-foreground underline underline-offset-2">
                            Mandarlo por {canal === "whatsapp" ? "Instagram" : "WhatsApp"}
                        </button>
                    )}
                    <label className="block space-y-1">
                        <span>Si ya le armaste la carta en VivoMenu, pegá el link (el mensaje cambia solo)</span>
                        <input
                            value={carta}
                            onChange={(e) => setCarta(e.target.value)}
                            onBlur={() => carta !== p.revision_url && onGuardar({ revision_url: carta })}
                            placeholder="https://vivomenu.com.ar/m/…"
                            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground"
                        />
                    </label>
                    <Boton onClick={onDescartar} tono="neutro" icon={X}>
                        No es para VivoMenu
                    </Boton>
                </div>
            </details>
        </Tarjeta>
    );
}

function TarjetaContesto({
    p, onEnviar, onGuardar, onCliente,
}: {
    p: Prospecto;
    onEnviar: (paso: PasoMensajeVivoMenu, texto: string) => void;
    onGuardar: (c: Partial<Prospecto>) => void;
    onCliente: () => void;
}) {
    const [carta, setCarta] = useState(p.revision_url);
    const pasos: PasoMensajeVivoMenu[] = ["rama_dueno", "rama_empleado", "interes_tibio", "compromiso_visita", "fu3", "no_interesa"];
    return (
        <Tarjeta p={p} extra={<span />}>
            <p className="text-[11px] text-muted-foreground">
                Contestó {p.fecha_respuesta ? `el ${p.fecha_respuesta.split("-").reverse().slice(0, 2).join("/")}` : ""}
                {p.estado === "reunion" ? " · visita propuesta" : ""}
            </p>
            <div className="grid grid-cols-2 gap-2">
                {pasos.map((paso) => (
                    <Boton key={paso} onClick={() => onEnviar(paso, generarMensajeVivoMenu(paso, { ...p, revision_url: carta }))} tono={paso === "no_interesa" ? "neutro" : "personal"}>
                        <span className="text-[11px]">{PASO_VIVOMENU_LABELS[paso]}</span>
                    </Boton>
                ))}
                <Boton onClick={onCliente} tono="ok" icon={UserPlus}>
                    <span className="text-[11px]">Pasó a cliente</span>
                </Boton>
            </div>
            <label className="block space-y-1 text-[11px] text-muted-foreground">
                <span>El link de su carta, cuando se la armes</span>
                <input
                    value={carta}
                    onChange={(e) => setCarta(e.target.value)}
                    onBlur={() => carta !== p.revision_url && onGuardar({ revision_url: carta })}
                    placeholder="https://vivomenu.com.ar/m/…"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground"
                />
            </label>
            {carta.trim() && (
                <Boton
                    onClick={() => onEnviar("interes_tibio", `Listo, acá está tu carta: ${carta.trim()}. Probá armar un pedido como si fueras un cliente y decime qué te parece.`)}
                    tono="business"
                    icon={MessageCircle}
                >
                    Mandarle su carta
                </Boton>
            )}
        </Tarjeta>
    );
}
