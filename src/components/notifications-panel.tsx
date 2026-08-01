"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, X, CheckCircle2, Clock, AlertTriangle, DollarSign, CheckSquare, CheckCheck } from "lucide-react";
import { cn, formatCurrency, formatDate, daysFromNow } from "@/lib/utils";
import { finanzasStore, tareasStore } from "@/lib/store";
import type { Finanza, Tarea } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────
type NotifType = "cobro_vencido" | "cobro_proximo" | "tarea_vencida" | "cobro_hoy";

interface Notification {
    id: string;
    type: NotifType;
    title: string;
    body: string;
    date: string;
    urgency: "high" | "medium" | "low";
}

const STORAGE_KEY = "crm_notifs_read_v2";

function getReadIds(): Set<string> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
        return new Set();
    }
}

function saveReadIds(ids: Set<string>) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
    } catch { /* */ }
}

// ── Generate notifications from CRM data ──────────────────────────────────────
function generateNotifications(finanzas: Finanza[], tareas: Tarea[]): Notification[] {
    const notifs: Notification[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Pending invoices
    finanzas
        .filter((f) => f.tipo === "ingreso" && !(f.cobrado ?? true))
        .forEach((f) => {
            const days = daysFromNow(f.fecha_cobro);
            if (days < 0) {
                notifs.push({
                    id: `cobro_vencido_${f.id}`,
                    type: "cobro_vencido",
                    title: "Cobro vencido",
                    body: `${f.descripcion} — ${formatCurrency(f.monto)} (hace ${Math.abs(days)} días)`,
                    date: f.fecha_cobro,
                    urgency: "high",
                });
            } else if (days === 0) {
                notifs.push({
                    id: `cobro_hoy_${f.id}`,
                    type: "cobro_hoy",
                    title: "Cobro para hoy",
                    body: `${f.descripcion} — ${formatCurrency(f.monto)}`,
                    date: f.fecha_cobro,
                    urgency: "high",
                });
            } else if (days <= 4) {
                notifs.push({
                    id: `cobro_proximo_${f.id}`,
                    type: "cobro_proximo",
                    title: `Cobro en ${days} día${days === 1 ? "" : "s"}`,
                    body: `${f.descripcion} — ${formatCurrency(f.monto)}`,
                    date: f.fecha_cobro,
                    urgency: "medium",
                });
            }
        });

    // Overdue tasks
    tareas
        .filter((t) => t.estado !== "completada" && t.fecha_vencimiento)
        .forEach((t) => {
            const days = daysFromNow(t.fecha_vencimiento!);
            if (days < 0) {
                notifs.push({
                    id: `tarea_vencida_${t.id}`,
                    type: "tarea_vencida",
                    title: "Tarea vencida",
                    body: `${t.titulo} (hace ${Math.abs(days)} día${Math.abs(days) === 1 ? "" : "s"})`,
                    date: t.fecha_vencimiento!,
                    urgency: "medium",
                });
            }
        });

    // Sort: high urgency first, then by date
    return notifs.sort((a, b) => {
        const urgencyOrder = { high: 0, medium: 1, low: 2 };
        if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
            return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        }
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
}

// ── Icon by type ──────────────────────────────────────────────────────────────
function NotifIcon({ type }: { type: NotifType }) {
    const base = "w-4 h-4 shrink-0";
    if (type === "cobro_vencido" || type === "cobro_hoy") return <AlertTriangle className={cn(base, "text-rose-400")} />;
    if (type === "cobro_proximo") return <DollarSign className={cn(base, "text-amber-400")} />;
    if (type === "tarea_vencida") return <CheckSquare className={cn(base, "text-orange-400")} />;
    return <Clock className={cn(base, "text-blue-400")} />;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function NotificationsPanel() {
    const [open, setOpen] = useState(false);
    const [notifs, setNotifs] = useState<Notification[]>([]);
    const [readIds, setReadIds] = useState<Set<string>>(new Set());
    const [loaded, setLoaded] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // Load CRM data and generate notifications
    const loadNotifs = async () => {
        try {
            const [finanzas, tareas] = await Promise.all([
                finanzasStore.getAll(),
                tareasStore.getAll(),
            ]);
            setNotifs(generateNotifications(finanzas, tareas));
        } catch {/* ignore */}
    };

    useEffect(() => {
        setReadIds(getReadIds());
        loadNotifs().then(() => setLoaded(true));
    }, []);

    // Reload when panel opens
    useEffect(() => {
        if (open) loadNotifs();
    }, [open]);

    // Close on outside click
    useEffect(() => {
        const handle = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, [open]);

    const unreadNotifs = notifs.filter((n) => !readIds.has(n.id));
    const unreadCount = unreadNotifs.length;

    const markAsRead = (id: string) => {
        const updated = new Set(readIds).add(id);
        setReadIds(updated);
        saveReadIds(updated);
    };

    const markAllRead = () => {
        const updated = new Set(Array.from(readIds).concat(notifs.map((n) => n.id)));
        setReadIds(updated);
        saveReadIds(updated);
    };

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell Button */}
            <button
                onClick={() => setOpen((v) => !v)}
                aria-label="Notificaciones"
                className={cn(
                    "relative flex items-center justify-center w-9 h-9 rounded-xl bg-secondary/60 hover:bg-accent border border-border/50 transition-all active:scale-95",
                    open && "bg-accent border-primary/30"
                )}
            >
                <Bell className="w-4 h-4 text-muted-foreground" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-primary rounded-full text-[10px] font-black text-primary-foreground flex items-center justify-center ring-2 ring-background animate-bounce-once">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Panel */}
            {open && (
                <div className="absolute right-0 top-12 z-50 w-[340px] sm:w-[380px] max-h-[75vh] flex flex-col rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/30 animate-slide-down overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-secondary/20 shrink-0">
                        <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-primary" />
                            <h3 className="text-sm font-bold text-foreground">Notificaciones</h3>
                            {unreadCount > 0 && (
                                <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold">
                                    {unreadCount} nuevas
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllRead}
                                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground font-semibold px-2 py-1 rounded-lg hover:bg-secondary transition-colors"
                                    title="Marcar todas como leídas"
                                >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                    Todo leído
                                </button>
                            )}
                            <button
                                onClick={() => setOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {!loaded ? (
                            <div className="space-y-2 p-4">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="h-14 rounded-xl bg-secondary/40 animate-pulse" />
                                ))}
                            </div>
                        ) : notifs.length === 0 ? (
                            <div className="py-14 flex flex-col items-center text-center px-6">
                                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                                    <CheckCircle2 className="w-7 h-7 text-primary/60" />
                                </div>
                                <p className="text-sm font-bold text-foreground">Todo en orden</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    No hay cobros pendientes ni tareas vencidas.
                                </p>
                            </div>
                        ) : (
                            <div className="p-2 space-y-1">
                                {notifs.map((n) => {
                                    const isRead = readIds.has(n.id);
                                    return (
                                        <div
                                            key={n.id}
                                            className={cn(
                                                "flex items-start gap-3 p-3 rounded-xl transition-all group cursor-default",
                                                isRead
                                                    ? "opacity-50 hover:opacity-70"
                                                    : n.urgency === "high"
                                                        ? "bg-rose-500/5 border border-rose-500/20 hover:border-rose-500/40"
                                                        : n.urgency === "medium"
                                                            ? "bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/40"
                                                            : "bg-secondary/30 border border-border hover:border-primary/30"
                                            )}
                                        >
                                            <div className={cn(
                                                "mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                                                n.urgency === "high" ? "bg-rose-500/15" :
                                                    n.urgency === "medium" ? "bg-amber-500/15" : "bg-blue-500/15"
                                            )}>
                                                <NotifIcon type={n.type} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-foreground leading-snug">
                                                    {n.title}
                                                    {!isRead && (
                                                        <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-primary align-middle" />
                                                    )}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                                                    {n.body}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground/70 mt-1">
                                                    {formatDate(n.date)}
                                                </p>
                                            </div>
                                            {!isRead && (
                                                <button
                                                    onClick={() => markAsRead(n.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shrink-0"
                                                    title="Marcar como leída"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifs.length > 0 && (
                        <div className="px-4 py-2.5 border-t border-border/60 bg-secondary/10 shrink-0 text-center">
                            <p className="text-[10px] text-muted-foreground">
                                {notifs.length - unreadCount} leídas · {unreadCount} sin leer
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
