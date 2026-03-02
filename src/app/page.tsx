"use client";

import { useEffect, useState } from "react";
import {
  DollarSign,
  FolderKanban,
  Users,
  TrendingUp,
  ArrowUpRight,
  Clock,
  AlertCircle,
} from "lucide-react";
import { cn, formatCurrency, formatDate, daysFromNow } from "@/lib/utils";
import { clientesStore, proyectosStore, finanzasStore, tareasStore } from "@/lib/store";
import type { Cliente, Proyecto, Finanza, Tarea } from "@/lib/types";
import { ETAPA_LABELS, ETAPA_COLORS, PRIORIDAD_COLORS } from "@/lib/types";
import Link from "next/link";

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  href,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  href: string;
}) {
  return (
    <Link href={href} className="block">
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 card-hover group">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-foreground">{value}</h3>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div
            className={cn(
              "flex items-center justify-center w-11 h-11 rounded-xl transition-transform group-hover:scale-110",
              color
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <div className={cn("absolute bottom-0 left-0 h-0.5 w-full opacity-50", color.replace("/20", "/40"))} />
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [finanzas, setFinanzas] = useState<Finanza[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setClientes(clientesStore.getAll());
    setProyectos(proyectosStore.getAll());
    setFinanzas(finanzasStore.getAll());
    setTareas(tareasStore.getAll());
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-[130px] rounded-xl skeleton" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-[300px] rounded-xl skeleton" />
          <div className="h-[300px] rounded-xl skeleton" />
        </div>
      </div>
    );
  }

  const ingresosMes = finanzas
    .filter((f) => f.tipo === "ingreso")
    .reduce((sum, f) => sum + f.monto, 0);

  const proyectosActivos = proyectos.filter((p) => p.estado === "activo");
  const leadsPorContactar = clientes.filter(
    (c) => c.etapa === "contacto" || c.etapa === "investigando"
  );

  const tareasUrgentes = tareas.filter(
    (t) => t.prioridad === "alta" && t.estado !== "completada"
  );

  const proximosCobros = finanzas
    .filter((f) => f.tipo === "ingreso" && daysFromNow(f.fecha_cobro) > 0 && daysFromNow(f.fecha_cobro) <= 30)
    .sort((a, b) => new Date(a.fecha_cobro).getTime() - new Date(b.fecha_cobro).getTime());

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Ingresos del Mes"
          value={formatCurrency(ingresosMes)}
          subtitle="Total facturado"
          icon={DollarSign}
          color="bg-emerald-500/20 text-emerald-400"
          href="/finanzas"
        />
        <KPICard
          title="Proyectos en Curso"
          value={proyectosActivos.length}
          subtitle={`${proyectos.length} totales`}
          icon={FolderKanban}
          color="bg-blue-500/20 text-blue-400"
          href="/proyectos"
        />
        <KPICard
          title="Leads por Contactar"
          value={leadsPorContactar.length}
          subtitle="Requieren atención"
          icon={Users}
          color="bg-amber-500/20 text-amber-400"
          href="/clientes"
        />
        <KPICard
          title="Tareas Urgentes"
          value={tareasUrgentes.length}
          subtitle="Prioridad alta"
          icon={AlertCircle}
          color="bg-rose-500/20 text-rose-400"
          href="/tareas"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Resumen */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Pipeline de Clientes</h3>
            <Link
              href="/clientes"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Ver todos <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {(["contacto", "investigando", "calificado", "contactado", "cotizado", "cliente_actual"] as const).map(
              (etapa) => {
                const count = clientes.filter((c) => c.etapa === etapa).length;
                const total = clientes.length || 1;
                return (
                  <div key={etapa} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-full border font-medium w-[120px] text-center",
                        ETAPA_COLORS[etapa]
                      )}
                    >
                      {ETAPA_LABELS[etapa]}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60 transition-all duration-500"
                        style={{ width: `${(count / total) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-foreground w-6 text-right">
                      {count}
                    </span>
                  </div>
                );
              }
            )}
          </div>
        </div>

        {/* Próximos Cobros */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Próximos Cobros</h3>
            <Link
              href="/finanzas"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Ver todos <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {proximosCobros.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <TrendingUp className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">No hay cobros pendientes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {proximosCobros.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10">
                    <Clock className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {f.descripcion}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(f.fecha_cobro)} · en {daysFromNow(f.fecha_cobro)} días
                    </p>
                  </div>
                  <span className="text-sm font-bold text-emerald-400">
                    {formatCurrency(f.monto)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tareas Urgentes */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Tareas Prioritarias</h3>
          <Link
            href="/tareas"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Ver todas <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        {tareasUrgentes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No hay tareas urgentes pendientes 🎉</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tareasUrgentes.slice(0, 6).map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-lg bg-secondary/50 border border-border card-hover"
              >
                <div className="flex items-start justify-between mb-2">
                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wider",
                      PRIORIDAD_COLORS[t.prioridad]
                    )}
                  >
                    {t.prioridad}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase">
                    {t.categoria}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground">{t.titulo}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
