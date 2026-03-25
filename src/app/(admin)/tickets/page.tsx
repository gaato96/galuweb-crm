"use client";

import { useEffect, useState } from "react";
import { Search, LifeBuoy, GripVertical, Calendar, MessagesSquare, CheckCircle2 } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { ticketsStore } from "@/lib/store";
import type { TicketSoporte, EstadoTicket, Prioridad } from "@/lib/types";
import { toast } from "sonner";
import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    useDraggable,
    useDroppable,
} from "@dnd-kit/core";

const ESTADO_LABELS: Record<EstadoTicket, string> = {
    abierto: "Abiertos",
    en_progreso: "En Progreso",
    resuelto: "Resueltos",
};

const ESTADO_ICONS = {
    abierto: <LifeBuoy className="w-4 h-4 text-emerald-500" />,
    en_progreso: <Calendar className="w-4 h-4 text-amber-500" />,
    resuelto: <CheckCircle2 className="w-4 h-4 text-blue-500" />,
};

const PRIORIDAD_COLORS: Record<Prioridad, string> = {
    baja: "bg-sky-500/10 text-sky-500 border-sky-500/20",
    media: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    alta: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

// --- Kanban Components ---
function DraggableTicketCard({ ticket, onClick }: { ticket: TicketSoporte; onClick: () => void }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: ticket.id,
        data: { ticket },
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 100 : 1,
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "w-full text-left p-3.5 rounded-xl bg-secondary/50 border border-border hover:border-primary/30 transition-all group relative flex flex-col gap-3",
                isDragging && "opacity-50 border-primary shadow-2xl"
            )}
            onClick={(e) => {
                // Prevent onClick if the drag handle was clicked
                if ((e.target as HTMLElement).closest('.drag-handle')) return;
                onClick();
            }}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 max-w-[85%]">
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0", PRIORIDAD_COLORS[ticket.prioridad])}>
                        {ticket.prioridad}
                    </span>
                    <h4 className="text-sm font-semibold text-foreground truncate">{ticket.asunto}</h4>
                </div>
                <div
                    {...listeners}
                    {...attributes}
                    className="drag-handle cursor-grab active:cursor-grabbing p-1 -mr-1 -mt-1 text-muted-foreground hover:text-foreground touch-none shrink-0"
                >
                    <GripVertical className="w-4 h-4" />
                </div>
            </div>
            
            <p className="text-xs text-muted-foreground line-clamp-2">
                {ticket.descripcion || "Sin descripción"}
            </p>

            <div className="flex items-center justify-between mt-1 pt-3 border-t border-border/50">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/40 to-cyan-500/40 flex items-center justify-center text-[9px] font-bold text-foreground">
                        {getInitials(ticket.cliente?.nombre || "")}
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground">{ticket.cliente?.nombre}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                    {new Date(ticket.created_at).toLocaleDateString("es-AR")}
                </span>
            </div>
        </div>
    );
}

function DroppableColumn({ estado, children, count }: { estado: EstadoTicket; children: React.ReactNode; count: number }) {
    const { setNodeRef, isOver } = useDroppable({
        id: estado,
    });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex flex-col rounded-2xl border border-border bg-card/30 p-4 min-h-[500px] transition-colors",
                isOver && "border-primary/50 bg-primary/5 shadow-inner shadow-primary/5"
            )}
        >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                    {ESTADO_ICONS[estado]}
                    <h3 className="text-sm font-bold text-foreground">{ESTADO_LABELS[estado]}</h3>
                </div>
                <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-secondary text-[11px] font-bold text-muted-foreground">
                    {count}
                </span>
            </div>
            <div className="space-y-3 flex-1">
                {children}
            </div>
        </div>
    );
}

// --- Detail Modal ---
function TicketDetailModal({ 
    open, 
    ticket, 
    onClose 
}: { 
    open: boolean; 
    ticket: TicketSoporte | null; 
    onClose: () => void;
}) {
    if (!open || !ticket) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl animate-fade-in">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border", PRIORIDAD_COLORS[ticket.prioridad])}>
                                {ticket.prioridad}
                            </span>
                            <span className="text-[11px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                                {new Date(ticket.created_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                            </span>
                        </div>
                        <h3 className="text-lg font-bold text-foreground">{ticket.asunto}</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                        X
                    </button>
                </div>
                
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                            <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">Cliente Solicitante</p>
                            <p className="text-sm font-semibold text-foreground">{ticket.cliente?.nombre}</p>
                            <p className="text-[11px] text-muted-foreground">{ticket.cliente?.email}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-secondary/50 border border-border">
                            <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">Proyecto Asignado</p>
                            <p className="text-sm font-semibold text-foreground">{ticket.proyecto?.nombre || "General"}</p>
                            <p className="text-[11px] text-muted-foreground">{ticket.proyecto?.tipo_proyecto || "N/A"}</p>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                            <MessagesSquare className="w-4 h-4 text-primary" /> Descripción / Mensaje
                        </h4>
                        <div className="p-4 rounded-xl bg-secondary border border-border/50 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                            {ticket.descripcion || "Sin descripción proporcionada."}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end mt-8">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">
                        Cerrar Detalles
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Main Page ---
export default function TicketsPage() {
    const [tickets, setTickets] = useState<TicketSoporte[]>([]);
    const [mounted, setMounted] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedTicket, setSelectedTicket] = useState<TicketSoporte | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const reload = async () => {
        try {
            const data = await ticketsStore.getAll();
            setTickets(data);
        } catch (error) {
            console.error("Error reloading tickets:", error);
            toast.error("Error al cargar tickets");
        }
    };

    useEffect(() => {
        reload().then(() => setMounted(true));
    }, []);

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const ticketId = active.id as string;
        const newEstado = over.id as EstadoTicket;
        const ticket = active.data.current?.ticket as TicketSoporte;

        if (ticket && ticket.estado !== newEstado) {
            try {
                // Optimistic UI update
                setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, estado: newEstado } : t));
                await ticketsStore.update(ticketId, { estado: newEstado });
                toast.success(`Ticket movido a: ${ESTADO_LABELS[newEstado]}`);
            } catch {
                await reload(); // Revert on failure
                toast.error("Error al mover el ticket");
            }
        }
    };

    const filtered = tickets.filter(
        (t) =>
            t.asunto.toLowerCase().includes(search.toLowerCase()) ||
            (t.cliente?.nombre.toLowerCase() || "").includes(search.toLowerCase())
    );

    if (!mounted) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-[100px] rounded-xl skeleton" />
                <div className="grid grid-cols-3 gap-6">
                    <div className="h-[400px] rounded-2xl skeleton" />
                    <div className="h-[400px] rounded-2xl skeleton" />
                    <div className="h-[400px] rounded-2xl skeleton" />
                </div>
            </div>
        );
    }

    const COLUMNS: EstadoTicket[] = ["abierto", "en_progreso", "resuelto"];

    return (
        <div className="space-y-6 animate-fade-in max-w-[1400px] mx-auto h-[calc(100vh-6rem)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Soporte y Tickets</h2>
                    <p className="text-sm text-muted-foreground">{tickets.length} solicitudes en total</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar asunto o cliente..."
                            className="w-[250px] h-10 pl-9 pr-3 rounded-lg bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                </div>
            </div>

            {/* Kanban Board */}
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden flex-1">
                    {COLUMNS.map((estado) => {
                        const columnTickets = filtered.filter((t) => t.estado === estado);
                        return (
                            <div key={estado} className="h-full overflow-y-auto custom-scrollbar pr-1">
                                <DroppableColumn estado={estado} count={columnTickets.length}>
                                    {columnTickets.map((t) => (
                                        <DraggableTicketCard
                                            key={t.id}
                                            ticket={t}
                                            onClick={() => setSelectedTicket(t)}
                                        />
                                    ))}
                                    {columnTickets.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-10 opacity-40">
                                            <div className="w-12 h-12 mb-3 rounded-full bg-secondary flex items-center justify-center">
                                                <LifeBuoy className="w-5 h-5" />
                                            </div>
                                            <p className="text-xs text-center font-medium">No hay tickets</p>
                                        </div>
                                    )}
                                </DroppableColumn>
                            </div>
                        );
                    })}
                </div>
            </DndContext>

            {/* Modal de Detalle */}
            <TicketDetailModal 
                open={!!selectedTicket} 
                ticket={selectedTicket} 
                onClose={() => setSelectedTicket(null)} 
            />
        </div>
    );
}
