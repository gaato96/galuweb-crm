/**
 * CotizacionPDFTemplate
 * ─────────────────────────────────────────────────────────────
 * This component renders visually inside a hidden div.
 * html2canvas captures it, jsPDF turns the capture into a PDF.
 *
 * All styling is inline so html2canvas renders it correctly
 */

import React from "react";
import type { Cotizacion, Cliente, SeccionesPDF, CotizacionItem } from "@/lib/types";

interface Props {
    cotizacion: Cotizacion;
    cliente: Cliente;
    secciones: SeccionesPDF;
}

// ── NEW BRAND COLORS ─────────────────────────────────────────────────────────
const BG_DARK = "#101B2A";       // Main background
const BG_MID = "#16253A";        // Cards/Header background
const ACCENT = "#FBC02D";        // Yellow accent
const WHITE = "#FFFFFF";
const TEXT_MUTED = "#9CA3AF";    // gray-400
const TEXT_BODY = "#E2E8F0";     // slate-200
const BORDER = "#1E2D40";

function formatUSD(n: number) {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                <div style={{
                    width: 32, height: 32, borderRadius: 4,
                    background: ACCENT, color: BG_DARK,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: 13, flexShrink: 0,
                }}>
                    {num}
                </div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: WHITE, letterSpacing: 0.5 }}>
                    {title}
                </h2>
            </div>
            <div style={{ paddingLeft: 48 }}>
                {children}
            </div>
        </div>
    );
}

function InvestmentTable({ items, total }: { items: CotizacionItem[]; total: number }) {
    return (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 8 }}>
            <thead>
                <tr style={{ background: BG_MID }}>
                    <th style={{ textAlign: "left", padding: "12px 16px", color: WHITE, fontWeight: 600, borderRadius: "6px 0 0 0", borderBottom: `2px solid ${ACCENT}` }}>
                        Ítem / Servicio
                    </th>
                    <th style={{ textAlign: "right", padding: "12px 16px", color: WHITE, fontWeight: 600, borderRadius: "0 6px 0 0", whiteSpace: "nowrap", borderBottom: `2px solid ${ACCENT}` }}>
                        Inversión
                    </th>
                </tr>
            </thead>
            <tbody>
                {items.map((item, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : BG_MID }}>
                        <td style={{ padding: "12px 16px", color: TEXT_BODY, borderBottom: `1px solid ${BORDER}` }}>
                            {item.descripcion}
                        </td>
                        <td style={{ padding: "12px 16px", color: WHITE, fontWeight: 600, textAlign: "right", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>
                            {formatUSD(item.precio)}
                        </td>
                    </tr>
                ))}
                <tr>
                    <td style={{ padding: "16px", color: ACCENT, fontWeight: 700, fontSize: 14 }}>
                        TOTAL INVERSIÓN
                    </td>
                    <td style={{ padding: "16px", color: ACCENT, fontWeight: 800, fontSize: 18, textAlign: "right", whiteSpace: "nowrap" }}>
                        {formatUSD(total)}
                    </td>
                </tr>
            </tbody>
        </table>
    );
}

/** Converts plain text with newlines into styled paragraphs */
function TextBody({ text }: { text: string }) {
    if (!text) return <p style={{ color: TEXT_MUTED, fontStyle: "italic", fontSize: 13 }}>—</p>;
    const lines = text.split("\n").filter(l => l.trim() !== "");
    return (
        <>
            {lines.map((line, i) => {
                const isBullet = line.trim().startsWith("-") || line.trim().startsWith("•") || line.trim().startsWith("*");
                const isBold = line.trim().startsWith("**") && line.trim().endsWith("**");
                const cleaned = line.trim().replace(/\*\*/g, "").replace(/^[-•*]\s*/, "");

                if (isBold) return (
                    <p key={i} style={{ margin: "12px 0 4px", fontSize: 13, fontWeight: 700, color: WHITE }}>{cleaned}</p>
                );
                if (isBullet) return (
                    <div key={i} style={{ display: "flex", gap: 8, margin: "6px 0", alignItems: "flex-start" }}>
                        <span style={{ color: ACCENT, fontWeight: 700, lineHeight: "1.6" }}>·</span>
                        <p style={{ margin: 0, fontSize: 13, color: TEXT_BODY, lineHeight: 1.6 }}>{cleaned}</p>
                    </div>
                );
                return (
                    <p key={i} style={{ margin: "0 0 10px 0", fontSize: 13, color: TEXT_BODY, lineHeight: 1.7 }}>{cleaned}</p>
                );
            })}
        </>
    );
}

export const CotizacionPDFTemplate = React.forwardRef<HTMLDivElement, Props>(
    function CotizacionPDFTemplate({ cotizacion, cliente, secciones }, ref) {
        const isWebApp = cotizacion.tipo_cotizacion === "webapp";
        const fecha = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

        const SECTIONS = isWebApp
            ? [
                { num: "01", key: "descripcion", title: "Descripción del Sistema" },
                { num: "02", key: "alcance", title: "Módulos y Funcionalidades" },
                { num: "03", key: "arquitectura", title: "Arquitectura y Tecnología" },
                { num: "04", key: "cronograma", title: "Plan de Desarrollo" },
                { num: "05", key: "investment", title: "Inversión" },
                { num: "06", key: "terminos", title: "Términos y Modelo de Pago" },
                { num: "07", key: "proximos_pasos", title: "Próximos Pasos" },
            ]
            : [
                { num: "01", key: "descripcion", title: "Descripción del Proyecto" },
                { num: "02", key: "alcance", title: "Alcance y Funcionalidades" },
                { num: "03", key: "cronograma", title: "Cronograma de Trabajo" },
                { num: "04", key: "investment", title: "Inversión" },
                { num: "05", key: "terminos", title: "Términos y Modalidad de Pago" },
                { num: "06", key: "conclusion", title: "Conclusión" },
                { num: "07", key: "proximos_pasos", title: "Próximos Pasos" },
            ];

        return (
            <div
                ref={ref}
                style={{
                    width: 794,               // ~A4 at 96dpi
                    background: BG_DARK,
                    // Injecting font via inline style. Note: html2canvas needs the font loaded in the document.
                    // See the main wrapper (layout/page) importing Montserrat if possible.
                    fontFamily: "'Montserrat', sans-serif",
                    color: TEXT_BODY,
                    margin: 0,
                    padding: 0,
                }}
            >
                {/* ── STYLES INJECTION ───────────────────────────────────── */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                        @import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;0,800&display=swap');
                    `
                }} />

                {/* ── HEADER / COVER BAND ─────────────────────────────────── */}
                <div style={{
                    background: BG_MID,
                    padding: "40px 48px 32px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    borderBottom: `2px solid ${ACCENT}`
                }}>
                    {/* Logo (White for dark backgrounds) */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <img
                            src="/icon-512x512.png"
                            alt="Galuweb Logo"
                            style={{ width: 44, height: 44, objectFit: "contain" }}
                        />
                        <span style={{ color: WHITE, fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>GALUWEB</span>
                    </div>

                    {/* Tipo badge */}
                    <div style={{
                        border: `1px solid ${ACCENT}`,
                        borderRadius: 4,
                        padding: "8px 16px",
                        color: ACCENT,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 1.5,
                        textTransform: "uppercase" as const,
                        marginTop: 4,
                    }}>
                        {isWebApp ? "Propuesta de Software" : "Propuesta de Diseño Web"}
                    </div>
                </div>

                {/* ── CLIENT CARD ──────────────────────────────────────────── */}
                <div style={{
                    padding: "40px 48px 24px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                }}>
                    <div>
                        <p style={{ margin: 0, fontSize: 11, color: ACCENT, letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 8, fontWeight: 600 }}>
                            Preparado para:
                        </p>
                        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: WHITE }}>{cliente.nombre}</h1>
                        <p style={{ margin: "4px 0 0", fontSize: 15, color: TEXT_MUTED, fontWeight: 500 }}>{cliente.negocio}</p>
                    </div>
                    <div style={{ textAlign: "right" as const }}>
                        {cliente.tel && (
                            <p style={{ margin: "0 0 6px", fontSize: 12, color: TEXT_MUTED }}>📱 {cliente.tel}</p>
                        )}
                        {cliente.email && (
                            <p style={{ margin: "0 0 6px", fontSize: 12, color: TEXT_MUTED }}>✉ {cliente.email}</p>
                        )}
                        <p style={{ margin: 0, fontSize: 12, color: TEXT_MUTED }}>📅 Emisión: {fecha}</p>
                    </div>
                </div>

                {/* ── BODY CONTENT ──────────────────────────────────────────── */}
                <div style={{ padding: "32px 48px 48px" }}>
                    {SECTIONS.map(({ num, key, title }) => {
                        if (key === "investment") {
                            return (
                                <Section key={key} num={num} title={title}>
                                    <InvestmentTable items={cotizacion.items} total={cotizacion.total} />
                                </Section>
                            );
                        }
                        const text = secciones[key as keyof SeccionesPDF] || "";
                        if (!text && key !== "conclusion" && key !== "arquitectura") return null; // hide if empty, unless it's a key section we want visible even if empty
                        return (
                            <Section key={key} num={num} title={title}>
                                <TextBody text={text} />
                            </Section>
                        );
                    })}
                </div>

                {/* ── FOOTER ───────────────────────────────────────────────── */}
                <div style={{
                    borderTop: `1px solid ${BORDER}`,
                    padding: "24px 48px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: BG_MID,
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <img src="/icon-512x512.png" alt="Galuweb" style={{ height: 20, width: 20, objectFit: "contain", opacity: 0.7 }} />
                        <p style={{ margin: 0, fontSize: 11, color: TEXT_MUTED, fontWeight: 500 }}>© {new Date().getFullYear()} Galuweb — galuweb.com</p>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: TEXT_MUTED }}>Propuesta comercial confidencial</p>
                </div>
            </div>
        );
    }
);

CotizacionPDFTemplate.displayName = "CotizacionPDFTemplate";
