// ============================================================
// Mail de contacto de una agencia — sacado de su propia web
// ============================================================
//
// En agencias del exterior el mail es el canal por defecto, y conseguirlo era
// el paso manual más caro de todo el sistema: entrar a la web, buscar el footer,
// buscar /contacto, copiar, pegar. Esto hace ese recorrido.
//
// Tres cosas que la versión anterior hacía mal y que explican por qué casi nunca
// encontraba nada:
//
//   · Solo miraba /contacto si al prospecto le faltaban TODOS los canales. Las
//     agencias que vienen del scraper ya traen teléfono, así que nunca se miraba.
//   · Tomaba el primer mail que aparecía en el HTML, que suele ser el de un
//     plugin, el de un cliente del portfolio o el de "trabajá con nosotros".
//   · No leía los mails ofuscados: el de Cloudflare (data-cfemail), el escrito
//     con entidades (&#64;) ni el "hola [at] agencia.com".
//
// Las funciones son puras: la red la pone quien las llama.

/** Descifra el mail protegido por Cloudflare: el primer byte es la clave XOR. */
function descifrarCloudflare(hex: string): string {
    try {
        const clave = parseInt(hex.slice(0, 2), 16);
        let out = "";
        for (let i = 2; i < hex.length; i += 2) {
            out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ clave);
        }
        return out;
    } catch {
        return "";
    }
}

function decodificar(html: string): string {
    return html
        // HTML metido dentro de un string de JS: "\nhola@agencia.com" se leía
        // como "nhola@agencia.com", un mail que rebota.
        .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\\[nrt]/g, " ")
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
        .replace(/&commat;/gi, "@")
        .replace(/&period;/gi, ".")
        .replace(/&amp;/gi, "&")
        .replace(/%40/g, "@");
}

const RE_MAIL = /[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}/gi;

/** Mails que aparecen en el HTML pero no los lee ninguna persona. */
const BASURA = [
    /\.(png|jpe?g|svg|gif|webp|avif|js|css|woff2?|ttf|ico|mp4)$/,
    /@\d+x\./,
    /sentry|wixpress|wix\.com|squarespace|godaddy|cloudflare|googleusercontent|schema\.org/,
    /(^|@)(example|domain|dominio|email|correo|tuemail|yourdomain|yoursite|sitio|mail)\.(com|org|net)$/,
    /^(user|usuario|name|nombre|tu|your|you|test|mail|mymail|email|correo|ejemplo|example|john|jane)(\.[a-z]+)?@/,
    /@(mailservice|yourcompany|company|empresa|tuempresa|tudominio)\./,
    /^(no-?reply|noreply|do-?not-?reply|mailer-daemon|postmaster|abuse|dpo)@/,
];

/**
 * Buzones que existen pero no le contestan a un proveedor. Se guardan igual,
 * al final de la lista, porque un "rrhh@" sigue siendo mejor que nada.
 */
const BUZON_LATERAL = /^(rrhh|hr|jobs|careers|empleo|empleos|trabaja|trabajo|cv|curriculum|talento|privacidad|privacy|legal|facturacion|billing|pagos|soporte|support|help|webmaster|prensa|press)[._-]?/;

/** Buzones que sí lee alguien que decide o que deriva. */
const BUZON_BUENO = /^(hola|hello|hi|info|contacto|contact|comercial|ventas|sales|negocios|business|proyectos|projects|agencia|studio|estudio|office|oficina|admin|direccion|director|ceo|founder|team|equipo|partners|alianzas)[._-]?/;

const PROVEEDORES_GENERICOS = /@(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|protonmail|proton)\./;

function dominioDe(url: string): string {
    try {
        return new URL(url.startsWith("http") ? url : `https://${url}`).hostname
            .replace(/^www\./, "")
            .toLowerCase();
    } catch {
        return "";
    }
}

/** Mismo dominio o subdominio: "agencia.com.mx" acepta "hola@agencia.com.mx" y "hola@mail.agencia.com.mx". */
function esDelSitio(mail: string, dominio: string): boolean {
    if (!dominio) return false;
    const suyo = mail.split("@")[1] || "";
    return suyo === dominio || suyo.endsWith(`.${dominio}`) || dominio.endsWith(`.${suyo}`);
}

function puntaje(mail: string, dominio: string): number {
    let p = 0;
    if (esDelSitio(mail, dominio)) p += 50;
    else if (PROVEEDORES_GENERICOS.test(mail)) p += 20; // la agencia chica usa Gmail
    if (BUZON_BUENO.test(mail)) p += 20;
    if (BUZON_LATERAL.test(mail)) p -= 40;
    return p;
}

/**
 * Todos los mails de contacto de un HTML, ordenados del más probable al menos.
 * `sitio` es la URL de la agencia: un mail de su propio dominio gana siempre
 * sobre el mail de un cliente que aparece en el portfolio.
 */
export function extraerMails(html: string, sitio: string): string[] {
    if (!html) return [];
    const dominio = dominioDe(sitio);
    const crudos: string[] = [];

    // Cloudflare reemplaza el mail por un hex en data-cfemail o en el link.
    for (const m of Array.from(html.matchAll(/data-cfemail="([0-9a-f]+)"/gi))) crudos.push(descifrarCloudflare(m[1]));
    for (const m of Array.from(html.matchAll(/email-protection#([0-9a-f]+)/gi))) crudos.push(descifrarCloudflare(m[1]));

    const texto = decodificar(html)
        // "hola [at] agencia [dot] com" — solo con corchetes o paréntesis, que
        // "at" suelto aparece en cualquier texto en inglés.
        .replace(/\s*[[(]\s*(?:at|arroba)\s*[\])]\s*/gi, "@")
        .replace(/\s*[[(]\s*(?:dot|punto)\s*[\])]\s*/gi, ".");

    // Los mailto primero: son los que la agencia puso a propósito para que le escriban.
    for (const m of Array.from(texto.matchAll(/mailto:([^"'?\s>]+)/gi))) crudos.push(m[1]);
    for (const m of Array.from(texto.matchAll(RE_MAIL))) crudos.push(m[0]);

    const vistos = new Set<string>();
    const limpios: string[] = [];
    for (const c of crudos) {
        const mail = c.trim().toLowerCase().replace(/^[._-]+|[._-]+$/g, "");
        if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/.test(mail)) continue;
        if (BASURA.some((re) => re.test(mail))) continue;
        if (vistos.has(mail)) continue;
        vistos.add(mail);
        limpios.push(mail);
    }

    // Orden estable: a igual puntaje queda primero el que apareció antes (mailto > texto).
    return limpios
        .map((mail, i) => ({ mail, i, p: puntaje(mail, dominio) }))
        .sort((a, b) => b.p - a.p || a.i - b.i)
        .map((x) => x.mail);
}

const RUTAS_FIJAS = [
    "/contacto", "/contact", "/contactanos", "/contact-us", "/contactenos",
    "/nosotros", "/about", "/about-us", "/quienes-somos",
];

/**
 * Dónde más buscar el mail, en orden. Primero los links de contacto que la
 * propia home publica —que son los que existen de verdad y ya traen el idioma y
 * el slug correctos—, después las rutas de siempre por si el menú se arma con
 * JavaScript y no hay links que leer.
 */
export function paginasDeContacto(html: string, base: string, max = 4): string[] {
    let origen: URL;
    try {
        origen = new URL(base);
    } catch {
        return [];
    }

    const delMenu: string[] = [];
    for (const m of Array.from(html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi))) {
        const href = m[1];
        const etiqueta = m[2].replace(/<[^>]+>/g, " ").toLowerCase();
        if (!/contact|nosotros|about|quienes|hablemos|escribinos|escríbenos/i.test(href + " " + etiqueta)) continue;
        try {
            const url = new URL(href, origen);
            if (url.hostname.replace(/^www\./, "") !== origen.hostname.replace(/^www\./, "")) continue;
            url.hash = "";
            delMenu.push(url.toString());
        } catch {
            /* href roto: se ignora */
        }
    }

    const fijas = RUTAS_FIJAS.map((r) => new URL(r, origen).toString());
    const home = origen.toString().replace(/\/$/, "");
    return Array.from(new Set([...delMenu, ...fijas]))
        .filter((u) => u.replace(/\/$/, "") !== home)
        .slice(0, max);
}
