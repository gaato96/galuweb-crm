import { llamarGemini, parsearJSON, respuestaError } from "@/lib/gemini";
import { normalizarCotizacionIA } from "@/lib/cotizacion-ia";
import type { BriefingCotizacion, TipoCotizacion } from "@/lib/types";

/** Las secciones que el PDF dibuja, según el tipo. El orden es el del documento. */
const ESTRUCTURA_WEB = `"descripcion": 01. Descripción del Proyecto — dos o tres párrafos: cómo resuelve esto hoy, qué le cuesta, y qué pasa a hacer el sitio por él. Cerrá con una frase que diga qué es el sitio en una línea.
"alcance": 02. Alcance y Funcionalidades — agrupado en 4 a 6 bloques con **título** y viñetas debajo.
"cronograma": 03. Cronograma de Trabajo — arrancá con el plazo total en una línea, después un bloque **Semana N — Nombre** por etapa, con viñetas.
"terminos": 04. Términos y Modalidad de Pago — bloques **Qué incluye**, **Qué queda por fuera**, **Mantenimiento (opcional)** si corresponde, y **Condiciones generales**.
"conclusion": 05. Conclusión — dos o tres párrafos de cierre. Sin viñetas. Que le devuelva lo que ya tiene a favor y qué cambia con esto.
"proximos_pasos": 06. Próximos Pasos — 3 a 5 viñetas, en orden, empezando por confirmar y terminando por el resultado.`;

const ESTRUCTURA_WEBAPP = `"descripcion": 01. Descripción del Sistema — dos bloques: **Problema institucional** (o del negocio) y **Valor proporcionado**, con dos párrafos cada uno.
"alcance": 02. Módulos y Funcionalidades — un bloque **por módulo**, con viñetas concretas debajo de cada uno.
"arquitectura": 03. Arquitectura y Tecnología — viñetas que arranquen con el aspecto y dos puntos, sin asteriscos: "Aplicación: ...", "Base de datos: ...", "Acceso y permisos: ...", "Infraestructura: ...". Si el sistema guarda datos personales sensibles, sumá un bloque **Resguardo de datos personales** que aclare qué protege el sistema y de quién es la responsabilidad sobre los datos.
"cronograma": 04. Plan de Desarrollo — plazo total en una línea, después un bloque **Fase N · Nombre — Semana X** por etapa, con viñetas.
"terminos": 05. Términos y Modelo de Pago — bloques **Qué incluye**, **Alcance cerrado** (un párrafo que liste lo que NO entra y explique que dejarlo escrito es lo que sostiene precio y plazo), **Costos recurrentes** y **Condiciones generales**.
"proximos_pasos": 06. Próximos Pasos — 3 a 5 viñetas, en orden.`;

export async function POST(req: Request) {
    try {
        const { briefing, tipo, cliente, negocio } = (await req.json()) as {
            briefing?: BriefingCotizacion;
            tipo?: TipoCotizacion;
            cliente?: string;
            negocio?: string;
        };

        const b = briefing;
        if (!b?.notas_reunion?.trim() && !b?.requerimientos?.trim()) {
            return Response.json(
                { error: "Contá qué se habló en la reunión o qué pidió el cliente para poder cotizar." },
                { status: 400 }
            );
        }
        if (!b?.presupuesto?.trim()) {
            return Response.json(
                { error: "Decí cuánto le vas a cobrar. Sin eso la IA inventa el precio." },
                { status: 400 }
            );
        }

        const esWebApp = tipo === "webapp";

        const prompt = `Sos el director de Galu, una agencia argentina de diseño y desarrollo web, y estás redactando una propuesta comercial para mandarle a un cliente.

CLIENTE
- Nombre: ${cliente || "—"}
- Negocio: ${negocio || "—"}
- Tipo de propuesta: ${esWebApp ? "Web App / Software a medida" : "Página web"}

LO QUE SE RELEVÓ
- Qué se habló: """${b.notas_reunion?.trim() || "—"}"""
- Cómo lo resuelve hoy y qué le duele: """${b.situacion_actual?.trim() || "—"}"""
- Qué pidió puntualmente: """${b.requerimientos?.trim() || "—"}"""
- A quién le vende o quién lo usa: """${b.publico?.trim() || "—"}"""
- Plazo: """${b.plazo?.trim() || "—"}"""
- Condiciones y lo que queda afuera: """${b.condiciones?.trim() || "—"}"""

PRECIO — ESTO NO SE NEGOCIA
- Lo que se le va a cobrar: """${b.presupuesto.trim()}"""
- Cómo se paga: """${b.forma_pago?.trim() || "—"}"""

Armá el desglose de ítems para que la SUMA DÉ EXACTAMENTE ese total. Nunca lo cambies ni lo redondees por tu cuenta.
Si el precio final es un precio con descuento, cotizá cada ítem a su valor de lista, sumá más que el total, y agregá como ÚLTIMO ítem el descuento con precio NEGATIVO, de modo que la suma cierre en el número pedido. El descuento razonable va entre 30% y 40%: sirve para que se vea el valor real del trabajo, no para simular una rebaja imposible.
Entre 5 y 8 ítems, nombrados por lo que el cliente recibe, no por la tarea técnica.
El plan de pago tiene que sumar el mismo total y respetar lo que se indicó arriba.

CÓMO ESCRIBIR
- Español rioplatense, de vos. Tono profesional y directo, sin vender humo ni adjetivos de folleto.
- Hablale al cliente de sus problemas concretos, con sus palabras y su rubro. Nada de frases que servirían para cualquier otro cliente.
- Nunca inventes datos que no estén en el relevamiento: ni cantidades, ni nombres de herramientas que no se mencionaron, ni funcionalidades que no pidió. Si algo no se dijo, no lo pongas.
- Si el relevamiento no alcanza para una sección, escribí lo que sí se sostiene y dejá el resto corto. Preferimos breve y cierto a largo e inventado.

FORMATO DEL TEXTO DE CADA SECCIÓN (lo interpreta el generador de PDF)
- Una línea que empieza y termina con ** es un subtítulo en negrita. Ej: **Qué incluye**
- La negrita es SOLO de línea completa. No hay negrita en medio de una frase ni dentro de una viñeta: los ** sueltos se borran al imprimir.
- Una línea que empieza con "- " es una viñeta.
- Cualquier otra línea es un párrafo.
- No uses markdown más allá de eso: ni ###, ni tablas, ni numeración manual de secciones.

SECCIONES A ESCRIBIR
${esWebApp ? ESTRUCTURA_WEBAPP : ESTRUCTURA_WEB}

Respondé SOLO con este JSON:
{
  "items": [{ "descripcion": "string", "precio": 0 }],
  "plan_pago": [{ "cuando": "Pago 1 · Al aceptar", "monto": 0, "detalle": "frase corta de qué cubre ese pago" }],
  "secciones": { ${(esWebApp
                ? ["descripcion", "alcance", "arquitectura", "cronograma", "terminos", "proximos_pasos"]
                : ["descripcion", "alcance", "cronograma", "terminos", "conclusion", "proximos_pasos"]
            ).map((k) => `"${k}": "string"`).join(", ")} },
  "resumen_interno": "2 frases para vos, no para el cliente: cómo se armó el precio y qué conviene revisar antes de mandarla"
}`;

        const texto = await llamarGemini(prompt, { json: true });
        const generada = normalizarCotizacionIA(parsearJSON(texto), esWebApp ? "webapp" : "web");

        if (generada.items.length === 0) {
            return Response.json(
                { error: "La IA no devolvió ítems. Probá de nuevo con más detalle en el relevamiento." },
                { status: 502 }
            );
        }

        return Response.json({ cotizacion: generada });
    } catch (e) {
        return respuestaError(e);
    }
}
