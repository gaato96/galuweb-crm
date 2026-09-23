import { llamarGemini, respuestaError } from "@/lib/gemini";

export async function POST(req: Request) {
    try {
        const { briefMarkdown, nombre, tipo, stack } = (await req.json()) as {
            briefMarkdown?: string; nombre?: string; tipo?: string; stack?: string;
        };
        if (!briefMarkdown?.trim()) {
            return Response.json({ error: "No hay brief respondido para generar el contexto." }, { status: 400 });
        }

        const prompt = `Sos un tech lead que prepara el archivo CONTEXTO.md que va a leer un asistente de IA de código (Claude Code) antes de construir este proyecto. Con el brief que respondió el cliente, escribí un documento markdown claro y accionable.

Proyecto: ${nombre || "—"} (${tipo || "web"})${stack ? ` · Stack preferido: ${stack}` : ""}

BRIEF RESPONDIDO:
"""
${briefMarkdown.slice(0, 20000)}
"""

Estructura obligatoria (en español, sin inventar datos: si algo no está en el brief, marcalo como "⚠️ Pendiente de confirmar con el cliente"):

# Contexto del proyecto — ${nombre || ""}
## 1. Resumen ejecutivo (5 líneas máximo)
## 2. Negocio y propuesta de valor
## 3. Objetivos y métricas de éxito
## 4. Público objetivo
## 5. Identidad de marca (tono de voz, colores, tipografías, estilo, referencias)
## 6. Arquitectura del sitio (sitemap con cada página/sección y su propósito)
## 7. Contenido por sección (qué va en cada una; copy sugerido si hay datos)
## 8. Funcionalidades y requerimientos técnicos (lista con criterio de aceptación)
## 9. Integraciones, SEO y analítica
## 10. Material recibido y pendiente
## 11. Riesgos, dudas abiertas y preguntas para el cliente
## 12. Instrucciones para el asistente de código (convenciones, prioridades, qué NO hacer)

Respondé SOLO con el markdown.`;

        const markdown = (await llamarGemini(prompt)).replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/i, "").trim();
        return Response.json({ markdown });
    } catch (e) {
        return respuestaError(e);
    }
}
