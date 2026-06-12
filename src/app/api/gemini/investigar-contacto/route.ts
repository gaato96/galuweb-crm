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

        const prompt = `Actúa como un consultor de negocios, estratega digital y diseñador UI/UX experto para Galuweb, una agencia de desarrollo web y soluciones digitales de alto nivel.
Analiza la siguiente información de un nuevo contacto comercial (lead) para clasificarlo, identificar sus problemas digitales, proponer soluciones de desarrollo web y realizar un análisis preliminar de su Identidad Visual (paleta de colores, tipografías y logo):

--- DATOS DEL LEAD ---
Nombre: ${nombre}
Negocio/Nombre comercial: ${negocio || "No especificado"}
Enlace del negocio (Web/Redes): ${link || "No provisto"}
Contexto/Observaciones provistas: ${contexto || "Ninguna"}

--- TAREA ---
1. Deduce o asume a qué se dedica el negocio en base a su nombre, enlace y el contexto.
2. Identifica puntos débiles o necesidades clave en su presencia digital, marketing, ventas, o procesos operativos que podrían estar costándoles clientes o eficiencia.
3. Propón soluciones específicas que Galuweb (nuestra agencia de diseño y desarrollo web) puede construirles (por ejemplo: Landing Page para captar leads, Web Institucional con blog, Tienda Online/E-commerce integrado, Web App a medida, automatizaciones o CRM).
4. Realiza un Análisis de Identidad Visual:
   - Paleta de colores: Si tiene enlace, analiza los colores dominantes en su sitio o redes sociales, o propón una paleta de colores moderna, equilibrada y armoniosa adecuada para su rubro (indicando nombres y códigos hexadecimales).
   - Tipografía: Si tiene enlace, deduce qué tipografías o estilos tipográficos usa, o recomienda una combinación de tipografías premium de Google Fonts (ej: Inter + Sora, Montserrat + Playfair Display) que calce con su nicho.
   - Logo: Si tiene sitio web propio con dominio (ej: negocio.com), devuelve un enlace al logo usando favicons de Google (formato exacto: https://www.google.com/s2/favicons?domain=negocio.com&sz=128, reemplazando "negocio.com" con su dominio real). Si es Instagram u otro enlace sin dominio propio, puedes proveer una recomendación de diseño o intentar inferir la imagen. Si no se puede deducir ningún enlace de logo, devuelve una recomendación de estilo de logo o déjalo vacío si es apropiado.

Debes responder ÚNICAMENTE con un objeto JSON válido. El JSON debe tener exactamente las siguientes claves y no debe incluir bloques de código como \`\`\`json:
{
  "que_hace": "Resumen conciso y profesional de la actividad del negocio, su nicho de mercado y propuesta de valor (máximo 80 palabras).",
  "puntos_debiles": "Detalle de al menos 3 puntos débiles digitales u operativos del negocio, formateados como una lista de viñetas cortas, concisas y claras.",
  "soluciones": "Propuestas de soluciones de diseño y desarrollo web que Galuweb puede implementar para resolver esos problemas, formateadas como una lista de viñetas claras y persuasivas.",
  "colores": "Resumen de la paleta de colores actual detectada o propuesta (ej: #0F172A Azul Profundo, #10B981 Esmeralda, #F8FAFC Blanco de Fondo).",
  "tipografia": "Tipografías actuales detectadas o sugerencia de combinación tipográfica premium de Google Fonts adecuada para el rubro.",
  "logo_url": "Enlace del logo (ej: la URL del favicon de Google o similar) o descripción/sugerencia de estilo si no es posible obtener una URL."
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
                colores: "Paleta neutra sugerida (Oscuros y acentos de color).",
                tipografia: "Google Fonts premium (Inter / Roboto).",
                logo_url: link && link.includes(".") ? `https://www.google.com/s2/favicons?domain=${link.replace(/https?:\/\/(www\.)?/, "").split("/")[0]}&sz=128` : "",
                rawText: text
            });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Error interno al procesar la IA" }, { status: 500 });
    }
}
