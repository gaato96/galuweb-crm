import type {
    ArchivoProyecto, Cliente, Finanza, LogProyecto, Proyecto, SolicitudProyecto, Tarea,
} from "@/lib/types";

export type PageTab = "resumen" | "fases" | "finanzas" | "brief" | "archivos" | "documentos" | "novedades" | "accesos";

export type Recargable = "proyecto" | "tareas" | "finanzas" | "archivos" | "solicitudes" | "logs";

export interface ProyectoCtx {
    proyecto: Proyecto;
    cliente: Cliente | null;
    tareas: Tarea[];
    logs: LogProyecto[];
    finanzas: Finanza[];
    archivos: ArchivoProyecto[];
    solicitudes: SolicitudProyecto[];
    setTareas: (t: Tarea[]) => void;
    /** Guarda campos del proyecto y actualiza el estado local. Devuelve false si falló. */
    guardarProyecto: (data: Partial<Proyecto>, mensaje?: string) => Promise<boolean>;
    recargar: (...que: Recargable[]) => Promise<void>;
    irA: (tab: PageTab) => void;
    portalUrl: string;
}

export const ui = {
    card: "rounded-2xl border border-border bg-card p-4 sm:p-5",
    input: "w-full h-9 px-3 rounded-xl bg-background border border-border text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40",
    textarea: "w-full p-3 rounded-xl bg-background border border-border text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/40 resize-y",
    label: "text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block",
    btn: "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:pointer-events-none",
    btnPrimary: "bg-primary text-primary-foreground hover:opacity-90 shadow-md shadow-primary/20",
    btnSecondary: "bg-secondary border border-border text-foreground hover:border-primary/40",
    btnGhost: "text-muted-foreground hover:text-foreground hover:bg-secondary",
    h3: "text-sm font-bold text-foreground flex items-center gap-2",
};
