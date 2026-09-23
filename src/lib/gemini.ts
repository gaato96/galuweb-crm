// Llamada mínima a Gemini desde rutas del servidor, con modelo de respaldo.
// Solo se importa en rutas de API: la clave nunca llega al navegador.

const MODELOS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

export class GeminiError extends Error {
    constructor(message: string, public status = 500) {
        super(message);
    }
}

export async function llamarGemini(prompt: string, opciones: { json?: boolean } = {}): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new GeminiError("GEMINI_API_KEY no está configurada en el servidor. Agregala para usar la IA.", 503);
    }

    let ultimoError = "";
    for (const modelo of MODELOS) {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    ...(opciones.json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
                }),
            }
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            const partes: { text?: string }[] = data.candidates?.[0]?.content?.parts || [];
            const texto = partes.map((p) => p.text || "").join("\n").trim();
            if (texto) return texto;
            ultimoError = "La IA devolvió una respuesta vacía.";
            continue;
        }
        ultimoError = data.error?.message || `Error ${res.status} de Gemini`;
    }
    throw new GeminiError(ultimoError, 502);
}

/** Parsea JSON tolerando fences de markdown alrededor. */
export function parsearJSON(texto: string): unknown {
    const limpio = texto.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    try {
        return JSON.parse(limpio);
    } catch {
        const inicio = limpio.search(/[[{]/);
        const fin = Math.max(limpio.lastIndexOf("}"), limpio.lastIndexOf("]"));
        if (inicio >= 0 && fin > inicio) return JSON.parse(limpio.slice(inicio, fin + 1));
        throw new GeminiError("La IA no devolvió un JSON válido. Probá de nuevo.", 502);
    }
}

export function respuestaError(e: unknown) {
    const status = e instanceof GeminiError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Error interno al procesar la IA";
    return Response.json({ error: message }, { status });
}
