// Piezas de las pantallas de prospección pensadas para el celular
// (prueba de la hora de Sarvo, contacto manual de agencias): tarjetas y
// botones grandes, de un toque, que no desbordan con nombres largos de Google.

import { cn } from "@/lib/utils";
import type { Prospecto } from "@/lib/types";

export function Tarjeta({ p, children, extra }: { p: Prospecto; children: React.ReactNode; extra?: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    {/* line-clamp y no truncate: el nombre de Google puede ser una línea
                        de SEO entera, y un texto que no corta ensancha todo el layout
                        en el celular. */}
                    <p className="text-sm font-bold text-foreground line-clamp-2 [overflow-wrap:anywhere]">{p.negocio}</p>
                    <p className="text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
                        {[p.ciudad, p.telefono_wa ? `+${p.telefono_wa}` : ""].filter(Boolean).join(" · ")}
                    </p>
                </div>
                {extra ??
                    (p.score > 0 && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-secondary text-[10px] font-bold tabular-nums text-muted-foreground">
                            {p.score}
                        </span>
                    ))}
            </div>
            {children}
        </div>
    );
}

export function Boton({
    onClick, tono, icon: Icon, children, disabled,
}: {
    onClick: () => void;
    tono: "business" | "personal" | "instagram" | "ok" | "alerta" | "neutro";
    icon?: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
    disabled?: boolean;
}) {
    const tonos = {
        business: "bg-emerald-600 text-white border-emerald-500",
        personal: "bg-primary text-primary-foreground border-primary",
        instagram: "bg-fuchsia-600 text-white border-fuchsia-500",
        ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
        alerta: "bg-amber-500/15 text-amber-300 border-amber-500/40",
        neutro: "bg-card text-muted-foreground border-border",
    };
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "w-full min-h-[44px] px-3 py-2.5 rounded-xl text-sm font-bold border flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40",
                tonos[tono]
            )}
        >
            {Icon && <Icon className="w-4 h-4" />}
            {children}
        </button>
    );
}

export function Vacio({ texto }: { texto: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 py-12 px-6 text-center">
            <p className="text-xs text-muted-foreground">{texto}</p>
        </div>
    );
}

export function Pestanias<T extends string>({
    valor, onCambio, opciones,
}: {
    valor: T;
    onCambio: (v: T) => void;
    opciones: { id: T; label: string; cant: number; icon: React.ComponentType<{ className?: string }> }[];
}) {
    return (
        <div className={cn("grid gap-1.5", opciones.length === 4 ? "grid-cols-4" : "grid-cols-3")}>
            {opciones.map(({ id, label, cant, icon: Icon }) => (
                <button
                    key={id}
                    onClick={() => onCambio(id)}
                    className={cn(
                        "flex flex-col items-center gap-0.5 px-1 py-2.5 rounded-xl text-[11px] font-bold border transition-all",
                        valor === id
                            ? "bg-primary text-primary-foreground border-primary shadow-md"
                            : "bg-card border-border text-muted-foreground"
                    )}
                >
                    <span className="flex items-center gap-1">
                        <Icon className="w-3.5 h-3.5 shrink-0" /> {label}
                    </span>
                    <span className="text-base tabular-nums">{cant}</span>
                </button>
            ))}
        </div>
    );
}
