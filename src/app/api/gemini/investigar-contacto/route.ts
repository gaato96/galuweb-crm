import { NextResponse } from "next/server";

// --- Helpers ---

async function fetchImageBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
    try {
        console.log(`[fetchImageBase64] Fetching image from: ${url}`);
        const response = await fetch(url, {
            signal: AbortSignal.timeout(12000),
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
        });
        if (!response.ok) {
            console.warn(`[fetchImageBase64] Fetch failed with status ${response.status} ${response.statusText}`);
            return null;
        }
        const contentType = response.headers.get("content-type") || "image/png";
        const mimeType = contentType.split(";")[0] || "image/png";
        // Only accept image types
        if (!mimeType.startsWith("image/")) {
            console.warn(`[fetchImageBase64] Invalid content type: ${contentType}`);
            return null;
        }
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength < 500) {
            console.warn(`[fetchImageBase64] Retrieved file too small (${buffer.byteLength} bytes), likely error page.`);
            return null;
        }
        const base64 = Buffer.from(buffer).toString("base64");
        console.log(`[fetchImageBase64] Image fetched successfully. Size: ${buffer.byteLength} bytes.`);
        return { data: base64, mimeType };
    } catch (e: any) {
        console.error(`[fetchImageBase64] Error fetching image:`, e.message);
        return null;
    }
}

async function searchBusinessWebsite(businessName: string): Promise<string | null> {
    if (!businessName) return null;
    const query = `${businessName} website`;
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    console.log(`[searchBusinessWebsite] Searching website on DDG: ${ddgUrl}`);
    try {
        const res = await fetch(ddgUrl, {
            signal: AbortSignal.timeout(6000),
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        if (!res.ok) {
            console.warn(`[searchBusinessWebsite] DDG search failed with status ${res.status}`);
            return null;
        }
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
                if (!isSocial) {
                    console.log(`[searchBusinessWebsite] Found candidate domain: ${url}`);
                    return url;
                }
            } catch {}
        }
    } catch (e: any) {
        console.error(`[searchBusinessWebsite] Error in DDG lookup:`, e.message);
    }
    return null;
}

async function fetchMicrolinkLogo(url: string): Promise<string | null> {
    try {
        console.log(`[fetchMicrolinkLogo] Fetching logo from Microlink for: ${url}`);
        const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, {
            signal: AbortSignal.timeout(6000),
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
        });
        if (!res.ok) {
            console.warn(`[fetchMicrolinkLogo] Microlink logo request failed: ${res.status}`);
            return null;
        }
        const data = await res.json();
        const logo = data.data?.logo?.url || null;
        console.log(`[fetchMicrolinkLogo] Found logo: ${logo}`);
        return logo;
    } catch (e: any) {
        console.error(`[fetchMicrolinkLogo] Error:`, e.message);
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
        let isScreenshotSuccessful = false;

        if (link) {
            const normalizedLink = link.startsWith("http") ? link : "https://" + link;

            if (link.includes("instagram.com")) {
                isInstagram = true;
                const username = extractInstagramUsername(link);
                
                // Fallback smart: Search if this business has a website
                const resolvedWebsite = await searchBusinessWebsite(negocio || username || "");
                
                if (resolvedWebsite) {
                    targetWebsiteUrl = resolvedWebsite;
                    
                    // Fetch logo via Microlink
                    const microlinkLogo = await fetchMicrolinkLogo(targetWebsiteUrl);
                    const domain = extractDomain(targetWebsiteUrl);
                    logoUrl = microlinkLogo || `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                    
                    // Fetch screenshot via Microlink
                    const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(targetWebsiteUrl)}&screenshot=true&embed=screenshot.url`;
                    imageDescription = `Captura de pantalla del sitio web oficial (${targetWebsiteUrl}) del negocio, obtenido buscando el perfil de Instagram.`;
                    
                    const base64Result = await fetchImageBase64(screenshotUrl);
                    if (base64Result) {
                        imageBase64 = base64Result;
                        isScreenshotSuccessful = true;
                    }
                } else {
                    // Instagram only, no website found. Instagram blocks direct scrapers.
                    logoUrl = "";
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
                
                const base64Result = await fetchImageBase64(screenshotUrl);
                if (base64Result) {
                    imageBase64 = base64Result;
                    isScreenshotSuccessful = true;
                }
            }
        }

        console.log(`[Investigación IA] Screenshot exitoso: ${isScreenshotSuccessful ? "SÍ" : "NO"}`);

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

        // --- Retry loop for Gemini API ---
        let attempt = 0;
        let response: any = null;
        let data: any = null;
        let success = false;
        const maxAttempts = 3;

        // We use gemini-2.5-flash as requested by the user.
        while (attempt < maxAttempts && !success) {
            attempt++;
            try {
                console.log(`[Gemini API] Llamando a gemini-2.5-flash (Intento ${attempt}/${maxAttempts})...`);
                response = await fetch(
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
                
                data = await response.json();
                
                if (response.ok) {
                    success = true;
                    console.log(`[Gemini API] Petición exitosa en el intento ${attempt}`);
                } else {
                    const errMsg = data.error?.message || "Unknown error";
                    console.warn(`[Gemini API] Intento ${attempt} falló (Status ${response.status}): ${errMsg}`);
                    
                    if (attempt < maxAttempts) {
                        const delay = attempt * 1500;
                        console.log(`[Gemini API] Esperando ${delay}ms antes del reintento...`);
                        await new Promise((resolve) => setTimeout(resolve, delay));
                    }
                }
            } catch (err: any) {
                console.error(`[Gemini API] Error de red en intento ${attempt}:`, err.message);
                if (attempt < maxAttempts) {
                    await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
                }
            }
        }

        if (!success) {
            const errMsg = data?.error?.message || "No se pudo comunicar con Gemini después de 3 intentos.";
            return NextResponse.json({ error: errMsg }, { status: response ? response.status : 500 });
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        try {
            const parsed = JSON.parse(text);
            // Inject resolved logo URL if missing in parsed JSON
            if (logoUrl && !parsed.logo_url) parsed.logo_url = logoUrl;
            return NextResponse.json(parsed);
        } catch {
            console.error("Error al parsear respuesta JSON de Gemini:", text);
            return NextResponse.json({
                que_hace: `Negocio de ${negocio || "servicios"}.`,
                puntos_debiles: "• Dificultad para captar clientes online.\n• Falta de optimización digital.",
                soluciones: "• Desarrollo de Landing Page.\n• Integración de CRM.",
                colores: "Paleta neutra sugerida (la IA no pudo generar un formato JSON válido).",
                tipografia: "Google Fonts premium: Inter + Sora.",
                logo_url: logoUrl,
                rawText: text
            });
        }
    } catch (error: any) {
        console.error("[POST Route Error]:", error);
        return NextResponse.json({ error: error.message || "Error interno al procesar la IA" }, { status: 500 });
    }
}
