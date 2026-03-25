import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Galu CRM — Gestión de Agencia Web",
  description: "CRM completo para agencias de diseño web. Gestiona clientes, proyectos, cotizaciones y más.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Galu CRM",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body>
        {children}
        <Toaster
          className="!z-[100]"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "hsl(222 47% 9%)",
              border: "1px solid hsl(217 33% 17%)",
              color: "hsl(210 40% 96%)",
            },
          }}
        />
      </body>
    </html>
  );
}
