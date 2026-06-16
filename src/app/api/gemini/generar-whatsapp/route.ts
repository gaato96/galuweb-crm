import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { nombre, negocio, que_hace, puntos_debiles, soluciones, servicio, link_demo } = await req.json();

        if (!nombre) {
            return NextResponse.json({ error: "El nombre del contacto es requerido" }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({
                error: "GEMINI_API_KEY no está configurada en las variables de entorno (.env.local). Por favor agrégala para usar el asistente de IA."
            }, { status: 500 });
        }

        const prompt = `Actúa como un copywriter de prospección B2B de alto nivel para Galuweb, especializado en captación de clientes de manera altamente profesional y directa.
Redacta un mensaje de primer contacto personalizado para enviar por WhatsApp al siguiente lead:

--- INFORMACIÓN DEL LEAD ---
Nombre del contacto: ${nombre}
Negocio: ${negocio || "Su negocio"}
Qué hace el negocio: ${que_hace || "No especificado"}
Puntos débiles identificados: ${puntos_debiles || "No especificados"}
Soluciones propuestas: ${soluciones || "No especificadas"}
Servicio específico a ofrecer: ${servicio || "desarrollo de solución a medida"}
Link de la demo interactiva (Vercel) si existe: ${link_demo || "No provisto"}

--- DIRECTRICES OBLIGATORIAS PARA EL MENSAJE ---
1. Tono: Profesional, directo y clínico. No debes vender "diseño web" o "páginas web". Vende la solución al dolor principal del negocio (como la saturación operativa, la pérdida de clientes, la mala reputación o procesos manuales ineficientes).
2. Estructura Obligatoria:
   - Saludo personalizado: (ej: "Hola ${nombre}, ¿cómo estás?").
   - El Gancho: Mención directa al problema específico detectado en su sistema actual o presencia digital (referenciando los puntos débiles del lead).
   - La Empatía: Validar la frustración o costo operativo del proceso manual o ineficiente que tienen actualmente.
   - La Propuesta de Valor (Usa exactamente esta estructura adaptada): "Para mostrarte cómo solucionarlo de raíz, armé una versión interactiva y funcional de cómo debería verse y operar el sistema de ${negocio || "tu negocio"}".
   - Los Entregables: Incluir explícitamente los placeholders o enlaces para los entregables.
     * Si el link de la demo (Vercel) provisto arriba NO es "No provisto", coloca el enlace real de la demo: ${link_demo}.
     * Si el link de la demo es "No provisto", escribe literalmente "[LINK DE LA DEMO EN VERCEL]".
     * Escribe siempre el placeholder literal: "[LINK DEL VIDEO EXPLICATIVO DE 2 MINUTOS]".
   - El CTA de Baja Fricción: Invitación a una charla corta de 15 minutos por llamada para analizar si les sirve implementarlo, sin ningún tipo de compromiso.
3. REGLA DE ORO:
   - Está terminantemente PROHIBIDO usar palabras cliché de marketing (ej: "innovador", "revolucionario", "soluciones integrales", "transformar tu negocio", "líderes en el sector").
   - Utiliza términos de negocio reales y clínicos: "automatizar reservas", "liberar líneas de atención", "captación orgánica", "tasa de rebote de pacientes", "saturación de WhatsApp", "tiempos de espera", etc.
4. Formato: Corto, al grano. Dividido en 3 o 4 párrafos cortos separados por saltos de línea para facilitar la lectura en WhatsApp. Usa negritas muy sutiles en palabras clave. No uses más de 1 o 2 emojis discretos.

Debes responder ÚNICAMENTE con un objeto JSON válido. El JSON debe tener exactamente la siguiente clave y no debe incluir bloques de código como \`\`\`json:
{
  "mensaje": "Mensaje final redactado listo para enviar..."
}

No agregues ninguna explicación fuera de este objeto JSON.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
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
                mensaje: `Hola ${nombre}, ¿cómo estás? Analizando el sistema actual de ${negocio || "tu negocio"} noté cuellos de botella en la gestión manual de reservas. Comprendo la frustración de perder tiempo valioso en tareas repetitivas.\n\nPara mostrarte cómo solucionarlo de raíz, armé una versión interactiva y funcional de cómo debería verse y operar el sistema de ${negocio || "tu negocio"}.\n\nAquí tienes el acceso:\nDemo: ${link_demo || "[LINK DE LA DEMO EN VERCEL]"}\nVideo de 2 minutos: [LINK DEL VIDEO EXPLICATIVO DE 2 MINUTOS]\n\n¿Te interesaría una charla de 15 minutos por llamada para analizar si te sirve implementarlo, sin compromisos? ¡Un saludo!`
            });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Error interno al procesar la IA" }, { status: 500 });
    }
}
