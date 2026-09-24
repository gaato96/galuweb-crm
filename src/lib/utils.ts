import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}

export function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
}

export function getInitials(name: string): string {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

/**
 * La fecha de hoy como YYYY-MM-DD, en la zona horaria de quien usa la app.
 *
 * `en-CA` porque su formato de fecha corto ya es YYYY-MM-DD, que es lo que
 * espera Postgres y lo que compara el resto del código. Con toISOString() la
 * fecha se corre un día para atrás en Argentina después de las 21hs.
 */
export function hoyISO(): string {
    return new Date().toLocaleDateString("en-CA");
}

export function formatDate(date: string | Date): string {
    return new Intl.DateTimeFormat("es-AR", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(new Date(date));
}

/**
 * Descarga texto como archivo. Usa Blob y no `data:` URI: los data URI se
 * rompen con contenidos largos y con caracteres como `#`.
 */
export function descargarTexto(nombreArchivo: string, contenido: string, mime = "text/markdown;charset=utf-8") {
    const blob = new Blob([contenido], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Se libera en el próximo tick: Safari necesita que la URL siga viva al hacer click.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Descarga varios documentos como un .md único, con separadores por título. */
export function descargarMarkdownCombinado(
    nombreArchivo: string,
    docs: { titulo: string; contenido: string }[]
) {
    const cuerpo = docs
        .map((d) => `# ${d.titulo}\n\n${d.contenido}`)
        .join("\n\n---\n\n");
    descargarTexto(nombreArchivo, cuerpo);
}

export function daysFromNow(date: string | Date): number {
    const now = new Date();
    const target = new Date(date);
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
