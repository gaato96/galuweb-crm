"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { CheckSquare, Square, Copy, Check } from "lucide-react";
import { useState } from "react";

interface MarkdownViewerProps {
    content: string;
    className?: string;
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
            <div className="py-12 text-center text-muted-foreground italic">
                Sin contenido en este documento. Haz clic en &quot;Editar&quot; para añadir notas en Markdown.
            </div>
        );
    }

    // Split into blocks (code blocks vs text blocks)
    const renderMarkdown = (text: string) => {
        const lines = text.split("\n");
        const elements: React.ReactNode[] = [];
        let inCodeBlock = false;
        let codeBuffer: string[] = [];
        let codeLang = "";
        let inList = false;
        let listItems: React.ReactNode[] = [];

        const flushList = () => {
            if (inList && listItems.length > 0) {
                elements.push(
                    <ul key={`ul-${elements.length}`} className="my-3 space-y-1.5 pl-4 list-disc marker:text-primary">
                        {listItems}
                    </ul>
                );
                listItems = [];
                inList = false;
            }
        };

        lines.forEach((line, idx) => {
            // Code block start/end
            if (line.trim().startsWith("```")) {
                flushList();
                if (inCodeBlock) {
                    const fullCode = codeBuffer.join("\n");
                    elements.push(
                        <div key={`code-${idx}`} className="my-4 rounded-xl border border-border bg-slate-950/80 overflow-hidden shadow-lg font-mono text-xs">
                            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-border/50 text-[10px] text-muted-foreground uppercase font-bold">
                                <span>{codeLang || "code"}</span>
                                <button
                                    onClick={() => handleCopy(fullCode)}
                                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                                >
                                    {copiedCode === fullCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                    {copiedCode === fullCode ? "Copiado" : "Copiar"}
                                </button>
                            </div>
                            <pre className="p-4 overflow-x-auto text-emerald-300 leading-relaxed font-mono">
                                <code>{fullCode}</code>
                            </pre>
                        </div>
                    );
                    codeBuffer = [];
                    codeLang = "";
                    inCodeBlock = false;
                } else {
                    inCodeBlock = true;
                    codeLang = line.trim().slice(3).trim();
                }
                return;
            }

            if (inCodeBlock) {
                codeBuffer.push(line);
                return;
            }

            // Empty line
            if (!line.trim()) {
                flushList();
                return;
            }

            // Headings
            if (line.startsWith("# ")) {
                flushList();
                elements.push(
                    <h1 key={`h1-${idx}`} className="text-xl sm:text-2xl font-black text-foreground mt-6 mb-3 pb-2 border-b border-border/60">
                        {parseInline(line.slice(2))}
                    </h1>
                );
                return;
            }
            if (line.startsWith("## ")) {
                flushList();
                elements.push(
                    <h2 key={`h2-${idx}`} className="text-lg sm:text-xl font-bold text-foreground mt-5 mb-2.5 flex items-center gap-2">
                        <span className="w-1.5 h-4 rounded-full bg-primary inline-block" />
                        {parseInline(line.slice(3))}
                    </h2>
                );
                return;
            }
            if (line.startsWith("### ")) {
                flushList();
                elements.push(
                    <h3 key={`h3-${idx}`} className="text-base font-bold text-foreground mt-4 mb-2">
                        {parseInline(line.slice(4))}
                    </h3>
                );
                return;
            }
            if (line.startsWith("#### ")) {
                flushList();
                elements.push(
                    <h4 key={`h4-${idx}`} className="text-sm font-bold text-foreground/90 mt-3 mb-1.5">
                        {parseInline(line.slice(5))}
                    </h4>
                );
                return;
            }

            // Blockquote
            if (line.startsWith("> ")) {
                flushList();
                elements.push(
                    <blockquote key={`quote-${idx}`} className="my-3 pl-4 py-2 border-l-4 border-primary bg-primary/5 text-foreground/90 italic rounded-r-xl text-xs sm:text-sm">
                        {parseInline(line.slice(2))}
                    </blockquote>
                );
                return;
            }

            // Horizontal Rule
            if (line.trim() === "---" || line.trim() === "***" || line.trim() === "___") {
                flushList();
                elements.push(<hr key={`hr-${idx}`} className="my-6 border-border/60" />);
                return;
            }

            // Checklists
            if (line.trim().startsWith("- [ ]") || line.trim().startsWith("* [ ]")) {
                flushList();
                elements.push(
                    <div key={`task-${idx}`} className="flex items-center gap-2.5 my-1.5 text-xs sm:text-sm text-foreground/90">
                        <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span>{parseInline(line.trim().slice(5))}</span>
                    </div>
                );
                return;
            }
            if (line.trim().startsWith("- [x]") || line.trim().startsWith("- [X]") || line.trim().startsWith("* [x]")) {
                flushList();
                elements.push(
                    <div key={`task-${idx}`} className="flex items-center gap-2.5 my-1.5 text-xs sm:text-sm text-emerald-400 line-through opacity-80">
                        <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{parseInline(line.trim().slice(5))}</span>
                    </div>
                );
                return;
            }

            // Bullet Lists
            if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
                inList = true;
                listItems.push(
                    <li key={`li-${idx}`} className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                        {parseInline(line.trim().slice(2))}
                    </li>
                );
                return;
            }

            // Ordered Lists (e.g. 1. Item)
            const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
            if (numMatch) {
                flushList();
                elements.push(
                    <div key={`ol-${idx}`} className="flex items-start gap-2.5 my-1.5 text-xs sm:text-sm text-foreground/90">
                        <span className="font-bold text-primary text-xs shrink-0 w-5 text-right">{numMatch[1]}.</span>
                        <span>{parseInline(numMatch[2])}</span>
                    </div>
                );
                return;
            }

            // Paragraph
            flushList();
            elements.push(
                <p key={`p-${idx}`} className="my-2 text-xs sm:text-sm text-foreground/80 leading-relaxed">
                    {parseInline(line)}
                </p>
            );
        });

        flushList();
        return elements;
    };

    // Helper to parse bold, italic, code inline
    const parseInline = (text: string): React.ReactNode => {
        const parts: React.ReactNode[] = [];
        let remaining = text;
        let key = 0;

        while (remaining.length > 0) {
            // Inline code `code`
            const codeMatch = remaining.match(/`([^`]+)`/);
            // Bold **text** or __text__
            const boldMatch = remaining.match(/(\*\*|__)(.*?)\1/);
            // Italic *text* or _text_
            const italicMatch = remaining.match(/(\*|_)(.*?)\1/);

            const matches = [
                codeMatch ? { type: "code", index: codeMatch.index!, match: codeMatch } : null,
                boldMatch ? { type: "bold", index: boldMatch.index!, match: boldMatch } : null,
                italicMatch ? { type: "italic", index: italicMatch.index!, match: italicMatch } : null,
            ]
                .filter((m): m is NonNullable<typeof m> => m !== null)
                .sort((a, b) => a.index - b.index);

            if (matches.length === 0) {
                parts.push(remaining);
                break;
            }

            const first = matches[0];
            if (first.index > 0) {
                parts.push(remaining.slice(0, first.index));
            }

            if (first.type === "code") {
                parts.push(
                    <code key={key++} className="px-1.5 py-0.5 rounded bg-secondary border border-border font-mono text-[11px] text-cyan-300">
                        {first.match[1]}
                    </code>
                );
                remaining = remaining.slice(first.index + first.match[0].length);
            } else if (first.type === "bold") {
                parts.push(
                    <strong key={key++} className="font-bold text-foreground">
                        {first.match[2]}
                    </strong>
                );
                remaining = remaining.slice(first.index + first.match[0].length);
            } else if (first.type === "italic") {
                parts.push(
                    <em key={key++} className="italic text-foreground/90">
                        {first.match[2]}
                    </em>
                );
                remaining = remaining.slice(first.index + first.match[0].length);
            }
        }

        return parts;
    };

    return (
        <div className={cn("prose-dark space-y-1 text-foreground leading-relaxed", className)}>
            {renderMarkdown(content)}
        </div>
    );
}
