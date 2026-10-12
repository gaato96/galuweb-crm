// ============================================================
// Gestión de proyectos de clientes — lógica pura (sin Supabase)
// ============================================================
// Plazos, plan de cobro, checklist por fase y brief. Vive acá y no en la UI
// para que el panel, el portal y las rutas de IA calculen exactamente lo mismo.

import type {
    BriefPregunta, BriefProyecto, BriefSeccion, Cliente, EsperaCliente, FaseProyecto, Finanza,
    FormularioProyecto, Proyecto, SolicitudProyecto, Tarea, TipoPreguntaBrief, TipoProyecto, TareaPlantilla,
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
// Esperas al cliente
// ─────────────────────────────────────────────────────────────
// Si falta el brief o un material que frena el proyecto, no se puede avanzar:
// cada día de espera corre las fases pendientes y la entrega. Los plazos
// guardados ya incluyen `dias_espera_aplicados`; lo que falte aplicar es la
// diferencia con los días de espera reales (unión de tramos, sin contar dos
// veces los días en que se esperaban dos cosas a la vez).

export function inicioDelProyecto(proyecto: Proyecto, hoy: string = aISO(new Date())): string {
    return proyecto.fecha_inicio || proyecto.created_at?.slice(0, 10) || hoy;
}

export function esperasAbiertas(proyecto: Pick<Proyecto, "esperas_cliente">): EsperaCliente[] {
    return (proyecto.esperas_cliente || []).filter((e) => !e.hasta);
}

/**
 * Días de espera desde `inicio` hasta `hoy`. Lo esperado antes de que arranque
 * el proyecto no cuenta: el plan ya suponía empezar en la fecha de inicio.
 */
export function diasDeEspera(esperas: EsperaCliente[], inicio: string, hoy: string = aISO(new Date())): number {
    const tramos = esperas
        .map((e) => [e.desde > inicio ? e.desde : inicio, e.hasta && e.hasta < hoy ? e.hasta : hoy] as const)
        .filter(([a, b]) => b > a)
        .sort((x, y) => x[0].localeCompare(y[0]));
    let total = 0;
    let fin: string | null = null;
    for (const [a, b] of tramos) {
        if (!fin || a >= fin) { total += diasEntre(a, b); fin = b; }
        else if (b > fin) { total += diasEntre(fin, b); fin = b; }
    }
    return total;
}

/** Corre `dias` las fases sin completar (las completadas conservan su fecha). */
export function correrFases(fases: FaseProyecto[], dias: number): FaseProyecto[] {
    if (!dias) return fases;
    return fases.map((f) => (f.completada || !f.fecha_limite ? f : { ...f, fecha_limite: sumarDias(f.fecha_limite, dias) }));
}

const fechaLocal = (ts: string | null | undefined, hoy: string) => (ts ? aISO(new Date(ts)) : hoy);

export interface PlanEsperas {
    esperas: EsperaCliente[];
    /** Días a sumar (o restar) a los plazos guardados. */
    delta: number;
    abiertas: EsperaCliente[];
    cerradas: EsperaCliente[];
    cambio: boolean;
}

/**
 * Pone las esperas al día con lo que pasó: el brief enviado abre una espera
 * y completado la cierra; un pedido que frena se cierra cuando el cliente lo
 * entrega, y si se borra el pedido su espera abierta desaparece.
 * `solicitudes` en null = no se pudieron leer, así que no se tocan sus esperas.
 */
export function planEsperas(
    proyecto: Proyecto,
    solicitudes: SolicitudProyecto[] | null,
    hoy: string = aISO(new Date())
): PlanEsperas {
    const originales = proyecto.esperas_cliente || [];
    const inicio = inicioDelProyecto(proyecto, hoy);
    const abiertas: EsperaCliente[] = [];
    const cerradas: EsperaCliente[] = [];
    let esperas: EsperaCliente[] = originales.map((e) => ({ ...e }));

    const brief = proyecto.brief;
    const hayEsperaBrief = esperas.some((e) => e.origen === "brief");
    if (brief?.estado === "enviado" && !hayEsperaBrief) {
        // Sin fecha de envío (briefs anteriores a esto) se cuenta desde el inicio:
        // sin brief no se pudo arrancar.
        const nueva: EsperaCliente = { id: nuevoId("e"), motivo: "Brief del cliente", origen: "brief", desde: brief.enviado_at ? fechaLocal(brief.enviado_at, hoy) : inicio, hasta: null };
        esperas.push(nueva);
        abiertas.push(nueva);
    }
    if (brief?.estado === "completado") {
        const hasta = fechaLocal(brief.completado_at, hoy);
        if (!hayEsperaBrief && brief.enviado_at) {
            // Se envió y se completó sin que nadie abriera el proyecto en el medio.
            const desde = fechaLocal(brief.enviado_at, hoy);
            const nueva: EsperaCliente = { id: nuevoId("e"), motivo: "Brief del cliente", origen: "brief", desde, hasta: hasta > desde ? hasta : desde };
            esperas.push(nueva);
            cerradas.push(nueva);
        }
        esperas = esperas.map((e) => {
            if (e.origen !== "brief" || e.hasta) return e;
            const cerrada = { ...e, hasta: hasta > e.desde ? hasta : e.desde };
            cerradas.push(cerrada);
            return cerrada;
        });
    }

    // Formularios extra: solo los que frenan el proyecto abren una espera.
    // Sin la columna (formularios undefined) no se tocan sus esperas.
    if (proyecto.formularios) {
        const porId = new Map(proyecto.formularios.map((f) => [f.id, f]));
        esperas = esperas.flatMap((e) => {
            if (e.origen !== "formulario" || e.hasta || !e.ref_id) return [e];
            const f = porId.get(e.ref_id);
            // Se borró o ya no frena: la espera abierta desaparece y los plazos vuelven atrás.
            if (!f || !f.frena) return [];
            if (f.estado !== "completado") return [e];
            const hasta = fechaLocal(f.completado_at, hoy);
            const cerrada = { ...e, hasta: hasta > e.desde ? hasta : e.desde };
            cerradas.push(cerrada);
            return [cerrada];
        });
        for (const f of proyecto.formularios) {
            if (!f.frena || f.estado === "borrador") continue;
            const suyas = esperas.filter((e) => e.origen === "formulario" && e.ref_id === f.id);
            const motivo = `Formulario: ${f.titulo}`;
            // Una vez cerrada (o "seguir sin esperar") no se vuelve a abrir sola.
            if (f.estado === "enviado" && suyas.length === 0) {
                const nueva: EsperaCliente = { id: nuevoId("e"), motivo, origen: "formulario", ref_id: f.id, desde: f.enviado_at ? fechaLocal(f.enviado_at, hoy) : hoy, hasta: null };
                esperas.push(nueva);
                abiertas.push(nueva);
            } else if (f.estado === "completado" && suyas.length === 0 && f.enviado_at) {
                const desde = fechaLocal(f.enviado_at, hoy);
                const hasta = fechaLocal(f.completado_at, hoy);
                const nueva: EsperaCliente = { id: nuevoId("e"), motivo, origen: "formulario", ref_id: f.id, desde, hasta: hasta > desde ? hasta : desde };
                esperas.push(nueva);
                cerradas.push(nueva);
            }
        }
    }

    if (solicitudes) {
        const porId = new Map(solicitudes.map((s) => [s.id, s]));
        esperas = esperas.flatMap((e) => {
            if (e.origen !== "solicitud" || e.hasta || !e.ref_id) return [e];
            const s = porId.get(e.ref_id);
            if (!s) return [];
            if (s.estado === "pendiente") return [e];
            const hasta = fechaLocal(s.entregada_at, hoy);
            const cerrada = { ...e, hasta: hasta > e.desde ? hasta : e.desde };
            cerradas.push(cerrada);
            return [cerrada];
        });
    }

    const delta = diasDeEspera(esperas, inicio, hoy) - (proyecto.dias_espera_aplicados || 0);
    const cambio = delta !== 0 || JSON.stringify(esperas) !== JSON.stringify(originales);
    return { esperas, delta, abiertas, cerradas, cambio };
}

// ─────────────────────────────────────────────────────────────
// Plazo general del proyecto
// ─────────────────────────────────────────────────────────────

export type EstadoPlazo = "sin_fecha" | "en_tiempo" | "ajustado" | "atrasado" | "vencido" | "esperando" | "entregado";

export const ESTADO_PLAZO_COLORS: Record<EstadoPlazo, string> = {
    sin_fecha: "text-slate-300 border-slate-500/30 bg-slate-500/10",
    esperando: "text-violet-300 border-violet-500/30 bg-violet-500/10",
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
    const inicio = inicioDelProyecto(proyecto, hoy);
    const diasTotales = Math.max(diasEntre(inicio, proyecto.fecha_entrega), 1);
    const diasRestantes = diasEntre(hoy, proyecto.fecha_entrega);
    const pctTiempo = Math.min(100, Math.max(0, Math.round(((diasTotales - diasRestantes) / diasTotales) * 100)));

    // Esperando al cliente, el plazo se corre solo: no está atrasado por nosotros.
    const esperando = esperasAbiertas(proyecto);
    if (esperando.length > 0) {
        const dias = diasDeEspera(esperando, inicio, hoy);
        return {
            estado: "esperando", diasRestantes, diasTotales, pctTiempo,
            texto: `Esperando al cliente${dias > 0 ? ` · ${dias} día${dias === 1 ? "" : "s"}` : ""}`,
        };
    }

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

/** Brief (o formulario) respondido → .md listo para usar como contexto de desarrollo. */
export function briefAMarkdown(brief: BriefProyecto, proyecto: Proyecto, cliente: Cliente | null, titulo = "Brief"): string {
    const lineas: string[] = [
        `# ${titulo} — ${proyecto.nombre}`,
        "",
        `- **Cliente:** ${cliente ? `${cliente.nombre}${cliente.negocio ? ` (${cliente.negocio})` : ""}` : "Interno"}`,
        `- **Tipo de proyecto:** ${TIPO_PROYECTO_LABELS[proyecto.tipo_proyecto]}`,
        ...(proyecto.fecha_entrega ? [`- **Entrega:** ${proyecto.fecha_entrega}`] : []),
        `- **Estado del ${titulo === "Brief" ? "brief" : "formulario"}:** ${brief.estado}${brief.completado_at ? ` (completado el ${brief.completado_at.slice(0, 10)})` : ""}`,
        "",
    ];
    if (proyecto.descripcion && titulo === "Brief") lineas.push("## Descripción del proyecto", "", proyecto.descripcion, "");
    for (const s of brief.secciones) {
        lineas.push(`## ${s.titulo}`, "");
        for (const q of s.preguntas) {
            lineas.push(`### ${q.pregunta}`, "", respuestaMarkdown(q), "");
        }
    }
    return lineas.join("\n").trim() + "\n";
}

// ─────────────────────────────────────────────────────────────
// Formularios extra
// ─────────────────────────────────────────────────────────────

export function nuevoFormulario(titulo: string, fase: string | null, base?: Partial<BriefProyecto>): FormularioProyecto {
    const ahora = new Date().toISOString();
    return {
        estado: "borrador",
        intro: "",
        secciones: [{ id: nuevoId("s"), titulo: "Preguntas", preguntas: [p("Nueva pregunta")] }],
        generado_con_ia: false,
        completado_at: null,
        ...base,
        actualizado_at: ahora,
        id: nuevoId("f"),
        titulo: titulo.trim() || "Formulario",
        fase,
        frena: false,
        creado_at: ahora,
    };
}

export const docIdFormulario = (id: string) => `doc_${id}`;

/** Reemplaza un formulario por id (o lo agrega al final si no estaba). */
export function reemplazarFormulario(lista: FormularioProyecto[], form: FormularioProyecto): FormularioProyecto[] {
    return lista.some((f) => f.id === form.id) ? lista.map((f) => (f.id === form.id ? form : f)) : [...lista, form];
}

/**
 * Respuestas del cliente que todavía no están en el CONTEXTO.md: el brief
 * completo sin contexto generado, o formularios completados después.
 */
export function respuestasSinContexto(proyecto: Pick<Proyecto, "brief" | "formularios" | "documentos">): { brief: boolean; formularios: FormularioProyecto[] } {
    const ctx = (proyecto.documentos || []).find((d) => d.id === "doc_contexto");
    return {
        brief: proyecto.brief?.estado === "completado" && !ctx,
        formularios: (proyecto.formularios || []).filter((f) => f.estado === "completado" && (!ctx || (f.completado_at || "") > ctx.updated_at)),
    };
}

/**
 * Todo lo que respondió el cliente (brief + formularios con respuestas) en un
 * solo markdown: es la entrada del CONTEXTO.md y de la IA que arma formularios.
 */
export function respuestasClienteMarkdown(proyecto: Proyecto, cliente: Cliente | null, excluir?: string): string {
    const partes: string[] = [];
    if (proyecto.brief && progresoBrief(proyecto.brief).respondidas > 0) partes.push(briefAMarkdown(proyecto.brief, proyecto, cliente));
    for (const f of proyecto.formularios || []) {
        if (f.id === excluir || progresoBrief(f).respondidas === 0) continue;
        partes.push(briefAMarkdown(f, proyecto, cliente, `Formulario: ${f.titulo}`));
    }
    return partes.join("\n---\n\n");
}

// ─────────────────────────────────────────────────────────────
// Formulario desde texto pegado (.md)
// ─────────────────────────────────────────────────────────────
// Para armar un formulario pegando lo que ya está escrito, sin IA:
//   # Título                    → título del formulario (si hay ## abajo)
//   ## Sección                  → sección (también una línea toda en **negrita**)
//   - ¿Pregunta? / 1. Pregunta  → pregunta (o cualquier línea que termine en ?)
//       - Opción                → opciones de una sola respuesta
//       - [ ] Opción            → opciones de varias respuestas
//   > texto o línea suelta      → ayuda de la pregunta de arriba
//   Pregunta *                  → obligatoria
//   [archivo] [texto] [párrafo] [una] [varias] → fuerza el tipo

export const EJEMPLO_FORMULARIO_MD = `# Tus cursos en detalle

## Curso de Maquillaje Profesional
- ¿A quién va dirigido? *
- ¿Cuánto dura y cuántas clases tiene? [texto]
- ¿Cuál es la modalidad?
    - Presencial
    - Online en vivo
    - Grabado
- ¿Qué incluye el precio?
    - [ ] Materiales
    - [ ] Certificado
    - [ ] Kit de regalo
- Contanos el temario, módulo por módulo
  > Si lo tenés en un PDF, subilo en la pregunta de abajo.
- Subí el programa, fotos o videos del curso [archivo]`;

const RE_TITULO = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const RE_LISTA = /^([ \t]*)(?:[-*+•]|\d+[.)])\s+(.*)$/;
const RE_CHECK = /^\[[ xX]?\]\s*/;
const RE_TAG = /\[(archivos?|adjuntos?|texto|corto|corta|p[aá]rrafo|largo|larga|una|opci[oó]n|varias|m[uú]ltiple)\]/i;

function limpiarMd(t: string): string {
    return t
        .replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1").replace(/`([^`]+)`/g, "$1")
        .replace(/\s+/g, " ").trim();
}

function preguntaDesdeTexto(crudo: string): BriefPregunta | null {
    let t = limpiarMd(crudo).replace(RE_CHECK, "");
    let tipo: TipoPreguntaBrief | null = null;
    let requerida = false;
    const tag = t.match(RE_TAG);
    if (tag) {
        const k = tag[1].toLowerCase();
        tipo = /^(archivo|adjunto)/.test(k) ? "archivo" : /^(texto|cort)/.test(k) ? "texto" : /^(p[aá]rrafo|larg)/.test(k) ? "parrafo" : /^(una|opci)/.test(k) ? "opcion" : "multiple";
        t = t.replace(RE_TAG, " ").replace(/\s+/g, " ").trim();
    }
    if (/\s*(\*|\(obligatori[oa]\))$/i.test(t)) { requerida = true; t = t.replace(/\s*(\*|\(obligatori[oa]\))$/i, "").trim(); }
    // Opciones en la misma línea: "¿Modalidad? (opciones: presencial, online)"
    let opciones: string[] | undefined;
    const enLinea = t.match(/\((opciones|varias)\s*:\s*([^)]+)\)\s*$/i);
    if (enLinea) {
        opciones = enLinea[2].split(/\s*[,/|]\s*/).map((x) => x.trim()).filter(Boolean);
        if (!tipo) tipo = /varias/i.test(enLinea[1]) ? "multiple" : "opcion";
        t = t.slice(0, enLinea.index).trim();
    }
    t = t.replace(/:$/, "").trim();
    if (!t) return null;
    if (!tipo) {
        if (/^(sub[ií]|adjunt|mand[aá]nos|envi[aá]nos|compart[ií])/i.test(t)) tipo = "archivo";
        else if (t.length <= 70 && /precio|cu[aá]nto (cuesta|sale|dura)|duraci[oó]n|fecha|nombre|tel[eé]fono|e-?mail|link|url|instagram|cantidad|cu[aá]nt[oa]s/i.test(t)) tipo = "texto";
        else tipo = "parrafo";
    }
    return { id: nuevoId("q"), pregunta: t, tipo, ...(opciones ? { opciones } : {}), ...(requerida ? { requerida: true } : {}) };
}

type PreguntaEnArmado = BriefPregunta & { indent: number; casillas: boolean; sub: string[] };

/** Texto pegado (markdown o texto plano) → secciones y preguntas del formulario. */
export function formularioDesdeTexto(texto: string): { titulo?: string; intro?: string; secciones: BriefSeccion[] } {
    const lineas = texto.replace(/\r/g, "").split("\n");
    const niveles = lineas
        .map((l) => l.match(RE_TITULO))
        .filter((m): m is RegExpMatchArray => m !== null && !m[2].trim().endsWith("?"))
        .map((m) => m[1].length);
    const minimo = niveles.length ? Math.min(...niveles) : 0;
    // El # de más arriba es el título solo si aparece una vez y hay secciones debajo.
    const nivelTitulo = niveles.filter((n) => n === minimo).length === 1 && niveles.some((n) => n > minimo) ? minimo : null;

    let titulo: string | undefined;
    const intro: string[] = [];
    const secciones: BriefSeccion[] = [];
    let seccion: BriefSeccion | null = null;
    let pregunta: PreguntaEnArmado | null = null;

    const cerrarPregunta = () => {
        if (!pregunta) return;
        const { indent: _i, casillas, sub, ...q } = pregunta;
        void _i;
        if (sub.length >= 2) {
            q.opciones = sub;
            if (q.tipo !== "opcion" && q.tipo !== "multiple") q.tipo = casillas ? "multiple" : "opcion";
        } else if (sub.length === 1) {
            q.ayuda = [q.ayuda, sub[0]].filter(Boolean).join(" ");
        }
        if ((q.tipo === "opcion" || q.tipo === "multiple") && (!q.opciones || q.opciones.length < 2)) { q.tipo = "parrafo"; delete q.opciones; }
        if (!seccion) { seccion = { id: nuevoId("s"), titulo: "Preguntas", preguntas: [] }; secciones.push(seccion); }
        seccion.preguntas.push(q);
        pregunta = null;
    };
    const nuevaSeccion = (t: string) => {
        cerrarPregunta();
        seccion = { id: nuevoId("s"), titulo: limpiarMd(t).replace(/:$/, ""), preguntas: [] };
        secciones.push(seccion);
    };
    const nuevaPregunta = (t: string, indent: number) => {
        cerrarPregunta();
        const q = preguntaDesdeTexto(t);
        if (q) pregunta = { ...q, indent, casillas: false, sub: [] };
    };

    for (const linea of lineas) {
        if (!linea.trim() || /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(linea)) continue;
        const h = linea.match(RE_TITULO);
        if (h) {
            const t = h[2].trim();
            if (t.endsWith("?")) nuevaPregunta(t, 0);
            else if (h[1].length === nivelTitulo && !titulo) { cerrarPregunta(); titulo = limpiarMd(t); }
            else nuevaSeccion(t);
            continue;
        }
        const negrita = linea.trim().match(/^\*\*([^*]+)\*\*:?$/);
        if (negrita && !negrita[1].trim().endsWith("?")) { nuevaSeccion(negrita[1]); continue; }

        const li = linea.match(RE_LISTA);
        if (li) {
            const indent = li[1].replace(/\t/g, "    ").length;
            const contenido = li[2].trim();
            const actual = pregunta as PreguntaEnArmado | null;
            // Sub-viñeta de una pregunta: opción (salvo que sea otra pregunta).
            if (actual && indent > actual.indent && !limpiarMd(contenido).endsWith("?")) {
                if (RE_CHECK.test(contenido)) actual.casillas = true;
                const o = limpiarMd(contenido.replace(RE_CHECK, ""));
                if (o) actual.sub.push(o);
                continue;
            }
            nuevaPregunta(contenido, indent);
            continue;
        }

        const esCita = /^\s*>/.test(linea);
        const plano = linea.trim().replace(/^>\s?/, "");
        if (!esCita && (/\?\s*\*?\s*$/.test(plano) || RE_TAG.test(plano))) { nuevaPregunta(plano, linea.length - linea.trimStart().length); continue; }
        const actual = pregunta as PreguntaEnArmado | null;
        if (actual) { actual.ayuda = [actual.ayuda, limpiarMd(plano)].filter(Boolean).join(" "); continue; }
        const sec = seccion as BriefSeccion | null;
        if (sec && sec.preguntas.length === 0) { sec.descripcion = [sec.descripcion, limpiarMd(plano)].filter(Boolean).join(" "); continue; }
        if (!sec) intro.push(limpiarMd(plano));
    }
    cerrarPregunta();

    return {
        ...(titulo ? { titulo } : {}),
        ...(intro.length ? { intro: intro.join(" ") } : {}),
        secciones: secciones.filter((s) => s.preguntas.length > 0),
    };
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
