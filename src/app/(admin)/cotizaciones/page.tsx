"use client";

import { useEffect, useState, Suspense, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
    Plus, Trash2, X, FileText, Sparkles, Upload, Link as LinkIcon,
    Code2, Globe, Download, ChevronDown, ChevronUp, AlignLeft, Archive, Pencil, Calculator
} from "lucide-react";
import { cn, formatCurrency, formatDate, hoyISO } from "@/lib/utils";
import { cotizacionesStore, clientesStore, storageStore } from "@/lib/store";
import { CotizacionPDFTemplate } from "@/components/cotizacion-pdf-template";
import type {
    Cotizacion, CotizacionItem, EstadoCotizacion, Cliente,
    EspecificacionesWebApp, TipoCotizacion, SeccionesPDF,
    BriefingCotizacion, PlanPagoItem
} from "@/lib/types";
import {
    CAMPOS_BRIEFING, briefingVacio, faltantesDelBriefing, faltantesParaEstimar,
    totalDeItems, anclasDePrecio, type EstimacionPrecio,
} from "@/lib/cotizacion-ia";
import { toast } from "sonner";
import ReactDOM from "react-dom/client";

// ── Helpers ──────────────────────────────────────────────────────────────────
const ESTADO_BADGE: Record<EstadoCotizacion, string> = {
    borrador: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    enviada: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    aceptada: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    rechazada: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    archivada: "bg-purple-500/20 text-purple-300 border-purple-500/30",
};

const TIPO_BADGE: Record<TipoCotizacion, string> = {
    web: "bg-sky-500/10 text-sky-300 border-sky-500/20",
    webapp: "bg-violet-500/10 text-violet-300 border-violet-500/20",
};

const TIPO_LABEL: Record<TipoCotizacion, string> = {
    web: "Página Web",
    webapp: "Web App / Software",
};

const DEFAULT_WEBAPP_SPECS: EspecificacionesWebApp = {
    modulos: [], cantidad_usuarios: "", roles: "",
    integraciones: "", plataforma: "", modelo_negocio: "", notas_tecnicas: "",
};

const SECCIONES_WEB_DEFAULT: SeccionesPDF = {
    descripcion: "",
    alcance: "",
    cronograma: "",
    terminos: "",
    proximos_pasos: "",
    conclusion: "",
};

const SECCIONES_WEBAPP_DEFAULT: SeccionesPDF = {
    descripcion: "",
    alcance: "",
    arquitectura: "",
    cronograma: "",
    terminos: "",
    proximos_pasos: "",
};

// ── PDF Generator ─────────────────────────────────────────────────────────────
async function generatePDF(
    cotizacion: Cotizacion,
    cliente: Cliente,
    secciones: SeccionesPDF,
    onDone?: () => void,
) {
    // Dynamic import to avoid SSR issues
    const html2pdf = (await import("html2pdf.js")).default;

    // Mount template into hidden container
    const container = document.createElement("div");
    container.style.cssText = "position:absolute;left:-9999px;top:0;width:794px;";
    document.body.appendChild(container);

    const root = ReactDOM.createRoot(container);
    root.render(
        <CotizacionPDFTemplate
            cotizacion={cotizacion}
            cliente={cliente}
            secciones={secciones}
        />
    );

    // Wait for React to paint and fonts to load
    await new Promise((r) => setTimeout(r, 600));

    const el = container.firstElementChild as HTMLElement;

    // Adjust min-height for complete page fills to keep footer at the bottom.
    // We don't manually limit the height anymore! Let html2pdf span across as many pages as it needs.
    const filename = `Cotizacion_${cliente.nombre.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;

    const opt = {
        margin: [0, 0, 15, 0] as [number, number, number, number], // Give 15mm bottom margin to avoid text overlapping the footer
        filename: filename,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
        pagebreak: { mode: ["css", "legacy"], avoid: '.avoid-break' }
    };

    const worker = html2pdf().set(opt).from(el);

    // Inject the footer on all pages using jsPDF vectors natively AFTER html rendering captures
    await worker.toPdf().get('pdf').then(async (pdf: any) => {
        const totalPages = pdf.internal.getNumberOfPages();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        // Convert logo to base64 for jsPDF
        const res = await fetch("/3.png");
        const blob = await res.blob();
        const reader = new FileReader();
        const logoB64 = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });

        // Calculate exact ratio to prevent stretching
        const img = new Image();
        img.src = logoB64;
        await new Promise((r) => img.onload = r);
        const logoH = 7; // 7mm height
        const logoW = logoH * (img.width / img.height);

        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);

            // Draw gray background
            pdf.setFillColor(249, 250, 251);
            pdf.rect(0, pageHeight - 15, pageWidth, 15, "F");

            // Draw top border
            pdf.setDrawColor(229, 231, 235);
            pdf.setLineWidth(0.2);
            pdf.line(0, pageHeight - 15, pageWidth, pageHeight - 15);

            // Draw Logo
            pdf.addImage(logoB64, 'PNG', 12, pageHeight - 11, logoW, logoH);

            // Draw texts
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8);
            pdf.setTextColor(107, 114, 128);

            // Left link alongside logo
            pdf.text(`© ${new Date().getFullYear()} Galuweb — galuweb.com`, 40, pageHeight - 6.5);

            // Right confidentiality
            const rightText = "Propuesta comercial confidencial";
            // Align to right edge with some padding
            pdf.text(rightText, pageWidth - 48, pageHeight - 6.5);
        }
    });

    await worker.save();

    root.unmount();
    document.body.removeChild(container);
    onDone?.();
}

// ── Secciones Form ─────────────────────────────────────────────────────────────
function SeccionesForm({
    tipo, secciones, onChange, abiertoPorDefecto = false,
}: {
    tipo: TipoCotizacion;
    secciones: SeccionesPDF;
    onChange: (s: SeccionesPDF) => void;
    abiertoPorDefecto?: boolean;
}) {
    const [open, setOpen] = useState(abiertoPorDefecto);

    const FIELDS_WEB = [
        { key: "descripcion", label: "01. Descripción del Proyecto" },
        { key: "alcance", label: "02. Alcance y Funcionalidades" },
        { key: "cronograma", label: "03. Cronograma de Trabajo" },
        { key: "terminos", label: "04. Términos y Modalidad de Pago" },
        { key: "conclusion", label: "05. Conclusión" },
        { key: "proximos_pasos", label: "06. Próximos Pasos" },
    ];

    const FIELDS_WEBAPP = [
        { key: "descripcion", label: "01. Descripción del Sistema" },
        { key: "alcance", label: "02. Módulos y Funcionalidades" },
        { key: "arquitectura", label: "03. Arquitectura y Tecnología" },
        { key: "cronograma", label: "04. Plan de Desarrollo" },
        { key: "terminos", label: "05. Términos y Modelo de Pago" },
        { key: "proximos_pasos", label: "06. Próximos Pasos" },
    ];

    const fields = tipo === "webapp" ? FIELDS_WEBAPP : FIELDS_WEB;

    return (
        <div className="rounded-xl border border-border bg-secondary/20 overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-secondary/50 transition-colors"
            >
                <span className="flex items-center gap-2">
                    <AlignLeft className="w-4 h-4 text-primary" />
                    Textos del PDF (secciones)
                </span>
                {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {open && (
                <div className="p-4 pt-0 space-y-3 border-t border-border">
                    <p className="text-xs text-muted-foreground pt-3">Cada sección aparecerá en el PDF. Podés usar - para listas.</p>
                    {fields.map(({ key, label }) => (
                        <div key={key} className="space-y-1">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
                            <textarea
                                value={(secciones as any)[key] || ""}
                                onChange={(e) => onChange({ ...secciones, [key]: e.target.value })}
                                rows={4}
                                placeholder={`Texto para "${label}"...`}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── PDF Button ─────────────────────────────────────────────────────────────────
function PDFButton({ cotizacion, cliente }: { cotizacion: Cotizacion; cliente: Cliente }) {
    const [loading, setLoading] = useState(false);

    const handleClick = async () => {
        if (loading) return;
        setLoading(true);
        toast.loading("Generando PDF…", { id: "pdf" });
        try {
            const secciones: SeccionesPDF = cotizacion.secciones_pdf ?? {
                descripcion: "", alcance: "", cronograma: "", terminos: "", proximos_pasos: "", conclusion: "",
            };
            await generatePDF(cotizacion, cliente, secciones, () => {
                toast.success("PDF descargado", { id: "pdf" });
            });
        } catch (err) {
            console.error(err);
            toast.error("Error al generar PDF", { id: "pdf" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleClick}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 disabled:opacity-50 transition-all"
        >
            {loading
                ? <span className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                : <Download className="w-3.5 h-3.5" />
            }
            {loading ? "Generando…" : "Descargar PDF"}
        </button>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
function CotizacionesContent() {
    const searchParams = useSearchParams();
    const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [mounted, setMounted] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [filterEstado, setFilterEstado] = useState<string>("todas");

    // Form state
    const [tipoCotizacion, setTipoCotizacion] = useState<TipoCotizacion>("web");
    const [clienteId, setClienteId] = useState("");
    const [items, setItems] = useState<CotizacionItem[]>([{ descripcion: "", precio: 0 }]);
    const [notas, setNotas] = useState("");
    const [uploading, setUploading] = useState(false);
    const [pdfUrl, setPdfUrl] = useState("");
    const [webappSpecs, setWebappSpecs] = useState<EspecificacionesWebApp>(DEFAULT_WEBAPP_SPECS);
    const [moduloInput, setModuloInput] = useState("");
    const [secciones, setSecciones] = useState<SeccionesPDF>(SECCIONES_WEB_DEFAULT);
    // Cotización con IA
    const [briefing, setBriefing] = useState<BriefingCotizacion>(briefingVacio());
    const [planPago, setPlanPago] = useState<PlanPagoItem[]>([]);
    const [fechaEmision, setFechaEmision] = useState(hoyISO());
    const [validezDias, setValidezDias] = useState(15);
    const [generando, setGenerando] = useState(false);
    const [estimando, setEstimando] = useState(false);
    const [estimacion, setEstimacion] = useState<EstimacionPrecio | null>(null);
    const [resumenInterno, setResumenInterno] = useState("");
    const [generado, setGenerado] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);

    const reload = async () => {
        try {
            const [q, c] = await Promise.all([cotizacionesStore.getAll(), clientesStore.getAll()]);
            setCotizaciones(q);
            setClientes(c);
        } catch {
            console.error("Error reloading quotes:");
        }
    };
    useEffect(() => { reload().then(() => setMounted(true)); }, []);

    const addItem = () => setItems([...items, { descripcion: "", precio: 0 }]);
    const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
    const updateItem = (i: number, field: keyof CotizacionItem, value: string | number) => {
        const updated = [...items];
        if (field === "precio") updated[i][field] = Number(value);
        else updated[i][field] = value as string;
        setItems(updated);
    };
    const total = totalDeItems(items);

    const handleTipoChange = (t: TipoCotizacion) => {
        setTipoCotizacion(t);
        setSecciones(t === "webapp" ? SECCIONES_WEBAPP_DEFAULT : SECCIONES_WEB_DEFAULT);
    };

    const addTramo = () => setPlanPago([...planPago, { cuando: "", monto: 0, detalle: "" }]);
    const removeTramo = (i: number) => setPlanPago(planPago.filter((_, idx) => idx !== i));
    const updateTramo = (i: number, campo: keyof PlanPagoItem, valor: string) => {
        const copia = [...planPago];
        copia[i] = { ...copia[i], [campo]: campo === "monto" ? Number(valor) : valor };
        setPlanPago(copia);
    };
    const totalPlan = planPago.reduce((s, t) => s + (Number(t.monto) || 0), 0);

    const addModulo = () => {
        const m = moduloInput.trim();
        if (!m) return;
        setWebappSpecs({ ...webappSpecs, modulos: [...webappSpecs.modulos, m] });
        setModuloInput("");
    };
    const removeModulo = (i: number) => setWebappSpecs({ ...webappSpecs, modulos: webappSpecs.modulos.filter((_, idx) => idx !== i) });

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const esPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!esPdf) { toast.error("Solo archivos PDF"); return; }
        setUploading(true);
        toast.loading("Subiendo PDF…", { id: "pdf-upload" });
        try {
            const url = await storageStore.uploadCotizacion(file);
            setPdfUrl(url);
            toast.success("PDF subido correctamente", { id: "pdf-upload" });
        } catch (err) {
            console.error("Error al subir PDF:", err);
            toast.error((err as Error)?.message || "Error al subir PDF", { id: "pdf-upload", duration: 10000 });
        }
        finally {
            setUploading(false);
            e.target.value = ""; // permite reintentar con el mismo archivo
        }
    };

    const handleSave = async () => {
        if (!clienteId) { toast.error("Selecciona un cliente"); return; }
        const itemsValidos = items.filter((i) => i.descripcion.trim());
        if (itemsValidos.length === 0 && !pdfUrl) {
            toast.error("Detallá al menos un ítem del servicio o adjuntá el PDF de la cotización");
            return;
        }
        const datos = {
            cliente_id: clienteId,
            total,
            items: itemsValidos,
            pdf_url: pdfUrl,
            notas,
            tipo_cotizacion: tipoCotizacion,
            especificaciones_webapp: tipoCotizacion === "webapp" ? webappSpecs : null,
            secciones_pdf: secciones,
            briefing,
            plan_pago: planPago.filter((t) => t.cuando.trim()),
            fecha_emision: fechaEmision,
            validez_dias: validezDias,
        };
        try {
            if (editId) {
                await cotizacionesStore.update(editId, datos);
            } else {
                await cotizacionesStore.create({ ...datos, estado: "borrador" });
            }
            setShowNew(false);
            resetForm();
            await reload();
            toast.success(editId ? "Cotización actualizada" : "Cotización creada");
        } catch { toast.error("Error al guardar cotización"); }
    };

    /** Carga una cotización existente en el formulario para editarla. */
    const editarCotizacion = (q: Cotizacion) => {
        const tipo = (q.tipo_cotizacion || "web") as TipoCotizacion;
        setEditId(q.id);
        setTipoCotizacion(tipo);
        setClienteId(q.cliente_id);
        setItems(q.items.length ? q.items : [{ descripcion: "", precio: 0 }]);
        setNotas(q.notas || "");
        setPdfUrl(q.pdf_url || "");
        setWebappSpecs(q.especificaciones_webapp || DEFAULT_WEBAPP_SPECS);
        setSecciones(q.secciones_pdf || (tipo === "webapp" ? SECCIONES_WEBAPP_DEFAULT : SECCIONES_WEB_DEFAULT));
        setBriefing(q.briefing || briefingVacio());
        setPlanPago(q.plan_pago || []);
        setFechaEmision(q.fecha_emision || q.created_at.slice(0, 10));
        setValidezDias(q.validez_dias ?? 15);
        setResumenInterno("");
        setEstimacion(null);
        setGenerado(Boolean(q.secciones_pdf));
        setShowNew(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const resetForm = () => {
        setItems([{ descripcion: "", precio: 0 }]);
        setClienteId("");
        setNotas("");
        setPdfUrl("");
        setTipoCotizacion("web");
        setWebappSpecs(DEFAULT_WEBAPP_SPECS);
        setModuloInput("");
        setSecciones(SECCIONES_WEB_DEFAULT);
        setBriefing(briefingVacio());
        setPlanPago([]);
        setFechaEmision(hoyISO());
        setValidezDias(15);
        setResumenInterno("");
        setGenerado(false);
        setEditId(null);
        setEstimacion(null);
    };

    /**
     * Pide una referencia de precio. No toca el campo: el número final lo
     * escribe quien cotiza, mirando la sugerencia al lado.
     */
    const handleEstimar = async () => {
        const faltan = faltantesParaEstimar(briefing);
        if (faltan.length > 0) { toast.error(`Falta completar: ${faltan.join(", ")}`); return; }
        const c = clientes.find((x) => x.id === clienteId);

        setEstimando(true);
        toast.loading("Estimando el precio…", { id: "est" });
        try {
            const res = await fetch("/api/gemini/estimar-precio", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    briefing,
                    tipo: tipoCotizacion,
                    negocio: c?.negocio,
                    historial: anclasDePrecio(cotizaciones, tipoCotizacion),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "No se pudo estimar el precio");
            setEstimacion(data.estimacion as EstimacionPrecio);
            toast.success("Precio estimado. Decidís vos.", { id: "est" });
        } catch (e) {
            toast.error((e as Error).message, { id: "est", duration: 8000 });
        } finally {
            setEstimando(false);
        }
    };

    /**
     * Manda el relevamiento a la IA y vuelca lo que devuelve en el formulario.
     * Todo queda editable: esto es un borrador con ventaja, no una entrega.
     */
    const handleGenerar = async () => {
        if (!clienteId) { toast.error("Elegí el cliente antes de generar"); return; }
        const faltan = faltantesDelBriefing(briefing);
        if (faltan.length > 0) {
            toast.error(`Falta completar: ${faltan.join(", ")}`);
            return;
        }
        const c = clientes.find((x) => x.id === clienteId);

        setGenerando(true);
        toast.loading("Redactando la cotización…", { id: "gen" });
        try {
            const res = await fetch("/api/gemini/generar-cotizacion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    briefing,
                    tipo: tipoCotizacion,
                    cliente: c?.nombre,
                    negocio: c?.negocio,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "No se pudo generar la cotización");

            const g = data.cotizacion as {
                items: CotizacionItem[]; plan_pago: PlanPagoItem[];
                secciones: SeccionesPDF; resumen_interno: string;
            };
            setItems(g.items.length ? g.items : [{ descripcion: "", precio: 0 }]);
            setPlanPago(g.plan_pago || []);
            setSecciones({ ...(tipoCotizacion === "webapp" ? SECCIONES_WEBAPP_DEFAULT : SECCIONES_WEB_DEFAULT), ...g.secciones });
            setResumenInterno(g.resumen_interno || "");
            setGenerado(true);
            toast.success("Cotización redactada. Revisala antes de mandarla.", { id: "gen" });
        } catch (e) {
            toast.error((e as Error).message, { id: "gen", duration: 8000 });
        } finally {
            setGenerando(false);
        }
    };

    const updateEstado = async (id: string, estado: EstadoCotizacion) => {
        try {
            await cotizacionesStore.update(id, { estado });
            await reload();
            toast.success(`Marcada como ${estado}`);
        } catch { toast.error("Error al actualizar estado"); }
    };

    const deleteCotizacion = async (id: string) => {
        if (!confirm("¿Seguro que deseas eliminar esta cotización?")) return;
        try {
            await cotizacionesStore.delete(id);
            await reload();
            toast.success("Cotización eliminada");
        } catch { toast.error("Error al eliminar"); }
    };

    if (!mounted) {
        return <div className="space-y-3 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl skeleton" />)}</div>;
    }

    // ── Main View ───────────────────────────────────────────────────────────
    return (
        <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Cotizaciones</h2>
                    <p className="text-sm text-muted-foreground">{cotizaciones.length} cotizaciones</p>
                </div>
                <button onClick={() => { resetForm(); setShowNew(true); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                    <Plus className="w-4 h-4" /> Nueva cotización
                </button>
            </div>

            {/* New Quote Form */}
            {showNew && (
                <div className="rounded-xl border border-primary/30 bg-card p-5 space-y-5 animate-fade-in">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-foreground">{editId ? "Editar cotización" : "Nueva cotización"}</h3>
                        <button onClick={() => { setShowNew(false); resetForm(); }} className="p-1 rounded-lg hover:bg-secondary"><X className="w-4 h-4 text-muted-foreground" /></button>
                    </div>

                    {/* Tipo */}
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleTipoChange("web")} className={cn("flex items-center gap-2 p-3 rounded-xl border text-sm font-medium", tipoCotizacion === "web" ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground")}>
                            <Globe className="w-4 h-4" /> Página Web
                        </button>
                        <button onClick={() => handleTipoChange("webapp")} className={cn("flex items-center gap-2 p-3 rounded-xl border text-sm font-medium", tipoCotizacion === "webapp" ? "border-violet-500 bg-violet-500/10 text-violet-400" : "border-border bg-secondary/50 text-muted-foreground")}>
                            <Code2 className="w-4 h-4" /> Web App / Software
                        </button>
                    </div>

                    <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                        <option value="">Seleccionar cliente...</option>
                        {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre} — {c.negocio}</option>)}
                    </select>

                    {/* Fecha y validez: salen impresas en el PDF */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Fecha de emisión</label>
                            <input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} className="w-full mt-1 h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Validez (días)</label>
                            <input type="number" min={1} value={validezDias} onChange={(e) => setValidezDias(Number(e.target.value) || 15)} className="w-full mt-1 h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                        </div>
                    </div>

                    {/* Relevamiento: lo que sabés del proyecto. De acá sale todo lo demás. */}
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                        <div>
                            <h4 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                                <Sparkles className="w-4 h-4" /> Relevamiento del proyecto
                            </h4>
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Contá lo que sabés, como lo tengas. Con esto la IA escribe la cotización entera y después la editás.
                            </p>
                        </div>

                        {CAMPOS_BRIEFING.map((campo) => (
                            <div key={campo.key} className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                        {campo.label}
                                        {campo.clave && <span className="text-[9px] font-bold uppercase tracking-wide text-amber-400">obligatorio</span>}
                                    </label>
                                    {campo.key === "presupuesto" && (
                                        <button
                                            type="button"
                                            onClick={handleEstimar}
                                            disabled={estimando}
                                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[11px] font-semibold hover:bg-sky-500/20 disabled:opacity-50 transition-colors"
                                        >
                                            {estimando
                                                ? <span className="w-3 h-3 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
                                                : <Calculator className="w-3 h-3" />}
                                            {estimando ? "Estimando…" : "¿Cuánto cobrar?"}
                                        </button>
                                    )}
                                </div>

                                {campo.key === "presupuesto" && estimacion && (
                                    <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 space-y-2.5">
                                        <div className="flex items-end justify-between gap-3 flex-wrap">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-sky-400">Sugerencia</p>
                                                <p className="text-2xl font-black text-foreground leading-tight tabular-nums">
                                                    {formatCurrency(estimacion.sugerido)}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground tabular-nums">
                                                    Rango {formatCurrency(estimacion.minimo)} — {formatCurrency(estimacion.maximo)}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setBriefing({ ...briefing, presupuesto: String(estimacion.sugerido) })}
                                                className="px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-500/30 text-sky-300 text-[11px] font-semibold hover:bg-sky-500/30"
                                            >
                                                Usar {formatCurrency(estimacion.sugerido)}
                                            </button>
                                        </div>
                                        {estimacion.razonamiento && (
                                            <p className="text-[11px] text-muted-foreground leading-relaxed">{estimacion.razonamiento}</p>
                                        )}
                                        {estimacion.factores.length > 0 && (
                                            <ul className="space-y-1">
                                                {estimacion.factores.map((f, i) => (
                                                    <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5">
                                                        <span className="text-sky-400">·</span>{f}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        <p className="text-[10px] text-muted-foreground/70 italic">
                                            Es una referencia. El precio que vale es el que escribas abajo.
                                        </p>
                                    </div>
                                )}

                                <textarea
                                    value={briefing[campo.key]}
                                    onChange={(e) => setBriefing({ ...briefing, [campo.key]: e.target.value })}
                                    rows={campo.filas}
                                    placeholder={campo.placeholder}
                                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40 resize-y"
                                />
                            </div>
                        ))}

                        <button
                            onClick={handleGenerar}
                            disabled={generando}
                            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-amber-500 text-black text-sm font-bold hover:bg-amber-400 disabled:opacity-50 transition-colors"
                        >
                            {generando
                                ? <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Redactando…</>
                                : <><Sparkles className="w-4 h-4" /> {generado ? "Volver a generar" : "Generar cotización con IA"}</>}
                        </button>
                        {generado && (
                            <p className="text-[11px] text-muted-foreground text-center">
                                Volver a generar reemplaza los ítems y los textos. Lo que edites a mano se pierde.
                            </p>
                        )}
                    </div>

                    {/* Lo que la IA anotó para vos, no para el cliente */}
                    {resumenInterno && (
                        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-sky-400 mb-1">Nota interna</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{resumenInterno}</p>
                        </div>
                    )}

                    {/* WebApp Specs */}
                    {tipoCotizacion === "webapp" && (
                        <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-500/5 space-y-4">
                            <h4 className="text-sm font-semibold text-violet-400 flex items-center gap-2"><Code2 className="w-4 h-4" /> Especificaciones del Sistema</h4>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-foreground">Módulos del Sistema</label>
                                <div className="flex gap-2">
                                    <input value={moduloInput} onChange={(e) => setModuloInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addModulo())} placeholder="Ej: Gestión de Clientes" className="flex-1 h-8 px-3 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none" />
                                    <button onClick={addModulo} className="px-3 h-8 rounded-lg bg-violet-500/20 text-violet-400 text-xs font-medium hover:bg-violet-500/30">+ Agregar</button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {webappSpecs.modulos.map((m, i) => (
                                        <span key={i} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">
                                            {m}<button onClick={() => removeModulo(i)}><X className="w-2.5 h-2.5" /></button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { label: "Cantidad de usuarios", key: "cantidad_usuarios", placeholder: "Ej: 1-20 usuarios" },
                                    { label: "Roles / Permisos", key: "roles", placeholder: "Ej: Admin, Operador, Cliente" },
                                    { label: "Integraciones", key: "integraciones", placeholder: "Ej: MercadoPago, WhatsApp API" },
                                ].map(({ label, key, placeholder }) => (
                                    <div key={key}>
                                        <label className="text-xs font-medium text-foreground">{label}</label>
                                        <input value={(webappSpecs as any)[key]} onChange={(e) => setWebappSpecs({ ...webappSpecs, [key]: e.target.value })} placeholder={placeholder} className="w-full mt-1 h-8 px-3 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none" />
                                    </div>
                                ))}
                                <div>
                                    <label className="text-xs font-medium text-foreground">Plataforma objetivo</label>
                                    <select value={webappSpecs.plataforma} onChange={(e) => setWebappSpecs({ ...webappSpecs, plataforma: e.target.value })} className="w-full mt-1 h-8 px-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none">
                                        <option value="">Seleccionar...</option>
                                        <option value="Web (Desktop)">Web (Desktop)</option>
                                        <option value="Web Responsive">Web Responsive</option>
                                        <option value="PWA (Mobile + Web)">PWA (Mobile + Web)</option>
                                        <option value="Multiplataforma">Multiplataforma</option>
                                    </select>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="text-xs font-medium text-foreground">Modelo de negocio</label>
                                    <select value={webappSpecs.modelo_negocio} onChange={(e) => setWebappSpecs({ ...webappSpecs, modelo_negocio: e.target.value })} className="w-full mt-1 h-8 px-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none">
                                        <option value="">Seleccionar...</option>
                                        <option value="Pago único (licencia)">Pago único (licencia)</option>
                                        <option value="SaaS (suscripción mensual)">SaaS (suscripción mensual)</option>
                                        <option value="Freemium + planes">Freemium + planes</option>
                                        <option value="Uso interno / sin monetización">Uso interno / sin monetización</option>
                                    </select>
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="text-xs font-medium text-foreground">Notas técnicas</label>
                                    <textarea value={webappSpecs.notas_tecnicas} onChange={(e) => setWebappSpecs({ ...webappSpecs, notas_tecnicas: e.target.value })} rows={2} placeholder="Requerimientos técnicos específicos..." className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none resize-none" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Items */}
                    <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_120px_40px] gap-2 text-[10px] text-muted-foreground uppercase"><span>Detalle del servicio</span><span>Precio</span><span /></div>
                        {items.map((item, i) => (
                            <div key={i} className="grid grid-cols-[1fr_120px_40px] gap-2">
                                <input value={item.descripcion} onChange={(e) => updateItem(i, "descripcion", e.target.value)} className="h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Descripción del servicio..." />
                                <input type="number" value={item.precio || ""} onChange={(e) => updateItem(i, "precio", e.target.value)} className="h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="0" />
                                <button onClick={() => removeItem(i)} className="h-9 flex items-center justify-center rounded-lg hover:bg-destructive/20"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                            </div>
                        ))}
                        <button onClick={addItem} className="text-xs text-primary hover:underline">+ Agregar ítem</button>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <span className="text-sm font-medium text-foreground">Total</span>
                        <span className="text-lg font-bold text-primary">{formatCurrency(total)}</span>
                    </div>

                    {/* Plan de pago: el PDF lo dibuja como tarjetas en Términos */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-muted-foreground uppercase">Plan de pago</label>
                            {planPago.length > 0 && (
                                <span className={cn("text-[11px] font-medium", totalPlan === total ? "text-emerald-400" : "text-amber-400")}>
                                    {totalPlan === total
                                        ? "Suma el total"
                                        : `Los tramos suman ${formatCurrency(totalPlan)} y el total es ${formatCurrency(total)}`}
                                </span>
                            )}
                        </div>
                        {planPago.map((tramo, i) => (
                            <div key={i} className="grid grid-cols-[1fr_110px_1fr_40px] gap-2">
                                <input value={tramo.cuando} onChange={(e) => updateTramo(i, "cuando", e.target.value)} placeholder="Pago 1 · Al aceptar" className="h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                <input type="number" value={tramo.monto || ""} onChange={(e) => updateTramo(i, "monto", e.target.value)} placeholder="0" className="h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                <input value={tramo.detalle} onChange={(e) => updateTramo(i, "detalle", e.target.value)} placeholder="Arranque del proyecto" className="h-9 px-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                <button onClick={() => removeTramo(i)} className="h-9 flex items-center justify-center rounded-lg hover:bg-destructive/20"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                            </div>
                        ))}
                        <button onClick={addTramo} className="text-xs text-primary hover:underline">+ Agregar tramo de pago</button>
                    </div>

                    {/* Secciones PDF */}
                    <SeccionesForm tipo={tipoCotizacion} secciones={secciones} onChange={setSecciones} abiertoPorDefecto={generado} />

                    {/* PDF Upload */}
                    <div className="flex flex-col gap-3 p-3 rounded-lg border border-border bg-secondary/30">
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2"><FileText className="w-3 h-3" /> PDF de la cotización</label>
                            <p className="text-[11px] text-muted-foreground mt-1">Si ya armaste el PDF por fuera, subilo acá y no hace falta completar los textos del PDF.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <input type="file" accept="application/pdf,.pdf" onChange={handleFileUpload} id="pdf-upload" className="hidden" />
                            <label htmlFor="pdf-upload" className={cn("flex-1 flex items-center justify-center gap-2 h-10 rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer text-sm", uploading && "opacity-50 pointer-events-none")}>
                                {uploading ? <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
                                {uploading ? "Subiendo…" : pdfUrl ? "Cambiar PDF" : "Subir archivo PDF"}
                            </label>
                            {pdfUrl && (
                                <>
                                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="h-10 px-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium"><LinkIcon className="w-3.5 h-3.5" /> Ver PDF</a>
                                    <button onClick={() => setPdfUrl("")} className="h-10 px-2 rounded-lg hover:bg-destructive/20" title="Quitar PDF"><X className="w-4 h-4 text-destructive" /></button>
                                </>
                            )}
                        </div>
                    </div>

                    <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Notas internas adicionales..." className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />

                    <div className="flex justify-end gap-2">
                        <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:opacity-90">Guardar Cotización</button>
                    </div>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto whitespace-nowrap scrollbar-none pb-1">
                {[
                    { id: "todas", label: "Todas" },
                    { id: "borrador", label: "Borrador" },
                    { id: "enviada", label: "Enviada" },
                    { id: "aceptada", label: "Aceptada" },
                    { id: "rechazada", label: "Rechazada" },
                    { id: "archivada", label: "Archivadas" },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setFilterEstado(tab.id as any)}
                        className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border",
                            filterEstado === tab.id
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-card text-muted-foreground border-border hover:bg-secondary hover:text-foreground"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Quote Cards */}
            <div className="space-y-3">
                {cotizaciones
                    .filter((q) => {
                        if (filterEstado === "todas") return q.estado !== "archivada"; // Por defecto no mostrar archivadas en 'todas'
                        return q.estado === filterEstado;
                    })
                    .map((q) => {
                    const cliente = clientes.find((c) => c.id === q.cliente_id);
                    if (!cliente) return null;
                    const tipo = (q.tipo_cotizacion || "web") as TipoCotizacion;
                    const esArchivada = q.estado === "archivada";

                    return (
                        <div key={q.id} className={cn("rounded-2xl border border-border bg-card p-3.5 sm:p-5 card-hover transition-all space-y-3", esArchivada && "opacity-60 bg-secondary/20")}>
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                        <h4 className="text-sm font-bold text-foreground truncate">{cliente.nombre}</h4>
                                        <span className={cn("text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0", TIPO_BADGE[tipo])}>
                                            {tipo === "webapp" ? <Code2 className="w-2.5 h-2.5 inline mr-1" /> : <Globe className="w-2.5 h-2.5 inline mr-1" />}
                                            {TIPO_LABEL[tipo]}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{cliente.negocio} · {formatDate(q.created_at)}</p>
                                </div>
                                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                                    <span className={cn("text-[10px] px-2.5 py-1 rounded-full border font-medium capitalize", ESTADO_BADGE[q.estado])}>{q.estado}</span>
                                    <span className="text-sm sm:text-base font-black text-foreground">{formatCurrency(q.total)}</span>
                                </div>
                            </div>

                            {/* Módulos WebApp */}
                            {tipo === "webapp" && (q.especificaciones_webapp?.modulos?.length ?? 0) > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {q.especificaciones_webapp?.modulos?.map((m, i) => (
                                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">{m}</span>
                                    ))}
                                </div>
                            )}

                            {/* Items */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {q.items.map((item, i) => (
                                    <div key={i} className="flex justify-between text-xs px-2.5 py-1.5 rounded-xl bg-secondary/40 border border-border/50">
                                        <span className="text-muted-foreground truncate mr-2">{item.descripcion}</span>
                                        <span className="text-foreground font-semibold shrink-0">{formatCurrency(item.precio)}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-border/50">
                                <div className="flex flex-wrap gap-1.5">
                                    {(["borrador", "enviada", "aceptada", "rechazada", "archivada"] as EstadoCotizacion[]).map((e) => (
                                        <button key={e} onClick={() => updateEstado(q.id, e)} className={cn("px-2 py-1 rounded-lg text-[10px] capitalize transition-colors flex items-center gap-1", q.estado === e ? "bg-primary/20 text-primary font-bold border border-primary/30" : "text-muted-foreground hover:bg-secondary")}>
                                            {e === "archivada" && <Archive className="w-2.5 h-2.5" />}
                                            {e}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-2 justify-end flex-wrap">
                                    {/* PDF adjuntado a mano */}
                                    {q.pdf_url && (
                                        <a href={q.pdf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold hover:bg-sky-500/20">
                                            <LinkIcon className="w-3.5 h-3.5" /> Ver PDF adjunto
                                        </a>
                                    )}
                                    {/* PDF Download */}
                                    <PDFButton cotizacion={q} cliente={cliente} />
                                    <button onClick={() => editarCotizacion(q)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold hover:bg-violet-500/20">
                                        <Pencil className="w-3.5 h-3.5" /> Editar
                                    </button>
                                    <button onClick={() => deleteCotizacion(q.id)} className="p-1.5 rounded-lg bg-secondary/50 hover:bg-destructive/20" title="Eliminar">
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {cotizaciones.length === 0 && (
                    <div className="py-12 text-center text-muted-foreground">
                        <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No hay cotizaciones creadas aún</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function CotizacionesPage() {
    return (
        <Suspense fallback={
            <div className="space-y-3 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-secondary/30" />)}</div>
        }>
            <CotizacionesContent />
        </Suspense>
    );
}
