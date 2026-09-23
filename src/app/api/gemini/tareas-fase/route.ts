import { llamarGemini, parsearJSON, respuestaError } from "@/lib/gemini";
import { normalizarTareasIA } from "@/lib/proyecto-gestion";
import { TIPO_PROYECTO_LABELS, type TipoProyecto } from "@/lib/types";

export async function POST(req: Request) {
    try {
        const { fase, descripcionFase, tipo, nombre, descripcion, briefResumen, existentes } = (await req.json()) as {
            fase?: string; descripcionFase?: string; tipo?: TipoProyecto; nombre?: string;
            descripcion?: string; briefResumen?: string; existentes?: string[];
        };
        if (!fase) return Response.json({ error: "Falta la fase." }, { status: 400 });

        const prompt = `Sos el project manager de una agencia web chica (1-2 personas). Armá el checklist de la fase "${fase}" de este proyecto.

PROYECTO: ${nombre || "—"} · ${tipo ? TIPO_PROYECTO_LABELS[tipo] : "Web"}
Descripción: ${descripcion || "—"}
Objetivo de la fase: ${descripcionFase || "—"}
${briefResumen ? `Lo que respondió el cliente en el brief:\n${briefResumen.slice(0, 6000)}\n` : ""}
Tareas que YA existen (no las repitas): ${(existentes || []).join(" | ") || "ninguna"}

REGLAS
- Entre 5 y 10 tareas, en el orden en que conviene hacerlas.
- Cada tarea es una acción concreta y chica (se termina en una sentada de 30 min a 3 h), empieza con verbo en infinitivo.
- Específicas de ESTE proyecto (usá el rubro, las funcionalidades y lo que dijo el cliente), no genéricas.
- categoria: diseno | dev | marketing | contenido | seo | otro. prioridad: alta | media | baja.
- descripcion: 1 frase con el criterio de "terminado".

Respondé SOLO con JSON: { "tareas": [ { "titulo": "", "categoria": "", "prioridad": "", "descripcion": "" } ] }`;

        const texto = await llamarGemini(prompt, { json: true });
        const tareas = normalizarTareasIA(parsearJSON(texto));
        if (tareas.length === 0) return Response.json({ error: "La IA no sugirió tareas. Probá de nuevo." }, { status: 502 });
        return Response.json({ tareas });
    } catch (e) {
        return respuestaError(e);
    }
}
