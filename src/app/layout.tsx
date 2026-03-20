import type { Metadata, Viewport } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
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
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col lg:pl-[250px] transition-all duration-300">
            <Header />
            <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
              {children}
            </main>
          </div>
        </div>
        <Toaster
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
