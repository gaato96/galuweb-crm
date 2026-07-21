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
    ChevronLeft,
    Server,
    LifeBuoy,
    Lightbulb,
    Repeat,
    Rocket
} from "lucide-react";
import { useState } from "react";

export interface NavGroup {
    title?: string;
    items: { label: string; href: string; icon: any }[];
}

export const NAV_GROUPS: NavGroup[] = [
    {
        items: [
            { label: "Dashboard", href: "/", icon: LayoutDashboard },
            { label: "Ideas", href: "/ideas", icon: Lightbulb },
        ]
    },
    {
        title: "MIS PROYECTOS & HÁBITOS",
        items: [
            { label: "Mis Proyectos", href: "/mis-proyectos", icon: Rocket },
            { label: "Rutinas / Hábitos", href: "/rutinas", icon: Repeat },
        ]
    },
    {
        title: "CLIENTES",
        items: [
            { label: "Clientes", href: "/clientes", icon: Users },
            { label: "Proyectos Clientes", href: "/proyectos", icon: FolderKanban },
            { label: "Cotizaciones", href: "/cotizaciones", icon: FileText },
            { label: "Briefs", href: "/briefs", icon: ClipboardList },
            { label: "Tickets", href: "/tickets", icon: LifeBuoy },
        ]
    },
    {
        title: "OPERATIVA & GESTIÓN",
        items: [
            { label: "Tareas", href: "/tareas", icon: CheckSquare },
            { label: "Finanzas", href: "/finanzas", icon: DollarSign },
            { label: "Infraestructura", href: "/infraestructura", icon: Server },
            { label: "Marketing", href: "/marketing", icon: Megaphone },
            { label: "Recursos", href: "/recursos", icon: BookOpen },
        ]
    }
];

export const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items);

import Logo from "./logo";

export default function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={cn(
                "fixed left-0 top-0 z-40 h-screen hidden lg:flex flex-col border-r border-border bg-sidebar transition-all duration-300",
                collapsed ? "w-[70px]" : "w-[250px]"
            )}
        >
            {/* Logo */}
            <div className="flex items-center px-4 h-[65px] border-b border-border">
                <Logo collapsed={collapsed} />
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto custom-scrollbar">
                {NAV_GROUPS.map((group, gIdx) => (
                    <div key={gIdx} className="space-y-1">
                        {group.title && !collapsed && (
                            <p className="px-3 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-1">
                                {group.title}
                            </p>
                        )}
                        {group.items.map((item) => {
                            const isActive =
                                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group",
                                        isActive
                                            ? "bg-primary/15 text-primary shadow-lg shadow-primary/5"
                                            : "text-sidebar-foreground hover:text-foreground hover:bg-secondary"
                                    )}
                                >
                                    <item.icon
                                        className={cn(
                                            "w-4 h-4 shrink-0 transition-colors",
                                            isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                                        )}
                                    />
                                    {!collapsed && <span className="text-xs font-semibold">{item.label}</span>}
                                    {isActive && !collapsed && (
                                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse-soft" />
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                ))}
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
