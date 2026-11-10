"use client";

// ============================================================
// Sarvo · Turnos — la prospección de negocios con turnos, de punta a punta
// ============================================================
//
// Una sola pantalla, pensada para el celular, con el método de la nota
// "Sistema de adquisición" (02b del panel de galu-web):
//
//   · Traer        — buscás un rubro y una zona: se busca en Maps, se carga al
//                    listado del rubro y se escanea solo. No hay que escanear
//                    de a uno ni importar a mano.
//   · Hoy          — los 12 del día, ordenados por quién tiene más chances, con
//                    el mensaje ya escrito según si contesta él o hay recepción,
//                    y por WhatsApp o Instagram. Un toque y sale.
//   · Seguir       — los seguimientos del día 3 y del día 8. A los tres días del
//                    último se cierran solos hasta febrero.
//   · Contestaron  — los que respondieron, con los mensajes de cada paso
//                    (el link, la llamada, el precio, los colegas).
//
// Los mensajes salen desde el WhatsApp Business de Galu. El contador de chats
// nuevos del mes avisa antes de llegar al límite de WhatsApp.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft, CalendarCheck, MessageCircle, Instagram, Clock, Reply, Search, Loader2, Copy,
    X, ExternalLink, UserPlus, Sparkles, Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, hoyISO } from "@/lib/utils";
import { prospectosStore, listasStore, mensajeError } from "@/lib/store";
import type { Prospecto, ListaProspeccion, ScraperBusqueda, SegmentoTurnos } from "@/lib/types";
import { ESCANEO_VACIO, ESCANEO_SARVO_VACIO } from "@/lib/types";
import { proximaAccion, diasDesde, telefonoAWhatsapp, normalizarEscaneo } from "@/lib/prospeccion";
import {
    RUBROS_ACTIVOS, rubroPorId, rubroTurnosDe, sarvoDe, segmentoDe, nivelDe, motivoFueraTurnos,
    generarMensajeTurnos, canalTurnos, scoreTurnos, fichaParaSarvo, chatsNuevosDelMes, nombreCorto,
    SEGMENTO_LABELS, PASO_TURNOS_LABELS, CUOTA_DIARIA, LIMITE_CHATS_NUEVOS_MES,
    type PasoTurnos, type CanalTurnos,
} from "@/lib/turnos";
import { linkWhatsapp } from "@/lib/odontologia-mensajes";
import { Tarjeta, Boton, Vacio, Pestanias } from "@/components/prospeccion/celular";

type Pestania = "hoy" | "seguir" | "contestaron" | "traer";

const SISTEMA = "odontologia" as const;
const SIN_CONTACTAR = ["sin_calificar", "calificado"];
const EN_CURSO = ["enviado", "fu1", "fu2"];
const TANDA_ESCANEO = 8;
/** Días después del día 8 en que se cierra solo si no contestó. */
const DIAS_PARA_CERRAR = 3;

const ZONAS = ["San Miguel de Tucumán", "Yerba Buena", "Tafí Viejo", "Banda del Río Salí", "Concepción"];

const abrirUrl = (u: string) => (u.startsWith("http") ? u : `https://${u}`);

/**
 * Ya se le escribió antes desde el WhatsApp de Galu (la prueba de la hora o el
 * guion viejo de odontología). La prueba de la hora no cambiaba el estado, así
 * que sin esto volvían a aparecer en "Hoy" como si nadie les hubiera hablado.
 */
const yaContactado = (p: Prospecto) => !!(p.prueba_enviada_at || p.fecha_envio || (p.mensaje_enviado || "").trim());

const rubroDeCola = (p: Prospecto) => rubroTurnosDe(p)?.id || "otros";

export default function TurnosPage() {
    const [universo, setUniverso] = useState<Prospecto[]>([]);
    const [listas, setListas] = useState<ListaProspeccion[]>([]);
    const [cargando, setCargando] = useState(true);
    const [pestania, setPestania] = useState<Pestania>("hoy");
    const [esAndroid, setEsAndroid] = useState(false);
    const [verTodos, setVerTodos] = useState(false);
    const [filtroRubro, setFiltroRubro] = useState<string>("todos");
    const [escaneo, setEscaneo] = useState<{ hechos: number; total: number } | null>(null);
    const [buscando, setBuscando] = useState<string | null>(null);
    const cerradosAuto = useRef(false);

    useEffect(() => setEsAndroid(/android/i.test(navigator.userAgent)), []);

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

    const turnos = useMemo(() => universo.filter((p) => p.sistema === SISTEMA), [universo]);

    const guardar = useCallback(
        async (p: Prospecto, cambios: Partial<Prospecto>) => {
            setUniverso((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...cambios } : x)));
            try {
                const actualizado = await prospectosStore.update(p.id, cambios, p, turnos);
                setUniverso((prev) => prev.map((x) => (x.id === p.id ? actualizado : x)));
                return actualizado;
            } catch (e) {
                setUniverso((prev) => prev.map((x) => (x.id === p.id ? p : x)));
                toast.error(`No se guardó ${nombreCorto(p.negocio)}: ${mensajeError(e)}`);
                return null;
            }
        },
        [turnos]
    );

    // ─── Derivados ───────────────────────────────────────────

    const hoy = hoyISO();
    const enviadosHoy = turnos.filter((p) => p.fecha_envio === hoy).length;
    const chatsMes = chatsNuevosDelMes(universo);
    const restantesHoy = Math.max(0, CUOTA_DIARIA - enviadosHoy);

    const sinEscanear = useMemo(
        () => turnos.filter((p) => SIN_CONTACTAR.includes(p.estado) && !yaContactado(p) && !sarvoDe(p).escaneado_at),
        [turnos]
    );

    const cola = useMemo(
        () =>
            turnos
                .filter((p) => SIN_CONTACTAR.includes(p.estado) && !yaContactado(p) && motivoFueraTurnos(p) === null)
                // El score se calcula acá y no se lee de la base: los consultorios
                // cargados antes del 2026-11-09 tienen guardado el de la prueba de la hora.
                .map((p) => ({ ...p, score: scoreTurnos(p).total }))
                .sort((a, b) => b.score - a.score),
        [turnos]
    );

    const seguimientos = useMemo(
        () =>
            turnos
                .map((p) => ({ p, accion: proximaAccion(p) }))
                .filter((x) => x.accion?.vencido && (x.accion.paso === "fu1" || x.accion.paso === "fu2")),
        [turnos]
    );

    const enCurso = useMemo(() => turnos.filter((p) => EN_CURSO.includes(p.estado)), [turnos]);
    const contestaron = useMemo(() => turnos.filter((p) => p.estado === "respondio" || p.estado === "reunion"), [turnos]);
    const fundadores = turnos.filter((p) => p.estado === "cliente").length;

    // El día 8 fue el último mensaje: a los tres días sin respuesta se cierra solo.
    useEffect(() => {
        if (cargando || cerradosAuto.current) return;
        cerradosAuto.current = true;
        const vencidos = turnos.filter(
            (p) => p.estado === "fu2" && p.fecha_fu2 && diasDesde(p.fecha_fu2) >= DIAS_PARA_CERRAR
        );
        if (vencidos.length === 0) return;
        vencidos.forEach((p) => guardar(p, { estado: "sin_respuesta" }));
        toast.info(`${vencidos.length} sin respuesta después del día 8: se cerraron hasta febrero`);
    }, [cargando, turnos, guardar]);

    // ─── Escaneo automático ──────────────────────────────────

    const escanear = useCallback(
        async (lista: Prospecto[]) => {
            if (lista.length === 0) return;
            setEscaneo({ hechos: 0, total: lista.length });
            let fallidos = 0;
            try {
                for (let i = 0; i < lista.length; i += TANDA_ESCANEO) {
                    const tanda = lista.slice(i, i + TANDA_ESCANEO);
                    try {
                        const res = await fetch("/api/prospeccion/escanear-turnos", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ prospectos: tanda }),
                        });
                        const json = await res.json();
                        if (!res.ok) throw new Error(json.error || "Error al escanear");
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
                        if (i === 0) break; // si falla la primera tanda, es la configuración: no seguir gastando
                    }
                    setEscaneo({ hechos: Math.min(i + TANDA_ESCANEO, lista.length), total: lista.length });
                }
            } finally {
                setEscaneo(null);
            }
            toast.success(
                `Escaneados ${lista.length - fallidos} de ${lista.length}` + (fallidos ? ` · ${fallidos} no se pudieron` : "")
            );
        },
        [guardar]
    );

    // ─── Traer: buscar en Maps, cargar al listado y escanear ─

    const listadoDe = async (zona: string, label: string): Promise<string | null> => {
        const nombre = ["AR", zona, label].join(" · ");
        const existente = listas.find((l) => l.sistema === SISTEMA && l.nombre === nombre && !l.archivada);
        if (existente) return existente.id;
        try {
            const creada = await listasStore.create({
                nombre, sistema: SISTEMA, pais: "Argentina", ciudad: zona, rubro: label, origen: "scraper",
                objetivo: "Fundadores de Sarvo (nota 02b)",
            });
            setListas((prev) => [creada, ...prev]);
            return creada.id;
        } catch {
            return null; // sin la tabla de listados se carga igual, sin listado
        }
    };

    const traer = async (rubroId: string, zona: string, limite: number) => {
        const rubro = rubroPorId(rubroId);
        if (!rubro) return;
        setBuscando(`Buscando ${rubro.label.toLowerCase()} en ${zona}…`);
        try {
            const res = await fetch("/api/scraper", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rubro: rubro.busquedas[0], lugar: zona, limite }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Error al buscar en Maps");
            const busqueda = json.data as ScraperBusqueda;
            setBuscando(`Encontré ${busqueda.prospectos.length}. Cargándolos…`);
            const listaId = await listadoDe(zona, rubro.label);
            const r = await prospectosStore.importarDesdeScraper(busqueda.prospectos, universo, SISTEMA, {
                listaId, pais: "Argentina",
            });
            setUniverso((prev) => [...r.insertados, ...prev]);
            toast.success(
                `${r.insertados.length} nuevos en "${rubro.label}"` + (r.duplicados ? ` · ${r.duplicados} ya estaban` : "")
            );
            setBuscando(null);
            await escanear(r.insertados);
            setPestania("hoy");
        } catch (e) {
            toast.error(mensajeError(e));
        } finally {
            setBuscando(null);
        }
    };

    const altaManual = async (datos: {
        negocio: string; contacto: string; instagram: string; telefono: string; rubro: string; presentado: string;
    }) => {
        const wa = telefonoAWhatsapp(datos.telefono);
        const instagram = datos.instagram.trim()
            ? datos.instagram.includes("instagram.com")
                ? datos.instagram.trim()
                : `https://instagram.com/${datos.instagram.trim().replace(/^@/, "")}`
            : "";
        try {
            const creado = await prospectosStore.create(
                {
                    sistema: SISTEMA,
                    negocio: datos.negocio.trim(),
                    contacto_nombre: datos.contacto.trim(),
                    rubro: rubroPorId(datos.rubro)?.label || "",
                    ciudad: "San Miguel de Tucumán",
                    pais: "Argentina",
                    telefono: datos.telefono.trim(),
                    telefono_wa: wa,
                    whatsapp_publicado: !!wa,
                    instagram_url: instagram,
                    canal: wa ? "whatsapp" : "instagram",
                    estado: "calificado",
                    origen: "manual",
                    escaneo: {
                        ...ESCANEO_VACIO,
                        sarvo: {
                            ...ESCANEO_SARVO_VACIO,
                            rubro: datos.rubro,
                            presentado_por: datos.presentado.trim(),
                            // Cargado a mano por alguien que lo conoce o lo miró: cuenta como escaneado.
                            escaneado_at: new Date().toISOString(),
                        },
                    },
                },
                turnos
            );
            setUniverso((prev) => [creado, ...prev]);
            toast.success(`${nombreCorto(creado.negocio)} cargado. Está en "Hoy".`);
            return true;
        } catch (e) {
            toast.error(mensajeError(e));
            return false;
        }
    };

    // ─── Mandar ──────────────────────────────────────────────

    const abrir = (p: Prospecto, texto: string, canal: CanalTurnos) => {
        if (canal === "whatsapp" && p.telefono_wa) {
            window.location.href = linkWhatsapp(p.telefono_wa, texto, "business", esAndroid);
        } else if (p.instagram_url) {
            navigator.clipboard.writeText(texto).catch(() => {});
            toast.success("Mensaje copiado: pegalo en el mensaje directo");
            window.open(abrirUrl(p.instagram_url), "_blank", "noopener,noreferrer");
        } else {
            navigator.clipboard.writeText(texto).catch(() => {});
            toast.info("No tiene WhatsApp ni Instagram cargado: el mensaje quedó copiado");
        }
    };

    /** Primero se abre la app y después se guarda: al revés, Android bloquea la apertura. */
    const enviar = (p: Prospecto, paso: PasoTurnos, canal: CanalTurnos, texto: string) => {
        abrir(p, texto, canal);
        if (paso === "m1" || paso === "m1_recepcion") {
            guardar(p, { estado: "enviado", fecha_envio: hoyISO(), mensaje_enviado: texto, canal });
        } else if (paso === "fu1") {
            guardar(p, { estado: "fu1", fecha_fu1: hoyISO() });
        } else if (paso === "fu2") {
            guardar(p, { estado: "fu2", fecha_fu2: hoyISO() });
        } else if (paso === "no_interesa") {
            guardar(p, { estado: "descartado", motivo_descarte: "Dijo que no" });
        }
    };

    const contesto = (p: Prospecto) => {
        guardar(p, { estado: "respondio", fecha_respuesta: hoyISO() });
        toast.success(`${nombreCorto(p.negocio)} pasó a "Contestaron"`);
    };

    const deshacerEnvio = (p: Prospecto) =>
        guardar(p, { estado: "calificado", fecha_envio: null, mensaje_enviado: "" });

    const fundador = async (p: Prospecto) => {
        try {
            await prospectosStore.convertirACliente(p);
            await cargar();
            toast.success(`${nombreCorto(p.negocio)} es fundador: está en Clientes`);
        } catch (e) {
            toast.error(mensajeError(e));
        }
    };

    const recientes = turnos.filter(
        (p) => p.estado === "enviado" && p.fecha_envio === hoy && Date.now() - new Date(p.updated_at || 0).getTime() < 15 * 60_000
    );

    // Filtro por rubro: los nutricionistas y los odontólogos conviven en la misma
    // cola, y a veces querés trabajar solo uno.
    const rubrosEnCola = useMemo(() => {
        const cuenta = new Map<string, number>();
        cola.forEach((p) => cuenta.set(rubroDeCola(p), (cuenta.get(rubroDeCola(p)) || 0) + 1));
        return Array.from(cuenta.entries())
            .map(([id, cant]) => ({ id, cant, label: rubroPorId(id)?.label || "Otros" }))
            .sort((a, b) => b.cant - a.cant);
    }, [cola]);
    const filtroValido = filtroRubro === "todos" || rubrosEnCola.some((r) => r.id === filtroRubro) ? filtroRubro : "todos";
    const colaFiltrada = filtroValido === "todos" ? cola : cola.filter((p) => rubroDeCola(p) === filtroValido);
    const sinEscanearFiltrado =
        filtroValido === "todos" ? sinEscanear : sinEscanear.filter((p) => rubroDeCola(p) === filtroValido);

    /** Para un rubro al que ya le escribiste por otro lado: salen todos de la cola de una. */
    const yaLesEscribi = async () => {
        const rubro = rubrosEnCola.find((r) => r.id === filtroValido);
        if (!rubro) return;
        const ok = window.confirm(
            `Vas a sacar de la cola a los ${rubro.cant} de ${rubro.label}, marcados como "ya contactado antes desde este número". No se borran: quedan en la planilla como descartados. Seguís?`
        );
        if (!ok) return;
        const lista = colaFiltrada;
        for (const p of lista) {
            await guardar(p, { estado: "descartado", motivo_descarte: "Ya contactado antes desde este número" });
        }
        setFiltroRubro("todos");
        toast.success(`${lista.length} de ${rubro.label} fuera de la cola`);
    };

    const visibles = verTodos ? colaFiltrada : colaFiltrada.slice(0, Math.max(restantesHoy, 3));

    // ─── Pantalla ────────────────────────────────────────────

    return (
        <div className="max-w-2xl mx-auto space-y-4 pb-24">
            <div className="space-y-1">
                <Link href="/prospeccion" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="w-3.5 h-3.5" /> Prospección
                </Link>
                <h1 className="text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
                    <CalendarCheck className="w-5 h-5 text-emerald-300" />
                    Sarvo · Negocios con turnos
                </h1>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Primero el profesional que contesta su propio WhatsApp. Se le manda su página armada o la demo de su
                    rubro. Tres mensajes en ocho días y se cierra.
                </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <Contador valor={`${enviadosHoy}/${CUOTA_DIARIA}`} label="Hoy" alerta={false} />
                <Contador
                    valor={`${chatsMes}/${LIMITE_CHATS_NUEVOS_MES}`}
                    label="Chats nuevos del mes"
                    alerta={chatsMes >= LIMITE_CHATS_NUEVOS_MES - 20}
                />
                <Contador valor={`${fundadores}/6`} label="Fundadores" alerta={false} />
            </div>
            {chatsMes >= LIMITE_CHATS_NUEVOS_MES - 20 && (
                <p className="text-[11px] text-amber-300">
                    Te acercás al límite de chats nuevos de WhatsApp del mes. Pasá los que tengan Instagram a ese canal.
                </p>
            )}

            <Pestanias
                valor={pestania}
                onCambio={setPestania}
                opciones={[
                    { id: "hoy", label: "Hoy", cant: cola.length, icon: CalendarCheck },
                    { id: "seguir", label: "Seguir", cant: seguimientos.length, icon: Clock },
                    { id: "contestaron", label: "Contestaron", cant: contestaron.length, icon: Reply },
                    { id: "traer", label: "Traer", cant: sinEscanear.length, icon: Search },
                ]}
            />

            {(escaneo || buscando) && (
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-200 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    {buscando || `Escaneando ${escaneo!.hechos} de ${escaneo!.total}…`}
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
                    {rubrosEnCola.length > 1 && (
                        <div className="flex flex-wrap gap-1.5">
                            {[{ id: "todos", label: "Todos", cant: cola.length }, ...rubrosEnCola].map((r) => (
                                <button
                                    key={r.id}
                                    onClick={() => { setFiltroRubro(r.id); setVerTodos(false); }}
                                    className={cn(
                                        "px-2.5 py-1 rounded-lg text-[11px] font-bold border",
                                        filtroValido === r.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"
                                    )}
                                >
                                    {r.label} · {r.cant}
                                </button>
                            ))}
                        </div>
                    )}
                    {sinEscanearFiltrado.length > 0 && !escaneo && (
                        <button
                            onClick={() => escanear(sinEscanearFiltrado)}
                            className="w-full rounded-xl border border-sky-500/40 bg-sky-500/10 p-3 text-left text-xs text-sky-200"
                        >
                            <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                            {sinEscanearFiltrado.length} sin escanear. Tocá para escanearlos todos (tarda unos segundos por tanda de 8).
                        </button>
                    )}
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {restantesHoy > 0
                            ? `Te quedan ${restantesHoy} de los ${CUOTA_DIARIA} de hoy. Antes de mandar: revisá la primera línea y, si le armaste la página, pegá el link.`
                            : "Ya hiciste los 12 de hoy. Los que siguen son para mañana."}
                    </p>
                    {colaFiltrada.length === 0 && <Vacio texto='No hay negocios listos. Traé un rubro desde "Traer".' />}
                    {visibles.map((p) => (
                        <TarjetaTurno
                            key={p.id}
                            p={p}
                            onGuardar={(c) => guardar(p, c)}
                            onEnviar={(paso, canal, texto) => enviar(p, paso, canal, texto)}
                            onDescartar={(motivo) => guardar(p, { estado: "descartado", motivo_descarte: motivo })}
                            onEscanear={() => escanear([p])}
                            ocupado={!!escaneo}
                        />
                    ))}
                    {!verTodos && colaFiltrada.length > visibles.length && (
                        <button onClick={() => setVerTodos(true)} className="w-full text-xs text-muted-foreground py-2">
                            Ver los {colaFiltrada.length - visibles.length} que siguen
                        </button>
                    )}
                    {filtroValido !== "todos" && colaFiltrada.length > 0 && (
                        <button onClick={yaLesEscribi} className="w-full text-[11px] text-amber-300/80 py-2 underline underline-offset-2">
                            Ya les escribí a todos estos antes: sacarlos de la cola
                        </button>
                    )}
                </section>
            ) : pestania === "seguir" ? (
                <section className="space-y-3">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Día 3: un recurso que le sirve aunque no te compre. Día 8: el cierre. Si alguien contestó, tocá
                        &ldquo;Contestó&rdquo; y pasa a la otra pestaña.
                    </p>
                    {seguimientos.length === 0 && <Vacio texto="No hay seguimientos que toquen hoy." />}
                    {seguimientos.map(({ p, accion }) => {
                        const paso = accion!.paso as "fu1" | "fu2";
                        const canal: CanalTurnos = p.canal === "instagram" ? "instagram" : canalTurnos(p);
                        const texto = generarMensajeTurnos(paso, p, canal);
                        return (
                            <Tarjeta key={p.id} p={p}>
                                <p className="text-[11px] text-sky-200/80">
                                    {PASO_TURNOS_LABELS[paso]} · por {canal === "whatsapp" ? "WhatsApp" : "Instagram"} · hace {accion!.dias} días
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
            ) : pestania === "contestaron" ? (
                <section className="space-y-3">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Contestales en menos de una hora. Cada botón abre el chat con el mensaje de ese paso.
                    </p>
                    {contestaron.length === 0 && <Vacio texto="Todavía no contestó nadie." />}
                    {contestaron.map((p) => (
                        <TarjetaContesto key={p.id} p={p} onEnviar={(paso, texto) => enviar(p, paso, canalTurnos(p), texto)} onFundador={() => fundador(p)} />
                    ))}
                </section>
            ) : (
                <SeccionTraer
                    ocupado={!!escaneo || !!buscando}
                    sinEscanear={sinEscanear.length}
                    onTraer={traer}
                    onEscanear={() => escanear(sinEscanear)}
                    onAlta={altaManual}
                />
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Piezas
// ─────────────────────────────────────────────────────────────

function Contador({ valor, label, alerta }: { valor: string; label: string; alerta: boolean }) {
    return (
        <div className={cn("rounded-xl border p-2.5 text-center", alerta ? "border-amber-500/40 bg-amber-500/10" : "border-border bg-card")}>
            <p className={cn("text-base font-extrabold tabular-nums", alerta ? "text-amber-300" : "text-foreground")}>{valor}</p>
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

function Chip({ children, tono = "neutro", onClick }: { children: React.ReactNode; tono?: "neutro" | "ok" | "alerta" | "info"; onClick?: () => void }) {
    const tonos = {
        neutro: "bg-secondary text-muted-foreground border-border",
        ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
        alerta: "bg-amber-500/15 text-amber-300 border-amber-500/30",
        info: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    };
    const Tag = onClick ? "button" : "span";
    return (
        <Tag onClick={onClick} className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", tonos[tono])}>
            {children}
        </Tag>
    );
}

const SIGUIENTE_SEGMENTO: Record<SegmentoTurnos, SegmentoTurnos> = { sin_definir: "solo", solo: "centro", centro: "sin_definir" };

function TarjetaTurno({
    p, onGuardar, onEnviar, onDescartar, onEscanear, ocupado,
}: {
    p: Prospecto;
    onGuardar: (c: Partial<Prospecto>) => void;
    onEnviar: (paso: PasoTurnos, canal: CanalTurnos, texto: string) => void;
    onDescartar: (motivo: string) => void;
    onEscanear: () => void;
    ocupado: boolean;
}) {
    const sarvo = sarvoDe(p);
    const rubro = rubroTurnosDe(p);
    const segmento = segmentoDe(p);
    const [linea, setLinea] = useState(p.dato_usado);
    const [pagina, setPagina] = useState(p.revision_url);
    const [nombre, setNombre] = useState(p.contacto_nombre);
    const [canal, setCanal] = useState<CanalTurnos>(canalTurnos(p));
    const [paso, setPaso] = useState<PasoTurnos>("m1");

    useEffect(() => {
        setLinea(p.dato_usado);
        setPagina(p.revision_url);
        setNombre(p.contacto_nombre);
    }, [p.id, p.dato_usado, p.revision_url, p.contacto_nombre]);

    const borrador: Prospecto = { ...p, dato_usado: linea, revision_url: pagina, contacto_nombre: nombre };
    const texto = generarMensajeTurnos(paso, borrador, canal);

    const cambiarSegmento = () => {
        const nuevo = SIGUIENTE_SEGMENTO[segmento];
        onGuardar({ escaneo: { ...normalizarEscaneo(p.escaneo), sarvo: { ...sarvo, segmento: nuevo } } });
    };

    /** Revisado a mano: cuenta como escaneado y guarda lo que marcaste. */
    const loReviseYo = () => {
        onGuardar({
            contacto_nombre: nombre,
            dato_usado: linea,
            escaneo: { ...normalizarEscaneo(p.escaneo), sarvo: { ...sarvo, escaneado_at: new Date().toISOString() } },
            escaneado_at: new Date().toISOString(),
            ...(p.estado === "sin_calificar" ? { estado: "calificado" as const } : {}),
        });
        toast.success("Marcado como revisado");
    };

    const copiarFicha = () => {
        navigator.clipboard.writeText(fichaParaSarvo(borrador)).catch(() => {});
        toast.success("Ficha copiada: pegala para armarlo en /admin de Sarvo");
    };

    const inputCls = "w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground";

    return (
        <Tarjeta p={p}>
            {!sarvo.escaneado_at && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 space-y-2">
                    <p className="text-[11px] text-amber-200 leading-relaxed">
                        Sin escanear. Escanealo, o revisalo vos: tocá el segmento hasta que diga quién contesta, poné el
                        nombre y la primera línea, y marcalo como revisado.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        <Boton onClick={onEscanear} tono="alerta" icon={Sparkles} disabled={ocupado}>
                            Escanear este
                        </Boton>
                        <Boton onClick={loReviseYo} tono="neutro">
                            Lo revisé yo
                        </Boton>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-1.5">
                <Chip tono={segmento === "solo" ? "ok" : segmento === "centro" ? "info" : "neutro"} onClick={cambiarSegmento}>
                    {SEGMENTO_LABELS[segmento]} ↻
                </Chip>
                {rubro && <Chip>{rubro.label}</Chip>}
                <Chip tono={nivelDe(borrador) === "A" ? "ok" : "neutro"}>Nivel {nivelDe(borrador)}</Chip>
                {p.reviews_count != null && <Chip>{p.reviews_count} reseñas</Chip>}
                {sarvo.precios_publicados && <Chip tono="ok">Publica precios</Chip>}
                {sarvo.link_turnos && <Chip tono="alerta">Ya usa {sarvo.link_turnos}</Chip>}
                {sarvo.presentado_por && <Chip tono="ok">Lo presentó {sarvo.presentado_por}</Chip>}
            </div>

            <div className="flex flex-wrap gap-3 text-[11px]">
                {p.maps_url && <a href={p.maps_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-300"><ExternalLink className="w-3 h-3" /> Maps</a>}
                {p.instagram_url && <a href={abrirUrl(p.instagram_url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-fuchsia-300"><Instagram className="w-3 h-3" /> Instagram</a>}
                {p.sitio_web_url && <a href={abrirUrl(p.sitio_web_url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-300"><ExternalLink className="w-3 h-3" /> Web</a>}
            </div>

            {sarvo.evidencias.length > 0 && (
                <p className="text-[10px] text-muted-foreground leading-relaxed">{sarvo.evidencias.join(" · ")}</p>
            )}

            <div className="space-y-2">
                <label className="block space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Nombre del profesional</span>
                    <input value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={() => nombre !== p.contacto_nombre && onGuardar({ contacto_nombre: nombre })} placeholder="Para el 'Hola [nombre]'" className={inputCls} />
                </label>
                <label className="block space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Primera línea (algo que solo es verdad de él)</span>
                    <textarea rows={2} value={linea} onChange={(e) => setLinea(e.target.value)} onBlur={() => linea !== p.dato_usado && onGuardar({ dato_usado: linea })} placeholder='Ej.: Vi que te preguntan el precio en los comentarios' className={inputCls} />
                </label>
                <label className="block space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Su página (si se la armaste en Sarvo)</span>
                    <input value={pagina} onChange={(e) => setPagina(e.target.value)} onBlur={() => pagina !== p.revision_url && onGuardar({ revision_url: pagina })} placeholder="https://sarvo-app.vercel.app/su-negocio" className={inputCls} />
                </label>
            </div>

            <div className="flex gap-1.5 flex-wrap">
                {(["m1", "m1_recepcion"] as PasoTurnos[]).map((x) => (
                    <button key={x} onClick={() => setPaso(x)} className={cn("px-2.5 py-1 rounded-lg text-[11px] font-bold border", paso === x ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border")}>
                        {x === "m1" ? "Al profesional / dueño" : "A la recepcionista"}
                    </button>
                ))}
                {p.telefono_wa && p.instagram_url && (
                    <button onClick={() => setCanal(canal === "whatsapp" ? "instagram" : "whatsapp")} className="px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-card text-muted-foreground border-border">
                        Por {canal === "whatsapp" ? "WhatsApp" : "Instagram"} ↻
                    </button>
                )}
            </div>

            <VerMensaje texto={texto} abierto />

            <Boton onClick={() => onEnviar(paso, canal, texto)} tono={canal === "whatsapp" ? "business" : "instagram"} icon={canal === "whatsapp" ? MessageCircle : Instagram}>
                {canal === "whatsapp" ? "Enviar por WhatsApp" : "Copiar y abrir Instagram"}
            </Boton>
            <div className="grid grid-cols-2 gap-2">
                <Boton onClick={copiarFicha} tono="neutro" icon={Copy}>
                    Ficha para Sarvo
                </Boton>
                <Boton onClick={() => onDescartar("No califica (revisado a mano)")} tono="neutro" icon={X}>
                    No califica
                </Boton>
            </div>
        </Tarjeta>
    );
}

function TarjetaContesto({ p, onEnviar, onFundador }: { p: Prospecto; onEnviar: (paso: PasoTurnos, texto: string) => void; onFundador: () => void }) {
    const pasos: PasoTurnos[] = ["link", "llamada", "precio", "referido", "no_interesa"];
    return (
        <Tarjeta p={p}>
            <p className="text-[11px] text-muted-foreground">
                Contestó {p.fecha_respuesta ? `el ${p.fecha_respuesta.split("-").reverse().slice(0, 2).join("/")}` : ""} · {SEGMENTO_LABELS[segmentoDe(p)]}
            </p>
            <div className="grid grid-cols-2 gap-2">
                {pasos.map((paso) => (
                    <Boton key={paso} onClick={() => onEnviar(paso, generarMensajeTurnos(paso, p))} tono={paso === "no_interesa" ? "neutro" : "personal"}>
                        <span className="text-[11px]">{PASO_TURNOS_LABELS[paso]}</span>
                    </Boton>
                ))}
                <Boton onClick={onFundador} tono="ok" icon={UserPlus}>
                    <span className="text-[11px]">Pasó a fundador</span>
                </Boton>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
                En la llamada: tres preguntas, su página con sus datos, la oferta entera, y el link puesto en ese momento en su
                mensaje de ausencia, su bio y su Maps.
            </p>
        </Tarjeta>
    );
}

function SeccionTraer({
    ocupado, sinEscanear, onTraer, onEscanear, onAlta,
}: {
    ocupado: boolean;
    sinEscanear: number;
    onTraer: (rubro: string, zona: string, limite: number) => void;
    onEscanear: () => void;
    onAlta: (d: { negocio: string; contacto: string; instagram: string; telefono: string; rubro: string; presentado: string }) => Promise<boolean>;
}) {
    const [rubro, setRubro] = useState(RUBROS_ACTIVOS[0].id);
    const [zona, setZona] = useState(ZONAS[0]);
    const [limite, setLimite] = useState(60);
    const vacio = { negocio: "", contacto: "", instagram: "", telefono: "", rubro: "nutricion", presentado: "" };
    const [alta, setAlta] = useState(vacio);
    const inputCls = "w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground";

    return (
        <section className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <p className="text-sm font-bold text-foreground">Traer negocios de Google Maps</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Busca, los carga al listado del rubro y los escanea solos: quién contesta, el nombre del profesional,
                    si publica precios, si ya usa otro sistema y la primera línea del mensaje. Después aparecen en &ldquo;Hoy&rdquo;.
                </p>
                <select value={rubro} onChange={(e) => setRubro(e.target.value)} className={inputCls}>
                    {RUBROS_ACTIVOS.map((r) => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                </select>
                <select value={zona} onChange={(e) => setZona(e.target.value)} className={inputCls}>
                    {ZONAS.map((z) => (
                        <option key={z} value={z}>{z}</option>
                    ))}
                </select>
                <select value={limite} onChange={(e) => setLimite(Number(e.target.value))} className={inputCls}>
                    <option value={40}>Hasta 40 (más rápido)</option>
                    <option value={60}>Hasta 60</option>
                    <option value={100}>Hasta 100</option>
                </select>
                <Boton onClick={() => onTraer(rubro, zona, limite)} tono="personal" icon={Search} disabled={ocupado}>
                    Buscar, cargar y escanear
                </Boton>
                <p className="text-[10px] text-muted-foreground">
                    Pilates, yoga, gimnasios, peluquerías y barberías no están: Sarvo no maneja clases con cupo, y las
                    peluquerías quedan fuera del plan.
                </p>
            </div>

            {sinEscanear > 0 && (
                <Boton onClick={onEscanear} tono="ok" icon={Sparkles} disabled={ocupado}>
                    Escanear los {sinEscanear} que faltan
                </Boton>
            )}

            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <p className="text-sm font-bold text-foreground">Cargar uno a mano</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Para los de Instagram que no están en Maps y para los que te pasa un conocido. Si alguien te lo
                    presentó, poné quién: el mensaje arranca con &ldquo;Me pasó tu contacto…&rdquo;.
                </p>
                <input value={alta.negocio} onChange={(e) => setAlta({ ...alta, negocio: e.target.value })} placeholder="Negocio o profesional *" className={inputCls} />
                <input value={alta.contacto} onChange={(e) => setAlta({ ...alta, contacto: e.target.value })} placeholder="Nombre del profesional" className={inputCls} />
                <input value={alta.instagram} onChange={(e) => setAlta({ ...alta, instagram: e.target.value })} placeholder="@instagram" className={inputCls} />
                <input value={alta.telefono} onChange={(e) => setAlta({ ...alta, telefono: e.target.value })} placeholder="WhatsApp (381…)" inputMode="tel" className={inputCls} />
                <select value={alta.rubro} onChange={(e) => setAlta({ ...alta, rubro: e.target.value })} className={inputCls}>
                    {RUBROS_ACTIVOS.map((r) => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                </select>
                <input value={alta.presentado} onChange={(e) => setAlta({ ...alta, presentado: e.target.value })} placeholder="Quién te lo presentó (opcional)" className={inputCls} />
                <Boton
                    onClick={async () => {
                        if (!alta.negocio.trim() || (!alta.instagram.trim() && !alta.telefono.trim())) {
                            toast.error("Hace falta el nombre y un WhatsApp o un Instagram");
                            return;
                        }
                        if (await onAlta(alta)) setAlta(vacio);
                    }}
                    tono="personal"
                    icon={UserPlus}
                >
                    Cargar
                </Boton>
            </div>
        </section>
    );
}
