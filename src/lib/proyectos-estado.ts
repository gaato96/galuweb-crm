// ============================================================
// Estado de un proyecto — "¿dónde estoy parado?"
// ============================================================
// Toda la lógica que responde esa pregunta vive acá y no en la UI, para que
// la tarjeta de la lista y la cabecera del detalle digan exactamente lo mismo.

import type { Proyecto, Tarea, LogProyecto, FaseProyecto } from "./types";
import { FASES_POR_TIPO } from "./types";

export type Salud = "en_marcha" | "atencion" | "frenado" | "sin_empezar" | "terminado";

export const SALUD_LABELS: Record<Salud, string> = {
    en_marcha: "En marcha",
    atencion: "Necesita atención",
    frenado: "Frenado",
    sin_empezar: "Sin empezar",
    terminado: "Terminado",
};

export const SALUD_COLORS: Record<Salud, string> = {
    en_marcha: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    atencion: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    frenado: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    sin_empezar: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    terminado: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
};

/** Punto en el que se considera que un proyecto se quedó quieto. */
const DIAS_SIN_MOVIMIENTO = 14;

export interface EstadoProyecto {
    fases: FaseProyecto[];
    fasesCompletadas: number;
    progreso: number;               // 0-100
    faseActual: FaseProyecto | null; // la primera sin completar: donde estás parado
    faseActualIndice: number;        // 1-based; 0 si no hay
    tareasPendientes: Tarea[];
    tareasVencidas: Tarea[];
    proximoPaso: string | null;      // la única cosa que sigue
    ultimaActividad: string | null;  // fecha ISO
    diasSinMovimiento: number | null;
    salud: Salud;
}

/** Las fases guardadas, o las del tipo de proyecto si nunca se configuraron. */
export function fasesDe(proyecto: Proyecto): FaseProyecto[] {
    if (proyecto.fases && proyecto.fases.length > 0) return proyecto.fases;
    const plantilla = FASES_POR_TIPO[proyecto.tipo_proyecto] || FASES_POR_TIPO.webapp;
    return plantilla.map((f) => ({ nombre: f.nombre, completada: false }));
}

function diasEntre(desde: string, hasta: Date): number {
    const d = new Date(desde.length === 10 ? desde + "T00:00:00" : desde);
    return Math.floor((hasta.getTime() - d.getTime()) / 86_400_000);
}

export function calcularEstado(
    proyecto: Proyecto,
    tareas: Tarea[],
    logs: LogProyecto[],
    hoy: Date = new Date()
): EstadoProyecto {
    const fases = fasesDe(proyecto);
    const fasesCompletadas = fases.filter((f) => f.completada).length;
    const progreso = fases.length > 0 ? Math.round((fasesCompletadas / fases.length) * 100) : 0;

    const indice = fases.findIndex((f) => !f.completada);
    const faseActual = indice === -1 ? null : fases[indice];

    const delProyecto = tareas.filter((t) => t.proyecto_id === proyecto.id);
    const tareasPendientes = delProyecto.filter((t) => t.estado !== "completada");
    const tareasVencidas = tareasPendientes.filter(
        (t) => t.fecha_vencimiento && diasEntre(t.fecha_vencimiento, hoy) > 0
    );

    // El próximo paso es una sola cosa: lo vencido manda, después lo en progreso,
    // después la tarea más urgente, y si no hay tareas, la fase que toca.
    const enProgreso = tareasPendientes.find((t) => t.estado === "en_progreso");
    const porPrioridad = [...tareasPendientes].sort((a, b) => {
        const peso = { alta: 0, media: 1, baja: 2 } as const;
        return (peso[a.prioridad] ?? 1) - (peso[b.prioridad] ?? 1);
    })[0];
    const proximoPaso =
        tareasVencidas[0]?.titulo ||
        enProgreso?.titulo ||
        porPrioridad?.titulo ||
        faseActual?.nombre ||
        null;

    const logsDelProyecto = logs.filter((l) => l.proyecto_id === proyecto.id);
    const ultimaActividad =
        logsDelProyecto.map((l) => l.fecha).sort().reverse()[0] ||
        delProyecto.map((t) => t.created_at).sort().reverse()[0] ||
        proyecto.created_at ||
        null;
    const diasSinMovimiento = ultimaActividad ? diasEntre(ultimaActividad, hoy) : null;

    let salud: Salud;
    if (proyecto.estado === "finalizado" || (fases.length > 0 && fasesCompletadas === fases.length)) {
        salud = "terminado";
    } else if (proyecto.estado === "pausado") {
        salud = "frenado";
    } else if (fasesCompletadas === 0 && delProyecto.length === 0) {
        salud = "sin_empezar";
    } else if (tareasVencidas.length > 0 || (diasSinMovimiento ?? 0) > DIAS_SIN_MOVIMIENTO) {
        salud = "atencion";
    } else {
        salud = "en_marcha";
    }

    return {
        fases, fasesCompletadas, progreso, faseActual,
        faseActualIndice: indice === -1 ? 0 : indice + 1,
        tareasPendientes, tareasVencidas, proximoPaso,
        ultimaActividad, diasSinMovimiento, salud,
    };
}

/** "hace 3 días", "hoy", "hace 2 meses" — para leer de un vistazo. */
export function haceCuanto(dias: number | null): string {
    if (dias == null) return "sin registro";
    if (dias <= 0) return "hoy";
    if (dias === 1) return "ayer";
    if (dias < 30) return `hace ${dias} días`;
    const meses = Math.floor(dias / 30);
    return meses === 1 ? "hace 1 mes" : `hace ${meses} meses`;
}
