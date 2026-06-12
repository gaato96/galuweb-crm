import { NextResponse } from "next/server";

// --- Helpers ---

async function fetchImageBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
    try {
        const response = await fetch(url, {
            signal: AbortSignal.timeout(9000),
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
        });
        if (!response.ok) return null;
        const contentType = response.headers.get("content-type") || "image/png";
        const mimeType = contentType.split(";")[0] || "image/png";
        // Only accept image types
        if (!mimeType.startsWith("image/")) return null;
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength < 500) return null; // too small, probably an error page
        const base64 = Buffer.from(buffer).toString("base64");
        return { data: base64, mimeType };
    } catch {
        return null;
    }
}

async function searchBusinessWebsite(businessName: string): Promise<string | null> {
    if (!businessName) return null;
    const query = `${businessName} website`;
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    try {
        const res = await fetch(ddgUrl, {
            signal: AbortSignal.timeout(6000),
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        if (!res.ok) return null;
        const html = await res.text();
        const regexLinks = /<a class="result__url"[^>]*href="([^"]+)"/g;
        let match;
        const domainsToExclude = [
            "instagram.com", "facebook.com", "twitter.com", "linkedin.com",
            "youtube.com", "pinterest.com", "tiktok.com", "duckduckgo.com",
            "wikipedia.org", "yelp.com", "tripadvisor.com"
        ];
        while ((match = regexLinks.exec(html)) !== null) {
            let url = match[1];
            if (url.includes("uddg=")) {
                const parts = url.split("uddg=");
                if (parts[1]) {
                    url = decodeURIComponent(parts[1].split("&")[0]);
                }
            }
            try {
                const parsed = new URL(url);
                const hostname = parsed.hostname.toLowerCase();
                const isSocial = domainsToExclude.some(d => hostname.includes(d));
                if (!isSocial) return url;
            } catch {}
        }
    } catch {}
    return null;
}

async function fetchMicrolinkLogo(url: string): Promise<string | null> {
    try {
        const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, {
            signal: AbortSignal.timeout(6000),
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.data?.logo?.url || null;
    } catch {
        return null;
    }
}

function extractInstagramUsername(url: string): string | null {
    const match = url.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
    if (!match) return null;
    const username = match[1];
    // Skip known non-profile paths
    if (["p", "reel", "stories", "explore", "accounts"].includes(username)) return null;
    return username;
}

function extractDomain(url: string): string {
    try {
        const parsed = new URL(url.startsWith("http") ? url : "https://" + url);
        return parsed.hostname.replace(/^www\./, "");
    } catch {
        return url.replace(/https?:\/\/(www\.)?/, "").split("/")[0];
    }
}

// --- Main Route ---

export async function POST(req: Request) {
    try {
        const { nombre, negocio, link, contexto } = await req.json();

        if (!nombre) {
            return NextResponse.json({ error: "El nombre del contacto es requerido" }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({
                error: "GEMINI_API_KEY no está configurada en las variables de entorno (.env.local)."
            }, { status: 500 });
        }

        // --- Resolve Image & Logo ---
        let imageBase64: { data: string; mimeType: string } | null = null;
        let logoUrl = "";
        let imageDescription = "";
        let isInstagram = false;
        let targetWebsiteUrl = "";

        if (link) {
            const normalizedLink = link.startsWith("http") ? link : "https://" + link;

            if (link.includes("instagram.com")) {
                isInstagram = true;
                const username = extractInstagramUsername(link);
                
                // Fallback smart: Search if this business has a website
                console.log(`Buscando sitio web oficial para el Instagram: ${username}`);
                const resolvedWebsite = await searchBusinessWebsite(negocio || username || "");
                
                if (resolvedWebsite) {
                    targetWebsiteUrl = resolvedWebsite;
                    console.log(`Sitio web encontrado: ${targetWebsiteUrl}`);
                    
                    // Fetch logo via Microlink
                    const microlinkLogo = await fetchMicrolinkLogo(targetWebsiteUrl);
                    const domain = extractDomain(targetWebsiteUrl);
                    logoUrl = microlinkLogo || `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                    
                    // Fetch screenshot via Microlink
                    const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(targetWebsiteUrl)}&screenshot=true&embed=screenshot.url`;
                    imageDescription = `Captura de pantalla del sitio web oficial (${targetWebsiteUrl}) del negocio, obtenido buscando el perfil de Instagram.`;
                    imageBase64 = await fetchImageBase64(screenshotUrl);
                } else {
                    // Instagram only, no website found. Instagram blocks direct scrapers.
                    logoUrl = ""; // Leave empty or set to blank so user can fill it. Do NOT set unavatar fallback.
                    imageDescription = "Perfil de Instagram sin sitio web detectado. No se puede acceder visualmente por el muro de login de Meta.";
                }
            } else {
                // Website: screenshot and logo via Microlink
                targetWebsiteUrl = normalizedLink;
                const domain = extractDomain(targetWebsiteUrl);
                const microlinkLogo = await fetchMicrolinkLogo(targetWebsiteUrl);
                logoUrl = microlinkLogo || `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                
                const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(targetWebsiteUrl)}&screenshot=true&embed=screenshot.url`;
                imageDescription = `Captura de pantalla del sitio web oficial: ${targetWebsiteUrl}`;
                imageBase64 = await fetchImageBase64(screenshotUrl);
            }
        }

        // --- Build Gemini Prompt ---
        const visualTask = imageBase64
            ? `4. ANÁLISIS DE IDENTIDAD VISUAL — Analiza la imagen adjunta (${imageDescription}) con mucho detalle:
   - Paleta de colores: Identifica los COLORES REALES y DOMINANTES que ves en la imagen. Nombra cada color descriptivamente y provee su código hexadecimal exacto aproximado (ej: "Fondo crema cálido #F5ECD7", "Verde salvia principal #7D9B76", "Texto marrón oscuro #3B2A1A"). Lista al menos 3 colores reales.
   - Tipografía: Identifica el estilo tipográfico visible en la imagen. Sugiere la tipografía de Google Fonts más similar.
   - Logo: Establece logo_url como: "${logoUrl}"`
            : `4. ANÁLISIS DE IDENTIDAD VISUAL (sin imagen disponible — sugiere basándote en el rubro):
   - Propón una paleta de colores coherente con el nicho del negocio (con nombres y hex).
   - Sugiere tipografías premium de Google Fonts adecuadas para el rubro.
   - Logo: ${logoUrl ? `Establece logo_url como: "${logoUrl}"` : "No disponible"}`;

        const textPrompt = `Actúa como un diseñador UI/UX experto, consultor de negocios y estratega digital para Galuweb, una agencia de desarrollo web de alto nivel.
Analiza la siguiente información de un lead comercial${imageBase64 ? " y la imagen adjunta" : ""}:

--- DATOS DEL LEAD ---
Nombre: ${nombre}
Negocio/Nombre comercial: ${negocio || "No especificado"}
Enlace del negocio: ${link || "No provisto"}
Sitio web encontrado (si aplica): ${targetWebsiteUrl || "No aplica"}
Contexto/Observaciones: ${contexto || "Ninguna"}

--- TAREA ---
1. Deduce a qué se dedica el negocio en base a su nombre, enlace y contexto.
2. Identifica al menos 3 puntos débiles en su presencia digital u operativa (procesos manuales, falta de automatización, baja captación online, etc.).
3. Propón soluciones específicas que Galuweb puede construir (Landing Page, E-commerce, Web App, automatizaciones, etc.).
4. Realiza el análisis visual siguiendo estas instrucciones:
${visualTask}

Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código markdown:
{
  "que_hace": "Resumen conciso y profesional de la actividad del negocio (máx 80 palabras).",
  "puntos_debiles": "Al menos 3 puntos débiles como lista de viñetas cortas y claras.",
  "soluciones": "Soluciones de diseño/desarrollo que Galuweb puede implementar, como lista de viñetas.",
  "colores": "Paleta de colores con nombres descriptivos y códigos hex (ej: #1A1A2E Azul Marino Profundo, #E94560 Rojo Acento).",
  "tipografia": "Tipografías detectadas en la imagen o sugerencia de Google Fonts premium para el rubro.",
  "logo_url": "${logoUrl || ""}"
}`;

        // --- Build Gemini Request Parts ---
        const parts: object[] = [];

        if (imageBase64) {
            parts.push({
                inlineData: {
                    mimeType: imageBase64.mimeType,
                    data: imageBase64.data
                }
            });
        }

        parts.push({ text: textPrompt });

        // Using gemini-2.5-flash for higher visual accuracy and faster processing
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: { responseMimeType: "application/json" }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json({
                error: data.error?.message || "Error de comunicación con el servicio de Gemini."
            }, { status: response.status });
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        try {
            const parsed = JSON.parse(text);
            // Inject the resolved logo URL if it was found and not returned by Gemini
            if (logoUrl && !parsed.logo_url) parsed.logo_url = logoUrl;
            return NextResponse.json(parsed);
        } catch {
            console.error("Error al parsear respuesta JSON de Gemini:", text);
            return NextResponse.json({
                que_hace: `Negocio de ${negocio || "servicios"}.`,
                puntos_debiles: "• Dificultad para captar clientes online.\n• Falta de optimización digital.",
                soluciones: "• Desarrollo de Landing Page.\n• Integración de CRM.",
                colores: "Paleta neutra sugerida (requiere imagen para análisis preciso).",
                tipografia: "Google Fonts premium: Inter + Sora.",
                logo_url: logoUrl,
                rawText: text
            });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Error interno al procesar la IA" }, { status: 500 });
    }
}
