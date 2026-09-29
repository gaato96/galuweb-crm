// ============================================================
// Escaneo de agencias — lee la web de la agencia y nada más
// ============================================================
//
// Vive fuera de la ruta de Next para que lo usen dos cosas: el botón de
// escanear del CRM (/api/prospeccion/escanear) y la rutina diaria
// (scripts/prospeccion/agencias-rutina.ts), que escanea sola las agencias de
// un listado recién importado. Por eso los imports son relativos.

import type { Prospecto } from "./types";
import type { EscaneoAutomatico, EvidenciaSenial } from "./escaneo-auto";
import { normalizar, normalizarEscaneo } from "./prospeccion";
import { extraerMails, paginasDeContacto, mailsRebotados } from "./contacto-web";

export const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";


/**
 * Entidades con nombre que aparecen en cualquier resultado en español. Sin
 * decodificarlas, "Tucumán" llega como "Tucum&aacute;n" y al comparar nombres
 * el token "tucuman" no matchea nunca: el negocio parece no estar en los
 * resultados cuando sí está, y eso se convierte en una señal no_aparece_rubro
 * afirmada de más. Vale la pena la tabla.
 */
const ENTIDADES: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", uuml: "ü",
    Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Uuml: "Ü",
    ntilde: "ñ", Ntilde: "Ñ", ccedil: "ç", Ccedil: "Ç",
    ordf: "ª", ordm: "º", deg: "°", middot: "·", bull: "·",
    ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»",
    lsquo: "'", rsquo: "'", ldquo: '"', rdquo: '"', euro: "€", pound: "£",
};

export function decodificarEntidades(s: string): string {
    return s
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
        .replace(/&([a-zA-Z]+);/g, (todo, nombre) => ENTIDADES[nombre] ?? todo);
}

/**
 * El contenido de <script> y <style> se borra entero, no solo sus tags. Sacarle
 * los tags a un `<script>` deja el JavaScript suelto dentro del texto, y ahí
 * viven nombres de librerías, rutas y strings de configuración que no son lo
 * que el sitio dice. Con eso, un WordPress cualquiera "mencionaba wordpress" y
 * una agencia quedaba marcada como que ofrece desarrollo web.
 */
export function sinHtml(s: string): string {
    const limpio = s
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<[^>]+>/g, " ");
    return decodificarEntidades(limpio).replace(/\s+/g, " ").trim();
}

/** Para comparar citas: sin acentos, sin puntuación y con los espacios colapsados. */
export function aplanar(s: string): string {
    return normalizar(s).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// ─────────────────────────────────────────────────────────────
// Escaneo de agencias — otra fuente, otra pregunta
// ─────────────────────────────────────────────────────────────

/**
 * Frases con las que una agencia nombra el servicio de hacer webs. Son las que
 * describen la actividad, no las herramientas: una agencia puede nombrar
 * "wordpress" o "landing page" en un caso de cliente, en un post del blog o en
 * el pie del tema que usa su propio sitio sin ofrecer nada de eso.
 *
 * La lista está en español y en inglés porque el mercado objetivo incluye Miami
 * y agencias latinoamericanas con el sitio en inglés. Se compara contra el texto
 * ya aplanado, así que va sin acentos y sin guiones.
 */
const SENIALES_HACE_WEB = [
    "desarrollo web", "desarrollo de sitios", "desarrollo de paginas", "diseno web",
    "diseno de paginas", "diseno de sitios", "paginas web", "sitios web",
    "creacion de sitios", "creacion de paginas", "desarrollo a medida",
    "desarrollo de software", "aplicaciones web",
    "web development", "web design", "website development", "website design",
    "custom websites",
];

/**
 * Palabras que *sugieren* trabajo de web pero no lo afirman. No descartan a
 * nadie: solo levantan la mano para que se mire la página de servicios. Antes
 * estaban mezcladas con las de arriba y se llevaban puestos prospectos buenos
 * —una agencia con el sitio hecho en WordPress quedaba descartada por eso.
 */
const PISTAS_QUIZAS_HACE_WEB = [
    "wordpress", "shopify", "woocommerce", "webflow", "ecommerce", "e commerce",
    "tienda online", "landing page", "landing pages",
];

/**
 * Lo que vende una agencia que NO hace web. Sirve para dos cosas: confirmar que
 * es una agencia de marketing (y no otra cosa que se coló en el scrapeo), y
 * llenar el campo `servicios` del que sale la personalización del mensaje 1.
 */
const SERVICIOS_DE_MARKETING = [
    "redes sociales", "social media", "community manage", "meta ads", "google ads",
    "publicidad", "pauta", "branding", "identidad de marca", "contenido",
    "fotografia", "audiovisual", "email marketing", "seo", "influencer",
];

function aplanarTexto(html: string): string {
    return aplanar(sinHtml(decodificarEntidades(html))).replace(/\s+/g, " ");
}

function vacio(p: Prospecto, pendientes: string[], campos: Partial<Prospecto> = {}): EscaneoAutomatico {
    return {
        prospecto_id: p.id,
        negocio: p.negocio,
        escaneo: normalizarEscaneo(p.escaneo),
        campos,
        evidencias: [],
        agregadas: [],
        pendientes,
        fecha: new Date().toISOString(),
    };
}

/**
 * Escaneo del sistema "agencias". No usa Google Places ni reseñas: una agencia
 * no se califica por su ficha de Maps (muchas ni la tienen, y a ninguna la
 * eligen por estrellas). La única fuente que importa es su propia página, y la
 * única pregunta es si ahí figura desarrollo web.
 *
 * Nunca marca `ofrece_desarrollo_web = false` a la ligera: si no se pudo leer la
 * página, queda en null y sale como pendiente. Un falso "no ofrece web" produce
 * un mensaje que le dice a una agencia que no hace algo que sí hace, y de ese
 * mensaje no se vuelve.
 */
/** El servicio de web dicho como servicio: así se escribe en un link de menú. */
const WEB_EN_MENU =
    /(desarrollo|diseno|creacion)( de)? (web|paginas|sitios|pagina)|paginas web|sitios web|web design|web development|tiendas? (en linea|online)|e ?commerce/;

/**
 * Qué link del menú nombra el servicio de web, o "" si ninguno. Solo se miran
 * textos de links cortos: un menú dice "Desarrollo web", un párrafo del blog no
 * entra en un link de menos de 60 caracteres.
 */
function webEnElMenu(html: string): string {
    for (const m of Array.from(html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi))) {
        const texto = aplanar(m[1].replace(/<[^>]+>/g, " "));
        if (texto && texto.length < 60 && WEB_EN_MENU.test(texto)) return texto;
    }
    return "";
}

/**
 * "Páginas Web Ok", "Diseño de páginas web", "Desarrollo de Software GDL": un
 * estudio que solo hace webs es competencia, no cliente. Mandarle "ustedes lo
 * tercerizan" a quien vive de hacerlo es el mensaje equivocado.
 */
function pareceEstudioWeb(negocio: string): boolean {
    return /pagina|paginas|sitio|sitios|desarrollo web|diseno web|software|tienda en linea|tiendas en linea/.test(aplanar(negocio));
}

export async function escanearAgencia(p: Prospecto): Promise<EscaneoAutomatico> {
    const evidencias: EvidenciaSenial[] = [];
    const campos: Partial<Prospecto> = {};
    const pendientes: string[] = [];

    const sitio = (p.sitio_web_url || "").trim();
    if (!sitio) {
        return vacio(p, [
            "Sin sitio web cargado no hay nada que escanear: la única fuente que califica a una agencia es su propia página de servicios. Cargala en Datos y volvé a escanear.",
        ]);
    }

    const base = sitio.startsWith("http") ? sitio : `https://${sitio}`;
    let html = "";
    try {
        const res = await fetch(base, {
            headers: { "User-Agent": UA },
            redirect: "follow",
            signal: AbortSignal.timeout(8000),
        });
        if (res.ok) html = (await res.text()).slice(0, 120_000);
    } catch {
        /* Se trata abajo como "no se pudo leer", que no es lo mismo que "no ofrece". */
    }

    if (!html) {
        return vacio(p, [
            `No se pudo leer ${base}. Abrila a mano y fijate una sola cosa: si en Servicios figura desarrollo o diseño web. Queda sin verificar, no como "no ofrece".`,
        ]);
    }

    const texto = aplanarTexto(html);
    const haceWeb = SENIALES_HACE_WEB.filter((s) => texto.includes(s));
    const quizas = PISTAS_QUIZAS_HACE_WEB.filter((s) => texto.includes(s));
    const servicios = SERVICIOS_DE_MARKETING.filter((s) => texto.includes(s));

    const enMenu = webEnElMenu(html);
    if (haceWeb.length > 0 && enMenu && servicios.length >= 2 && !pareceEstudioWeb(p.negocio)) {
        // Lista B, marcada sola. Una frase suelta en la home no alcanza (puede ser
        // un caso de cliente o un post), pero un link del menú que dice
        // "Desarrollo web" es un servicio que venden. Con eso, más dos servicios
        // de marketing, es una agencia que vende web y casi seguro la terceriza.
        campos.ofrece_desarrollo_web = true;
        pendientes.push(
            `Lista B: el menú de ${base} tiene "${enMenu}" y además venden ${servicios.slice(0, 2).join(" y ")}. Si es un estudio que solo hace webs (competencia), descartala.`
        );
    } else if (haceWeb.length > 0) {
        // Sin el menú como prueba NO se marca `ofrece_desarrollo_web = true`: leer
        // una frase en la home no distingue un servicio propio de un caso de
        // cliente ("le hicimos el diseño web a X") ni de un post del blog. Queda la
        // evidencia servida y lo confirma una persona en un click.
        pendientes.push(
            pareceEstudioWeb(p.negocio)
                ? `Por el nombre parece un estudio de desarrollo web, no una agencia de marketing: es competencia. Revisalo y descartalo.`
                : `La web dice "${haceWeb.slice(0, 3).join('", "')}". Abrí ${base} y fijate si es un servicio que ofrecen o un trabajo que hicieron: si lo ofrecen, marcá "Sí lo ofrece" y pasa a la lista B.`
        );
    } else if (servicios.length > 0) {
        // Solo se afirma que NO ofrece web si además se confirmó que ES una agencia
        // de marketing. Sin ninguna de las dos señales, lo más probable es que la
        // home se arme con JavaScript y no haya texto que leer — no que no hagan web.
        campos.ofrece_desarrollo_web = false;
        evidencias.push({
            falla: "no_ofrece_desarrollo",
            fuente: "web",
            detalle: `La home lista ${servicios.slice(0, 3).join(", ")} y no menciona desarrollo ni diseño web.`,
            url: base,
        });
    } else {
        pendientes.push(
            `No se encontró texto de servicios en ${base} (probablemente la home se arma con JavaScript). Abrí la página de Servicios a mano: es el único dato que califica.`
        );
    }

    if (quizas.length > 0 && haceWeb.length === 0) {
        pendientes.push(
            `Aparece "${quizas.slice(0, 3).join('", "')}" en la web, pero eso solo no confirma que ofrezcan desarrollo: puede ser la herramienta con la que está hecho su propio sitio, o un caso de cliente. Vale una mirada a Servicios antes de escribirle.`
        );
    }

    if (servicios.length > 0 && !p.servicios.trim()) {
        campos.servicios = servicios.slice(0, 5).join(", ");
    }

    // El mail es EL canal en agencias del exterior, así que se busca siempre que
    // falte, aunque el prospecto ya traiga teléfono del scraper. Antes solo se
    // miraba /contacto cuando faltaban todos los canales, y como Places casi
    // siempre trae teléfono, en la práctica nunca se miraba y el mail se buscaba
    // a mano, web por web.
    const muertos = mailsRebotados(p.notas);
    const vivos = (ms: string[]) => ms.filter((m) => !muertos.has(m));
    let mails = p.email.trim() ? [] : vivos(extraerMails(html, base));
    let htmlContacto = "";
    const faltaMail = !p.email.trim() && mails.length === 0;
    const faltaOtroCanal = !p.instagram_url.trim() && !p.telefono.trim();
    if (faltaMail || faltaOtroCanal) {
        for (const url of paginasDeContacto(html, base)) {
            try {
                const res = await fetch(url, {
                    headers: { "User-Agent": UA },
                    redirect: "follow",
                    signal: AbortSignal.timeout(6000),
                });
                if (!res.ok) continue;
                const pagina = (await res.text()).slice(0, 120_000);
                htmlContacto += " " + pagina;
                if (!p.email.trim()) mails = vivos(extraerMails(html + " " + htmlContacto, base));
                if (mails.length > 0 || (!faltaMail && /instagram\.com|wa\.me/i.test(pagina))) break;
            } catch {
                /* Que no exista /contacto es lo más común: no es un error. */
            }
        }
    }
    const htmlContacto_ = html + " " + htmlContacto;

    if (!p.email.trim()) {
        if (mails[0]) {
            campos.email = mails[0];
            if (mails.length > 1) {
                pendientes.push(
                    `Se cargó ${mails[0]} como mail. En la web también aparecen: ${mails.slice(1, 4).join(", ")}. Si alguno es de alguien que decide (dueño, director), cambialo.`
                );
            }
        } else {
            pendientes.push(
                `No se encontró ningún mail en ${base} ni en su página de contacto (puede estar detrás de un formulario o armado con JavaScript). Queda para buscar a mano o por LinkedIn.`
            );
        }
    }

    if (!p.instagram_url.trim()) {
        const ig = htmlContacto_.match(
            /https?:\/\/(?:www\.)?instagram\.com\/([\w.]{2,30})/i
        );
        // "instagram.com/p/" es un posteo embebido, no el perfil de la agencia.
        if (ig && !/^(p|reel|explore|accounts)$/i.test(ig[1])) campos.instagram_url = ig[0];
    }

    if (!p.telefono.trim()) {
        const wa = htmlContacto_.match(/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?(\+?\d{8,15})/i);
        if (wa) campos.telefono = wa[1];
    }

    if (!p.linkedin_url.trim()) {
        const li = htmlContacto_.match(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in)\/[\w%-]+/i);
        if (li) campos.linkedin_url = li[0];
    }

    if (p.muestra_clientes == null && /clientes|portfolio|portafolio|casos|trabajos|clients|our work/.test(texto)) {
        pendientes.push(
            'La web tiene sección de clientes o casos. Abrila y fijate si los trabajos incluyen alguna web: si son todos de redes y pauta, marcá la señal "casos solo redes".'
        );
    }

    pendientes.push(
        "A mano, 30 segundos: contá las personas del equipo que muestra (3 a 20 es la ventana). Es el segundo campo que más pesa después del filtro de desarrollo web."
    );

    const escaneoBase = normalizarEscaneo(p.escaneo);
    const agregadas = evidencias.map((e) => e.falla).filter((f) => !escaneoBase.fallas.includes(f));

    return {
        prospecto_id: p.id,
        negocio: p.negocio,
        escaneo: { ...escaneoBase, fallas: [...escaneoBase.fallas, ...agregadas] },
        campos,
        evidencias,
        agregadas,
        pendientes,
        fecha: new Date().toISOString(),
    };
}
