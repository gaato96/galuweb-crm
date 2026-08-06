import { cn } from "@/lib/utils";

/**
 * Logo oficial de Galu. El archivo es horizontal (500x216) con el isotipo de la
 * lámpara a la izquierda y el texto a la derecha.
 *
 * - Expandido: se usa la imagen completa.
 * - Colapsado: se recorta a la lámpara con un contenedor cuadrado, para no
 *   deformar la marca ni necesitar un segundo archivo.
 */
export default function Logo({
    className,
    collapsed = false,
}: {
    className?: string;
    collapsed?: boolean;
}) {
    if (collapsed) {
        return (
            <div className={cn("flex items-center justify-center", className)}>
                <span className="relative block w-10 h-10 overflow-hidden">
                    {/*
                      El isotipo ocupa x 54–161 de los 500px del archivo (centro 107,5).
                      A 38px de alto la escala es 38/216 = 0,176, con lo que ese centro
                      cae a 18,9px del borde izquierdo de la imagen. Con left:50% (20px)
                      hay que correrla -18,9px para centrar la lámpara en la caja.
                    */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/icon-512x512.png"
                        alt="Galu"
                        className="absolute top-1/2 left-1/2 h-[38px] max-w-none -translate-y-1/2 select-none"
                        style={{ marginLeft: "-18.9px" }}
                        draggable={false}
                    />
                </span>
            </div>
        );
    }

    return (
        <div className={cn("flex items-center", className)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/icon-512x512.png"
                alt="Galu — Diseño Web"
                className="h-9 w-auto object-contain select-none"
                draggable={false}
            />
        </div>
    );
}
