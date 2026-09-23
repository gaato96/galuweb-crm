import { llamarGemini, parsearJSON, respuestaError } from "@/lib/gemini";
import { normalizarBrief } from "@/lib/proyecto-gestion";
import { TIPO_PROYECTO_LABELS, type TipoProyecto } from "@/lib/types";

export async function POST(req: Request) {
    try {
        const { descripcion, tipo, nombre, cliente, negocio } = (await req.json()) as {
            descripcion?: string; tipo?: TipoProyecto; nombre?: string; cliente?: string; negocio?: string;
        };
        if (!descripcion?.trim()) {
            return Response.json({ error: "Describí el proyecto para generar el brief." }, { status: 400 });
        }

        const prompt = `Sos el director de proyectos de Galu, una agencia de diseño y desarrollo web de Argentina.
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
