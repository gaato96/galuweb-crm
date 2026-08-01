"use client";

import { usePathname } from "next/navigation";
import { Menu, X, Bell, Search } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "./sidebar";
import Logo from "./logo";

const PAGE_TITLES: Record<string, string> = {
    "/": "Dashboard",
    "/ideas": "Ideas & Oportunidades",
    "/mis-proyectos": "Mis Proyectos SaaS",
    "/rutinas": "Rutinas & Hábitos",
    "/clientes": "Clientes",
    "/scraper": "Scraper Leads",
    "/proyectos": "Proyectos Clientes",
    "/cotizaciones": "Cotizaciones",
    "/briefs": "Briefs",
    "/tickets": "Tickets de Soporte",
    "/tareas": "Tareas & Operativa",
    "/finanzas": "Finanzas",
    "/infraestructura": "Infraestructura",
    "/marketing": "Marketing",
    "/recursos": "Recursos",
};

export default function Header() {
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const baseRoute = "/" + (pathname.split("/")[1] || "");
    const title = PAGE_TITLES[baseRoute] || "Galu CRM";

    // Close menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname]);

    // Prevent body scroll when mobile menu is open
    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [mobileMenuOpen]);

    return (
        <>
            <header className="sticky top-0 z-30 h-[60px] lg:h-[65px] flex items-center justify-between px-3 sm:px-4 lg:px-6 border-b border-border/80 bg-background/80 backdrop-blur-md">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <button
                        onClick={() => setMobileMenuOpen(true)}
                        className="lg:hidden p-2.5 -ml-1.5 rounded-xl bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all active:scale-95 border border-border/50 shrink-0"
                        aria-label="Abrir menú de navegación"
                    >
                        <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                    <h2 className="text-base sm:text-lg lg:text-xl font-bold text-foreground truncate">
                        {title}
                    </h2>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <div className="relative hidden md:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Buscar en CRM..."
                            className="w-[180px] lg:w-[220px] h-9 pl-9 pr-3 rounded-xl bg-secondary/60 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        />
                    </div>
                    <button 
                        aria-label="Notificaciones"
                        className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-secondary/60 hover:bg-accent border border-border/50 transition-all active:scale-95"
                    >
                        <Bell className="w-4 h-4 text-muted-foreground" />
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full ring-2 ring-background animate-pulse" />
                    </button>
                    <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary via-indigo-600 to-cyan-500 text-[11px] font-extrabold text-white shadow-md shadow-primary/20 shrink-0">
                        AG
                    </div>
                </div>
            </header>

            {/* Mobile Navigation Drawer Backdrop */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md lg:hidden animate-fade-in"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Mobile Navigation Drawer Panel */}
            <aside className={cn(
                "fixed left-0 top-0 z-50 h-screen w-[290px] max-w-[85vw] bg-sidebar border-r border-border flex flex-col transition-transform duration-300 ease-out lg:hidden shadow-2xl",
                mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 h-[60px] sm:h-[65px] border-b border-border/80 shrink-0">
                    <Logo />
                    <button 
                        onClick={() => setMobileMenuOpen(false)} 
                        className="p-2 rounded-xl bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all active:scale-95"
                        aria-label="Cerrar menú"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Grouped Links */}
                <nav className="flex-1 p-3 space-y-4 overflow-y-auto custom-scrollbar">
                    {NAV_GROUPS.map((group, gIdx) => (
                        <div key={gIdx} className="space-y-1">
                            {group.title && (
                                <p className="px-3 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-1.5">
                                    {group.title}
                                </p>
                            )}
                            {group.items.map((item) => {
                                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={cn(
                                            "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-[0.98]",
                                            isActive
                                                ? "bg-primary/15 text-primary border border-primary/20 shadow-md shadow-primary/5"
                                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                                        )}
                                    >
                                        <item.icon className={cn("w-4 h-4 sm:w-5 sm:h-5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                                        <span className="truncate">{item.label}</span>
                                        {isActive && (
                                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>
            </aside>
        </>
    );
}
