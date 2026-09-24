import { llamarGemini, parsearJSON, respuestaError } from "@/lib/gemini";
import { normalizarEstimacion, type AnclaPrecio } from "@/lib/cotizacion-ia";
import type { BriefingCotizacion, TipoCotizacion } from "@/lib/types";

/**
 * Sugiere un rango de precio para el trabajo relevado.
 *
 * Es una referencia para decidir, no el precio: quien cotiza escribe después
 * el número que quiera en el briefing, y ese es el que manda.
 *
 * El ancla principal son las cotizaciones anteriores del propio estudio. Un
 * modelo estimando "precios de mercado" por su cuenta se va a los miles de
 * dólares con cualquier sistema; el historial propio es lo que lo mantiene
 * en la realidad de lo que este estudio cobra y sus clientes pagan.
 */
export async function POST(req: Request) {
    try {
        const { briefing, tipo, negocio, historial } = (await req.json()) as {
            briefing?: BriefingCotizacion;
            tipo?: TipoCotizacion;
            negocio?: string;
            historial?: AnclaPrecio[];
        };

        const b = briefing;
        if (!b?.notas_reunion?.trim() && !b?.requerimientos?.trim()) {
            return Response.json(
                { error: "Contá qué se habló o qué pidió el cliente para poder estimar." },
                { status: 400 }
            );
        }

        const esWebApp = tipo === "webapp";
        const anclas = (historial || []).filter((h) => h.total > 0);

        const bloqueHistorial = anclas.length > 0
            ? anclas
                .map((h) => `- ${h.tipo === "webapp" ? "Web App" : "Página web"} — USD ${h.total}${h.detalle ? `. Incluía: ${h.detalle}` : ""}`)
                .join("\n")
            : "(todavía no hay cotizaciones anteriores cargadas)";

        const prompt = `Sos el director de Galu, un estudio argentino de diseño y desarrollo web. Tenés que estimar cuánto conviene cobrar por un trabajo que acaba de relevarse, para que el dueño del estudio decida con una referencia enfrente.

EL TRABAJO
- Tipo: ${esWebApp ? "Web App / Software a medida" : "Página web"}
- Rubro del cliente: ${negocio || "—"}
- Qué se habló: """${b.notas_reunion?.trim() || "—"}"""
- Cómo lo resuelve hoy: """${b.situacion_actual?.trim() || "—"}"""
- Qué pidió puntualmente: """${b.requerimientos?.trim() || "—"}"""
- Quién lo usa: """${b.publico?.trim() || "—"}"""
- Plazo: """${b.plazo?.trim() || "—"}"""
- Condiciones: """${b.condiciones?.trim() || "—"}"""

LO QUE ESTE ESTUDIO COBRÓ ANTES — es tu ancla principal
${bloqueHistorial}

CÓMO ESTIMAR
1. Empezá por el historial de arriba. Ubicá este trabajo respecto de esos: ¿es más chico, parecido o más grande? Esa comparación vale más que cualquier promedio de mercado.
2. Recién después ajustá por el mercado argentino real: acá los clientes pymes, profesionales independientes y comercios pagan bastante menos que las tarifas internacionales que circulan. Una propuesta fuera de precio no se negocia, se pierde.
3. Considerá el trabajo concreto: cantidad de pantallas o módulos, si hay pagos online, si hay login y varios usuarios, si hay datos sensibles, si hay integraciones con terceros, y cuántas semanas de trabajo real implica.
4. Si no hay historial cargado, decilo en el razonamiento y sé más conservador.

REGLAS
- Montos en dólares, números enteros y redondos (de 50 en 50 o de 100 en 100).
- "minimo" es el piso por debajo del cual el trabajo no conviene tomarlo. "sugerido" es lo que conviene pedir. "maximo" es lo que se podría sostener si el cliente tiene espalda o el alcance crece.
- El razonamiento va dirigido al dueño del estudio, de vos, en 2 o 3 frases. Nada de vender: decile por qué ese número, comparándolo con lo que ya cobró.
- Entre 3 y 5 "factores": qué del trabajo empuja el precio para arriba o para abajo. Frases cortas y concretas, cada una referida a ESTE trabajo.
- No inventes datos de mercado con aires de precisión (nada de "el precio promedio en Argentina es exactamente X"). Si estás estimando, decilo así.

Respondé SOLO con este JSON:
{
  "minimo": 0,
  "sugerido": 0,
  "maximo": 0,
  "razonamiento": "string",
  "factores": ["string"]
}`;

        const texto = await llamarGemini(prompt, { json: true });
        const estimacion = normalizarEstimacion(parsearJSON(texto));

        if (!estimacion) {
            return Response.json(
                { error: "La IA no devolvió un precio usable. Probá de nuevo." },
                { status: 502 }
            );
        }

        return Response.json({ estimacion, anclas: anclas.length });
    } catch (e) {
        return respuestaError(e);
    }
}
