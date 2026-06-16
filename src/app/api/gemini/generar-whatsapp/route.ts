import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { nombre, negocio, que_hace, puntos_debiles, soluciones, tipo_pagina, link_demo, prompt_maestro } = await req.json();

        if (!nombre) {
            return NextResponse.json({ error: "El nombre del contacto es requerido" }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({
                error: "GEMINI_API_KEY no está configurada en las variables de entorno (.env.local). Por favor agrégala para usar el asistente de IA."
            }, { status: 500 });
        }

        const prompt = `Actúa como un Copywriter Experto en Ventas B2B y Estratega de Optimización de Conversión de la agencia Galu Diseño Web. Tu misión es transformar negocios utilizando las soluciones de Galu Diseño Web.

Nuestros servicios: Diseño web en WordPress, Web Apps de alto rendimiento con Next.js/Supabase, y automatización de procesos (CRM, turnos, pagos).
Nuestro enfoque: No vendo 'estética', vendo soluciones a problemas de negocio y dolores reales.

Te daré los datos de un prospecto:
- Nombre del contacto: ${nombre}
- Negocio: ${negocio || "Su negocio"}
- Qué hace: ${que_hace || "No especificado"}
- Debilidades: ${puntos_debiles || "No especificados"}
- Soluciones propuestas: ${soluciones || "No especificadas"}
- Tipo de página: ${tipo_pagina || "landing"}
- Link Demo (Vercel): ${link_demo || "No provisto"}
- Prompt Maestro de la Demo: ${prompt_maestro || "No provisto"}

Debes generar los siguientes campos y responder ÚNICAMENTE con un objeto JSON válido con las claves especificadas abajo (no incluyas bloques de código ni texto fuera del JSON):
{
  "analisis_impacto": "Una explicación muy breve e impactante de cuánto dinero o tiempo está perdiendo el negocio por sus fallas o debilidades actuales.",
  "solucion_tecnica": "Qué herramienta o stack técnico exacto se está proponiendo en la demo y por qué (Ej: Una landing en Next.js para velocidad instantánea, o un sistema de turnos tipo 'Tu Turno' integrado con Supabase para automatizar el control).",
  "mensaje": "Mensaje frío pero altamente personalizado para enviar por WhatsApp al prospecto. Saludo inicial personalizado ('Hola ${nombre}, ¿cómo estás?'), mención directa y empática a sus debilidades y dolor, presentación del Link Demo (${link_demo || "[LINK DE LA DEMO EN VERCEL]"}) y mención del video explicativo literal '[LINK DEL VIDEO EXPLICATIVO DE 2 MINUTOS]', cerrando con CTA de baja fricción invitando a charla de 15 minutos. Sin palabras cliché como 'revolucionario' o 'innovador'.",
  "guion_demo": "Un guion detallado y personalizado para que yo grabe un video de 2 minutos mostrando mi pantalla con la web demo generada y leyendo este guion con voz en off. Debe estructurarse en base a las secciones y funciones que tiene la web demo según el Prompt Maestro y las Debilidades. Usa un tono natural, amigable y explicativo, detallando cómo cada sección resuelve sus problemas operativos."
}

Ejemplo de estructura para el guion (adápalo a las secciones de la demo actual):
\"Hola! ¿Cómo están? Bueno, les hice este video básicamente para mostrarles una demo de lo que podría ser su web. Si bien esto es solo demostrativo para que vean las funciones que tendría, la idea es que esto lo diseñemos a medida para su negocio y podamos trabajarlo juntos. Bueno, esta sería la vista principal... En todo momento sale el botón de reservar/comprar... Luego muestra características... Testimonios... Para reservar presionamos acá... Eso sería básicamente la web... Espero les guste, y si les llega a interesar o tienen alguna duda, me avisan. Un saludo.\"`;

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
                analisis_impacto: `Sufren pérdidas por procesos ineficientes.`,
                solucion_tecnica: `Web App en Next.js con Supabase.`,
                mensaje: `Hola ${nombre}, ¿cómo estás? Analizando el sistema actual de ${negocio || "tu negocio"} noté cuellos de botella en la gestión manual de reservas. Comprendo la frustración de perder tiempo valioso en tareas repetitivas.\n\nPara mostrarte cómo solucionarlo de raíz, armé una versión interactiva y funcional de cómo debería verse y operar el sistema de ${negocio || "tu negocio"}.\n\nAquí tienes el acceso:\nDemo: ${link_demo || "[LINK DE LA DEMO EN VERCEL]"}\nVideo de 2 minutos: [LINK DEL VIDEO EXPLICATIVO DE 2 MINUTOS]\n\n¿Te interesaría una charla de 15 minutos por llamada para analizar si te sirve implementarlo, sin compromisos? ¡Un saludo!`,
                guion_demo: `Hola! ¿Cómo están? Bueno, les hice este video básicamente para mostrarles una demo de lo que podría ser su web...`
            });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Error interno al procesar la IA" }, { status: 500 });
    }
}
