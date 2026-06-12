import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { nombre, negocio, link, contexto } = await req.json();

        if (!nombre) {
            return NextResponse.json({ error: "El nombre del contacto es requerido" }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({
                error: "GEMINI_API_KEY no está configurada en las variables de entorno (.env.local). Por favor agrégala para usar el asistente de IA."
            }, { status: 500 });
        }

        const prompt = `Actúa como un consultor de negocios y estratega digital experto para Galuweb, una agencia de desarrollo web y soluciones digitales de alto nivel.
Analiza la siguiente información de un nuevo contacto comercial (lead) para clasificarlo, identificar sus problemas digitales y proponer soluciones de desarrollo web:

--- DATOS DEL LEAD ---
Nombre: ${nombre}
Negocio/Nombre comercial: ${negocio || "No especificado"}
Enlace del negocio (Web/Redes): ${link || "No provisto"}
Contexto/Observaciones provistas: ${contexto || "Ninguna"}

--- TAREA ---
1. Deduce o asume a qué se dedica el negocio en base a su nombre, enlace y el contexto.
2. Identifica puntos débiles o necesidades clave en su presencia digital, marketing, ventas, o procesos operativos que podrían estar costándoles clientes o eficiencia.
3. Propón soluciones específicas que Galuweb (nuestra agencia de diseño y desarrollo web) puede construirles (por ejemplo: Landing Page para captar leads, Web Institucional con blog, Tienda Online/E-commerce integrado, Web App a medida, automatizaciones o CRM).

Debes responder ÚNICAMENTE con un objeto JSON válido. El JSON debe tener exactamente las siguientes claves y no debe incluir bloques de código como \`\`\`json:
{
  "que_hace": "Resumen conciso y profesional de la actividad del negocio, su nicho de mercado y propuesta de valor (máximo 80 palabras).",
  "puntos_debiles": "Detalle de al menos 3 puntos débiles digitales u operativos del negocio, formateados como una lista de viñetas cortas, concisas y claras.",
  "soluciones": "Propuestas de soluciones de diseño y desarrollo web que Galuweb puede implementar para resolver esos problemas, formateadas como una lista de viñetas claras y persuasivas."
}

No agregues explicaciones fuera de este objeto JSON.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json({
                error: data.error?.message || "Error de comunicación con el servicio de Gemini."
            }, { status: response.status });
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        try {
            const parsed = JSON.parse(text);
            return NextResponse.json(parsed);
        } catch (parseError) {
            console.error("Error al parsear respuesta JSON de Gemini:", text);
            // Fallback if parsing fails but text exists
            return NextResponse.json({
                que_hace: `Negocio de ${negocio || "servicios"}.`,
                puntos_debiles: "• Dificultad para captar clientes online.\n• Falta de optimización digital.",
                soluciones: "• Desarrollo de Landing Page.\n• Integración de CRM.",
                rawText: text
            });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Error interno al procesar la IA" }, { status: 500 });
    }
}
