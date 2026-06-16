import { NextResponse } from "next/server";

// Allow up to 60s for this route (2 Gemini calls + image fetches)
export const maxDuration = 60;

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

async function getInstagramProfilePic(username: string): Promise<string | null> {
    try {
        console.log(`[getInstagramProfilePic] Searching DDG image for Instagram avatar of: ${username}`);
        const mainUrl = `https://duckduckgo.com/?q=${encodeURIComponent('site:instagram.com "' + username + '" profile pic')}`;
        const mainRes = await fetch(mainUrl, {
            signal: AbortSignal.timeout(6000),
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        if (!mainRes.ok) return null;
        const html = await mainRes.text();
        const regexVqd = /vqd=([^&'"]+)/;
        const match = html.match(regexVqd);
        if (!match) return null;
        const vqd = match[1];
        
        const imagesUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent('site:instagram.com "' + username + '" profile pic')}&o=json&vqd=${vqd}`;
        const imagesRes = await fetch(imagesUrl, {
            signal: AbortSignal.timeout(6000),
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://duckduckgo.com/"
            }
        });
        if (!imagesRes.ok) return null;
        const data: any = await imagesRes.json();
        if (data.results && data.results.length > 0) {
            const candidates = data.results.filter((item: any) => {
                const title = item.title.toLowerCase();
                const image = item.image.toLowerCase();
                return image.includes("profile") || image.includes("avatar") || title.includes("profile") || title.includes("avatar") || image.includes("lookaside.fbsbx.com/lookaside/crawler/instagram");
            });
            if (candidates.length > 0) {
                return candidates[0].thumbnail || candidates[0].image;
            }
            return data.results[0].thumbnail || data.results[0].image;
        }
    } catch (e: any) {
        console.error(`[getInstagramProfilePic] Error:`, e.message);
    }
    return null;
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

// --- Robust JSON extraction ---
function extractJSON(raw: string): any | null {
    // 1. Try direct parse
    const trimmed = raw.trim();
    try { return JSON.parse(trimmed); } catch {}

    // 2. Strip markdown code fences (```json ... ``` or ``` ... ```)
    const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
        try { return JSON.parse(fenceMatch[1].trim()); } catch {}
    }

    // 3. Find the first { ... } block that looks like valid JSON
    const braceStart = raw.indexOf("{");
    if (braceStart !== -1) {
        let depth = 0;
        let braceEnd = -1;
        for (let i = braceStart; i < raw.length; i++) {
            if (raw[i] === "{") depth++;
            if (raw[i] === "}") depth--;
            if (depth === 0) { braceEnd = i; break; }
        }
        if (braceEnd !== -1) {
            const candidate = raw.substring(braceStart, braceEnd + 1);
            try { return JSON.parse(candidate); } catch {}
            // Try fixing common issues: trailing commas
            try {
                const fixed = candidate
                    .replace(/,\s*}/g, "}")
                    .replace(/,\s*]/g, "]");
                return JSON.parse(fixed);
            } catch {}
        }
    }

    return null;
}

// --- Main Route ---

export async function POST(req: Request) {
    try {
        const { nombre, negocio, link, contexto, tipo_pagina } = await req.json();

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
                
                if (username) {
                    // Fetch real profile avatar from DDG Image search
                    const avatarUrl = await getInstagramProfilePic(username);
                    if (avatarUrl) {
                        logoUrl = avatarUrl;
                    }
                }
                
                // Fallback smart: Search if this business has a website
                const resolvedWebsite = await searchBusinessWebsite(negocio || username || "");
                
                if (resolvedWebsite) {
                    targetWebsiteUrl = resolvedWebsite;
                    
                    if (!logoUrl) {
                        // Fetch logo via Microlink
                        const microlinkLogo = await fetchMicrolinkLogo(targetWebsiteUrl);
                        const domain = extractDomain(targetWebsiteUrl);
                        logoUrl = microlinkLogo || `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                    }
                    
                    // Fetch screenshot via Microlink of their website
                    const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(targetWebsiteUrl)}&screenshot=true&embed=screenshot.url`;
                    imageDescription = `Captura de pantalla del sitio web oficial (${targetWebsiteUrl}) del negocio, obtenido buscando el perfil de Instagram.`;
                    
                    const base64Result = await fetchImageBase64(screenshotUrl);
                    if (base64Result) {
                        imageBase64 = base64Result;
                        isScreenshotSuccessful = true;
                    }
                } else {
                    // Instagram only, no website found.
                    if (!logoUrl) {
                        logoUrl = "";
                    }
                    imageDescription = "Perfil de Instagram sin sitio web detectado. La investigación se realizará mediante búsqueda integrada.";
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

        // --- Build Gemini Request Config (Grounding vs standard visual call) ---
        let contents: any[] = [];
        let tools: any[] = [];

        if (isInstagram && !isScreenshotSuccessful) {
            // Instagram profile investigation using Google Search Grounding
            const username = extractInstagramUsername(link) || negocio || nombre;
            const groundingPrompt = `Actúa como un diseñador UI/UX experto, consultor de negocios y estratega digital para la agencia Galuweb.
Investiga el perfil de Instagram del usuario/negocio "${username}" (enlace: ${link}) usando la búsqueda de Google.
Busca y extrae la siguiente información real:
1. ¿A qué se dedica exactamente este negocio?
2. ¿Cuántos seguidores tiene aproximadamente?
3. ¿Cuál es su biografía o descripción de perfil?
4. ¿Qué sitio web tiene enlazado en su biografía (si hay alguno)?
5. ¿Cuál es el estilo visual de sus publicaciones (colores predominantes, tipo de fotos, estética general)?

--- DATOS ADICIONALES DEL CLIENTE ---
Nombre del contacto: ${nombre}
Negocio: ${negocio || "No especificado"}
Observaciones/Anotaciones provistas por el usuario: ${contexto || "Ninguna (si el usuario escribió algo aquí sobre el perfil, dale prioridad máxima)"}
Tipo de proyecto seleccionado: ${tipo_pagina || "landing"}

--- TAREA ---
Identifica al menos 3 puntos débiles u oportunidades de mejora en su presencia digital (por ejemplo, si no tiene web, si su link en bio está roto o falta, si no automatiza reservas, si su catálogo es manual, si le falta captación online, etc.) y propón soluciones de desarrollo que Galuweb puede construir para este tipo de proyecto: "${tipo_pagina || "landing"}".

Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código markdown:
{
  "que_hace": "Resumen conciso y profesional de la actividad del negocio y datos del perfil como seguidores o bio (máx 80 palabras).",
  "puntos_debiles": "Al menos 3 puntos débiles como lista de viñetas cortas y claras.",
  "soluciones": "Soluciones específicas de diseño/desarrollo que Galuweb puede implementar orientadas al tipo de proyecto '${tipo_pagina || "landing"}', como lista de viñetas.",
  "colores": "Paleta de colores dominantes que se observan en las imágenes/posteos de su perfil de Instagram, con nombres y hex (ej: #E8A598 Rosa Salmón, #4A3E3D Marrón Oscuro). Provee al menos 3 colores reales.",
  "tipografia": "Tipografías o estilos tipográficos sugeridos (Google Fonts premium) que vayan en sintonía con su marca y estilo de Instagram.",
  "logo_url": "${logoUrl || ""}"
}`;

            contents = [{ parts: [{ text: groundingPrompt }] }];
            tools = [{ googleSearch: {} }];
        } else {
            // Standard analysis with screenshot
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
Contexto/Observaciones provistas por el usuario: ${contexto || "Ninguna (si el usuario escribió algo aquí sobre el negocio, dale prioridad máxima)"}
Tipo de proyecto seleccionado: ${tipo_pagina || "landing"}

--- TAREA ---
1. Deduce a qué se dedica el negocio en base a su nombre, enlace y contexto.
2. Identifica al menos 3 puntos débiles en su presencia digital u operativa (procesos manuales, falta de automatización, baja captación online, etc.).
3. Propón soluciones específicas que Galuweb puede construir orientadas al tipo de proyecto "${tipo_pagina || "landing"}" (Landing Page, E-commerce, Web App, automatizaciones, etc.).
4. Realiza el análisis visual siguiendo estas instrucciones:
${visualTask}

Responde ÚNICAMENTE con un objeto JSON válido, sin bloques de código markdown:
{
  "que_hace": "Resumen conciso y profesional de la actividad del negocio (máx 80 palabras).",
  "puntos_debiles": "Al menos 3 puntos débiles como lista de viñetas cortas y claras.",
  "soluciones": "Soluciones de diseño/desarrollo que Galuweb puede implementar orientadas al tipo de proyecto '${tipo_pagina || "landing"}', como lista de viñetas.",
  "colores": "Paleta de colores con nombres descriptivos y códigos hex (ej: #1A1A2E Azul Marino Profundo, #E94560 Rojo Acento).",
  "tipografia": "Tipografías detectadas en la imagen o sugerencia de Google Fonts premium para el rubro.",
  "logo_url": "${logoUrl || ""}"
}`;

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
            contents = [{ parts }];
        }

        // --- Retry loop for Gemini API ---
        let attempt = 0;
        let response: any = null;
        let data: any = null;
        let success = false;
        const maxAttempts = 3;

        while (attempt < maxAttempts && !success) {
            attempt++;
            try {
                console.log(`[Gemini API] Llamando a gemini-2.5-flash (Intento ${attempt}/${maxAttempts})...`);
                const bodyPayload: any = {
                    contents
                };
                if (tools.length > 0) {
                    bodyPayload.tools = tools;
                } else {
                    bodyPayload.generationConfig = { responseMimeType: "application/json" };
                }

                response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(bodyPayload)
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
            console.error("[Gemini API] Todas las llamadas fallaron. Último error:", errMsg);
            return NextResponse.json({ error: errMsg }, { status: response ? response.status : 500 });
        }

        // --- Extract text from ALL parts (grounding returns multiple parts) ---
        const allParts = data.candidates?.[0]?.content?.parts || [];
        let text = allParts
            .filter((p: any) => typeof p.text === "string")
            .map((p: any) => p.text)
            .join("\n");
        
        console.log(`[Gemini API] Respuesta recibida. Partes: ${allParts.length}, Texto total: ${text.length} chars`);
        if (text.length < 50) {
            console.warn(`[Gemini API] Respuesta muy corta, texto completo:`, text);
        } else {
            console.log(`[Gemini API] Primeros 300 chars:`, text.substring(0, 300));
        }

        const parsed = extractJSON(text);
        
        if (!parsed) {
            console.error("[Gemini API] No se pudo extraer JSON de la respuesta de investigación. Texto completo:", text);
            // Even if JSON parsing failed, return what we have with the raw text
            // so the user sees something and can manually fill in
            return NextResponse.json({
                que_hace: `Negocio de ${negocio || "servicios"}.`,
                puntos_debiles: "• No se pudo analizar automáticamente. Revisa el enlace o agrega más contexto en las observaciones.",
                soluciones: "• Intenta nuevamente con más datos o un enlace diferente.",
                colores: "",
                tipografia: "",
                logo_url: logoUrl,
                prompt_maestro: "",
                tipo_pagina: tipo_pagina || "landing",
                _error: "La IA no devolvió un JSON válido. Intenta de nuevo o agrega más contexto.",
                _rawPreview: text.substring(0, 500)
            });
        }

        console.log("[Gemini API] JSON de investigación extraído exitosamente. Claves:", Object.keys(parsed).join(", "));
        
        // Inject resolved logo URL if missing in parsed JSON
        if (logoUrl && !parsed.logo_url) parsed.logo_url = logoUrl;

        // --- Call 2: Generate Prompt Maestro (GEM logic) ---
        let promptMaestro = "";
        if (apiKey) {
            console.log("[Gemini API] Generando Prompt Maestro...");
            const gemSystemPrompt = `Afecta el rol de Arquitecto de Software Senior y Experto en Ingeniería de Prompts para Inteligencias Artificiales de Código (como Antigravity/Cursor). 

Tu único objetivo es recibir un NICHO DE NEGOCIO, una NECESIDAD y el TIPO DE PÁGINA A DESARROLLAR, y devolverme un PROMPT MAESTRO HIPER-DETALLADO, EXTENSO Y TÉCNICO que yo pueda copiar y pegar directamente en Antigravity para que me genere una aplicación web de conversión brutal usando Next.js y Tailwind CSS. El tipo de proyecto es: "${tipo_pagina || "landing"}". Sin integración a Supabase ya que no tendría base de datos porque esto sería solo una Demo para presentar al potencial cliente. 

El prompt maestro que me devuelvas debe ser masivo y estructurado OBLIGATORIAMENTE con las siguientes secciones explícitas:
1. CONTEXTO DEL NEGOCIO Y PÚBLICO OBJETIVO: Explicar el dolor del cliente final de ese nicho.
2. ARQUITECTURA DE COMPONENTES: Lista exhaustiva de componentes modulares, limpios y responsivos específicos para un proyecto de tipo "${tipo_pagina || "landing"}".
3. ESPECIFICACIONES DE DISEÑO (TAILWIND): Paleta de colores premium para el nicho, tipografías, espaciados y animaciones sutiles.
4. COPIA Y CONVERSIÓN (COPYWRITING): Estructura exacta de los textos, títulos ganadores y llamadas a la acción (CTA) según el nicho y el tipo de página.
5. LOGICA DE CÓDIGO (NEXT.JS): Manejo de estados, hooks necesarios y validaciones de formularios correspondientes a la funcionalidad.

Por favor, sé extremadamente minucioso, prolijo y extenso. No resumas nada. Dame todo el código de configuración y las instrucciones estructurales para que Antigravity trabajaje en modo "Vibe Coding" sin errores.`;

            const gemInput = `--- DATOS DEL NEGOCIO ---
Nombre comercial: ${negocio || nombre}
Tipo de proyecto solicitado: ${tipo_pagina || "landing"}
Rubro / Lo que hace: ${parsed.que_hace || "No especificado"}
Debilidades identificadas: ${parsed.puntos_debiles || "No especificados"}
Soluciones propuestas: ${parsed.soluciones || "No especificadas"}
Colores de marca: ${parsed.colores || "No especificados"}
Tipografías recomendadas: ${parsed.tipografia || "No especificadas"}`;

            try {
                const gemResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [
                                {
                                    parts: [
                                        { text: gemSystemPrompt },
                                        { text: gemInput }
                                    ]
                                }
                            ]
                        })
                    }
                );

                if (gemResponse.ok) {
                    const gemData = await gemResponse.json();
                    // Also concatenate all text parts from prompt maestro response
                    const pmParts = gemData.candidates?.[0]?.content?.parts || [];
                    promptMaestro = pmParts
                        .filter((p: any) => typeof p.text === "string")
                        .map((p: any) => p.text)
                        .join("\n");
                    console.log(`[Gemini API] Prompt Maestro generado con éxito. Longitud: ${promptMaestro.length} chars`);
                } else {
                    const gemErrData = await gemResponse.json().catch(() => ({}));
                    console.warn(`[Gemini API] Falló al generar Prompt Maestro: status ${gemResponse.status}`, gemErrData?.error?.message || "");
                }
            } catch (gemErr: any) {
                console.error("[Gemini API] Error al generar Prompt Maestro:", gemErr.message);
            }
        }

        parsed.prompt_maestro = promptMaestro;
        parsed.tipo_pagina = tipo_pagina || "landing";
        return NextResponse.json(parsed);
    } catch (error: any) {
        console.error("[POST Route Error]:", error);
        return NextResponse.json({ error: error.message || "Error interno al procesar la IA" }, { status: 500 });
    }
}
