import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { nombre, negocio, que_hace, puntos_debiles, soluciones, servicio } = await req.json();

        if (!nombre) {
            return NextResponse.json({ error: "El nombre del contacto es requerido" }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({
                error: "GEMINI_API_KEY no está configurada en las variables de entorno (.env.local). Por favor agrégala para usar el asistente de IA."
            }, { status: 500 });
        }

        const prompt = `Actúa como un experto en prospección y ventas digitales para la agencia Galuweb. 
Redacta un mensaje de primer contacto personalizado para enviar por WhatsApp al siguiente lead:

--- INFORMACIÓN DEL LEAD ---
Nombre del contacto: ${nombre}
Negocio: ${negocio || "Su negocio"}
Qué hace el negocio: ${que_hace || "No especificado"}
Puntos débiles identificados: ${puntos_debiles || "No especificados"}
Soluciones propuestas: ${soluciones || "No especificadas"}
Servicio específico a ofrecer: ${servicio || "desarrollo web a medida"}

--- DIRECTRICES PARA EL MENSAJE ---
1. Tono: Muy profesional pero a la vez cercano, humano y natural. Evita sonar a bot o spam de venta agresiva.
2. Estructura:
   - Saludo personalizado con su nombre (ej: "Hola ${nombre}, ¿cómo estás?").
   - Gancho rápido: Mencionar de forma directa que estuvimos analizando el sitio/redes de ${negocio || "su negocio"} y vimos una gran oportunidad de crecimiento.
   - Dolor/Solución: Mencionar sutilmente uno de los puntos débiles identificados (ej: falta de embudo de venta, lentitud, falta de catálogo web) y cómo la solución de ${servicio} que creamos en Galuweb les ayudaría directamente a captar más clientes o ahorrar tiempo.
   - Llamado a la acción (CTA) de baja fricción: Proponer una llamada corta de 5 minutos o enviarles una propuesta rápida, por ejemplo: "¿Te vendría bien una breve charla de 5 minutos esta semana para ver si te cuadra?" o "¿Te gustaría que te envíe una propuesta preliminar?".
3. Extensión: Corto y al grano (máximo 120 palabras). Dividido en 2 o 3 párrafos pequeños separados por saltos de línea para facilitar la lectura en WhatsApp.
4. Emojis: Usa un par de emojis relacionados (ej: 👋, 🚀, 📈) de forma muy sutil.
5. NO incluyas placeholders en corchetes como "[Tu Nombre]" ni "[Galuweb]". Habla en nombre de la agencia o de forma directa.

Debes responder ÚNICAMENTE con un objeto JSON válido. El JSON debe tener exactamente la siguiente clave y no debe incluir bloques de código como \`\`\`json:
{
  "mensaje": "Mensaje final redactado listo para enviar..."
}

No agregues ninguna explicación fuera de este objeto JSON.`;

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
            console.error("Error al parsear respuesta de WhatsApp de Gemini:", text);
            return NextResponse.json({
                mensaje: `Hola ${nombre}, ¿cómo estás? Te escribo de Galuweb. Estuve analizando la presencia online de ${negocio || "tu negocio"} y veo una gran oportunidad de optimización con un ${servicio || "desarrollo web"}. ¿Te interesaría que charlemos 5 minutos esta semana para contarte mi propuesta? ¡Un saludo!`
            });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Error interno al procesar la IA" }, { status: 500 });
    }
}
