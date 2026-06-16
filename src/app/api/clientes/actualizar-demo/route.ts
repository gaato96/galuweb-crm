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
        let analisisImpacto = "";
        let solucionTecnica = "";
        let guionDemo = "";

        const info = cliente.info_investigacion || {};

        if (apiKey) {
            // 2. Generar el mensaje de WhatsApp y Guion automáticamente usando el nuevo enlace de demo
            const prompt = `Actúa como un Copywriter Experto en Ventas B2B y Estratega de Optimización de Conversión de la agencia Galu Diseño Web. Tu misión es transformar negocios utilizando las soluciones de Galu Diseño Web.

Nuestros servicios: Diseño web en WordPress, Web Apps de alto rendimiento con Next.js/Supabase, y automatización de procesos (CRM, turnos, pagos).
Nuestro enfoque: No vendo 'estética', vendo soluciones a problemas de negocio y dolores reales.

Te daré los datos de un prospecto:
- Nombre del contacto: ${cliente.nombre}
- Negocio: ${cliente.negocio || "Su negocio"}
- Qué hace: ${info.que_hace || "No especificado"}
- Debilidades: ${info.puntos_debiles || "No especificados"}
- Soluciones propuestas: ${info.soluciones || "No especificadas"}
- Tipo de página: ${info.tipo_pagina || "landing"}
- Link Demo (Vercel): ${linkDemo}
- Prompt Maestro de la Demo: ${info.prompt_maestro || "No provisto"}

Debes generar los siguientes campos y responder ÚNICAMENTE con un objeto JSON válido con las claves especificadas abajo (no incluyas bloques de código ni texto fuera del JSON):
{
  "analisis_impacto": "Una explicación muy breve e impactante de cuánto dinero o tiempo está perdiendo el negocio por sus fallas o debilidades actuales.",
  "solucion_tecnica": "Qué herramienta o stack técnico exacto se está proponiendo en la demo y por qué (Ej: Una landing en Next.js para velocidad instantánea, o un sistema de turnos tipo 'Tu Turno' integrado con Supabase para automatizar el control).",
  "mensaje": "Mensaje frío pero altamente personalizado para enviar por WhatsApp al prospecto. Saludo inicial personalizado ('Hola ${cliente.nombre}, ¿cómo estás?'), mención directa y empática a sus debilidades y dolor, presentación del Link Demo (${linkDemo}) y mención del video explicativo literal '[LINK DEL VIDEO EXPLICATIVO DE 2 MINUTOS]', cerrando con CTA de baja fricción invitando a charla de 15 minutos. Sin palabras cliché como 'revolucionario' o 'innovador'.",
  "guion_demo": "Un guion detallado y personalizado para que yo grabe un video de 2 minutos mostrando mi pantalla con la web demo generada y leyendo este guion con voz en off. Debe estructurarse en base a las secciones y funciones que tiene la web demo según el Prompt Maestro y las Debilidades. Usa un tono natural, amigable y explicativo, detallando cómo cada sección resuelve sus problemas operativos."
}

Ejemplo de estructura para el guion (adápalo a las secciones de la demo actual):
\"Hola! ¿Cómo están? Bueno, les hice este video básicamente para mostrarles una demo de lo que podría ser su web. Si bien esto es solo demostrativo para que vean las funciones que tendría, la idea es que esto lo diseñemos a medida para su negocio y podamos trabajarlo juntos. Bueno, esta sería la vista principal... En todo momento sale el botón de reservar/comprar... Luego muestra características... Testimonios... Para reservar presionamos acá... Eso sería básicamente la web... Espero les guste, y si les llega a interesar o tienen alguna duda, me avisan. Un saludo.\"`;

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
                    analisisImpacto = parsed.analisis_impacto || "";
                    solucionTecnica = parsed.solucion_tecnica || "";
                    guionDemo = parsed.guion_demo || "";
                }
            } catch (err) {
                console.error("Error al generar WhatsApp automático en actualización:", err);
            }
        }

        // Fallback del mensaje si falla la IA
        if (!finalMessage) {
            finalMessage = `Hola ${cliente.nombre}, ¿cómo estás? Analizando el sistema actual de ${cliente.negocio || "tu negocio"} noté cuellos de botella en la gestión manual de reservas. Comprendo la frustración de perder tiempo valioso en tareas repetitivas.\n\nPara mostrarte cómo solucionarlo de raíz, armé una versión interactiva y funcional de cómo debería verse y operar el sistema de ${cliente.negocio || "tu negocio"}.\n\nAquí tienes el acceso:\nDemo: ${linkDemo}\nVideo de 2 minutos: [LINK DEL VIDEO EXPLICATIVO DE 2 MINUTOS]\n\n¿Te interesaría una charla de 15 minutos por llamada para analizar si te sirve implementarlo, sin compromisos? ¡Un saludo!`;
        }

        const infoActualizada = {
            ...info,
            analisis_impacto: analisisImpacto || info.analisis_impacto,
            solucion_tecnica: solucionTecnica || info.solucion_tecnica,
            guion_demo: guionDemo || info.guion_demo
        };

        // 3. Actualizar el cliente en Supabase
        const { data: updatedCliente, error: updateError } = await supabase
            .from("clientes")
            .update({
                link_demo: linkDemo,
                msg_whatsapp: finalMessage,
                info_investigacion: infoActualizada
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
