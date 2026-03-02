"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Users,
    FolderKanban,
    CheckSquare,
    FileText,
    DollarSign,
    ClipboardList,
    Megaphone,
    BookOpen,
    Zap,
    ChevronLeft,
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Clientes", href: "/clientes", icon: Users },
    { label: "Proyectos", href: "/proyectos", icon: FolderKanban },
    { label: "Tareas", href: "/tareas", icon: CheckSquare },
    { label: "Cotizaciones", href: "/cotizaciones", icon: FileText },
    { label: "Finanzas", href: "/finanzas", icon: DollarSign },
    { label: "Briefs", href: "/briefs", icon: ClipboardList },
    { label: "Marketing", href: "/marketing", icon: Megaphone },
    { label: "Recursos", href: "/recursos", icon: BookOpen },
];

export default function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={cn(
                "fixed left-0 top-0 z-40 h-screen flex flex-col border-r border-border bg-sidebar transition-all duration-300",
                collapsed ? "w-[70px]" : "w-[250px]"
            )}
        >
            {/* Logo */}
            <div className="flex items-center gap-3 px-4 h-[65px] border-b border-border">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/20 shrink-0">
                    <Zap className="w-5 h-5 text-primary" />
                </div>
                {!collapsed && (
                    <div className="overflow-hidden">
                        <h1 className="text-lg font-bold gradient-text tracking-tight">Galu</h1>
                        <p className="text-[10px] text-muted-foreground -mt-1 tracking-widest uppercase">CRM</p>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                    const isActive =
                        item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                                isActive
                                    ? "bg-primary/15 text-primary shadow-lg shadow-primary/5"
                                    : "text-sidebar-foreground hover:text-foreground hover:bg-secondary"
                            )}
                        >
                            <item.icon
                                className={cn(
                                    "w-5 h-5 shrink-0 transition-colors",
                                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                                )}
                            />
                            {!collapsed && <span>{item.label}</span>}
                            {isActive && !collapsed && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse-soft" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Collapse toggle */}
            <div className="px-3 py-3 border-t border-border">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex items-center justify-center w-full py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                    <ChevronLeft
                        className={cn(
                            "w-5 h-5 transition-transform duration-300",
                            collapsed && "rotate-180"
                        )}
                    />
                </button>
            </div>
        </aside>
    );
}
