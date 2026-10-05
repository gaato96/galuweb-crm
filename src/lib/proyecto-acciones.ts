// ============================================================
// Acciones de proyecto que tocan varias tablas a la vez.
// ============================================================
// Crear un proyecto no es solo insertar una fila: también arma el plan de
// cobro en Finanzas, carga el checklist de la primera fase, pasa al cliente a
// "cliente actual" y marca la cotización como aceptada. Todo eso vive acá para
// que cualquier pantalla que cree un proyecto haga lo mismo.

import {
    proyectosStore, tareasStore, finanzasStore, clientesStore,
    cotizacionesStore, logsProyectoStore, solicitudesStore,
} from "./store";
import type {
    Cliente, EsperaCliente, FaseProyecto, Proyecto, SolicitudProyecto, Tarea, TareaPlantilla, TipoProyecto,
} from "./types";
import {
    aISO, briefPlantilla, correrFases, diasDeEspera, fasesIniciales, generarPlanCobro, inicioDelProyecto,
    planEsperas, sumarDias, tareasParaFase, tareasPlantillaDeFase,
} from "./proyecto-gestion";
import { fasesDe } from "./proyectos-estado";
import { slugify } from "./utils";

export async function registrarLog(proyectoId: string, titulo: string, descripcion = ""): Promise<void> {
    try {
        await logsProyectoStore.create({ proyecto_id: proyectoId, titulo, descripcion, fecha: aISO(new Date()) });
    } catch (e) {
        console.error("No se pudo registrar la novedad:", e);
    }
}

export interface NuevoProyectoInput {
    nombre: string;
    tipo_proyecto: TipoProyecto;
    cliente: Cliente | null;
    descripcion: string;
    fecha_inicio: string;
    fecha_entrega: string | null;
    monto_total: number;
    cotizacion_id: string | null;
    plan: { anticipoPct: number; cuotas: number; fechaPrimerCobro: string; anticipoCobrado: boolean } | null;
    cargarChecklist: boolean;
    slug_portal?: string;
}

export interface ResultadoCreacion {
    proyecto: Proyecto;
    cobros: number;
    tareas: number;
    avisos: string[];
}

export async function crearProyectoCompleto(input: NuevoProyectoInput): Promise<ResultadoCreacion> {
    const avisos: string[] = [];
    const slugBase = slugify(input.slug_portal?.trim() || input.nombre) || "proyecto";
    const fases = fasesIniciales(input.tipo_proyecto, input.fecha_inicio, input.fecha_entrega);

    const proyecto = await proyectosStore.create({
        nombre: input.nombre.trim(),
        tipo_proyecto: input.tipo_proyecto,
        cliente_id: input.cliente?.id || null,
        descripcion: input.descripcion,
        es_interno: false,
        accesos: [],
        figma_url: "",
        calendly_url: "",
        contrato_url: "",
        slug_portal: `${slugBase}-${Date.now().toString(36).slice(-4)}`,
        estado: "activo",
        fases,
        fecha_inicio: input.fecha_inicio || null,
        fecha_entrega: input.fecha_entrega || null,
        monto_total: input.monto_total || 0,
        cotizacion_id: input.cotizacion_id,
        links: [],
        brief: briefPlantilla(input.tipo_proyecto),
    });

    let cobros = 0;
    if (input.plan && input.monto_total > 0) {
        try {
            const filas = generarPlanCobro({
                proyectoId: proyecto.id,
                nombreProyecto: proyecto.nombre,
                monto: input.monto_total,
                ...input.plan,
            });
            cobros = (await finanzasStore.createBulk(filas)).length;
        } catch (e) {
            console.error(e);
            avisos.push("No se pudo crear el plan de cobro en Finanzas.");
        }
    }

    let tareas = 0;
    if (input.cargarChecklist && fases[0]) {
        try {
            const filas = tareasParaFase(proyecto.id, fases[0], tareasPlantillaDeFase(input.tipo_proyecto, fases[0].nombre), []);
            if (filas.length) tareas = (await tareasStore.createBulk(filas)).length;
        } catch (e) {
            console.error(e);
            avisos.push("No se pudo cargar el checklist de la primera fase (¿corriste la migración 20260923?).");
        }
    }

    if (input.cliente && !["cliente_actual", "cliente_finalizado"].includes(input.cliente.etapa)) {
        try { await clientesStore.update(input.cliente.id, { etapa: "cliente_actual" }); }
        catch { avisos.push("No se pudo pasar al cliente a \"Cliente actual\"."); }
    }

    if (input.cotizacion_id) {
        try { await cotizacionesStore.update(input.cotizacion_id, { estado: "aceptada" }); }
        catch { avisos.push("No se pudo marcar la cotización como aceptada."); }
    }

    await registrarLog(
        proyecto.id,
        "Proyecto creado",
        [
            input.fecha_entrega ? `Entrega pactada: ${input.fecha_entrega}.` : "",
            input.monto_total ? `Monto: ${input.monto_total}.` : "",
            cobros ? `${cobros} cobros cargados en Finanzas.` : "",
        ].filter(Boolean).join(" ")
    );

    return { proyecto, cobros, tareas, avisos };
}

/** Carga en Tareas el checklist de una fase (plantilla o sugerido por IA), sin duplicar. */
export async function cargarChecklistFase(
    proyecto: Proyecto,
    fase: FaseProyecto,
    existentes: Tarea[],
    plantillas: TareaPlantilla[] = tareasPlantillaDeFase(proyecto.tipo_proyecto, fase.nombre)
): Promise<Tarea[]> {
    const filas = tareasParaFase(proyecto.id, fase, plantillas, existentes);
    if (!filas.length) return [];
    return tareasStore.createBulk(filas);
}

// ─────────────────────────────────────────────────────────────
// Esperas al cliente → plazos corridos
// ─────────────────────────────────────────────────────────────

export interface ResultadoEsperas {
    proyecto: Proyecto;
    /** Días que se corrieron los plazos en esta pasada (negativo si se volvieron atrás). */
    delta: number;
    /** Si se guardó algo (esperas o plazos). */
    cambio: boolean;
}

/** Corre las tareas pendientes de las fases sin completar, igual que sus fases. */
async function correrTareas(proyecto: Proyecto, dias: number): Promise<void> {
    const fasesAbiertas = new Set(fasesDe(proyecto).filter((f) => !f.completada).map((f) => f.nombre));
    const tareas = await tareasStore.getByProyecto(proyecto.id);
    await Promise.all(
        tareas
            .filter((t) => t.estado !== "completada" && t.fecha_vencimiento && t.fase && fasesAbiertas.has(t.fase))
            .map((t) => tareasStore.update(t.id, { fecha_vencimiento: sumarDias(t.fecha_vencimiento!, dias) }).catch(() => null))
    );
}

/**
 * Pone al día las esperas al cliente y corre los plazos (fases pendientes,
 * entrega y sus tareas) por los días que se esperó. Es idempotente: se puede
 * llamar cada vez que se abre el proyecto, y así los plazos se van corriendo
 * día a día mientras falte algo del cliente.
 *
 * `editar` permite abrir, cerrar o quitar esperas a mano antes de calcular.
 * Lee el proyecto fresco de la base para no correr dos veces lo mismo.
 * Tira error si falta la migración 20261005_esperas_cliente.sql.
 */
export async function sincronizarEsperas(
    proyectoId: string,
    editar?: (esperas: EsperaCliente[]) => EsperaCliente[],
    hoy: string = aISO(new Date())
): Promise<ResultadoEsperas | null> {
    const proyecto = await proyectosStore.getById(proyectoId);
    if (!proyecto) return null;
    if (proyecto.es_interno || proyecto.estado === "finalizado") return { proyecto, delta: 0, cambio: false };

    let solicitudes: SolicitudProyecto[] | null = null;
    try { solicitudes = await solicitudesStore.getByProyecto(proyectoId); } catch { /* sin la tabla: sus esperas no se tocan */ }

    const originales = proyecto.esperas_cliente || [];
    const base: Proyecto = editar ? { ...proyecto, esperas_cliente: editar(originales.map((e) => ({ ...e }))) } : proyecto;
    const plan = planEsperas(base, solicitudes, hoy);
    if (JSON.stringify(plan.esperas) === JSON.stringify(originales) && plan.delta === 0) return { proyecto, delta: 0, cambio: false };

    const cambios: Partial<Proyecto> = { esperas_cliente: plan.esperas };
    if (plan.delta !== 0) {
        cambios.dias_espera_aplicados = (proyecto.dias_espera_aplicados || 0) + plan.delta;
        if (proyecto.fases?.length) cambios.fases = correrFases(proyecto.fases, plan.delta);
        if (proyecto.fecha_entrega) cambios.fecha_entrega = sumarDias(proyecto.fecha_entrega, plan.delta);
    }
    const actualizado = await proyectosStore.update(proyecto.id, cambios);
    if (plan.delta !== 0) await correrTareas(proyecto, plan.delta).catch((e) => console.error("No se pudieron correr las tareas:", e));

    const inicio = inicioDelProyecto(proyecto, hoy);
    for (const e of plan.abiertas) {
        await registrarLog(proyecto.id, `En pausa esperando al cliente: ${e.motivo}`, "Mientras falte, los plazos de las fases pendientes y la entrega se corren solos.");
    }
    for (const e of plan.cerradas) {
        const dias = diasDeEspera([e], inicio, hoy);
        await registrarLog(proyecto.id, `Se recibió del cliente: ${e.motivo}`, dias > 0 ? `Se esperó ${dias} día${dias === 1 ? "" : "s"}; los plazos se corrieron en consecuencia.` : "");
    }
    return { proyecto: actualizado, delta: plan.delta, cambio: true };
}
