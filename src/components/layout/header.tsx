"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
    "/": "Dashboard",
    "/clientes": "Clientes",
    "/proyectos": "Proyectos",
    "/tareas": "Tareas",
    "/cotizaciones": "Cotizaciones",
    "/finanzas": "Finanzas",
    "/briefs": "Briefs",
    "/marketing": "Marketing",
    "/recursos": "Recursos",
};

export default function Header() {
    const pathname = usePathname();
    const baseRoute = "/" + (pathname.split("/")[1] || "");
    const title = PAGE_TITLES[baseRoute] || "Galu CRM";

    return (
        <header className="sticky top-0 z-30 h-[65px] flex items-center justify-between px-6 border-b border-border glass">
            <div>
                <h2 className="text-xl font-bold text-foreground">{title}</h2>
            </div>
            <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        className="w-[220px] h-9 pl-9 pr-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    />
                </div>
                {/* Notifications */}
                <button className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-secondary hover:bg-accent transition-colors">
                    <Bell className="w-4 h-4 text-muted-foreground" />
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full border-2 border-sidebar" />
                </button>
                {/* Avatar */}
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-primary to-cyan-400 text-xs font-bold text-white">
                    AG
                </div>
            </div>
        </header>
    );
}
