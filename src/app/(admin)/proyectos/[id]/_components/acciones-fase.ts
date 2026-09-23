import { toast } from "sonner";
import { cargarChecklistFase, registrarLog } from "@/lib/proyecto-acciones";
import { aISO } from "@/lib/proyecto-gestion";
import { fasesDe } from "@/lib/proyectos-estado";
import type { ProyectoCtx } from "./ctx";

/**
 * Completa (o reabre) una fase. Al completarla deja registro en Novedades y,
 * si la fase siguiente todavía no tiene tareas, le carga su checklist: así el
 * proyecto se avanza fase por fase sin tener que acordarse de armar la lista.
 */
export async function alternarFase(ctx: ProyectoCtx, index: number): Promise<void> {
    const fases = fasesDe(ctx.proyecto).map((f) => ({ ...f }));
    const fase = fases[index];
    if (!fase) return;
    const completada = !fase.completada;
    fases[index] = { ...fase, completada, fecha_completada: completada ? aISO(new Date()) : null };

    const ok = await ctx.guardarProyecto({ fases });
    if (!ok) return;

    if (!completada) {
        toast.success(`Fase "${fase.nombre}" reabierta`);
        return;
    }

    await registrarLog(ctx.proyecto.id, `Fase "${fase.nombre}" completada`);
    const siguiente = fases.find((f, j) => j > index && !f.completada);
    if (!siguiente) {
        toast.success("¡Todas las fases completadas! Podés marcar el proyecto como finalizado.");
        ctx.recargar("logs");
        return;
    }

    const yaTiene = ctx.tareas.some((t) => t.fase === siguiente.nombre);
    if (yaTiene) {
        toast.success(`Fase "${fase.nombre}" completada. Sigue: ${siguiente.nombre}`);
    } else {
        try {
            const creadas = await cargarChecklistFase({ ...ctx.proyecto, fases }, siguiente, ctx.tareas);
            ctx.setTareas([...creadas, ...ctx.tareas]);
            toast.success(`Fase completada. Se cargaron ${creadas.length} tareas de "${siguiente.nombre}"`);
        } catch {
            toast.success(`Fase "${fase.nombre}" completada. Sigue: ${siguiente.nombre}`);
        }
    }
    ctx.recargar("logs");
}
