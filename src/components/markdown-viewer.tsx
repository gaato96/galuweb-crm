"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { CheckSquare, Square, Copy, Check, ExternalLink } from "lucide-react";

interface MarkdownViewerProps {
    content: string;
    className?: string;
}

/**
 * Divide una fila de tabla respetando los pipes escapados (\|).
 * Se recorre a mano en vez de usar lookbehind: Safari no lo soporta hasta 16.4
 * y esto se lee sobre todo desde el celular.
 */
function celdasDeFila(linea: string): string[] {
    const cuerpo = linea.replace(/^\s*\|/, "").replace(/\|\s*$/, "");
    const celdas: string[] = [];
    let actual = "";
    for (let n = 0; n < cuerpo.length; n++) {
        const c = cuerpo[n];
        if (c === "\\" && cuerpo[n + 1] === "|") { actual += "|"; n++; continue; }
        if (c === "|") { celdas.push(actual.trim()); actual = ""; continue; }
        actual += c;
    }
    celdas.push(actual.trim());
    return celdas;
}

function esSeparadorDeTabla(linea: string): boolean {
    return /^\s*\|?[\s:-]*-{2,}[\s:|-]*\|?\s*$/.test(linea) && linea.includes("-");
}

type Alineacion = "left" | "center" | "right";

function alineacionesDe(separador: string): Alineacion[] {
    return celdasDeFila(separador).map((c) => {
        const izq = c.startsWith(":");
        const der = c.endsWith(":");
        if (izq && der) return "center";
        if (der) return "right";
        return "left";
    });
}

export default function MarkdownViewer({ content, className }: MarkdownViewerProps) {
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const handleCopy = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    if (!content || !content.trim()) {
        return (
            <div className="py-12 text-center text-muted-foreground italic text-sm">
                Sin contenido en este documento. Tocá &quot;Editar&quot; para añadir notas en Markdown.
            </div>
        );
    }

    // ── Inline: código, negrita, itálica, tachado y enlaces ──
    const parseInline = (text: string): React.ReactNode => {
        const parts: React.ReactNode[] = [];
        let remaining = text;
        let key = 0;
        let guard = 0;

        while (remaining.length > 0 && guard++ < 500) {
            const candidatos = [
                { tipo: "code", m: remaining.match(/`([^`]+)`/) },
                { tipo: "img", m: remaining.match(/!\[([^\]]*)\]\(([^)\s]+)\)/) },
                { tipo: "link", m: remaining.match(/\[([^\]]+)\]\(([^)\s]+)\)/) },
                { tipo: "bold", m: remaining.match(/(\*\*|__)(.+?)\1/) },
                { tipo: "strike", m: remaining.match(/~~(.+?)~~/) },
                // Itálica sólo con asteriscos: con guiones bajos rompería nombres_asi.
                // Ante empate de índice con la negrita, gana la negrita por el orden
                // de este array (Array.prototype.sort es estable).
                { tipo: "italic", m: remaining.match(/\*([^*\n]+)\*/) },
                { tipo: "url", m: remaining.match(/(https?:\/\/[^\s<>()]+)/) },
            ].filter((c): c is { tipo: string; m: RegExpMatchArray } => c.m != null && c.m.index != null);

            if (candidatos.length === 0) {
                parts.push(remaining);
                break;
            }

            candidatos.sort((a, b) => a.m.index! - b.m.index!);
            let primero = candidatos[0];

            // Una URL suelta que en realidad es el destino de un [texto](url) ya
            // fue consumida por el caso "link"; si igual queda pegada a un "(",
            // se prefiere el siguiente candidato para no anidar dos anclas.
            if (primero.tipo === "url" && primero.m.index! > 0 && remaining[primero.m.index! - 1] === "(") {
                const alt = candidatos.find((c) => c.tipo !== "url");
                if (alt) primero = alt;
            }

            const idx = primero.m.index!;

            if (idx > 0) parts.push(remaining.slice(0, idx));

            switch (primero.tipo) {
                case "code":
                    parts.push(
                        <code key={key++} className="px-1.5 py-0.5 rounded bg-secondary border border-border font-mono text-[11px] text-cyan-300 break-words">
                            {primero.m[1]}
                        </code>
                    );
                    break;
                case "img":
                    parts.push(
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={key++} src={primero.m[2]} alt={primero.m[1]} className="inline-block max-w-full h-auto rounded-lg my-2" />
                    );
                    break;
                case "link":
                case "url": {
                    const href = primero.tipo === "link" ? primero.m[2] : primero.m[1];
                    const texto = primero.tipo === "link" ? primero.m[1] : primero.m[1];
                    const externo = /^https?:\/\//.test(href);
                    parts.push(
                        <a
                            key={key++}
                            href={href}
                            target={externo ? "_blank" : undefined}
                            rel={externo ? "noopener noreferrer" : undefined}
                            className="text-primary hover:text-primary/80 underline underline-offset-2 decoration-primary/40 break-words inline-flex items-baseline gap-0.5"
                        >
                            {texto}
                            {externo && <ExternalLink className="w-3 h-3 shrink-0 self-center opacity-60" />}
                        </a>
                    );
                    break;
                }
                case "bold":
                    parts.push(<strong key={key++} className="font-bold text-foreground">{parseInline(primero.m[2])}</strong>);
                    break;
                case "strike":
                    parts.push(<del key={key++} className="line-through text-muted-foreground">{primero.m[1]}</del>);
                    break;
                case "italic":
                    parts.push(<em key={key++} className="italic text-foreground/90">{primero.m[1]}</em>);
                    break;
            }

            remaining = remaining.slice(idx + primero.m[0].length);
        }

        return parts;
    };

    // ── Bloques ──
    const renderMarkdown = (text: string) => {
        const lineas = text.replace(/\r\n/g, "\n").split("\n");
        const elements: React.ReactNode[] = [];

        let i = 0;
        while (i < lineas.length) {
            const linea = lineas[i];
            const limpia = linea.trim();

            // Bloque de código
            if (limpia.startsWith("```")) {
                const lang = limpia.slice(3).trim();
                const buffer: string[] = [];
                i++;
                while (i < lineas.length && !lineas[i].trim().startsWith("```")) {
                    buffer.push(lineas[i]);
                    i++;
                }
                i++; // cierre
                const code = buffer.join("\n");
                elements.push(
                    <div key={`code-${i}`} className="my-4 rounded-xl border border-border bg-slate-950/80 overflow-hidden shadow-lg">
                        <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-slate-900 border-b border-border/50 text-[10px] text-muted-foreground uppercase font-bold">
                            <span className="truncate">{lang || "code"}</span>
                            <button onClick={() => handleCopy(code)} className="flex items-center gap-1 hover:text-foreground transition-colors shrink-0 ml-2">
                                {copiedCode === code ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                {copiedCode === code ? "Copiado" : "Copiar"}
                            </button>
                        </div>
                        <pre className="p-3 sm:p-4 overflow-x-auto text-emerald-300 leading-relaxed font-mono text-[11px] sm:text-xs">
                            <code>{code}</code>
                        </pre>
                    </div>
                );
                continue;
            }

            // Tabla: fila de encabezado + separador
            if (limpia.includes("|") && i + 1 < lineas.length && esSeparadorDeTabla(lineas[i + 1])) {
                const headers = celdasDeFila(limpia);
                const alineaciones = alineacionesDe(lineas[i + 1]);
                i += 2;
                const filas: string[][] = [];
                while (i < lineas.length && lineas[i].trim().includes("|") && lineas[i].trim()) {
                    filas.push(celdasDeFila(lineas[i].trim()));
                    i++;
                }
                const alinCls = (n: number) =>
                    alineaciones[n] === "center" ? "text-center" : alineaciones[n] === "right" ? "text-right" : "text-left";

                elements.push(
                    // El contenedor scrollea solo: una tabla ancha nunca empuja la página.
                    <div key={`table-${i}`} className="my-4 -mx-1 sm:mx-0 overflow-x-auto custom-scrollbar rounded-xl border border-border">
                        <table className="w-full min-w-[480px] text-[11px] sm:text-xs border-collapse">
                            <thead>
                                <tr className="bg-secondary/60">
                                    {headers.map((h, n) => (
                                        <th key={n} className={cn("px-3 py-2.5 font-bold text-foreground border-b border-border whitespace-nowrap", alinCls(n))}>
                                            {parseInline(h)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filas.map((fila, fi) => (
                                    <tr key={fi} className="border-b border-border/50 last:border-0 hover:bg-secondary/25 transition-colors">
                                        {headers.map((_, n) => (
                                            <td key={n} className={cn("px-3 py-2 text-foreground/85 align-top", alinCls(n))}>
                                                {parseInline(fila[n] ?? "")}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
                continue;
            }

            // Cita: acumula las líneas consecutivas en un solo bloque
            if (limpia.startsWith(">")) {
                const buffer: string[] = [];
                while (i < lineas.length && lineas[i].trim().startsWith(">")) {
                    buffer.push(lineas[i].trim().replace(/^>\s?/, ""));
                    i++;
                }
                elements.push(
                    <blockquote key={`quote-${i}`} className="my-3 pl-3 sm:pl-4 py-2 border-l-4 border-primary bg-primary/5 text-foreground/90 italic rounded-r-xl text-xs sm:text-sm space-y-1.5">
                        {buffer.map((l, n) => <p key={n}>{parseInline(l)}</p>)}
                    </blockquote>
                );
                continue;
            }

            // Listas (con o sin numeración, respetando la indentación)
            const esItem = /^(\s*)([-*+]|\d+\.)\s+/.exec(linea);
            if (esItem) {
                const items: { sangria: number; ordenado: boolean; marca: string; texto: string; tarea?: boolean; hecha?: boolean }[] = [];
                while (i < lineas.length) {
                    const m = /^(\s*)([-*+]|(\d+)\.)\s+(.*)$/.exec(lineas[i]);
                    if (!m) {
                        // Una línea en blanco entre ítems no corta la lista.
                        if (!lineas[i].trim() && /^(\s*)([-*+]|\d+\.)\s+/.test(lineas[i + 1] || "")) { i++; continue; }
                        break;
                    }
                    const texto = m[4];
                    const tarea = /^\[( |x|X)\]\s*/.exec(texto);
                    items.push({
                        sangria: Math.floor(m[1].replace(/\t/g, "  ").length / 2),
                        ordenado: !!m[3],
                        marca: m[3] || "",
                        texto: tarea ? texto.replace(/^\[( |x|X)\]\s*/, "") : texto,
                        tarea: !!tarea,
                        hecha: tarea ? tarea[1].toLowerCase() === "x" : undefined,
                    });
                    i++;
                }

                elements.push(
                    <div key={`list-${i}`} className="my-3 space-y-1.5">
                        {items.map((it, n) => (
                            <div
                                key={n}
                                className="flex items-start gap-2 text-xs sm:text-sm text-foreground/90 leading-relaxed"
                                style={{ paddingLeft: `${Math.min(it.sangria, 4) * 1.1}rem` }}
                            >
                                {it.tarea ? (
                                    it.hecha
                                        ? <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                        : <Square className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                                ) : it.ordenado ? (
                                    <span className="font-bold text-primary shrink-0 min-w-[1.1rem] text-right">{it.marca}.</span>
                                ) : (
                                    <span className="text-primary shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
                                )}
                                <span className={cn("min-w-0 break-words", it.hecha && "line-through text-muted-foreground")}>
                                    {parseInline(it.texto)}
                                </span>
                            </div>
                        ))}
                    </div>
                );
                continue;
            }

            // Encabezados
            const h = /^(#{1,6})\s+(.*)$/.exec(limpia);
            if (h) {
                const nivel = h[1].length;
                const txt = parseInline(h[2]);
                if (nivel === 1)
                    elements.push(<h1 key={i} className="text-lg sm:text-2xl font-black text-foreground mt-6 mb-3 pb-2 border-b border-border/60 break-words">{txt}</h1>);
                else if (nivel === 2)
                    elements.push(
                        <h2 key={i} className="text-base sm:text-xl font-bold text-foreground mt-5 mb-2.5 flex items-start gap-2 break-words">
                            <span className="w-1.5 h-4 rounded-full bg-primary inline-block shrink-0 mt-1" />
                            <span className="min-w-0">{txt}</span>
                        </h2>
                    );
                else if (nivel === 3)
                    elements.push(<h3 key={i} className="text-sm sm:text-base font-bold text-foreground mt-4 mb-2 break-words">{txt}</h3>);
                else
                    elements.push(<h4 key={i} className="text-xs sm:text-sm font-bold text-foreground/90 mt-3 mb-1.5 uppercase tracking-wide break-words">{txt}</h4>);
                i++;
                continue;
            }

            // Regla horizontal
            if (/^(-{3,}|\*{3,}|_{3,})$/.test(limpia)) {
                elements.push(<hr key={i} className="my-5 sm:my-6 border-border/60" />);
                i++;
                continue;
            }

            // Línea en blanco
            if (!limpia) { i++; continue; }

            // Párrafo
            elements.push(
                <p key={i} className="my-2 text-xs sm:text-sm text-foreground/80 leading-relaxed break-words">
                    {parseInline(linea)}
                </p>
            );
            i++;
        }

        return elements;
    };

    return (
        <div className={cn("prose-dark text-foreground leading-relaxed max-w-full overflow-x-hidden", className)}>
            {renderMarkdown(content)}
        </div>
    );
}
