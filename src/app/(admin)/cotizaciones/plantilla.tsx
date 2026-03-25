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
        <div className="bg-white text-zinc-900 w-full max-w-[210mm] mx-auto shadow-2xl print:shadow-none print:w-[210mm]">
            {/* FIRST PAGE: COVER & INTRO */}
            <div className="min-h-[297mm] p-[15mm] flex flex-col justify-center relative break-after-page">
                {/* Accent shape */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-bl-[100px] -z-10" />
                
                <header className="mb-20">
                    <div className="invert grayscale brightness-0 sepia-0 w-48 mb-6">
                        <Logo collapsed={false} />
                    </div>
                    <div className="h-1 w-12 bg-primary rounded-full mb-6" />
                    <h1 className="text-5xl font-black text-zinc-900 tracking-tight leading-none mb-4">
                        Propuesta de <br />
                        <span className="text-primary">Estrategia Digital</span>
                    </h1>
                    <p className="text-xl text-zinc-500 font-light">
                        Diseño Web & Desarrollo Orientado a Ventas
                    </p>
                </header>

                <div className="flex gap-12 mt-auto pb-12">
                    <div className="flex-1 border-l-2 border-zinc-200 pl-6">
                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Preparado para</h3>
                        <p className="text-2xl font-bold text-zinc-900">{cliente.nombre}</p>
                        <p className="text-zinc-600">{cliente.negocio}</p>
                        <p className="text-sm text-zinc-500 mt-1">{cliente.email}</p>
                    </div>
                    <div className="flex-1 border-l-2 border-zinc-200 pl-6">
                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Detalles del Documento</h3>
                        <p className="text-sm font-medium text-zinc-900">Cotización N° {cotizacion.id.split("-")[0].toUpperCase()}</p>
                        <p className="text-sm text-zinc-600">Fecha: {formatDate(cotizacion.created_at)}</p>
                        <p className="text-sm text-zinc-500 mt-4">Válido por 15 días.</p>
                    </div>
                </div>
            </div>

            {/* SECOND PAGE: PROBLEM & SOLUTION */}
            <div className="min-h-[297mm] p-[15mm] flex flex-col break-after-page">
                <div className="mb-12">
                    <h2 className="text-3xl font-black text-zinc-900 mb-6 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm">01</span>
                        El Reto Actual
                    </h2>
                    <div className="prose prose-zinc max-w-none text-zinc-600 leading-relaxed space-y-4">
                        <p>
                            El sitio web actual de <strong>{cliente.nombre}</strong> presenta una estructura básica y desorganizada que no refleja la calidad ni la profundidad de su marca personal o comercial. La distribución ineficiente del contenido, sumada a una falta de jerarquía visual y recursos gráficos de baja calidad, genera fricción y confusión en el usuario.
                        </p>
                        <p>
                            Esta desconexión visual crea una barrera de confianza crítica. La imagen digital actual no transmite la autoridad ni el profesionalismo necesarios para justificar una inversión de alto valor ticket, diluyendo la credibilidad construida exitosamente en redes sociales o canales offline.
                        </p>
                    </div>
                </div>

                <div className="mb-12">
                    <h2 className="text-3xl font-black text-zinc-900 mb-6 flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm">02</span>
                        Nuestra Solución
                    </h2>
                    <div className="prose prose-zinc max-w-none text-zinc-600 leading-relaxed space-y-4">
                        <p>
                            Llevaremos a cabo una reingeniería total de la presencia digital, comenzando con el desarrollo de una identidad visual exclusiva para la web que aporte carácter y modernismo. El diseño, ejecutado en Figma y desarrollado en Framer o Next.js (según necesidades), priorizará una estética atractiva con animaciones estratégicas que retengan al usuario sin sacrificar velocidad.
                        </p>
                        <p>
                            La nueva arquitectura de la información transformará la experiencia de navegación. Implementaremos un funnel de ventas claro y persuasivo, donde cada sección tenga un propósito definido, eliminando el ruido y guiando al usuario intuitivamente hacia la compra visualizando el ecosistema de ventas robusto, optimizado para transmitir valor real y eliminar dudas.
                        </p>
                    </div>
                </div>
            </div>

            {/* THIRD PAGE: SCOPE OF WORK & PRICING */}
            <div className="min-h-[297mm] p-[15mm] flex flex-col break-after-page">
                <h2 className="text-3xl font-black text-zinc-900 mb-8 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm">03</span>
                    Alcance y Entregables
                </h2>
                
                <div className="grid grid-cols-2 gap-8 mb-12">
                    <div className="bg-zinc-50 p-6 rounded-xl border border-zinc-100">
                        <h4 className="font-bold text-zinc-900 mb-3 border-b border-zinc-200 pb-2">1. Estrategia & Diseño UX/UI</h4>
                        <ul className="text-sm text-zinc-600 space-y-2 list-disc pl-4">
                            <li><strong>Auditoría de marca:</strong> Perfecciona el mensaje y posicionamiento web.</li>
                            <li><strong>Arquitectura:</strong> Mapa de sitio y flujos de navegación lógicos.</li>
                            <li><strong>Wireframes & UI:</strong> Maquetas de alta fidelidad Figma priorizando un diseño visual orgánico.</li>
                            <li><strong>VSL & Landing Pages:</strong> Páginas de alta conversión centradas focalmente en la venta.</li>
                        </ul>
                    </div>
                    <div className="bg-zinc-50 p-6 rounded-xl border border-zinc-100">
                        <h4 className="font-bold text-zinc-900 mb-3 border-b border-zinc-200 pb-2">2. Desarrollo Web & Integración</h4>
                        <ul className="text-sm text-zinc-600 space-y-2 list-disc pl-4">
                            <li><strong>Desarrollo Custom:</strong> Código altamente responsivo y rápido.</li>
                            <li><strong>CMS Dinámico:</strong> Sistema administrable para textos, testimonios, o imágenes.</li>
                            <li><strong>Integraciones:</strong> Conexión con Email Marketing, Systeme.io, Stripe/Paypal u otras pasarelas.</li>
                        </ul>
                    </div>
                    <div className="bg-zinc-50 p-6 rounded-xl border border-zinc-100">
                        <h4 className="font-bold text-zinc-900 mb-3 border-b border-zinc-200 pb-2">3. Optimización SEO & Rendimiento</h4>
                        <ul className="text-sm text-zinc-600 space-y-2 list-disc pl-4">
                            <li><strong>SEO Técnico:</strong> Metadatos, Schema XML sitemaps, optimización de velocidad.</li>
                            <li><strong>Accesibilidad:</strong> Alto contraste y compatibilidad estándar web.</li>
                            <li><strong>Analítica:</strong> Google Analytics y GTM implementados desde el día 1.</li>
                        </ul>
                    </div>
                    <div className="bg-zinc-50 p-6 rounded-xl border border-zinc-100">
                        <h4 className="font-bold text-zinc-900 mb-3 border-b border-zinc-200 pb-2">4. Entregables Adicionales</h4>
                        <ul className="text-sm text-zinc-600 space-y-2 list-disc pl-4">
                            <li><strong>Social Assets:</strong> Open Graph images para compartir en LinkedIn / IG y Favicons adaptativos.</li>
                            <li><strong>Capacitación premium:</strong> Entregamos en Notion guías con videos de cómo manejar el portal.</li>
                            <li><strong>Soporte mensual post-lanzamiento.</strong></li>
                        </ul>
                    </div>
                </div>

                {/* Pricing Table from Database */}
                <h3 className="text-xl font-bold text-zinc-900 mb-4">Desglose de Inversión</h3>
                <div className="mb-8 border border-zinc-200 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-[1fr_120px] bg-zinc-100 px-6 py-3 border-b border-zinc-200">
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Servicio Específico</span>
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest text-right">Monto (USD)</span>
                    </div>
                    <div className="divide-y divide-zinc-100 bg-white">
                        {cotizacion.items.map((item, i) => (
                            <div key={i} className="grid grid-cols-[1fr_120px] gap-4 px-6 py-4 hover:bg-zinc-50 transition-colors">
                                <span className="text-sm font-medium text-zinc-800">{item.descripcion}</span>
                                <span className="text-sm font-bold text-zinc-900 text-right">{formatCurrency(item.precio)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="bg-zinc-900 text-white px-6 py-5 flex justify-between items-center">
                        <span className="text-sm font-bold uppercase tracking-widest text-zinc-400">Total Inversión Proyecto</span>
                        <span className="text-2xl font-black">{formatCurrency(cotizacion.total)}</span>
                    </div>
                </div>
            </div>

            {/* FOURTH PAGE: TIMELINE, TERMS & CONDITIONS */}
            <div className="min-h-[297mm] p-[15mm] flex flex-col">
                <h2 className="text-3xl font-black text-zinc-900 mb-6 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm">04</span>
                    Hitos & Cronograma
                </h2>
                
                <div className="bg-zinc-50 rounded-xl p-6 mb-10 border border-zinc-200">
                    <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wide mb-4">Estructura de Pago</h3>
                    <p className="text-sm text-zinc-600 mb-6">Se requiere un depósito para iniciar. Todos los valores están en USD.</p>
                    
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-zinc-200">
                            <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center">1</span>
                                <span className="text-sm font-medium text-zinc-800">Depósito Inicial (Arranque de Proyecto)</span>
                            </div>
                            <span className="font-bold text-zinc-900">50%</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-zinc-200">
                            <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-zinc-200 text-zinc-700 font-bold text-xs flex items-center justify-center">2</span>
                                <span className="text-sm font-medium text-zinc-800">Al finalizar Diseño Web / Maquetas</span>
                            </div>
                            <span className="font-bold text-zinc-900">25%</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-zinc-200">
                            <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">3</span>
                                <span className="text-sm font-medium text-zinc-800">Al finalizar Desarrollo y Lanzamiento</span>
                            </div>
                            <span className="font-bold text-zinc-900">25%</span>
                        </div>
                    </div>
                </div>

                <div className="mb-10">
                    <h3 className="text-lg font-bold text-zinc-900 mb-4">Términos y Condiciones</h3>
                    <div className="text-[11px] text-zinc-500 leading-relaxed space-y-3 p-6 bg-zinc-50 rounded-xl border border-zinc-200">
                        <p><strong>1. Recursos adicionales:</strong> Fuentes tipográficas de pago o herramientas de terceros no están incluidas en el precio de la web. Se consultará siempre con el cliente de antemano.</p>
                        <p><strong>2. Cancelación:</strong> Si el cliente cancela el proyecto una vez iniciado, pagará por el tiempo producido incluso si no usará el trabajo final.</p>
                        <p><strong>3. Propiedad:</strong> El cliente es propietario absoluto del sitio web una vez finalizados todos los pagos.</p>
                        <p><strong>4. Retroalimentación:</strong> Se requiere enviar feedback en los tiempos estipulados. Demoras excesivas sin justificación pausarán el proyecto.</p>
                        <p><strong>5. Atrasos de pago:</strong> Facturas de pago finalizadas tienen un marco de gracia de 14 días. Pasado este plazo pueden incurrir retrasos porcentuales en base al contrato.</p>
                        {cotizacion.notas && (
                            <div className="mt-4 pt-4 border-t border-zinc-300">
                                <strong>Notas adicionales específicas de esta cotización: </strong>
                                {cotizacion.notas}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-auto border-t-2 border-zinc-900 pt-8 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Empresa</p>
                        <p className="text-lg font-black text-zinc-900 tracking-tighter">GALU.AGENCY</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Director Creativo</p>
                        <p className="font-signature text-2xl text-zinc-900 -rotate-2">Galu Team</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
