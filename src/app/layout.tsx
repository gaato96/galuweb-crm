import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Nexus CRM — Gestión de Agencia Web",
  description: "CRM completo para agencias de diseño web. Gestiona clientes, proyectos, cotizaciones y más.",
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
          <main className="flex-1 ml-[250px] transition-all duration-300">
            <Header />
            <div className="p-6">
              {children}
            </div>
          </main>
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
