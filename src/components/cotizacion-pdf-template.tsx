/**
 * CotizacionPDFTemplate
 * ─────────────────────────────────────────────────────────────
 * This component renders visually inside a hidden div.
 * html2canvas captures it, jsPDF turns the capture into a PDF.
 *
 * All styling is inline so html2canvas renders it correctly
 * (Tailwind classes are NOT used here — only inline styles).
 */

import React from "react";
import type { Cotizacion, Cliente, SeccionesPDF, CotizacionItem } from "@/lib/types";

interface Props {
    cotizacion: Cotizacion;
    cliente: Cliente;
    secciones: SeccionesPDF;
}

const ACCENT = "#7C3AED";        // violet-700
const ACCENT_LIGHT = "#EDE9FE";  // violet-100
const DARK = "#0F0A1E";
const MID = "#1E1433";
const MUTED = "#6B7280";
const TEXT = "#111827";
const BORDER = "#E5E7EB";
const WHITE = "#FFFFFF";

function formatUSD(n: number) {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: ACCENT, color: WHITE,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 13, flexShrink: 0,
                }}>
                    {num}
                </div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: DARK, letterSpacing: 0.3 }}>
                    {title}
                </h2>
            </div>
            <div style={{ paddingLeft: 44 }}>
                {children}
            </div>
        </div>
    );
}

function InvestmentTable({ items, total }: { items: CotizacionItem[]; total: number }) {
    return (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
                <tr style={{ background: DARK }}>
                    <th style={{ textAlign: "left", padding: "10px 14px", color: WHITE, fontWeight: 600, borderRadius: "4px 0 0 4px" }}>
                        Ítem / Servicio
                    </th>
                    <th style={{ textAlign: "right", padding: "10px 14px", color: WHITE, fontWeight: 600, borderRadius: "0 4px 4px 0", whiteSpace: "nowrap" }}>
                        Inversión
                    </th>
                </tr>
            </thead>
            <tbody>
                {items.map((item, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? WHITE : "#F9FAFB" }}>
                        <td style={{ padding: "10px 14px", color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                            {item.descripcion}
                        </td>
                        <td style={{ padding: "10px 14px", color: TEXT, fontWeight: 600, textAlign: "right", borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>
                            {formatUSD(item.precio)}
                        </td>
                    </tr>
                ))}
                <tr style={{ background: ACCENT }}>
                    <td style={{ padding: "12px 14px", color: WHITE, fontWeight: 700, fontSize: 14, borderRadius: "0 0 0 6px" }}>
                        TOTAL
                    </td>
                    <td style={{ padding: "12px 14px", color: WHITE, fontWeight: 800, fontSize: 16, textAlign: "right", borderRadius: "0 0 6px 0", whiteSpace: "nowrap" }}>
                        {formatUSD(total)}
                    </td>
                </tr>
            </tbody>
        </table>
    );
}

/** Converts plain text with newlines into styled paragraphs */
function TextBody({ text }: { text: string }) {
    if (!text) return <p style={{ color: MUTED, fontStyle: "italic", fontSize: 13 }}>—</p>;
    const lines = text.split("\n").filter(l => l.trim() !== "");
    return (
        <>
            {lines.map((line, i) => {
                const isBullet = line.trim().startsWith("-") || line.trim().startsWith("•") || line.trim().startsWith("*");
                const isBold = line.trim().startsWith("**") && line.trim().endsWith("**");
                const cleaned = line.trim().replace(/\*\*/g, "").replace(/^[-•*]\s*/, "");

                if (isBold) return (
                    <p key={i} style={{ margin: "6px 0", fontSize: 13, fontWeight: 700, color: DARK }}>{cleaned}</p>
                );
                if (isBullet) return (
                    <div key={i} style={{ display: "flex", gap: 8, margin: "4px 0", alignItems: "flex-start" }}>
                        <span style={{ color: ACCENT, fontWeight: 700, lineHeight: "1.6" }}>·</span>
                        <p style={{ margin: 0, fontSize: 13, color: TEXT, lineHeight: 1.6 }}>{cleaned}</p>
                    </div>
                );
                return (
                    <p key={i} style={{ margin: "0 0 8px 0", fontSize: 13, color: TEXT, lineHeight: 1.7 }}>{cleaned}</p>
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
                { num: "03", key: "cronograma", title: "Plan de Desarrollo" },
                { num: "04", key: "investment", title: "Inversión" },
                { num: "05", key: "terminos", title: "Términos y Modelo de Pago" },
                { num: "06", key: "proximos_pasos", title: "Próximos Pasos" },
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
                    background: WHITE,
                    fontFamily: "'Segoe UI', Arial, sans-serif",
                    color: TEXT,
                    margin: 0,
                    padding: 0,
                }}
            >
                {/* ── HEADER / COVER BAND ─────────────────────────────────── */}
                <div style={{
                    background: DARK,
                    padding: "36px 48px 32px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                }}>
                    {/* Logo */}
                    <img
                        src="/3.png"
                        alt="Galuweb"
                        style={{ height: 50, objectFit: "contain" }}
                    />
                    {/* Tipo badge */}
                    <div style={{
                        background: ACCENT,
                        borderRadius: 20,
                        padding: "6px 18px",
                        color: WHITE,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 1.5,
                        textTransform: "uppercase" as const,
                        marginTop: 4,
                    }}>
                        {isWebApp ? "Propuesta Web App / Software" : "Propuesta Diseño Web"}
                    </div>
                </div>

                {/* ── CLIENT CARD ──────────────────────────────────────────── */}
                <div style={{
                    background: MID,
                    padding: "24px 48px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}>
                    <div>
                        <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 4 }}>
                            Preparado para:
                        </p>
                        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: WHITE }}>{cliente.nombre}</h1>
                        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#C4B5FD", fontWeight: 600 }}>{cliente.negocio}</p>
                    </div>
                    <div style={{ textAlign: "right" as const }}>
                        {cliente.tel && (
                            <p style={{ margin: "0 0 4px", fontSize: 12, color: "#9CA3AF" }}>📱 {cliente.tel}</p>
                        )}
                        {cliente.email && (
                            <p style={{ margin: "0 0 4px", fontSize: 12, color: "#9CA3AF" }}>✉ {cliente.email}</p>
                        )}
                        <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>📅 {fecha}</p>
                    </div>
                </div>

                {/* Thin accent bar */}
                <div style={{ height: 4, background: `linear-gradient(90deg, ${ACCENT}, #38BDF8)` }} />

                {/* ── BODY CONTENT ──────────────────────────────────────────── */}
                <div style={{ padding: "40px 48px 48px" }}>
                    {SECTIONS.map(({ num, key, title }) => {
                        if (key === "investment") {
                            return (
                                <Section key={key} num={num} title={title}>
                                    <InvestmentTable items={cotizacion.items} total={cotizacion.total} />
                                </Section>
                            );
                        }
                        const text = secciones[key as keyof SeccionesPDF] || "";
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
                    padding: "18px 48px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#FAFAFA",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <img src="/3.png" alt="Galuweb" style={{ height: 22, objectFit: "contain", opacity: 0.6 }} />
                        <p style={{ margin: 0, fontSize: 11, color: MUTED }}>© {new Date().getFullYear()} Galuweb — galuweb.com</p>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: MUTED }}>Propuesta confidencial · {fecha}</p>
                </div>
            </div>
        );
    }
);

CotizacionPDFTemplate.displayName = "CotizacionPDFTemplate";
