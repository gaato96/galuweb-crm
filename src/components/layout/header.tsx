"use client";

import { usePathname } from "next/navigation";
import { Menu, X, Bell, Search, Zap } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./sidebar";
import Logo from "./logo";

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
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const baseRoute = "/" + (pathname.split("/")[1] || "");
    const title = PAGE_TITLES[baseRoute] || "Galu CRM";

    return (
        <>
            <header className="sticky top-0 z-30 h-[65px] flex items-center justify-between px-4 lg:px-6 border-b border-border glass">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setMobileMenuOpen(true)}
                        className="lg:hidden p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <h2 className="text-lg lg:text-xl font-bold text-foreground">{title}</h2>
                </div>

                <div className="flex items-center gap-2 lg:gap-3">
                    <div className="relative hidden xl:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="w-[220px] h-9 pl-9 pr-3 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        />
                    </div>
                    <button className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-secondary hover:bg-accent transition-colors">
                        <Bell className="w-4 h-4 text-muted-foreground" />
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full border-2 border-sidebar" />
                    </button>
                    <div className="flex items-center justify-center w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-gradient-to-br from-primary to-cyan-400 text-[10px] lg:text-xs font-bold text-white uppercase">
                        AG
                    </div>
                </div>
            </header>

            {/* Mobile Sidebar Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Mobile Sidebar */}
            <aside className={cn(
                "fixed left-0 top-0 z-50 h-screen w-[280px] bg-sidebar border-r border-border transition-transform duration-300 lg:hidden",
                mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex items-center justify-between px-4 h-[65px] border-b border-border">
                    <Logo />
                    <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-secondary">
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>
                <nav className="p-3 space-y-1">
                    {NAV_ITEMS.map((item) => {
                        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                                )}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </aside>
        </>
    );
}
