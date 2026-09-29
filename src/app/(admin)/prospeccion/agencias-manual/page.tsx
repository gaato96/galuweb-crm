"use client";

// ============================================================
// Agencias sin mail — lo que la rutina no puede hacer sola
// ============================================================
//
// La rutina diaria le escribe por mail a toda agencia que tenga mail y esté
// clasificada (lista A o B). Todo lo demás cae acá, ordenado por el canal que
// sí tiene, para escribirle a mano desde el celular con un toque:
//
//   · WhatsApp  — abre tu WhatsApp con el mensaje escrito y lo marca enviado.
//   · Instagram — copia el mensaje, abre el perfil y lo marca enviado.
//   · Sin canal — no hay por dónde. Si le encontrás el mail, cargalo acá con su
//                 lista y al día siguiente lo toma la rutina.
//   · Seguimientos — los que contactaste por WhatsApp o Instagram y ya les toca.
//
// En México los fijos y los celulares tienen el mismo formato, así que un número
// puede no tener WhatsApp: la app lo avisa al abrir el chat y se pasa al siguiente.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Instagram, Mail, Undo2, Loader2, Send, Clock, ExternalLink, Handshake } from "lucide-react";
import { toast } from "sonner";
import { cn, hoyISO } from "@/lib/utils";
import { prospectosStore, mensajeError } from "@/lib/store";
import type { Prospecto } from "@/lib/types";
import { proximaAccion } from "@/lib/prospeccion";
import { generarMensajeAgencia, nombreCorto, segmentoAgencia, SEGMENTO_AGENCIA_LABELS } from "@/lib/agencias-mensajes";
import { linkWhatsapp } from "@/lib/odontologia-mensajes";
import { Tarjeta, Boton, Vacio, Pestanias } from "@/components/prospeccion/celular";

type Pestania = "whatsapp" | "instagram" | "sin_canal" | "seguimientos";

const SIN_CONTACTAR = ["sin_calificar", "calificado"];
const MINUTOS_DESHACER = 15;

/** Lista A primero (es la que valida el carril), después B, después sin verificar. */
function ordenSegmento(p: Prospecto): number {
    return p.ofrece_desarrollo_web === false ? 0 : p.ofrece_desarrollo_web === true ? 1 : 2;
}

export default function AgenciasManualPage() {
    const [universo, setUniverso] = useState<Prospecto[]>([]);
    const [cargando, setCargando] = useState(true);
    const [esAndroid, setEsAndroid] = useState(false);
    const [pestania, setPestania] = useState<Pestania>("whatsapp");
    const [mails, setMails] = useState<Record<string, string>>({});

    useEffect(() => {
        setEsAndroid(/android/i.test(navigator.userAgent));
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

    const agencias = useMemo(() => universo.filter((p) => p.sistema === "agencias"), [universo]);

    const sinMail = useMemo(
        () =>
            agencias
                .filter((p) => SIN_CONTACTAR.includes(p.estado) && !p.email.trim())
                .sort((a, b) => ordenSegmento(a) - ordenSegmento(b) || b.score - a.score),
        [agencias]
    );

    const porWhatsapp = sinMail.filter((p) => p.telefono_wa);
    const porInstagram = sinMail.filter((p) => !p.telefono_wa && p.instagram_url.trim());
    const sinCanal = sinMail.filter((p) => !p.telefono_wa && !p.instagram_url.trim());

    // Los seguimientos por mail los manda la rutina; acá solo los que salieron a mano.
    const seguimientos = useMemo(
        () =>
            agencias
                .filter((p) => !p.email.trim() && ["enviado", "fu1"].includes(p.estado))
                .map((p) => ({ p, accion: proximaAccion(p) }))
                .filter((x) => x.accion?.vencido && (x.accion.paso === "fu1" || x.accion.paso === "fu2")),
        [agencias]
    );

    const guardar = async (p: Prospecto, cambios: Partial<Prospecto>) => {
        setUniverso((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...cambios } : x)));
        try {
            const actualizado = await prospectosStore.update(p.id, cambios, p, agencias);
            setUniverso((prev) => prev.map((x) => (x.id === p.id ? actualizado : x)));
        } catch (e) {
            setUniverso((prev) => prev.map((x) => (x.id === p.id ? p : x)));
            toast.error(`No se guardó ${p.negocio}: ${mensajeError(e)}`);
        }
    };

    // El mensaje por DM es el corto: el de mail no entra en una previsualización.
    const mensaje1 = (p: Prospecto) => generarMensajeAgencia("m1", p, "instagram");

    /** Primero se abre la app y después se guarda: al revés, Android bloquea la apertura. */
    const porWhatsappEnviar = (p: Prospecto) => {
        const texto = mensaje1(p);
        window.location.href = linkWhatsapp(p.telefono_wa, texto, "personal", esAndroid);
        guardar(p, { estado: "enviado", fecha_envio: hoyISO(), mensaje_enviado: texto, canal: "whatsapp" });
    };

    const porInstagramEnviar = (p: Prospecto) => {
        const texto = mensaje1(p);
        navigator.clipboard.writeText(texto).catch(() => {});
        toast.success("Mensaje copiado: pegalo en el DM");
        window.open(p.instagram_url.startsWith("http") ? p.instagram_url : `https://${p.instagram_url}`, "_blank", "noopener,noreferrer");
        guardar(p, { estado: "enviado", fecha_envio: hoyISO(), mensaje_enviado: texto, canal: "instagram" });
    };

    const enviarSeguimiento = (p: Prospecto, paso: "fu1" | "fu2") => {
        const texto = generarMensajeAgencia(paso, p);
        const cambios: Partial<Prospecto> = paso === "fu1" ? { estado: "fu1", fecha_fu1: hoyISO() } : { estado: "fu2", fecha_fu2: hoyISO() };
        if (p.canal === "whatsapp" && p.telefono_wa) {
            window.location.href = linkWhatsapp(p.telefono_wa, texto, "personal", esAndroid);
        } else if (p.instagram_url) {
            navigator.clipboard.writeText(texto).catch(() => {});
            toast.success("Seguimiento copiado: pegalo en el DM");
            window.open(p.instagram_url.startsWith("http") ? p.instagram_url : `https://${p.instagram_url}`, "_blank", "noopener,noreferrer");
        }
        guardar(p, cambios);
    };

    /** Deshacer: vuelve a "sin contactar" si se tocó el botón y no se mandó. */
    const deshacer = (p: Prospecto) =>
        guardar(p, { estado: "sin_calificar", fecha_envio: null, mensaje_enviado: "" } as Partial<Prospecto>);

    const cambiarSegmento = (p: Prospecto, valor: boolean | null) => guardar(p, { ofrece_desarrollo_web: valor });

    const guardarMail = (p: Prospecto) => {
        const mail = (mails[p.id] || "").trim().toLowerCase();
        if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/.test(mail)) {
            toast.error("Ese mail no tiene formato válido");
            return;
        }
        guardar(p, { email: mail });
        setMails((m) => ({ ...m, [p.id]: "" }));
        toast.success(
            p.ofrece_desarrollo_web == null
                ? `Mail guardado. Elegí si es lista A o B para que la rutina lo tome.`
                : `Mail guardado. La rutina le escribe en la próxima tanda.`
        );
    };

    // Recién enviados: se ven 15 minutos más con "Deshacer".
    const recientes = agencias.filter(
        (p) =>
            p.estado === "enviado" &&
            !p.email.trim() &&
            p.fecha_envio === hoyISO() &&
            Date.now() - new Date(p.updated_at || 0).getTime() < MINUTOS_DESHACER * 60_000
    );

    const Segmento = ({ p }: { p: Prospecto }) => (
        <div className="space-y-1">
            <div className="grid grid-cols-3 gap-1">
                {([
                    [false, "Lista A"],
                    [true, "Lista B"],
                    [null, "Sin verificar"],
                ] as const).map(([valor, label]) => (
                    <button
                        key={label}
                        onClick={() => cambiarSegmento(p, valor)}
                        className={cn(
                            "px-2 py-1.5 rounded-lg text-[11px] font-bold border",
                            p.ofrece_desarrollo_web === valor
                                ? "bg-secondary text-foreground border-primary/50"
                                : "bg-card text-muted-foreground border-border"
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <p className="text-[10px] text-muted-foreground">{SEGMENTO_AGENCIA_LABELS[segmentoAgencia(p)]}</p>
        </div>
    );

    const VerWeb = ({ p }: { p: Prospecto }) =>
        p.sitio_web_url ? (
            <a
                href={p.sitio_web_url.startsWith("http") ? p.sitio_web_url : `https://${p.sitio_web_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-sky-300 [overflow-wrap:anywhere]"
            >
                <ExternalLink className="w-3 h-3 shrink-0" /> {p.sitio_web_url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
            </a>
        ) : null;

    const VerMensaje = ({ texto }: { texto: string }) => (
        <details className="text-[11px] text-muted-foreground">
            <summary className="cursor-pointer select-none">Ver el mensaje</summary>
            <p className="whitespace-pre-line mt-2 leading-relaxed text-foreground/90">{texto}</p>
        </details>
    );

    return (
        <div className="max-w-2xl mx-auto space-y-4 pb-24">
            <div className="space-y-1">
                <Link href="/prospeccion" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="w-3.5 h-3.5" /> Prospección
                </Link>
                <h1 className="text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
                    <Handshake className="w-5 h-5 text-emerald-300" />
                    Agencias sin mail
                </h1>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Las que tienen mail las escribe la rutina de las 15 h. Estas no: van por WhatsApp o Instagram, desde tu
                    celular. Primero la lista A.
                </p>
            </div>

            <Pestanias
                valor={pestania}
                onCambio={setPestania}
                opciones={[
                    { id: "whatsapp", label: "WhatsApp", cant: porWhatsapp.length, icon: MessageCircle },
                    { id: "instagram", label: "Instagram", cant: porInstagram.length, icon: Instagram },
                    { id: "sin_canal", label: "Sin canal", cant: sinCanal.length, icon: Mail },
                    { id: "seguimientos", label: "Seguir", cant: seguimientos.length, icon: Clock },
                ]}
            />

            {recientes.length > 0 && (
                <div className="rounded-xl border border-border bg-card/60 p-3 space-y-2">
                    <p className="text-[11px] text-muted-foreground">Recién marcados como enviados:</p>
                    {recientes.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2">
                            <span className="text-xs text-foreground [overflow-wrap:anywhere]">{nombreCorto(p.negocio)}</span>
                            <button onClick={() => deshacer(p)} className="shrink-0 inline-flex items-center gap-1 text-[11px] text-amber-300">
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
            ) : pestania === "whatsapp" ? (
                <section className="space-y-3">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Sale de tu WhatsApp personal. Si WhatsApp dice que el número no tiene cuenta, es un fijo: tocá
                        &ldquo;Deshacer&rdquo; y probá por Instagram si tiene.
                    </p>
                    {porWhatsapp.length === 0 && <Vacio texto="No hay agencias sin mail con teléfono." />}
                    {porWhatsapp.map((p) => (
                        <Tarjeta key={p.id} p={p}>
                            <VerWeb p={p} />
                            <Segmento p={p} />
                            <VerMensaje texto={mensaje1(p)} />
                            <Boton onClick={() => porWhatsappEnviar(p)} tono="personal" icon={MessageCircle}>
                                Escribir por WhatsApp
                            </Boton>
                        </Tarjeta>
                    ))}
                </section>
            ) : pestania === "instagram" ? (
                <section className="space-y-3">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Copia el mensaje y abre el perfil: tocá &ldquo;Mensaje&rdquo;, pegá y enviá. Ojo: el DM de una agencia
                        suele leerlo el community manager, no quien decide.
                    </p>
                    {porInstagram.length === 0 && <Vacio texto="No hay agencias sin mail que solo tengan Instagram." />}
                    {porInstagram.map((p) => (
                        <Tarjeta key={p.id} p={p}>
                            <VerWeb p={p} />
                            <Segmento p={p} />
                            <VerMensaje texto={mensaje1(p)} />
                            <Boton onClick={() => porInstagramEnviar(p)} tono="instagram" icon={Instagram}>
                                Copiar y abrir Instagram
                            </Boton>
                        </Tarjeta>
                    ))}
                </section>
            ) : pestania === "sin_canal" ? (
                <section className="space-y-3">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Sin mail, teléfono ni Instagram cargados. Si les encontrás el mail (LinkedIn, formulario, Google),
                        cargalo acá y elegí la lista: al día siguiente le escribe la rutina.
                    </p>
                    {sinCanal.length === 0 && <Vacio texto="No hay agencias sin ningún canal." />}
                    {sinCanal.map((p) => (
                        <Tarjeta key={p.id} p={p}>
                            <VerWeb p={p} />
                            {p.linkedin_url && (
                                <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-sky-300">
                                    <ExternalLink className="w-3 h-3" /> LinkedIn
                                </a>
                            )}
                            <Segmento p={p} />
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    inputMode="email"
                                    placeholder="mail@agencia.com"
                                    value={mails[p.id] || ""}
                                    onChange={(e) => setMails((m) => ({ ...m, [p.id]: e.target.value }))}
                                    className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground"
                                />
                                <button
                                    onClick={() => guardarMail(p)}
                                    className="shrink-0 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-bold"
                                >
                                    Guardar
                                </button>
                            </div>
                        </Tarjeta>
                    ))}
                </section>
            ) : (
                <section className="space-y-3">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Los que contactaste por WhatsApp o Instagram y ya les toca el seguimiento. Los de mail los manda la
                        rutina.
                    </p>
                    {seguimientos.length === 0 && <Vacio texto="No hay seguimientos manuales vencidos." />}
                    {seguimientos.map(({ p, accion }) => {
                        const paso = accion!.paso as "fu1" | "fu2";
                        return (
                            <Tarjeta key={p.id} p={p}>
                                <p className="text-[11px] text-sky-200/80">
                                    {paso === "fu1" ? "Seguimiento 1" : "Seguimiento 2 (el último)"} · por{" "}
                                    {p.canal === "whatsapp" ? "WhatsApp" : "Instagram"} · hace {accion!.dias} días
                                </p>
                                <VerMensaje texto={generarMensajeAgencia(paso, p)} />
                                <Boton
                                    onClick={() => enviarSeguimiento(p, paso)}
                                    tono={p.canal === "whatsapp" ? "personal" : "instagram"}
                                    icon={Send}
                                >
                                    Enviar seguimiento
                                </Boton>
                            </Tarjeta>
                        );
                    })}
                </section>
            )}
        </div>
    );
}
