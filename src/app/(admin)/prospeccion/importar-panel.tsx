"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Table2, Compass, Loader2, ArrowRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Prospecto, ScraperBusqueda, Sistema } from "@/lib/types";
import { ESCANEO_VACIO, SISTEMA_LABELS } from "@/lib/types";
import {
    parsearPegado, mapearColumnas, clasificarWebDesdeUrl, telefonoAWhatsapp,
    CAMPOS_IMPORTABLES, type CampoImportable, type FilaParseada,
} from "@/lib/prospeccion";

interface Props {
    busquedasScraper: ScraperBusqueda[];
    sistemaInicial?: Sistema;
    onImportarFilas: (items: Partial<Prospecto>[]) => Promise<void>;
    onImportarScraper: (busqueda: ScraperBusqueda, sistema: Sistema) => Promise<void>;
    onCerrar: () => void;
}

type Fuente = "sheets" | "scraper";

export default function ImportarPanel({
    busquedasScraper, sistemaInicial = "galu", onImportarFilas, onImportarScraper, onCerrar,
}: Props) {
    const [fuente, setFuente] = useState<Fuente>("sheets");
    const [sistema, setSistema] = useState<Sistema>(sistemaInicial);
    const [texto, setTexto] = useState("");
    const [mapeo, setMapeo] = useState<(CampoImportable | "")[]>([]);
    const [rubroPorDefecto, setRubroPorDefecto] = useState("");
    const [ciudadPorDefecto, setCiudadPorDefecto] = useState("");
    const [importando, setImportando] = useState(false);

    const parseado: FilaParseada | null = useMemo(() => parsearPegado(texto), [texto]);

    // El automapeo corre cuando cambian los encabezados; después manda el usuario.
    const firmaHeaders = parseado ? parseado.headers.join("|") : "";
    useEffect(() => {
        if (!parseado) { setMapeo([]); return; }
        setMapeo(mapearColumnas(parseado.headers));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firmaHeaders]);

    const filasAImportar = useMemo(() => {
        if (!parseado) return [];
        return parseado.filas
            .map((fila) => construirProspecto(fila, mapeo, rubroPorDefecto, ciudadPorDefecto, sistema))
            .filter((p) => p.negocio && p.negocio.trim().length > 0);
    }, [parseado, mapeo, rubroPorDefecto, ciudadPorDefecto, sistema]);

    const faltaNegocio = parseado != null && !mapeo.includes("negocio");

    const importar = async () => {
        if (filasAImportar.length === 0) {
            toast.error("No hay filas con nombre de negocio para importar");
            return;
        }
        setImportando(true);
        try {
            await onImportarFilas(filasAImportar);
            setTexto("");
            setMapeo([]);
        } finally {
            setImportando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
            <div className="bg-card border border-border rounded-2xl w-full max-w-5xl shadow-2xl my-4">
                <div className="flex items-start justify-between gap-4 p-5 border-b border-border">
                    <div>
                        <h2 className="text-lg font-extrabold text-foreground">Cargar prospectos</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Pasá en limpio la planilla de Google Sheets, o traé una búsqueda del Scraper.
                        </p>
                    </div>
                    <button onClick={onCerrar} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-5 pt-4 space-y-3">
                    <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-muted-foreground uppercase">Sistema de prospección</label>
                        <div className="flex gap-2">
                            {(Object.keys(SISTEMA_LABELS) as Sistema[]).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setSistema(s)}
                                    className={cn(
                                        "flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold border transition-all",
                                        sistema === s ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {SISTEMA_LABELS[s]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <BotonFuente activo={fuente === "sheets"} onClick={() => setFuente("sheets")} icon={Table2} label="Pegar desde Google Sheets" />
                        <BotonFuente activo={fuente === "scraper"} onClick={() => setFuente("scraper")} icon={Compass} label={`Desde el Scraper (${busquedasScraper.length})`} />
                    </div>
                </div>

                <div className="p-5 space-y-4">
                    {fuente === "sheets" && (
                        <>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="block text-[11px] font-bold text-muted-foreground uppercase">Rubro por defecto</label>
                                    <input
                                        value={rubroPorDefecto}
                                        onChange={(e) => setRubroPorDefecto(e.target.value)}
                                        placeholder="Se usa si la planilla no trae columna de rubro"
                                        className={inputCls}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[11px] font-bold text-muted-foreground uppercase">Ciudad por defecto</label>
                                    <input
                                        value={ciudadPorDefecto}
                                        onChange={(e) => setCiudadPorDefecto(e.target.value)}
                                        placeholder="San Miguel de Tucumán"
                                        className={inputCls}
                                    />
                                </div>
                            </div>

                            <textarea
                                value={texto}
                                onChange={(e) => setTexto(e.target.value)}
                                rows={7}
                                placeholder={"Copiá el rango de Google Sheets (con la fila de encabezados) y pegalo acá.\nTambién acepta CSV separado por coma o punto y coma."}
                                className={cn(inputCls, "font-mono text-xs resize-y")}
                            />

                            {parseado && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <p className="text-xs text-muted-foreground">
                                            <span className="font-bold text-foreground">{parseado.filas.length}</span> filas ·{" "}
                                            <span className="font-bold text-foreground">{parseado.headers.length}</span> columnas detectadas
                                        </p>
                                        {faltaNegocio && (
                                            <p className="text-xs text-amber-300 flex items-center gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                Asigná una columna a &quot;Negocio&quot; para poder importar
                                            </p>
                                        )}
                                    </div>

                                    {/* Mapeo de columnas */}
                                    <div className="rounded-xl border border-border overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-secondary/50">
                                                <tr>
                                                    {parseado.headers.map((h, i) => (
                                                        <th key={i} className="px-2 py-2 text-left font-bold text-muted-foreground whitespace-nowrap border-r border-border last:border-r-0">
                                                            <div className="space-y-1.5">
                                                                <div className="truncate max-w-[160px]" title={h}>{h || `Columna ${i + 1}`}</div>
                                                                <select
                                                                    value={mapeo[i] ?? ""}
                                                                    onChange={(e) => {
                                                                        const next = [...mapeo];
                                                                        next[i] = e.target.value as CampoImportable | "";
                                                                        setMapeo(next);
                                                                    }}
                                                                    className="w-full px-1.5 py-1 bg-background border border-input rounded text-[11px] font-semibold text-foreground"
                                                                >
                                                                    <option value="">— Ignorar —</option>
                                                                    {CAMPOS_IMPORTABLES.map((c) => (
                                                                        <option key={c.key} value={c.key}>{c.label}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {parseado.filas.slice(0, 4).map((fila, i) => (
                                                    <tr key={i} className="border-t border-border">
                                                        {parseado.headers.map((_, j) => (
                                                            <td key={j} className="px-2 py-1.5 text-muted-foreground border-r border-border last:border-r-0">
                                                                <div className="truncate max-w-[160px]" title={fila[j]}>{fila[j] || "—"}</div>
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-xs text-muted-foreground">
                                            Se importarán <span className="font-bold text-primary">{filasAImportar.length}</span> prospectos.
                                            Los repetidos por negocio + ciudad se saltean.
                                        </p>
                                        <button
                                            onClick={importar}
                                            disabled={importando || faltaNegocio || filasAImportar.length === 0}
                                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-lg disabled:opacity-40"
                                        >
                                            {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                                            Importar a la planilla
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {fuente === "scraper" && (
                        <div className="space-y-2">
                            {busquedasScraper.length === 0 && (
                                <p className="text-xs text-muted-foreground py-8 text-center">
                                    No hay búsquedas guardadas en el Scraper todavía.
                                </p>
                            )}
                            {busquedasScraper.map((b) => (
                                <div key={b.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-background/40">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-foreground truncate">
                                            {b.tituloPersonalizado || `${b.rubro} en ${b.lugar}`}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">
                                            {b.totalResultados} negocios · {b.sinWebCount} sin web · {b.conWhatsappCount} con WhatsApp
                                        </p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            setImportando(true);
                                            try { await onImportarScraper(b, sistema); } finally { setImportando(false); }
                                        }}
                                        disabled={importando}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary text-xs font-bold shrink-0 disabled:opacity-40"
                                    >
                                        {importando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                                        Traer
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Construcción de un prospecto desde una fila de la planilla ───

function construirProspecto(
    fila: string[],
    mapeo: (CampoImportable | "")[],
    rubroDefecto: string,
    ciudadDefecto: string,
    sistema: Sistema
): Partial<Prospecto> {
    const valores: Partial<Record<CampoImportable, string>> = {};
    mapeo.forEach((campo, i) => {
        if (campo && fila[i]) valores[campo] = fila[i].trim();
    });

    const telefono = valores.telefono || "";
    const web = valores.sitio_web_url || "";
    const instagram = valores.instagram_url || (web.includes("instagram.com") ? web : "");
    /** Rating: "4,5" y "4.5" son el mismo número. Acá el separador SÍ es decimal. */
    const decimal = (v?: string) => {
        if (!v) return null;
        const n = Number(v.replace(",", ".").replace(/[^\d.-]/g, ""));
        return Number.isFinite(n) ? n : null;
    };

    /**
     * Cantidades: son enteros, y el punto o la coma que traen es separador de
     * MILES, no decimal.
     *
     * Con el parser de decimales, "1.234 reseñas" se guardaba como 1,234 — un
     * local con mil doscientas reseñas quedaba con "menos de 5" y lo echaba de
     * la cola por volumen bajo, mostrando el cartel "1.234 reseñas" que se lee
     * exactamente al revés de como lo estaba entendiendo el código. Se quitan
     * todos los separadores y se parsea entero.
     */
    const entero = (v?: string) => {
        if (!v) return null;
        const digitos = v.replace(/[^\d]/g, "");
        if (!digitos) return null;
        const n = Number(digitos);
        return Number.isFinite(n) ? n : null;
    };

    return {
        sistema,
        negocio: valores.negocio || "",
        rubro: valores.rubro || rubroDefecto,
        especialidad: valores.especialidad || "",
        ciudad: valores.ciudad || ciudadDefecto,
        direccion: valores.direccion || "",
        telefono,
        telefono_wa: telefonoAWhatsapp(telefono),
        whatsapp_publicado: !!telefonoAWhatsapp(telefono),
        instagram_url: instagram,
        sitio_web_url: web.includes("instagram.com") || web.includes("facebook.com") ? "" : web,
        maps_url: valores.maps_url || "",
        clasificacion_web: clasificarWebDesdeUrl(web),
        canal: telefonoAWhatsapp(telefono) ? "whatsapp" : "instagram",
        rating: decimal(valores.rating),
        reviews_count: entero(valores.reviews_count),
        notas: valores.notas || "",
        escaneo: { ...ESCANEO_VACIO },
        origen: "sheets",
    };
}

const inputCls =
    "w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/40";

function BotonFuente({
    activo, onClick, icon: Icon, label,
}: { activo: boolean; onClick: () => void; icon: typeof Table2; label: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all",
                activo ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"
            )}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );
}
