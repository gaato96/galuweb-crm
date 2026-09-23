// ============================================================
// Gestión de proyectos de clientes — lógica pura (sin Supabase)
// ============================================================
// Plazos, plan de cobro, checklist por fase y brief. Vive acá y no en la UI
// para que el panel, el portal y las rutas de IA calculen exactamente lo mismo.

import type {
    BriefPregunta, BriefProyecto, BriefSeccion, Cliente, FaseProyecto, Finanza,
    Proyecto, Tarea, TipoPreguntaBrief, TipoProyecto, TareaPlantilla,
    CategoriaTarea, Prioridad,
} from "./types";
import { FASES_POR_TIPO, TIPO_PROYECTO_LABELS } from "./types";

// ─────────────────────────────────────────────────────────────
// Fechas (siempre YYYY-MM-DD en hora local)
// ─────────────────────────────────────────────────────────────

export function aISO(d: Date): string {
    return d.toLocaleDateString("en-CA");
}

function parseFecha(iso: string): Date {
    return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
}

export function sumarDias(iso: string, dias: number): string {
    const d = parseFecha(iso);
    d.setDate(d.getDate() + dias);
    return aISO(d);
}

export function sumarMeses(iso: string, meses: number): string {
    const d = parseFecha(iso);
    const dia = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + meses);
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(dia, ultimo));
    return aISO(d);
}

/** Días de `desde` a `hasta` (positivo si hasta es posterior). */
export function diasEntre(desde: string, hasta: string): number {
    return Math.round((parseFecha(hasta).getTime() - parseFecha(desde).getTime()) / 86_400_000);
}

export function fechaCorta(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(parseFecha(iso));
}

// ─────────────────────────────────────────────────────────────
// Fases y plazos
// ─────────────────────────────────────────────────────────────

export function configDeFase(tipo: TipoProyecto, nombre: string) {
    return (FASES_POR_TIPO[tipo] || []).find((f) => f.nombre === nombre) || null;
}

/**
 * Reparte el tiempo entre inicio y entrega según el peso típico de cada fase.
 * Las fases ya completadas conservan su fecha.
 */
export function distribuirPlazos(
    fases: FaseProyecto[],
    tipo: TipoProyecto,
    inicio: string,
    entrega: string
): FaseProyecto[] {
    const total = Math.max(diasEntre(inicio, entrega), fases.length);
    const pesos = fases.map((f) => configDeFase(tipo, f.nombre)?.dias ?? 4);
    const suma = pesos.reduce((a, b) => a + b, 0) || 1;
    let acumulado = 0;
    return fases.map((f, i) => {
        acumulado += pesos[i];
        if (f.completada) return f;
        const offset = i === fases.length - 1 ? total : Math.round((total * acumulado) / suma);
        return { ...f, fecha_limite: sumarDias(inicio, offset) };
    });
}

export function fasesIniciales(tipo: TipoProyecto, inicio?: string | null, entrega?: string | null): FaseProyecto[] {
    const fases: FaseProyecto[] = (FASES_POR_TIPO[tipo] || []).map((c) => ({ nombre: c.nombre, completada: false }));
    if (inicio && entrega && diasEntre(inicio, entrega) > 0) return distribuirPlazos(fases, tipo, inicio, entrega);
    return fases;
}

export function tareasPlantillaDeFase(tipo: TipoProyecto, faseNombre: string): TareaPlantilla[] {
    return configDeFase(tipo, faseNombre)?.tareas || [];
}

const normalizarTitulo = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Tareas listas para insertar en una fase, salteando las que ya existen con el mismo título. */
export function tareasParaFase(
    proyectoId: string,
    fase: FaseProyecto,
    plantillas: TareaPlantilla[],
    existentes: Tarea[]
): Omit<Tarea, "id" | "created_at">[] {
    const ya = new Set(existentes.map((t) => normalizarTitulo(t.titulo)));
    return plantillas
        .filter((p) => !ya.has(normalizarTitulo(p.titulo)))
        .map((p) => ({
            proyecto_id: proyectoId,
            titulo: p.titulo,
            descripcion: p.descripcion || "",
            prioridad: p.prioridad,
            estado: "pendiente" as const,
            categoria: p.categoria,
            fase: fase.nombre,
            ...(fase.fecha_limite ? { fecha_vencimiento: fase.fecha_limite } : {}),
        }));
}

// ─────────────────────────────────────────────────────────────
// Plazo general del proyecto
// ─────────────────────────────────────────────────────────────

export type EstadoPlazo = "sin_fecha" | "en_tiempo" | "ajustado" | "atrasado" | "vencido" | "entregado";

export const ESTADO_PLAZO_COLORS: Record<EstadoPlazo, string> = {
    sin_fecha: "text-slate-300 border-slate-500/30 bg-slate-500/10",
    en_tiempo: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
    ajustado: "text-amber-300 border-amber-500/30 bg-amber-500/10",
    atrasado: "text-orange-300 border-orange-500/30 bg-orange-500/10",
    vencido: "text-rose-300 border-rose-500/30 bg-rose-500/10",
    entregado: "text-cyan-300 border-cyan-500/30 bg-cyan-500/10",
};

export interface InfoPlazo {
    estado: EstadoPlazo;
    diasRestantes: number | null;
    diasTotales: number | null;
    pctTiempo: number | null;
    texto: string;
}

export function infoPlazo(proyecto: Proyecto, progreso: number, hoy: string = aISO(new Date())): InfoPlazo {
    if (proyecto.estado === "finalizado" || progreso >= 100) {
        return { estado: "entregado", diasRestantes: null, diasTotales: null, pctTiempo: null, texto: "Proyecto entregado" };
    }
    if (!proyecto.fecha_entrega) {
        return { estado: "sin_fecha", diasRestantes: null, diasTotales: null, pctTiempo: null, texto: "Sin fecha de entrega" };
    }
    const inicio = proyecto.fecha_inicio || proyecto.created_at?.slice(0, 10) || hoy;
    const diasTotales = Math.max(diasEntre(inicio, proyecto.fecha_entrega), 1);
    const diasRestantes = diasEntre(hoy, proyecto.fecha_entrega);
    const pctTiempo = Math.min(100, Math.max(0, Math.round(((diasTotales - diasRestantes) / diasTotales) * 100)));

    let estado: EstadoPlazo;
    if (diasRestantes < 0) estado = "vencido";
    else if (pctTiempo - progreso > 25) estado = "atrasado";
    else if (diasRestantes <= 3 || pctTiempo - progreso > 10) estado = "ajustado";
    else estado = "en_tiempo";

    const texto =
        diasRestantes < 0 ? `Vencido hace ${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) === 1 ? "" : "s"}`
            : diasRestantes === 0 ? "Se entrega hoy"
                : `Faltan ${diasRestantes} día${diasRestantes === 1 ? "" : "s"}`;

    return { estado, diasRestantes, diasTotales, pctTiempo, texto };
}

export function textoDiasFase(fase: FaseProyecto, hoy: string = aISO(new Date())): { texto: string; vencida: boolean } | null {
    if (!fase.fecha_limite || fase.completada) return null;
    const d = diasEntre(hoy, fase.fecha_limite);
    if (d < 0) return { texto: `vencida hace ${Math.abs(d)}d`, vencida: true };
    if (d === 0) return { texto: "vence hoy", vencida: false };
    return { texto: `${d}d restantes`, vencida: false };
}

// ─────────────────────────────────────────────────────────────
// Plan de cobro → filas de Finanzas
// ─────────────────────────────────────────────────────────────

export interface PlanCobroInput {
    proyectoId: string;
    nombreProyecto: string;
    monto: number;
    anticipoPct: number;      // 0-100
    cuotas: number;           // cuotas del saldo (≥1)
    fechaPrimerCobro: string; // YYYY-MM-DD
    anticipoCobrado: boolean;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export function generarPlanCobro(input: PlanCobroInput): Omit<Finanza, "id" | "created_at">[] {
    const { proyectoId, nombreProyecto, monto, fechaPrimerCobro } = input;
    if (!monto || monto <= 0) return [];
    const pct = Math.min(100, Math.max(0, input.anticipoPct || 0));
    const cuotas = Math.max(1, Math.floor(input.cuotas || 1));
    const anticipo = pct > 0 ? redondear((monto * pct) / 100) : 0;
    const saldo = redondear(monto - anticipo);
    const grupo = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `g_${Date.now()}`;

    const pagos: { monto: number; etiqueta: string; fecha: string }[] = [];
    if (anticipo > 0) pagos.push({ monto: anticipo, etiqueta: `Anticipo ${pct}%`, fecha: fechaPrimerCobro });
    if (saldo > 0) {
        const base = redondear(saldo / cuotas);
        for (let i = 0; i < cuotas; i++) {
            const m = i === cuotas - 1 ? redondear(saldo - base * (cuotas - 1)) : base;
            const etiqueta = anticipo > 0
                ? (cuotas === 1 ? "Saldo final" : `Saldo cuota ${i + 1}/${cuotas}`)
                : (cuotas === 1 ? "Pago único" : `Cuota ${i + 1}/${cuotas}`);
            const fecha = sumarMeses(fechaPrimerCobro, anticipo > 0 ? i + 1 : i);
            pagos.push({ monto: m, etiqueta, fecha });
        }
    }

    return pagos.map((p, i) => {
        const cobrado = i === 0 && input.anticipoCobrado;
        return {
            proyecto_id: proyectoId,
            monto: p.monto,
            tipo: "ingreso" as const,
            descripcion: `${nombreProyecto} — ${p.etiqueta}`,
            cuotas_totales: pagos.length,
            cuota_actual: i + 1,
            fecha_cobro: p.fecha,
            cobrado,
            fecha_cobrado: cobrado ? p.fecha : null,
            es_recurrente: false,
            grupo_cuota: pagos.length > 1 ? grupo : null,
        };
    });
}

export interface ResumenCobros {
    total: number;
    planificado: number;
    cobrado: number;
    pendiente: number;
    sinPlanificar: number;
    pctCobrado: number;
    proximo: Finanza | null;
    vencidos: Finanza[];
}

export function resumenCobros(finanzas: Finanza[], montoTotal: number, hoy: string = aISO(new Date())): ResumenCobros {
    const ingresos = finanzas.filter((f) => f.tipo === "ingreso");
    const planificado = redondear(ingresos.reduce((s, f) => s + Number(f.monto), 0));
    const cobrado = redondear(ingresos.filter((f) => f.cobrado ?? true).reduce((s, f) => s + Number(f.monto), 0));
    const pendientes = ingresos.filter((f) => !(f.cobrado ?? true)).sort((a, b) => a.fecha_cobro.localeCompare(b.fecha_cobro));
    const total = Math.max(Number(montoTotal) || 0, planificado);
    return {
        total,
        planificado,
        cobrado,
        pendiente: redondear(planificado - cobrado),
        sinPlanificar: redondear(Math.max(0, (Number(montoTotal) || 0) - planificado)),
        pctCobrado: total > 0 ? Math.round((cobrado / total) * 100) : 0,
        proximo: pendientes[0] || null,
        vencidos: pendientes.filter((f) => f.fecha_cobro < hoy),
    };
}

// ─────────────────────────────────────────────────────────────
// Brief
// ─────────────────────────────────────────────────────────────

export function nuevoId(prefijo = "id"): string {
    return `${prefijo}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const p = (pregunta: string, tipo: TipoPreguntaBrief = "parrafo", extra: Partial<BriefPregunta> = {}): BriefPregunta =>
    ({ id: nuevoId("q"), pregunta, tipo, ...extra });

/** Brief base por tipo de proyecto. Es el punto de partida cuando no se usa IA. */
export function briefPlantilla(tipo: TipoProyecto): BriefProyecto {
    const secciones: BriefSeccion[] = [
        {
            id: nuevoId("s"), titulo: "Tu negocio", descripcion: "Contanos quiénes son y qué hacen.",
            preguntas: [
                p("¿A qué se dedica tu negocio y qué lo hace distinto?", "parrafo", { requerida: true }),
                p("¿Hace cuánto están en el mercado y dónde trabajan?", "texto"),
                p("¿Quiénes son tus principales competidores?", "parrafo", { ayuda: "Nombres o links." }),
            ],
        },
        {
            id: nuevoId("s"), titulo: "Objetivos", descripcion: "Qué tiene que lograr este proyecto.",
            preguntas: [
                p("¿Cuál es el objetivo principal?", "opcion", {
                    requerida: true,
                    opciones: ["Conseguir más consultas", "Vender online", "Mostrar profesionalismo / marca", "Tomar turnos o reservas", "Otro"],
                }),
                p("¿Qué acción querés que haga el visitante?", "texto", { ayuda: "Ej: escribir por WhatsApp, reservar, comprar." }),
                p("¿Cómo vas a medir que el proyecto funcionó?", "parrafo"),
            ],
        },
        {
            id: nuevoId("s"), titulo: "Tu cliente ideal",
            preguntas: [
                p("¿Quién es tu cliente ideal? (edad, zona, intereses)", "parrafo", { requerida: true }),
                p("¿Qué problema le resolvés?", "parrafo"),
                p("¿Qué dudas u objeciones suelen tener antes de comprarte?", "parrafo"),
            ],
        },
        {
            id: nuevoId("s"), titulo: "Marca y diseño",
            preguntas: [
                p("Subí tu logo y manual de marca (si tenés)", "archivo"),
                p("¿Qué colores y estilo te representan?", "texto"),
                p("¿Cómo querés que se sienta la marca?", "multiple", {
                    opciones: ["Moderna", "Elegante", "Cercana", "Profesional", "Divertida", "Minimalista", "Premium"],
                }),
                p("Pasanos 2 o 3 sitios que te gusten y por qué", "parrafo"),
            ],
        },
        {
            id: nuevoId("s"), titulo: "Contenido",
            preguntas: [
                p("¿Qué secciones o páginas imaginás?", "parrafo"),
                p("¿Tenés los textos listos?", "opcion", { opciones: ["Sí, los tengo", "Tengo una parte", "No, necesito ayuda"] }),
                p("Subí fotos, videos o material que quieras usar", "archivo"),
                p("¿Cuáles son tus redes sociales y datos de contacto?", "parrafo"),
            ],
        },
    ];

    if (tipo === "ecommerce") {
        secciones.push({
            id: nuevoId("s"), titulo: "Tienda",
            preguntas: [
                p("¿Cuántos productos vas a vender y en cuántas categorías?", "texto", { requerida: true }),
                p("¿Qué medios de pago querés ofrecer?", "multiple", { opciones: ["Mercado Pago", "Transferencia", "Efectivo", "Tarjeta (Stripe)", "Otro"] }),
                p("¿Cómo hacés los envíos?", "parrafo"),
                p("Subí la planilla de productos (si la tenés)", "archivo"),
            ],
        });
    }
    if (tipo === "webapp" || tipo === "saas") {
        secciones.push({
            id: nuevoId("s"), titulo: "Sistema",
            preguntas: [
                p("¿Qué tareas debería resolver el sistema? Contanos el proceso actual", "parrafo", { requerida: true }),
                p("¿Qué tipos de usuario lo van a usar y qué puede hacer cada uno?", "parrafo"),
                p("¿Necesita integrarse con algo? (pagos, facturación, WhatsApp, planillas)", "parrafo"),
                p("¿Cuántos usuarios estimás al principio?", "texto"),
            ],
        });
    }

    secciones.push({
        id: nuevoId("s"), titulo: "Extras",
        preguntas: [
            p("¿Ya tenés dominio y hosting?", "opcion", { opciones: ["Sí, tengo los dos", "Solo dominio", "No tengo", "No sé"] }),
            p("¿Hay alguna fecha importante para el lanzamiento?", "texto"),
            p("¿Algo más que debamos saber?", "parrafo"),
        ],
    });

    return {
        estado: "borrador",
        intro: `¡Hola! Este formulario nos ayuda a entender tu proyecto (${TIPO_PROYECTO_LABELS[tipo]}) antes de empezar. Podés completarlo en varias veces: se guarda solo.`,
        secciones,
        generado_con_ia: false,
        actualizado_at: new Date().toISOString(),
        completado_at: null,
    };
}

const TIPOS_PREGUNTA: TipoPreguntaBrief[] = ["texto", "parrafo", "opcion", "multiple", "archivo"];

/** Normaliza un brief que viene de la IA (o de la base) para que la UI nunca rompa. */
export function normalizarBrief(raw: unknown, base?: Partial<BriefProyecto>): BriefProyecto {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const seccionesRaw = Array.isArray(r.secciones) ? r.secciones : [];
    const secciones: BriefSeccion[] = seccionesRaw
        .map((s): BriefSeccion | null => {
            const so = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
            const preguntas = (Array.isArray(so.preguntas) ? so.preguntas : [])
                .map((q): BriefPregunta | null => {
                    const qo = (q && typeof q === "object" ? q : {}) as Record<string, unknown>;
                    const texto = String(qo.pregunta || "").trim();
                    if (!texto) return null;
                    const tipo = TIPOS_PREGUNTA.includes(qo.tipo as TipoPreguntaBrief) ? (qo.tipo as TipoPreguntaBrief) : "parrafo";
                    const opciones = Array.isArray(qo.opciones) ? qo.opciones.map(String).filter(Boolean) : undefined;
                    const final: TipoPreguntaBrief = (tipo === "opcion" || tipo === "multiple") && (!opciones || opciones.length < 2) ? "parrafo" : tipo;
                    return {
                        id: typeof qo.id === "string" && qo.id ? qo.id : nuevoId("q"),
                        pregunta: texto,
                        tipo: final,
                        ...(qo.ayuda ? { ayuda: String(qo.ayuda) } : {}),
                        ...(final === "opcion" || final === "multiple" ? { opciones } : {}),
                        ...(qo.requerida ? { requerida: true } : {}),
                        ...(qo.respuesta !== undefined ? { respuesta: qo.respuesta as string | string[] } : {}),
                    };
                })
                .filter((q): q is BriefPregunta => q !== null);
            const titulo = String(so.titulo || "").trim();
            if (!titulo || preguntas.length === 0) return null;
            return {
                id: typeof so.id === "string" && so.id ? so.id : nuevoId("s"),
                titulo,
                ...(so.descripcion ? { descripcion: String(so.descripcion) } : {}),
                preguntas,
            };
        })
        .filter((s): s is BriefSeccion => s !== null);

    return {
        ...base,
        estado: (["borrador", "enviado", "completado"] as const).includes(r.estado as never) ? (r.estado as BriefProyecto["estado"]) : "borrador",
        intro: typeof r.intro === "string" ? r.intro : base?.intro,
        secciones,
        generado_con_ia: Boolean(r.generado_con_ia ?? base?.generado_con_ia),
        actualizado_at: typeof r.actualizado_at === "string" ? r.actualizado_at : new Date().toISOString(),
        completado_at: typeof r.completado_at === "string" ? r.completado_at : null,
    };
}

export function tieneRespuesta(q: BriefPregunta): boolean {
    if (Array.isArray(q.respuesta)) return q.respuesta.length > 0;
    return Boolean(q.respuesta && String(q.respuesta).trim());
}

export function progresoBrief(brief: BriefProyecto | null | undefined) {
    const preguntas = (brief?.secciones || []).flatMap((s) => s.preguntas);
    const respondidas = preguntas.filter(tieneRespuesta).length;
    const faltanRequeridas = preguntas.filter((q) => q.requerida && !tieneRespuesta(q));
    return {
        total: preguntas.length,
        respondidas,
        pct: preguntas.length ? Math.round((respondidas / preguntas.length) * 100) : 0,
        faltanRequeridas,
    };
}

function respuestaMarkdown(q: BriefPregunta): string {
    if (!tieneRespuesta(q)) return "_Sin respuesta_";
    if (q.tipo === "archivo") {
        const urls = Array.isArray(q.respuesta) ? q.respuesta : [String(q.respuesta)];
        return urls.map((u, i) => `- [Archivo ${i + 1}](${u})`).join("\n");
    }
    if (Array.isArray(q.respuesta)) return q.respuesta.map((r) => `- ${r}`).join("\n");
    return String(q.respuesta).trim();
}

/** Brief respondido → .md listo para usar como contexto de desarrollo. */
export function briefAMarkdown(brief: BriefProyecto, proyecto: Proyecto, cliente: Cliente | null): string {
    const lineas: string[] = [
        `# Brief — ${proyecto.nombre}`,
        "",
        `- **Cliente:** ${cliente ? `${cliente.nombre}${cliente.negocio ? ` (${cliente.negocio})` : ""}` : "Interno"}`,
        `- **Tipo de proyecto:** ${TIPO_PROYECTO_LABELS[proyecto.tipo_proyecto]}`,
        ...(proyecto.fecha_entrega ? [`- **Entrega:** ${proyecto.fecha_entrega}`] : []),
        `- **Estado del brief:** ${brief.estado}${brief.completado_at ? ` (completado el ${brief.completado_at.slice(0, 10)})` : ""}`,
        "",
    ];
    if (proyecto.descripcion) lineas.push("## Descripción del proyecto", "", proyecto.descripcion, "");
    for (const s of brief.secciones) {
        lineas.push(`## ${s.titulo}`, "");
        for (const q of s.preguntas) {
            lineas.push(`### ${q.pregunta}`, "", respuestaMarkdown(q), "");
        }
    }
    return lineas.join("\n").trim() + "\n";
}

// ─────────────────────────────────────────────────────────────
// Tareas sugeridas por IA → normalización
// ─────────────────────────────────────────────────────────────

const CATEGORIAS: CategoriaTarea[] = ["diseno", "dev", "marketing", "contenido", "seo", "otro"];
const PRIORIDADES: Prioridad[] = ["baja", "media", "alta"];

export function normalizarTareasIA(raw: unknown): TareaPlantilla[] {
    const lista = Array.isArray(raw) ? raw : Array.isArray((raw as { tareas?: unknown })?.tareas) ? (raw as { tareas: unknown[] }).tareas : [];
    return lista
        .map((x): TareaPlantilla | null => {
            const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
            const titulo = String(o.titulo || "").trim();
            if (!titulo) return null;
            return {
                titulo: titulo.slice(0, 140),
                categoria: CATEGORIAS.includes(o.categoria as CategoriaTarea) ? (o.categoria as CategoriaTarea) : "otro",
                prioridad: PRIORIDADES.includes(o.prioridad as Prioridad) ? (o.prioridad as Prioridad) : "media",
                ...(o.descripcion ? { descripcion: String(o.descripcion).slice(0, 400) } : {}),
            };
        })
        .filter((t): t is TareaPlantilla => t !== null)
        .slice(0, 12);
}
