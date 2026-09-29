"use client";

// ============================================================
// La prueba de la hora, desde el celular
// ============================================================
//
// La prueba era el paso que más se postergaba de todo Sarvo: abrir la ficha,
// copiar el número, pasarlo al WhatsApp del chip de paciente, escribir la
// consulta, volver, anotar la hora a mano. Por consultorio. Un sábado a la noche.
//
// Esta pantalla lo deja en un toque por consultorio, pensada para el celular:
//
//   1. Esta noche — cada consultorio tiene un botón que abre WhatsApp BUSINESS
//      (el chip de paciente) con la consulta ya escrita. La hora de envío se
//      guarda en el mismo toque.
//   2. Esperando — cuando contestan, "Contestó" guarda la hora. Viene cargada
//      con la hora actual y se corrige a la que figura en WhatsApp si hace falta.
//   3. Mensaje 1 — con la prueba cerrada, un botón abre el WhatsApp PERSONAL con
//      el mensaje 1 armado con la demora real, y lo marca como enviado.
//
// Las dos apps van por separado a propósito: la prueba desde el número propio
// quema el número y arruina la prueba en el mismo movimiento.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft, Moon, Clock, Send, CircleCheck, CircleSlash, MessageCircle, Undo2, Loader2, Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { cn, hoyISO } from "@/lib/utils";
import { prospectosStore, mensajeError } from "@/lib/store";
import type { Prospecto } from "@/lib/types";
import {
    consultaDePrueba, linkWhatsapp, frasePrueba, tienePrueba, vozDe, anguloSugerido, ANGULO_LABELS,
    pasoAperturaSugerido, generarMensajeOdontologia, minutosPrueba, type AppWhatsapp,
} from "@/lib/odontologia-mensajes";

type Pestania = "noche" | "esperando" | "listos";

/** Cuántos se muestran para esta noche. Más de veinte por noche con un chip nuevo es pedir un bloqueo. */
const TANDA = 20;

/** Ventana para deshacer un envío: alcanza para "toqué el que no era". */
const MINUTOS_DESHACER = 15;

const SIN_CONTACTAR = ["sin_calificar", "calificado"];

function horaCorta(iso: string): string {
    return new Date(iso).toLocaleString("es-AR", { weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

function hace(iso: string): string {
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 48) return `hace ${h} h${min % 60 ? ` ${min % 60} min` : ""}`;
    return `hace ${Math.floor(h / 24)} días`;
}

/** Valor para un input datetime-local, en la hora del teléfono. */
function aLocal(d: Date): string {
    const off = d.getTimezoneOffset() * 60_000;
    return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export default function PruebaHoraPage() {
    const [universo, setUniverso] = useState<Prospecto[]>([]);
    const [cargando, setCargando] = useState(true);
    const [esAndroid, setEsAndroid] = useState(false);
    const [pestania, setPestania] = useState<Pestania>("noche");
    const [verTodos, setVerTodos] = useState(false);
    const [respondiendo, setRespondiendo] = useState<string | null>(null);
    const [horaRespuesta, setHoraRespuesta] = useState("");
    // Para que "hace X min" avance solo sin recargar.
    const [, setTic] = useState(0);

    useEffect(() => {
        setEsAndroid(/android/i.test(navigator.userAgent));
        const t = setInterval(() => setTic((x) => x + 1), 60_000);
        return () => clearInterval(t);
    }, []);

    const cargar = useCallback(async () => {
        try {
            setUniverso(await prospectosStore.getAll());
        } catch (e) {
            toast.error(mensajeError(e));
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const consultorios = useMemo(() => universo.filter((p) => p.sistema === "odontologia"), [universo]);

    const paraEstaNoche = useMemo(
        () =>
            consultorios
                .filter((p) => SIN_CONTACTAR.includes(p.estado) && !p.prueba_enviada_at && p.telefono_wa)
                .sort((a, b) => b.score - a.score),
        [consultorios]
    );

    const esperando = useMemo(
        () =>
            consultorios
                .filter((p) => p.prueba_enviada_at && !p.prueba_respondida_at && !p.prueba_sin_respuesta)
                .sort((a, b) => (a.prueba_enviada_at! < b.prueba_enviada_at! ? -1 : 1)),
        [consultorios]
    );

    const listos = useMemo(
        () =>
            consultorios
                .filter((p) => tienePrueba(p) && SIN_CONTACTAR.includes(p.estado))
                // Primero los que más tardaron: son el mejor mensaje.
                .sort((a, b) => (minutosPrueba(b) ?? Infinity) - (minutosPrueba(a) ?? Infinity)),
        [consultorios]
    );

    // Arranca en la pestaña que tiene sentido para la hora del día: de noche se
    // manda la prueba, de día se cargan respuestas y sale el mensaje 1.
    useEffect(() => {
        if (cargando) return;
        const hora = new Date().getHours();
        if (hora >= 20 || hora < 2) setPestania("noche");
        else if (esperando.length > 0) setPestania("esperando");
        else if (listos.length > 0) setPestania("listos");
        // Solo al cargar: después manda el usuario.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargando]);

    const guardar = async (p: Prospecto, cambios: Partial<Prospecto>) => {
        // Optimista: en el celular, esperar la vuelta de la base entre consultorio
        // y consultorio es justo la fricción que esta pantalla viene a sacar.
        setUniverso((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...cambios } : x)));
        try {
            const actualizado = await prospectosStore.update(p.id, cambios, p, consultorios);
            setUniverso((prev) => prev.map((x) => (x.id === p.id ? actualizado : x)));
        } catch (e) {
            setUniverso((prev) => prev.map((x) => (x.id === p.id ? p : x)));
            toast.error(`No se guardó ${p.negocio}: ${mensajeError(e)}`);
        }
    };

    /**
     * Primero se abre WhatsApp y después se guarda. Al revés, el await deja
     * vencer el permiso del toque y Android bloquea la apertura de la app.
     */
    const abrir = (numero: string, texto: string, app: AppWhatsapp) => {
        window.location.href = linkWhatsapp(numero, texto, app, esAndroid);
    };

    const enviarPrueba = (p: Prospecto) => {
        abrir(p.telefono_wa, consultaDePrueba(p), "business");
        guardar(p, { prueba_enviada_at: new Date().toISOString() });
    };

    const deshacerEnvio = (p: Prospecto) => guardar(p, { prueba_enviada_at: null });

    const abrirRespuesta = (p: Prospecto) => {
        setRespondiendo(p.id);
        setHoraRespuesta(aLocal(new Date()));
    };

    const guardarRespuesta = (p: Prospecto) => {
        const cuando = new Date(horaRespuesta);
        if (Number.isNaN(cuando.getTime())) {
            toast.error("Poné la hora en que contestaron");
            return;
        }
        if (p.prueba_enviada_at && cuando < new Date(p.prueba_enviada_at)) {
            toast.error("La respuesta no puede ser anterior a la consulta");
            return;
        }
        setRespondiendo(null);
        guardar(p, { prueba_respondida_at: cuando.toISOString(), prueba_sin_respuesta: false });
        toast.success(`${p.negocio}: respuesta guardada`);
    };

    const noContesto = (p: Prospecto) => {
        guardar(p, { prueba_respondida_at: null, prueba_sin_respuesta: true });
        toast.success(`${p.negocio}: sin respuesta. Es el mejor caso para el mensaje 1.`);
    };

    const enviarMensaje1 = (p: Prospecto) => {
        const texto = generarMensajeOdontologia(pasoAperturaSugerido(p), p, vozDe(p));
        abrir(p.telefono_wa, texto, "personal");
        guardar(p, { estado: "enviado", fecha_envio: hoyISO(), mensaje_enviado: texto });
    };

    const hora = new Date().getHours();
    const deNoche = hora >= 20 || hora < 2;
    const visibles = verTodos ? paraEstaNoche : paraEstaNoche.slice(0, TANDA);
    const enviadasHoy = consultorios.filter(
        (p) => p.prueba_enviada_at && new Date(p.prueba_enviada_at).toLocaleDateString("en-CA") === hoyISO()
    ).length;

    return (
        <div className="max-w-2xl mx-auto space-y-4 pb-24">
            <div className="space-y-1">
                <Link href="/prospeccion" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="w-3.5 h-3.5" /> Prospección
                </Link>
                <h1 className="text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-sky-300" />
                    Prueba de la hora
                </h1>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Sarvo · consultorios. La consulta sale del chip de paciente (WhatsApp Business); el mensaje 1, de tu
                    WhatsApp personal.
                </p>
            </div>

            {!esAndroid && !cargando && (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-3 text-[11px] text-amber-200 leading-relaxed">
                    Estás en la compu: los botones abren WhatsApp Web y no se puede elegir entre Business y el personal.
                    Esta pantalla está pensada para usarla desde el celular.
                </p>
            )}

            {/* Pestañas */}
            <div className="grid grid-cols-3 gap-1.5">
                {([
                    ["noche", "Esta noche", paraEstaNoche.length, Moon],
                    ["esperando", "Esperando", esperando.length, Clock],
                    ["listos", "Mensaje 1", listos.length, Send],
                ] as const).map(([id, label, cant, Icon]) => (
                    <button
                        key={id}
                        onClick={() => setPestania(id)}
                        className={cn(
                            "flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-xl text-xs font-bold border transition-all",
                            pestania === id
                                ? "bg-primary text-primary-foreground border-primary shadow-md"
                                : "bg-card border-border text-muted-foreground"
                        )}
                    >
                        <span className="flex items-center gap-1.5">
                            <Icon className="w-3.5 h-3.5" /> {label}
                        </span>
                        <span className="text-base tabular-nums">{cant}</span>
                    </button>
                ))}
            </div>

            {cargando ? (
                <div className="flex justify-center py-16 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                </div>
            ) : pestania === "noche" ? (
                <section className="space-y-3">
                    <p className={cn("text-[11px] leading-relaxed", deNoche ? "text-sky-200/80" : "text-amber-200/90")}>
                        {deNoche
                            ? `Buen horario. Hoy van ${enviadasHoy}. Hasta ${TANDA} por noche con un chip nuevo: más que eso y WhatsApp lo puede bloquear.`
                            : `La prueba vale de noche (21 a 23 h), cuando nadie está atendiendo. Si la mandás ahora te contestan en horario y el dato no sirve.`}
                    </p>
                    {visibles.length === 0 && <Vacio texto="No quedan consultorios con WhatsApp sin probar." />}
                    {visibles.map((p) => (
                        <Tarjeta key={p.id} p={p}>
                            <p className="text-[11px] text-muted-foreground italic leading-relaxed">&ldquo;{consultaDePrueba(p)}&rdquo;</p>
                            <Boton onClick={() => enviarPrueba(p)} tono="business" icon={MessageCircle}>
                                Enviar consulta desde Business
                            </Boton>
                        </Tarjeta>
                    ))}
                    {!verTodos && paraEstaNoche.length > TANDA && (
                        <button onClick={() => setVerTodos(true)} className="w-full text-xs text-muted-foreground py-2">
                            Ver los {paraEstaNoche.length - TANDA} restantes
                        </button>
                    )}
                </section>
            ) : pestania === "esperando" ? (
                <section className="space-y-3">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Cuando contesten, tocá &ldquo;Contestó&rdquo;. Si lo cargás tarde, poné la hora que figura en WhatsApp.
                    </p>
                    {esperando.length === 0 && <Vacio texto="No hay consultas esperando respuesta." />}
                    {esperando.map((p) => {
                        const reciente = Date.now() - new Date(p.prueba_enviada_at!).getTime() < MINUTOS_DESHACER * 60_000;
                        return (
                            <Tarjeta key={p.id} p={p}>
                                <p className="text-[11px] text-sky-200/80">
                                    Enviada {horaCorta(p.prueba_enviada_at!)} · {hace(p.prueba_enviada_at!)}
                                </p>
                                {respondiendo === p.id ? (
                                    <div className="space-y-2">
                                        <input
                                            type="datetime-local"
                                            value={horaRespuesta}
                                            onChange={(e) => setHoraRespuesta(e.target.value)}
                                            className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground"
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                            <Boton onClick={() => setRespondiendo(null)} tono="neutro">Cancelar</Boton>
                                            <Boton onClick={() => guardarRespuesta(p)} tono="ok" icon={CircleCheck}>Guardar</Boton>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        <Boton onClick={() => abrirRespuesta(p)} tono="ok" icon={CircleCheck}>Contestó</Boton>
                                        <Boton onClick={() => noContesto(p)} tono="alerta" icon={CircleSlash}>No contestó</Boton>
                                        <Boton onClick={() => abrir(p.telefono_wa, "", "business")} tono="neutro" icon={MessageCircle}>
                                            Ver chat
                                        </Boton>
                                        {reciente && (
                                            <Boton onClick={() => deshacerEnvio(p)} tono="neutro" icon={Undo2}>Deshacer</Boton>
                                        )}
                                    </div>
                                )}
                            </Tarjeta>
                        );
                    })}
                </section>
            ) : (
                <section className="space-y-3">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Sale de tu WhatsApp personal con la demora real. Al tocar el botón queda marcado como enviado.
                    </p>
                    {listos.length === 0 && <Vacio texto="Todavía no hay pruebas cerradas. Cargá las respuestas en Esperando." />}
                    {listos.map((p) => {
                        const texto = generarMensajeOdontologia(pasoAperturaSugerido(p), p, vozDe(p));
                        return (
                            <Tarjeta key={p.id} p={p}>
                                <p className="text-xs text-foreground leading-relaxed">{frasePrueba(p, vozDe(p))}</p>
                                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                                    {ANGULO_LABELS[anguloSugerido(p)]}
                                </p>
                                <details className="text-[11px] text-muted-foreground">
                                    <summary className="cursor-pointer select-none">Ver el mensaje</summary>
                                    <p className="whitespace-pre-line mt-2 leading-relaxed text-foreground/90">{texto}</p>
                                </details>
                                <Boton onClick={() => enviarMensaje1(p)} tono="personal" icon={Send}>
                                    Enviar mensaje 1 desde mi WhatsApp
                                </Boton>
                            </Tarjeta>
                        );
                    })}
                </section>
            )}
        </div>
    );
}

function Tarjeta({ p, children }: { p: Prospecto; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    {/* line-clamp y no truncate: el nombre de Google puede ser una línea
                        de SEO entera, y un texto que no corta ensancha todo el layout
                        en el celular. */}
                    <p className="text-sm font-bold text-foreground line-clamp-2 [overflow-wrap:anywhere]">{p.negocio}</p>
                    <p className="text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
                        {[p.ciudad, p.telefono_wa ? `+${p.telefono_wa}` : ""].filter(Boolean).join(" · ")}
                    </p>
                </div>
                {p.score > 0 && (
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-secondary text-[10px] font-bold tabular-nums text-muted-foreground">
                        {p.score}
                    </span>
                )}
            </div>
            {children}
        </div>
    );
}

function Boton({
    onClick, tono, icon: Icon, children,
}: {
    onClick: () => void;
    tono: "business" | "personal" | "ok" | "alerta" | "neutro";
    icon?: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
}) {
    const tonos = {
        business: "bg-emerald-600 text-white border-emerald-500",
        personal: "bg-primary text-primary-foreground border-primary",
        ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
        alerta: "bg-amber-500/15 text-amber-300 border-amber-500/40",
        neutro: "bg-card text-muted-foreground border-border",
    };
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full min-h-[44px] px-3 py-2.5 rounded-xl text-sm font-bold border flex items-center justify-center gap-2 active:scale-[0.98] transition-transform",
                tonos[tono]
            )}
        >
            {Icon && <Icon className="w-4 h-4" />}
            {children}
        </button>
    );
}

function Vacio({ texto }: { texto: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 py-12 px-6 text-center">
            <p className="text-xs text-muted-foreground">{texto}</p>
        </div>
    );
}
