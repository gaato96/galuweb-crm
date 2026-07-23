"use client";

import { useState, useEffect } from "react";
import { 
    Search, Compass, MapPin, Globe, Phone, MessageSquare, Copy, 
    Sparkles, Check, Download, History, AlertTriangle, 
    Star, ExternalLink, UserPlus, RefreshCw, ChevronRight,
    Building2, Flame, CheckCircle2, Instagram, Facebook, Linkedin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ProspectoScraped, ScraperBusqueda } from "@/lib/types";
import { scraperStore } from "@/lib/store";

// Categorías / Rubros sugeridos para prospección en frío
const RUBROS_SUGERIDOS = [
    { label: "Gimnasios", query: "Gimnasios" },
    { label: "Inmobiliarias", query: "Inmobiliarias" },
    { label: "Odontólogos", query: "Dentistas" },
    { label: "Peluquerías & Barbers", query: "Peluquerías" },
    { label: "Restaurantes & Bares", query: "Restaurantes" },
    { label: "Talleres Mecánicos", query: "Talleres mecánicos" },
    { label: "Centros de Estética", query: "Centros de estética" },
    { label: "Estudios Contables", query: "Estudios contables" },
];

// Plantillas de WhatsApp predeterminadas
const WHATSAPP_TEMPLATES = [
    {
        id: "default",
        titulo: "Consulta Inicial (Recomendado)",
        texto: "Hola! Como estan? Les queria hacer una consulta"
    },
    {
        id: "web_pitch",
        titulo: "Propuesta de Sitio Web",
        texto: "Hola! Estaba buscando servicios de {rubro} en {lugar} y vi su negocio en Google Maps. Me di cuenta de que no tienen sitio web oficial y me gustaría ofrecerles un diseño profesional para aumentar sus clientes. ¿Les interesaría ver una propuesta breve?"
    },
    {
        id: "marketing",
        titulo: "Posicionamiento & Redes",
        texto: "Hola! Qué tal? Vi su negocio {nombre} en Google Maps. Me dedico a ayudar a negocios de {rubro} a conseguir más clientes por WhatsApp y redes. ¿Tienen 2 minutos para charlar?"
    }
];

export default function ScraperPage() {
    // Formulario de Búsqueda
    const [rubro, setRubro] = useState("");
    const [lugar, setLugar] = useState("");
    const [limite, setLimite] = useState(200);
    const [loading, setLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState("");

    // Resultados & Historial
    const [currentSearch, setCurrentSearch] = useState<ScraperBusqueda | null>(null);
    const [prospectos, setProspectos] = useState<ProspectoScraped[]>([]);
    const [historial, setHistorial] = useState<ScraperBusqueda[]>([]);
    const [showHistorial, setShowHistorial] = useState(false);

    // Filtros de UI sobre resultados
    const [searchFilter, setSearchFilter] = useState("");
    const [tabFiltro, setTabFiltro] = useState<"todos" | "sin_web" | "con_whatsapp" | "top_rated" | "guardados">("todos");
    const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

    // Modal de WhatsApp
    const [selectedProspectoWa, setSelectedProspectoWa] = useState<ProspectoScraped | null>(null);
    const [customWaMsg, setCustomWaMsg] = useState("Hola! Como estan? Les queria hacer una consulta");
    const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

    // Carga de historial guardado al montar
    useEffect(() => {
        const cargarHistorial = async () => {
            const data = await scraperStore.getAllSearches();
            setHistorial(data);
            if (data.length > 0) {
                setCurrentSearch(prev => prev || data[0]);
                setProspectos(prev => prev.length > 0 ? prev : (data[0].prospectos || []));
            }
        };
        cargarHistorial();
    }, []);

    // Función principal para llamar al API Scraper
    const handleBuscar = async (e?: React.FormEvent, rubroOverride?: string) => {
        if (e) e.preventDefault();
        
        const targetRubro = rubroOverride || rubro;
        if (!targetRubro.trim() || !lugar.trim()) {
            toast.error("Por favor ingresa un rubro y un lugar para la búsqueda");
            return;
        }

        setLoading(true);
        setLoadingStep("Conectando con Google Maps...");

        try {
            setTimeout(() => setLoadingStep("Extrayendo números de teléfono y sitios web..."), 1200);
            setTimeout(() => setLoadingStep("Analizando presencia en redes sociales..."), 2400);

            const res = await fetch("/api/scraper", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rubro: targetRubro, lugar: lugar.trim(), limite: Number(limite) }),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.error || "Error al realizar el scraping");
            }

            const nuevaBusqueda: ScraperBusqueda = json.data;
            setCurrentSearch(nuevaBusqueda);
            setProspectos(nuevaBusqueda.prospectos);

            // Guardar en persistencia
            await scraperStore.saveSearch(nuevaBusqueda);
            const nuevoHistorial = await scraperStore.getAllSearches();
            setHistorial(nuevoHistorial);

            toast.success(`¡Scraping completado! Se encontraron ${nuevaBusqueda.totalResultados} negocios`);
        } catch (error: any) {
            console.error("Error scraping:", error);
            toast.error(error.message || "Ocurrió un error al buscar en Google Maps");
        } finally {
            setLoading(false);
            setLoadingStep("");
        }
    };

    // Copiar número al portapapeles
    const handleCopyPhone = (prospecto: ProspectoScraped) => {
        if (!prospecto.telefono) {
            toast.error("Este negocio no registra número de teléfono");
            return;
        }
        navigator.clipboard.writeText(prospecto.telefono);
        setCopiedPhoneId(prospecto.id);
        toast.success(`Número de ${prospecto.nombre} copiado al portapapeles`);
        setTimeout(() => setCopiedPhoneId(null), 2500);
    };

    // Abrir WhatsApp Web / App directo
    const handleOpenWhatsappDirect = (prospecto: ProspectoScraped, mensajeCustom?: string) => {
        if (!prospecto.telefonoClean) {
            toast.error("No se pudo detectar un número válido para WhatsApp");
            return;
        }
        const text = mensajeCustom || "Hola! Como estan? Les queria hacer una consulta";
        const encodedText = encodeURIComponent(text);
        const url = `https://wa.me/${prospecto.telefonoClean}?text=${encodedText}`;
        window.open(url, "_blank");
    };

    // Guardar prospecto en el CRM como Cliente
    const handleGuardarEnCrm = async (prospecto: ProspectoScraped) => {
        try {
            await scraperStore.convertirACliente(prospecto);
            
            // Actualizar estado local
            setProspectos(prev =>
                prev.map(p => p.id === prospecto.id ? { ...p, guardadoEnCrm: true } : p)
            );

            if (currentSearch) {
                const updatedProspects = currentSearch.prospectos.map(p =>
                    p.id === prospecto.id ? { ...p, guardadoEnCrm: true } : p
                );
                const updatedBusqueda = { ...currentSearch, prospectos: updatedProspects };
                setCurrentSearch(updatedBusqueda);
                await scraperStore.saveSearch(updatedBusqueda);
            }

            toast.success(`¡${prospecto.nombre} fue guardado como cliente en el CRM!`);
        } catch (error) {
            console.error("Error al guardar cliente:", error);
            toast.error("Error al guardar en el CRM");
        }
    };

    // Exportar lista a CSV
    const handleExportCsv = () => {
        if (prospectos.length === 0) return;
        const headers = ["Nombre", "Rubro", "Lugar", "Telefono", "Tiene Sitio Web", "Sitio Web URL", "Rating", "Instagram", "Facebook", "Direccion"];
        const rows = prospectos.map(p => [
            `"${p.nombre.replace(/"/g, '""')}"`,
            `"${p.rubro}"`,
            `"${p.lugar}"`,
            `"${p.telefono || ''}"`,
            p.tieneSitioWeb ? "Si" : "No",
            `"${p.sitioWebUrl || ''}"`,
            p.rating || "",
            `"${p.redesSociales.instagram || ''}"`,
            `"${p.redesSociales.facebook || ''}"`,
            `"${p.direccion.replace(/"/g, '""')}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `prospectos_${currentSearch?.rubro || 'maps'}_${currentSearch?.lugar || 'leads'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Listado exportado a CSV exitosamente");
    };

    // Aplicar filtros a la lista actual
    const prospectosFiltrados = prospectos.filter(p => {
        const matchesSearch = p.nombre.toLowerCase().includes(searchFilter.toLowerCase()) ||
                              p.direccion.toLowerCase().includes(searchFilter.toLowerCase()) ||
                              (p.telefono && p.telefono.includes(searchFilter));

        if (!matchesSearch) return false;

        if (tabFiltro === "sin_web") return !p.tieneSitioWeb;
        if (tabFiltro === "con_whatsapp") return !!p.telefonoClean;
        if (tabFiltro === "top_rated") return (p.rating || 0) >= 4.5;
        if (tabFiltro === "guardados") return !!p.guardadoEnCrm;
        return true;
    });

    const totalSinWeb = prospectos.filter(p => !p.tieneSitioWeb).length;
    const totalConWa = prospectos.filter(p => !!p.telefonoClean).length;
    const totalGuardados = prospectos.filter(p => !!p.guardadoEnCrm).length;

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
            {/* Header del Módulo */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900/90 via-slate-900/40 to-slate-900/90 border border-primary/20 p-6 rounded-2xl shadow-xl backdrop-blur-md relative overflow-hidden">
                <div className="absolute -right-12 -top-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                <div className="space-y-1 z-10">
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/20 text-primary border border-primary/30 tracking-wide uppercase">
                            Prospección en Frío
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            Google Maps Live
                        </span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
                        <Compass className="w-7 h-7 text-primary animate-pulse-soft" />
                        Scraper de Prospectos & WhatsApp
                    </h1>
                    <p className="text-sm text-muted-foreground max-w-2xl">
                        Busca negocios en Google Maps por rubro y ciudad. Obtén números telefónicos directos, presencia web y redes sociales para iniciar conversaciones en frío por WhatsApp en 1-clic.
                    </p>
                </div>

                <div className="flex items-center gap-2 z-10 shrink-0">
                    <button
                        onClick={() => setShowHistorial(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-secondary/80 hover:bg-secondary text-sm font-medium transition-all text-foreground hover:shadow-md"
                    >
                        <History className="w-4 h-4 text-primary" />
                        Historial ({historial.length})
                    </button>
                    {prospectos.length > 0 && (
                        <button
                            onClick={handleExportCsv}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-sm font-medium transition-all"
                        >
                            <Download className="w-4 h-4" />
                            Exportar CSV
                        </button>
                    )}
                </div>
            </div>

            {/* Panel de Búsqueda */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-lg space-y-4">
                <form onSubmit={handleBuscar} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-4 relative">
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block px-1">
                            Rubro o Categoría del Negocio
                        </label>
                        <div className="relative">
                            <Building2 className="w-4 h-4 absolute left-3.5 top-3 text-muted-foreground" />
                            <input
                                type="text"
                                value={rubro}
                                onChange={(e) => setRubro(e.target.value)}
                                placeholder="Ej: Comida, Gimnasios, Dentistas..."
                                className="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/60"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-4 relative">
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block px-1">
                            Ubicación / Lugar
                        </label>
                        <div className="relative">
                            <MapPin className="w-4 h-4 absolute left-3.5 top-3 text-muted-foreground" />
                            <input
                                type="text"
                                value={lugar}
                                onChange={(e) => setLugar(e.target.value)}
                                placeholder="Ej: San Miguel de Tucumán, Córdoba..."
                                className="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/60"
                            />
                        </div>
                    </div>

                    <div className="md:col-span-2 relative">
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block px-1">
                            Límite de Búsqueda
                        </label>
                        <select
                            value={limite}
                            onChange={(e) => setLimite(Number(e.target.value))}
                            className="w-full px-3 py-2.5 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                        >
                            <option value={200}>Todos los posibles (Sin Límite)</option>
                            <option value={100}>Hasta 100 resultados</option>
                            <option value={50}>Hasta 50 resultados</option>
                        </select>
                    </div>

                    <div className="md:col-span-2 pt-5">
                        <button
                            type="submit"
                            disabled={loading}
                            className={cn(
                                "w-full py-2.5 px-4 rounded-xl text-sm font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2",
                                loading
                                    ? "bg-primary/50 cursor-not-allowed"
                                    : "bg-primary hover:bg-primary/90 shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                            )}
                        >
                            {loading ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Scrapeando...
                                </>
                            ) : (
                                <>
                                    <Search className="w-4 h-4" />
                                    Buscar Negocios
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {/* Chips de rubros recomendados */}
                <div className="pt-2 flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-muted-foreground font-semibold flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Búsquedas Rápidas:
                    </span>
                    {RUBROS_SUGERIDOS.map((item, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => {
                                setRubro(item.query);
                                if (lugar) handleBuscar(undefined, item.query);
                                else toast.info(`Rubro '${item.label}' seleccionado. Ingresa un lugar y haz clic en Buscar.`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-secondary/60 hover:bg-secondary border border-border text-foreground transition-all duration-150 hover:border-primary/40"
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {/* Feedback de estado de carga */}
                {loading && (
                    <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 flex items-center gap-3 animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                            <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-primary">{loadingStep}</p>
                            <p className="text-xs text-muted-foreground">Scrapeando datos públicos de Google Maps para {rubro} en {lugar}...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Resultados */}
            {currentSearch && (
                <div className="space-y-6">
                    {/* Tarjetas KPI de resumen */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-card border border-border p-4 rounded-xl shadow-sm space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Total Negocios</p>
                            <p className="text-2xl font-black text-foreground">{prospectos.length}</p>
                            <p className="text-[11px] text-muted-foreground">Encontrados en Maps</p>
                        </div>

                        <div className="bg-gradient-to-br from-amber-500/10 via-card to-card border border-amber-500/30 p-4 rounded-xl shadow-sm space-y-1 relative overflow-hidden">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1">
                                    <Flame className="w-3.5 h-3.5 fill-amber-400" /> Sin Sitio Web
                                </p>
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                                    ¡Oportunidad!
                                </span>
                            </div>
                            <p className="text-2xl font-black text-amber-400">{totalSinWeb}</p>
                            <p className="text-[11px] text-muted-foreground">Potenciales ventas de Web</p>
                        </div>

                        <div className="bg-card border border-border p-4 rounded-xl shadow-sm space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Con WhatsApp Directo</p>
                            <p className="text-2xl font-black text-emerald-400">{totalConWa}</p>
                            <p className="text-[11px] text-muted-foreground">Listos para contacto en frío</p>
                        </div>

                        <div className="bg-card border border-border p-4 rounded-xl shadow-sm space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Guardados en CRM</p>
                            <p className="text-2xl font-black text-primary">{totalGuardados}</p>
                            <p className="text-[11px] text-muted-foreground">Convertidos a Clientes</p>
                        </div>
                    </div>

                    {/* Barra de Filtros & Búsqueda */}
                    <div className="bg-card border border-border rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
                        {/* Tabs de filtro */}
                        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
                            <button
                                onClick={() => setTabFiltro("todos")}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                                    tabFiltro === "todos"
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground hover:bg-secondary"
                                )}
                            >
                                Todos ({prospectos.length})
                            </button>
                            <button
                                onClick={() => setTabFiltro("sin_web")}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1",
                                    tabFiltro === "sin_web"
                                        ? "bg-amber-500 text-black font-bold shadow-sm"
                                        : "text-amber-400 hover:bg-amber-500/10"
                                )}
                            >
                                🔥 Sin Web ({totalSinWeb})
                            </button>
                            <button
                                onClick={() => setTabFiltro("con_whatsapp")}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                                    tabFiltro === "con_whatsapp"
                                        ? "bg-emerald-600 text-white shadow-sm"
                                        : "text-emerald-400 hover:bg-emerald-500/10"
                                )}
                            >
                                📱 Con WhatsApp ({totalConWa})
                            </button>
                            <button
                                onClick={() => setTabFiltro("guardados")}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                                    tabFiltro === "guardados"
                                        ? "bg-primary/20 text-primary border border-primary/40"
                                        : "text-muted-foreground hover:bg-secondary"
                                )}
                            >
                                Guardados en CRM ({totalGuardados})
                            </button>
                        </div>

                        {/* Buscador secundario y selector de vista */}
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1 md:w-64">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={searchFilter}
                                    onChange={(e) => setSearchFilter(e.target.value)}
                                    placeholder="Filtrar por nombre o cel..."
                                    className="w-full pl-8 pr-3 py-1.5 bg-background border border-input rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                            <div className="flex items-center bg-secondary/80 rounded-lg p-0.5 border border-border">
                                <button
                                    onClick={() => setViewMode("cards")}
                                    className={cn(
                                        "px-2 py-1 rounded text-xs font-medium transition-all",
                                        viewMode === "cards" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                                    )}
                                >
                                    Tarjetas
                                </button>
                                <button
                                    onClick={() => setViewMode("table")}
                                    className={cn(
                                        "px-2 py-1 rounded text-xs font-medium transition-all",
                                        viewMode === "table" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                                    )}
                                >
                                    Tabla
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Grilla o Tabla de Prospectos */}
                    {prospectosFiltrados.length === 0 ? (
                        <div className="bg-card border border-border rounded-2xl p-12 text-center space-y-3">
                            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto text-muted-foreground">
                                <Search className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-bold text-foreground">No se encontraron prospectos con los filtros seleccionados</h3>
                            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                                Intenta cambiar la pestaña de filtro o realizar una nueva búsqueda con otro rubro o lugar.
                            </p>
                        </div>
                    ) : viewMode === "cards" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {prospectosFiltrados.map((prospecto) => (
                                <div
                                    key={prospecto.id}
                                    className={cn(
                                        "bg-card border rounded-2xl p-5 shadow-md hover:shadow-xl transition-all duration-200 flex flex-col justify-between space-y-4 relative group",
                                        !prospecto.tieneSitioWeb
                                            ? "border-amber-500/30 hover:border-amber-500/60"
                                            : "border-border hover:border-primary/40"
                                    )}
                                >
                                    {/* Indicadores superiores */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-1 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-foreground uppercase border border-border">
                                                    {prospecto.rubro}
                                                </span>
                                                {prospecto.guardadoEnCrm && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center gap-1">
                                                        <CheckCircle2 className="w-3 h-3" /> CRM
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-base font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                                                {prospecto.nombre}
                                            </h3>
                                        </div>

                                        {/* Rating */}
                                        {prospecto.rating && (
                                            <div className="flex items-center gap-1 text-xs font-bold bg-amber-500/10 text-amber-400 px-2 py-1 rounded-lg border border-amber-500/20 shrink-0">
                                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                                <span>{prospecto.rating}</span>
                                                {prospecto.reviewsCount && (
                                                    <span className="text-[10px] text-muted-foreground font-normal">({prospecto.reviewsCount})</span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Información de Dirección y Sitio Web */}
                                    <div className="space-y-2 text-xs">
                                        <div className="flex items-start justify-between gap-1 text-muted-foreground">
                                            <p className="flex items-start gap-1.5 line-clamp-2 flex-1">
                                                <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                                                <span>{prospecto.direccion}</span>
                                            </p>
                                            <a
                                                href={prospecto.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prospecto.nombre + " " + prospecto.direccion)}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:text-sky-300 hover:underline shrink-0 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20"
                                                title="Ver ubicación exacta en Google Maps"
                                            >
                                                <span>📍 Google Maps</span>
                                                <ExternalLink className="w-2.5 h-2.5" />
                                            </a>
                                        </div>

                                        {/* Badge Sitio Web vs Oportunidad */}
                                        <div>
                                            {!prospecto.tieneSitioWeb ? (
                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30 text-xs">
                                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                                    <span>Sin Sitio Web — ¡Oportunidad de Venta!</span>
                                                </div>
                                            ) : (
                                                <a
                                                    href={prospecto.sitioWebUrl || "#"}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary text-foreground hover:text-primary font-medium text-xs border border-border truncate max-w-full"
                                                >
                                                    <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                                    <span className="truncate">{prospecto.sitioWebUrl}</span>
                                                    <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                                                </a>
                                            )}
                                        </div>

                                        {/* Redes Sociales */}
                                        {(prospecto.redesSociales.instagram || prospecto.redesSociales.facebook || prospecto.redesSociales.linkedin) && (
                                            <div className="flex items-center gap-2 pt-1">
                                                <span className="text-[11px] text-muted-foreground font-medium">Redes:</span>
                                                {prospecto.redesSociales.instagram && (
                                                    <a
                                                        href={prospecto.redesSociales.instagram}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="p-1 rounded bg-secondary hover:bg-pink-500/20 text-pink-400 transition-colors"
                                                        title="Ver Instagram"
                                                    >
                                                        <Instagram className="w-3.5 h-3.5" />
                                                    </a>
                                                )}
                                                {prospecto.redesSociales.facebook && (
                                                    <a
                                                        href={prospecto.redesSociales.facebook}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="p-1 rounded bg-secondary hover:bg-blue-500/20 text-blue-400 transition-colors"
                                                        title="Ver Facebook"
                                                    >
                                                        <Facebook className="w-3.5 h-3.5" />
                                                    </a>
                                                )}
                                                {prospecto.redesSociales.linkedin && (
                                                    <a
                                                        href={prospecto.redesSociales.linkedin}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="p-1 rounded bg-secondary hover:bg-cyan-500/20 text-cyan-400 transition-colors"
                                                        title="Ver LinkedIn"
                                                    >
                                                        <Linkedin className="w-3.5 h-3.5" />
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Bloque de Acciones: Teléfono & WhatsApp */}
                                    <div className="pt-3 border-t border-border space-y-2.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-1.5 text-foreground font-semibold">
                                                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                                                <span>{prospecto.telefono || "Sin teléfono registrado"}</span>
                                            </div>

                                            {prospecto.telefono && (
                                                <button
                                                    onClick={() => handleCopyPhone(prospecto)}
                                                    className="flex items-center gap-1 px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                                    title="Copiar número de teléfono"
                                                >
                                                    {copiedPhoneId === prospecto.id ? (
                                                        <>
                                                            <Check className="w-3 h-3 text-emerald-400" />
                                                            <span className="text-emerald-400 font-bold">¡Copiado!</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-3 h-3" />
                                                            <span>Copiar</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            {/* Botón Abrir WhatsApp Directo */}
                                            <button
                                                onClick={() => {
                                                    setSelectedProspectoWa(prospecto);
                                                    setCustomWaMsg(`Hola! Como estan? Les queria hacer una consulta`);
                                                }}
                                                disabled={!prospecto.telefonoClean}
                                                className={cn(
                                                    "py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm",
                                                    prospecto.telefonoClean
                                                        ? "bg-emerald-600 hover:bg-emerald-500 text-white hover:scale-[1.02]"
                                                        : "bg-secondary text-muted-foreground cursor-not-allowed opacity-60"
                                                )}
                                            >
                                                <MessageSquare className="w-3.5 h-3.5 fill-white" />
                                                <span>WhatsApp</span>
                                            </button>

                                            {/* Botón Guardar en CRM */}
                                            <button
                                                onClick={() => handleGuardarEnCrm(prospecto)}
                                                disabled={prospecto.guardadoEnCrm}
                                                className={cn(
                                                    "py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border",
                                                    prospecto.guardadoEnCrm
                                                        ? "bg-primary/10 border-primary/30 text-primary cursor-default"
                                                        : "bg-secondary hover:bg-secondary/80 border-border text-foreground hover:border-primary/40"
                                                )}
                                            >
                                                {prospecto.guardadoEnCrm ? (
                                                    <>
                                                        <Check className="w-3.5 h-3.5 text-primary" />
                                                        <span>Guardado</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <UserPlus className="w-3.5 h-3.5 text-primary" />
                                                        <span>+ CRM</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Vista de Tabla */
                        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-md">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-secondary/60 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                                        <tr>
                                            <th className="p-3.5">Negocio</th>
                                            <th className="p-3.5">Ubicación</th>
                                            <th className="p-3.5">Sitio Web</th>
                                            <th className="p-3.5">Teléfono</th>
                                            <th className="p-3.5">Rating</th>
                                            <th className="p-3.5 text-right">Acciones WhatsApp</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {prospectosFiltrados.map((prospecto) => (
                                            <tr key={prospecto.id} className="hover:bg-secondary/40 transition-colors">
                                                <td className="p-3.5 font-bold text-foreground">
                                                    <div>{prospecto.nombre}</div>
                                                    <span className="text-[10px] text-muted-foreground font-normal">{prospecto.rubro}</span>
                                                </td>
                                                <td className="p-3.5 text-muted-foreground max-w-[200px] truncate">
                                                    {prospecto.direccion}
                                                </td>
                                                <td className="p-3.5">
                                                    {!prospecto.tieneSitioWeb ? (
                                                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30">
                                                            Sin Web (Oportunidad)
                                                        </span>
                                                    ) : (
                                                        <a href={prospecto.sitioWebUrl || '#'} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                                                            {prospecto.sitioWebUrl}
                                                        </a>
                                                    )}
                                                </td>
                                                <td className="p-3.5 font-medium text-foreground">
                                                    {prospecto.telefono || "No especificado"}
                                                </td>
                                                <td className="p-3.5">
                                                    {prospecto.rating ? `⭐ ${prospecto.rating}` : "-"}
                                                </td>
                                                <td className="p-3.5 text-right space-x-2 whitespace-nowrap">
                                                    <a
                                                        href={prospecto.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prospecto.nombre + " " + prospecto.direccion)}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="px-2.5 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-semibold text-xs border border-sky-500/30 inline-flex items-center gap-1"
                                                        title="Ver en Google Maps"
                                                    >
                                                        <span>📍 Maps</span>
                                                    </a>
                                                    <button
                                                        onClick={() => handleCopyPhone(prospecto)}
                                                        className="p-1.5 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground inline-flex items-center"
                                                        title="Copiar Teléfono"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedProspectoWa(prospecto);
                                                            setCustomWaMsg("Hola! Como estan? Les queria hacer una consulta");
                                                        }}
                                                        disabled={!prospecto.telefonoClean}
                                                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold inline-flex items-center gap-1"
                                                    >
                                                        <MessageSquare className="w-3 h-3 fill-white" /> WhatsApp
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal / Drawer para enviar mensaje de WhatsApp personalizado */}
            {selectedProspectoWa && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                                    <MessageSquare className="w-5 h-5 fill-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-foreground">Enviar mensaje por WhatsApp</h3>
                                    <p className="text-xs text-muted-foreground">{selectedProspectoWa.nombre} ({selectedProspectoWa.telefono})</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedProspectoWa(null)}
                                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Selección de plantillas rápida */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground">Elegir plantilla de mensaje:</label>
                            <div className="grid grid-cols-1 gap-2">
                                {WHATSAPP_TEMPLATES.map((tpl) => (
                                    <button
                                        key={tpl.id}
                                        type="button"
                                        onClick={() => {
                                            let text = tpl.texto;
                                            text = text.replace("{nombre}", selectedProspectoWa.nombre);
                                            text = text.replace("{rubro}", selectedProspectoWa.rubro);
                                            text = text.replace("{lugar}", selectedProspectoWa.lugar);
                                            setCustomWaMsg(text);
                                        }}
                                        className="text-left p-2.5 rounded-xl border border-border hover:border-primary/50 bg-secondary/40 hover:bg-secondary text-xs transition-all space-y-0.5"
                                    >
                                        <p className="font-bold text-primary">{tpl.titulo}</p>
                                        <p className="text-muted-foreground line-clamp-2">&quot;{tpl.texto}&quot;</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Editor de mensaje */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground">Mensaje a enviar:</label>
                            <textarea
                                rows={4}
                                value={customWaMsg}
                                onChange={(e) => setCustomWaMsg(e.target.value)}
                                className="w-full p-3 bg-background border border-input rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setSelectedProspectoWa(null)}
                                className="px-4 py-2 rounded-xl text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    handleOpenWhatsappDirect(selectedProspectoWa, customWaMsg);
                                    setSelectedProspectoWa(null);
                                }}
                                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                            >
                                <MessageSquare className="w-4 h-4 fill-white" />
                                Abrir Chat de WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Historial de Búsquedas */}
            {showHistorial && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-card border border-border rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
                            <div className="flex items-center gap-2">
                                <History className="w-5 h-5 text-primary" />
                                <h3 className="font-bold text-foreground">Historial de Búsquedas Guardadas</h3>
                            </div>
                            <button
                                onClick={() => setShowHistorial(false)}
                                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {historial.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-8">No hay búsquedas guardadas en el historial.</p>
                            ) : (
                                historial.map((b) => (
                                    <div
                                        key={b.id}
                                        onClick={() => {
                                            setCurrentSearch(b);
                                            setProspectos(b.prospectos || []);
                                            setShowHistorial(false);
                                            toast.info(`Cargada búsqueda anterior: ${b.rubro} en ${b.lugar}`);
                                        }}
                                        className="p-3 rounded-xl border border-border hover:border-primary/40 bg-secondary/30 hover:bg-secondary cursor-pointer transition-all flex items-center justify-between group"
                                    >
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-foreground group-hover:text-primary">
                                                    {b.rubro} en {b.lugar}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                {new Date(b.created_at).toLocaleDateString()} • {b.totalResultados} negocios ({b.sinWebCount} sin web)
                                            </p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-1" />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
