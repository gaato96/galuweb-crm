import { formatCurrency, formatDate } from "@/lib/utils";
import type { Cotizacion, Cliente } from "@/lib/types";
import Logo from "@/components/layout/logo";

export default function CotizacionPlantilla({
    cotizacion,
    cliente,
}: {
    cotizacion: Cotizacion;
    cliente: Cliente;
}) {
    if (!cotizacion || !cliente) return null;

    return (
        <div className="bg-white text-zinc-900 w-full max-w-[210mm] min-h-[297mm] mx-auto p-[12mm] shadow-2xl print:shadow-none print:p-0">
            {/* Header */}
            <header className="flex items-start justify-between border-b-2 border-zinc-100 pb-8 mb-8">
                <div>
                    <div className="invert grayscale brightness-0 sepia-0 w-40 mb-4">
                        {/* We use the Logo component but force it black for printing */}
                        <Logo collapsed={false} />
                    </div>
                    <div className="text-sm text-zinc-500 space-y-1">
                        <p>Agencia Creativa & Software Server</p>
                        <p>hello@galu.agency</p>
                    </div>
                </div>
                <div className="text-right">
                    <h1 className="text-4xl font-light text-zinc-300 uppercase tracking-widest mb-4">Cotización</h1>
                    <div className="text-sm">
                        <p className="text-zinc-500 mb-1">Cotización N° <span className="text-zinc-900 font-medium">#{cotizacion.id.split("-")[0].toUpperCase()}</span></p>
                        <p className="text-zinc-500">Fecha: <span className="text-zinc-900 font-medium">{formatDate(cotizacion.created_at)}</span></p>
                    </div>
                </div>
            </header>

            {/* Client Info */}
            <div className="flex gap-12 mb-12">
                <div className="flex-1">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Preparado para</h3>
                    <p className="text-lg font-bold text-zinc-900">{cliente.nombre}</p>
                    <p className="text-sm text-zinc-600">{cliente.negocio}</p>
                    <p className="text-sm text-zinc-500 mt-1">{cliente.email}</p>
                </div>
                <div className="flex-1">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Detalles del Proyecto</h3>
                    <p className="text-sm text-zinc-600">Servicios de Diseño y Desarrollo enfocados en el crecimiento y escalabilidad de la marca.</p>
                </div>
            </div>

            {/* Items Table */}
            <div className="mb-12">
                <div className="grid grid-cols-[1fr_120px] gap-4 mb-2 border-b border-zinc-200 pb-2 px-2">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Descripción del Servicio</span>
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider text-right">Monto</span>
                </div>
                
                <div className="space-y-1">
                    {cotizacion.items.map((item, i) => (
                        <div key={i} className="grid grid-cols-[1fr_120px] gap-4 py-3 px-2 rounded-lg bg-zinc-50/50">
                            <span className="text-sm text-zinc-700">{item.descripcion}</span>
                            <span className="text-sm font-medium text-zinc-900 text-right">{formatCurrency(item.precio)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Totals Section */}
            <div className="flex justify-end mb-12">
                <div className="w-1/2 rounded-xl bg-zinc-50 p-6">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-sm text-zinc-500">Subtotal</span>
                        <span className="text-sm font-medium text-zinc-900">{formatCurrency(cotizacion.total)}</span>
                    </div>
                    <div className="flex justify-between items-center py-4 border-t border-zinc-200">
                        <span className="text-base font-bold text-zinc-900">Total a Pagar</span>
                        <span className="text-2xl font-black text-zinc-900 tracking-tight">{formatCurrency(cotizacion.total)}</span>
                    </div>
                </div>
            </div>

            {/* Notes */}
            {cotizacion.notas && (
                <div className="mb-12">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Notas y Condiciones</h3>
                    <div className="p-4 rounded-xl border border-zinc-100 bg-white text-sm text-zinc-600 leading-relaxed">
                        {cotizacion.notas}
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer className="mt-auto pt-8 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-400">
                <p>Las cotizaciones tienen una validez de 15 días tras su emisión.</p>
                <p className="font-bold">GALU.AGENCY</p>
            </footer>
        </div>
    );
}
