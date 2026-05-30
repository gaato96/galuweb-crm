import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { idea } = await req.json();
        
        if (!idea) {
            return NextResponse.json({ error: "Datos de la idea no proporcionados" }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ 
                error: "GEMINI_API_KEY no está configurada en las variables de entorno (.env.local). Por favor agrégala para usar el asistente de IA." 
            }, { status: 500 });
        }

        const prompt = `Actúa como un consultor experto en desarrollo de productos de software y estrategia de negocios para agencias web.
Analiza la siguiente idea de negocio/proyecto y genera una evaluación estratégica completa:

--- IDEA CENTRAL ---
Título: ${idea.titulo}
Categoría: ${idea.categoria}
Descripción: ${idea.descripcion}
Rubro/Sector: ${idea.rubro || "No especificado"}
Cliente objetivo: ${idea.cliente_potencial || "No especificado"}

--- TU RESPUESTA DEBE GENERAR ESTAS 3 SECCIONES EN MARKDOWN CLARO ---

### 1. Modelo de Negocio (Lean Canvas Express)
Genera una lista organizada que responda de forma concisa a:
* **Propuesta de Valor:** ¿Por qué un cliente pagaría por esto?
* **Segmento de Clientes:** ¿Quién es el comprador ideal?
* **Canales:** ¿Cómo llegaremos a ellos?
* **Fuentes de Ingreso:** ¿Cómo monetizarlo (SaaS mensual, pago único, etc.)?

### 2. Estructura del MVP (Requerimientos base)
Proporciona exactamente 5 características o módulos imprescindibles para lanzar el Producto Mínimo Viable (MVP). Agrega un nombre corto y descripción en una sola línea para cada uno.

### 3. Mensaje de WhatsApp (Pitch de Ventas)
Redacta un mensaje listo para copiar y enviar por WhatsApp para captar el interés de un cliente potencial en este rubro. Debe:
* Ser profesional pero directo y natural (máximo 120 palabras).
* Utilizar emojis de forma moderada.
* Explicar el beneficio de forma inmediata.
* Dejar corchetes claros como [Nombre] y [Tu Nombre] para ser reemplazados.

Responde únicamente con el markdown formateado de estas tres secciones. Evita introducciones o comentarios adicionales.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            return NextResponse.json({ 
                error: data.error?.message || "Error de comunicación con el servicio de Gemini." 
            }, { status: response.status });
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return NextResponse.json({ text });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Error interno al procesar la IA" }, { status: 500 });
    }
}
