import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
    try {
        const { clienteId, linkDemo } = await req.json();

        if (!clienteId || !linkDemo) {
            return NextResponse.json({ error: "Faltan parámetros requeridos: clienteId y linkDemo" }, { status: 400 });
        }

        // 1. Obtener cliente actual de Supabase
        const { data: cliente, error: getError } = await supabase
            .from("clientes")
            .select("*")
            .eq("id", clienteId)
            .single();

        if (getError || !cliente) {
            return NextResponse.json({ error: "Cliente no encontrado en la base de datos" }, { status: 404 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        let finalMessage = "";

        if (apiKey) {
            // 2. Generar el mensaje de WhatsApp automáticamente usando el nuevo enlace de demo
            const info = cliente.info_investigacion || {};
            const prompt = `Actúa como un copywriter de prospección B2B de alto nivel para Galuweb, especializada en captación de clientes de manera altamente profesional y directa.
Redacta un mensaje de primer contacto personalizado para enviar por WhatsApp al siguiente lead:

--- INFORMACIÓN DEL LEAD ---
Nombre del contacto: ${cliente.nombre}
Negocio: ${cliente.negocio || "Su negocio"}
Qué hace el negocio: ${info.que_hace || "No especificado"}
Puntos débiles identificados: ${info.puntos_debiles || "No especificados"}
Soluciones propuestas: ${info.soluciones || "No especificadas"}
Servicio específico a ofrecer: desarrollo de solución a medida
Link de la demo interactiva (Vercel): ${linkDemo}

--- DIRECTRICES OBLIGATORIAS PARA EL MENSAJE ---
1. Tono: Profesional, directo y clínico. No debes vender "diseño web" o "páginas web". Vende la solución al dolor principal del negocio (como la saturación operativa, la pérdida de clientes, la mala reputación o procesos manuales ineficientes).
2. Estructura Obligatoria:
   - Saludo personalizado: (ej: "Hola ${cliente.nombre}, ¿cómo estás?").
   - El Gancho: Mención directa al problema específico detectado en su sistema actual o presencia digital (referenciando los puntos débiles del lead).
   - La Empatía: Validar la frustración o costo operativo del proceso manual o ineficiente que tienen actualmente.
   - La Propuesta de Valor: "Para mostrarte cómo solucionarlo de raíz, armé una versión interactiva y funcional de cómo debería verse y operar el sistema de ${cliente.negocio || "tu negocio"}".
   - Los Entregables: Incluir explícitamente los placeholders o enlaces para los entregables.
     * Coloca el enlace real de la demo: ${linkDemo}
     * Escribe siempre el placeholder literal: "[LINK DEL VIDEO EXPLICATIVO DE 2 MINUTOS]"
   - El CTA de Baja Fricción: Invitación a una charla corta de 15 minutos por llamada para analizar si les sirve implementarlo, sin ningún tipo de compromiso.
3. REGLA DE ORO:
   - Está terminantemente PROHIBIDO usar palabras cliché de marketing (ej: "innovador", "revolucionario", "soluciones integrales", "transformar tu negocio", "líderes en el sector").
   - Utiliza términos de negocio reales y clínicos: "automatizar reservas", "liberar líneas de atención", "captación orgánica", "tasa de rebote de pacientes", "saturación de WhatsApp", "tiempos de espera", etc.
4. Formato: Corto, al grano. Dividido en 3 o 4 párrafos cortos separados por saltos de línea para facilitar la lectura en WhatsApp. Usa negritas muy sutiles en palabras clave. No uses más de 1 o 2 emojis discretos.

Debes responder ÚNICAMENTE con un objeto JSON válido. El JSON debe tener exactamente la siguiente clave y no debe incluir bloques de código como \`\`\`json:
{
  "mensaje": "Mensaje final redactado listo para enviar..."
}`;

            try {
                const geminiRes = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { responseMimeType: "application/json" }
                        })
                    }
                );

                if (geminiRes.ok) {
                    const data = await geminiRes.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                    const parsed = JSON.parse(text);
                    finalMessage = parsed.mensaje || "";
                }
            } catch (err) {
                console.error("Error al generar WhatsApp automático en actualización:", err);
            }
        }

        // Fallback del mensaje si falla la IA
        if (!finalMessage) {
            finalMessage = `Hola ${cliente.nombre}, ¿cómo estás? Analizando el sistema actual de ${cliente.negocio || "tu negocio"} noté cuellos de botella en la gestión manual de reservas. Comprendo la frustración de perder tiempo valioso en tareas repetitivas.\n\nPara mostrarte cómo solucionarlo de raíz, armé una versión interactiva y funcional de cómo debería verse y operar el sistema de ${cliente.negocio || "tu negocio"}.\n\nAquí tienes el acceso:\nDemo: ${linkDemo}\nVideo de 2 minutos: [LINK DEL VIDEO EXPLICATIVO DE 2 MINUTOS]\n\n¿Te interesaría una charla de 15 minutos por llamada para analizar si te sirve implementarlo, sin compromisos? ¡Un saludo!`;
        }

        // 3. Actualizar el cliente en Supabase
        const { data: updatedCliente, error: updateError } = await supabase
            .from("clientes")
            .update({
                link_demo: linkDemo,
                msg_whatsapp: finalMessage
            })
            .eq("id", clienteId)
            .select()
            .single();

        if (updateError) {
            throw updateError;
        }

        return NextResponse.json({
            success: true,
            cliente: updatedCliente
        });

    } catch (error: any) {
        console.error("Error en actualizar-demo API:", error);
        return NextResponse.json({ error: error.message || "Error interno del servidor" }, { status: 500 });
    }
}
