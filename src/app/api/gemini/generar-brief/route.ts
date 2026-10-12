import { llamarGemini, parsearJSON, respuestaError } from "@/lib/gemini";
import { normalizarBrief } from "@/lib/proyecto-gestion";
import { TIPO_PROYECTO_LABELS, type TipoProyecto } from "@/lib/types";

/**
 * Formulario extra: profundiza algo puntual (ej: el detalle de cada curso que
 * vende) sabiendo lo que el cliente ya contó, para no volver a preguntarlo.
 */
function promptFormulario(d: {
    descripcion: string; tipo?: TipoProyecto; nombre?: string; cliente?: string; negocio?: string;
    formulario: { titulo?: string; fase?: string | null }; respuestasPrevias?: string;
}): string {
    return `Sos el director de proyectos de Galu, una agencia de diseño y desarrollo web de Argentina.
El cliente ya completó el brief inicial. Ahora tenés que armar un FORMULARIO NUEVO que va a completar solo, desde su celular, en el portal del proyecto, para profundizar en un tema puntual.

PROYECTO
- Nombre: ${d.nombre || "Sin nombre"}
- Tipo: ${d.tipo ? TIPO_PROYECTO_LABELS[d.tipo] : "Sitio web"}
- Cliente: ${d.cliente || "—"}${d.negocio ? ` (${d.negocio})` : ""}

FORMULARIO
- Título: ${d.formulario.titulo || "—"}
${d.formulario.fase ? `- Las respuestas se necesitan para la fase: ${d.formulario.fase}\n` : ""}- Lo que la agencia necesita saber:
"""
${d.descripcion.trim()}
"""

LO QUE EL CLIENTE YA RESPONDIÓ
"""
${(d.respuestasPrevias || "Todavía nada.").slice(0, 24000)}
"""

REGLAS
- NO repitas nada que ya esté respondido arriba. Usalo para que las preguntas sean concretas: si el cliente ya nombró sus productos, cursos o servicios, armá UNA SECCIÓN POR CADA UNO, con su nombre en el título, y preguntá en profundidad sobre ese ítem.
- Si hay ítems que se repiten (productos, cursos, servicios, sedes, profesionales), sumá al final una sección para "¿Hay alguno más que no nombramos?".
- Español rioplatense, tuteo con "vos", tono cálido y simple. Nada de jerga técnica.
- Entre 2 y 10 secciones, 3 a 8 preguntas cada una. Que se pueda completar en 15 a 30 minutos.
- Usá "archivo" para pedir material (fotos, PDFs, programas, videos). "opcion" o "multiple" cuando haya respuestas típicas (3 a 7 opciones, y "Otro" si aplica). "texto" para respuestas cortas (precio, duración, fecha), "parrafo" para largas.
- Marcá "requerida": true solo en lo imprescindible.
- "ayuda" es opcional: un ejemplo corto que oriente la respuesta.

Respondé SOLO con este JSON:
{
  "intro": "1 o 2 frases explicando para qué sirve este formulario y que se guarda solo",
  "secciones": [
    {
      "titulo": "string",
      "descripcion": "string corta",
      "preguntas": [
        { "pregunta": "string", "tipo": "texto|parrafo|opcion|multiple|archivo", "opciones": ["..."], "ayuda": "string", "requerida": true }
      ]
    }
  ]
}`;
}

export async function POST(req: Request) {
    try {
        const { descripcion, tipo, nombre, cliente, negocio, formulario, respuestasPrevias } = (await req.json()) as {
            descripcion?: string; tipo?: TipoProyecto; nombre?: string; cliente?: string; negocio?: string;
            /** Si viene, se arma un formulario extra (no el brief inicial). */
            formulario?: { titulo?: string; fase?: string | null };
            /** Lo que el cliente ya respondió (brief y otros formularios), en markdown. */
            respuestasPrevias?: string;
        };
        if (!descripcion?.trim()) {
            return Response.json({ error: formulario ? "Contá qué necesitás saber para armar el formulario." : "Describí el proyecto para generar el brief." }, { status: 400 });
        }

        const prompt = formulario ? promptFormulario({ descripcion, tipo, nombre, cliente, negocio, formulario, respuestasPrevias }) : `Sos el director de proyectos de Galu, una agencia de diseño y desarrollo web de Argentina.
Tenés que armar el BRIEF que el cliente va a completar solo, desde su celular, en el portal del proyecto.

PROYECTO
- Nombre: ${nombre || "Sin nombre"}
- Tipo: ${tipo ? TIPO_PROYECTO_LABELS[tipo] : "Sitio web"}
- Cliente: ${cliente || "—"}${negocio ? ` (${negocio})` : ""}
- Descripción que dio la agencia:
"""
${descripcion.trim()}
"""

REGLAS
- Español rioplatense, tuteo con "vos", tono cálido y simple. Nada de jerga técnica.
- Entre 4 y 7 secciones, 3 a 6 preguntas cada una, 18 a 30 preguntas en total.
- Las preguntas tienen que ser ESPECÍFICAS de este proyecto y su rubro, no genéricas.
- Cubrí: negocio, objetivo y métricas de éxito, cliente ideal, propuesta de valor, marca y estilo visual, referencias, contenido/secciones, funcionalidades concretas que menciona la descripción, material que tiene que mandar, plazos y dominio/hosting.
- Usá "archivo" para pedir material (logo, fotos, planillas, textos). Usá "opcion" o "multiple" cuando haya respuestas típicas (con 3 a 7 opciones, y "Otro" si aplica). "texto" para respuestas cortas, "parrafo" para largas.
- Marcá "requerida": true solo en las 4 a 6 preguntas imprescindibles para arrancar.
- "ayuda" es opcional: un ejemplo corto que oriente la respuesta.

Respondé SOLO con este JSON:
{
  "intro": "2 frases de bienvenida explicando para qué sirve el brief",
  "secciones": [
    {
      "titulo": "string",
      "descripcion": "string corta",
      "preguntas": [
        { "pregunta": "string", "tipo": "texto|parrafo|opcion|multiple|archivo", "opciones": ["..."], "ayuda": "string", "requerida": true }
      ]
    }
  ]
}`;

        const texto = await llamarGemini(prompt, { json: true });
        const brief = normalizarBrief(parsearJSON(texto), { generado_con_ia: true, estado: "borrador" });
        if (brief.secciones.length === 0) {
            return Response.json({ error: "La IA no devolvió preguntas. Probá de nuevo con más detalle." }, { status: 502 });
        }
        return Response.json({ brief });
    } catch (e) {
        return respuestaError(e);
    }
}
