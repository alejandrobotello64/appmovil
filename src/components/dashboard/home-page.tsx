"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeDollarSign,
  Boxes,
  Building2,
  ClipboardList,
  Clock,
  Gauge,
  Gavel,
  Loader2,
  MonitorCog,
  PieChart,
  RefreshCw,
  Smile,
  Target,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import {
  AlertsPanel,
  ClientActivityTable,
  EmptyState,
  formatDays,
  formatMoney,
  formatNumber,
  formatPercent,
  formatShortDate,
  HorizontalBars,
  KpiCard,
  MonthlyChart,
  Panel,
  PanelLink,
  type ChartSeries,
} from "@/components/dashboard/home-widgets";
import {
  allowedHomeAreas,
  homeAreaLabel,
  loadHomeData,
  type HomeArea,
  type HomeData,
} from "@/lib/analytics/home-data";
import { computeHomeMetrics, delta, PERIODS, type PeriodId } from "@/lib/analytics/home-metrics";
import { useSessionAccess } from "@/lib/auth/use-permissions";
import { quoteStatusLabel } from "@/lib/quotes/types";
import { cn } from "@/lib/utils";

type ChartMode = "servicio" | "ventas" | "montos";

const CHART_MODES: { id: ChartMode; label: string; areas: HomeArea[] }[] = [
  { id: "servicio", label: "Órdenes de servicio", areas: ["servicio"] },
  { id: "ventas", label: "Cotizaciones", areas: ["ventas"] },
  { id: "montos", label: "Montos", areas: ["servicio", "ventas"] },
];

function greeting(time: number) {
  const hour = new Date(time).getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function DashboardHomePage() {
  const { session, ready, canView } = useSessionAccess();
  const allowedKey = ready ? allowedHomeAreas(canView).join(",") : "";
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [period, setPeriod] = useState<PeriodId>("90d");
  const [chartMode, setChartMode] = useState<ChartMode | null>(null);

  useEffect(() => {
    if (!allowedKey) return;
    let active = true;
    loadHomeData(allowedKey.split(",") as HomeArea[])
      .then((result) => {
        if (!active) return;
        setData(result);
        setError("");
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "No se pudo cargar el tablero.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [allowedKey, reloadKey]);

  const metrics = useMemo(() => (data ? computeHomeMetrics(data, period) : null), [data, period]);

  const firstName = (session?.fullName || session?.username || "").split(" ")[0];
  const noAreas = ready && !allowedKey;

  function refresh() {
    setLoading(true);
    setReloadKey((key) => key + 1);
  }

  return (
    <AppShell title="Panel principal" subtitle="Medical Advanced Supplies">
      <div className="space-y-6">
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-[linear-gradient(135deg,rgba(0,191,255,0.08),rgba(59,70,165,0.12))] p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {data ? greeting(data.loadedAt) : "Hola"}
              {firstName ? `, ${firstName}` : ""}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              Resumen general de la empresa
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Indicadores acumulados de biomédica, ventas, almacén, calidad y clientes, con alertas de
              todas las áreas que puedes ver.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <div
              role="group"
              aria-label="Periodo"
              className="inline-flex rounded-lg border border-border bg-background p-0.5"
            >
              {PERIODS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPeriod(item.id)}
                  aria-pressed={period === item.id}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                    period === item.id
                      ? "bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={refresh}
              disabled={loading || noAreas}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              {data
                ? `Actualizado ${new Date(data.loadedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`
                : "Cargando…"}
            </button>
          </div>
        </section>

        {error ? (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {data?.failed.length ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            No se pudieron cargar: {data.failed.map(homeAreaLabel).join(", ")}. El resto del tablero
            está completo.
          </p>
        ) : null}

        {noAreas ? (
          <EmptyState>Tu rol no tiene áreas con indicadores para mostrar.</EmptyState>
        ) : !metrics ? (
          <LoadingSkeleton />
        ) : (
          <HomeContent
            metrics={metrics}
            chartMode={chartMode}
            onChartMode={setChartMode}
          />
        )}
      </div>
    </AppShell>
  );
}

function HomeContent({
  metrics,
  chartMode,
  onChartMode,
}: {
  metrics: NonNullable<ReturnType<typeof computeHomeMetrics>>;
  chartMode: ChartMode | null;
  onChartMode: (mode: ChartMode) => void;
}) {
  const { has, period, service, sales, tenders, inventory, quality, clients } = metrics;
  const compare = period.compareLabel;
  const modes = CHART_MODES.filter((mode) => mode.areas.some(has));
  const mode = modes.find((item) => item.id === chartMode) ?? modes[0];

  const chartSeries: Record<ChartMode, ChartSeries[]> = {
    servicio: [
      { key: "osReceived", label: "Recibidas", color: "#00BFFF" },
      { key: "osDelivered", label: "Entregadas", color: "#3B46A5" },
    ],
    ventas: [
      { key: "quotesCreated", label: "Cotizaciones", color: "#00BFFF" },
      { key: "quotesWon", label: "Aceptadas", color: "#22A06B" },
    ],
    montos: [
      ...(has("servicio")
        ? [{ key: "serviceRevenue", label: "Servicio entregado", color: "#3B46A5" } as ChartSeries]
        : []),
      ...(has("ventas")
        ? [{ key: "quotedAmount", label: "Monto cotizado", color: "#00BFFF" } as ChartSeries]
        : []),
    ],
  };

  const showClientTable = has("servicio") || has("ventas") || has("clientes");

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {has("servicio") ? (
          <>
            <KpiCard
              icon={BadgeDollarSign}
              area="Biomédica"
              label="Servicio entregado"
              value={formatMoney(service.revenue.current ?? 0)}
              delta={delta(service.revenue.current, service.revenue.previous)}
              compareLabel={compare}
              footnote={`${formatNumber(service.delivered.current ?? 0)} órdenes entregadas`}
              href="/dashboard/ordenes-servicio?tab=dashboard"
            />
            <KpiCard
              icon={ClipboardList}
              area="Biomédica"
              label="Órdenes recibidas"
              value={formatNumber(service.received.current ?? 0)}
              delta={delta(service.received.current, service.received.previous)}
              compareLabel={compare}
              footnote={`${service.urgent} urgentes · ${service.warranty} en garantía`}
              href="/dashboard/ordenes-servicio?tab=ordenes"
            />
            <KpiCard
              icon={Wrench}
              area="Biomédica"
              label="Órdenes abiertas hoy"
              value={formatNumber(service.open)}
              compareLabel={compare}
              footnote={
                service.overdue
                  ? `${service.overdue} atrasadas vs fecha promesa`
                  : `${service.pendingAuthorization} cotizaciones por autorizar`
              }
              footnoteTone={service.overdue ? "danger" : "muted"}
              href="/dashboard/ordenes-servicio?tab=ordenes"
            />
            <KpiCard
              icon={Clock}
              area="Biomédica"
              label="Tiempo de ciclo promedio"
              value={formatDays(service.avgCycle.current)}
              delta={delta(service.avgCycle.current, service.avgCycle.previous)}
              invert
              compareLabel={compare}
              footnote={`${formatPercent(service.onTimeRate)} entregadas a tiempo`}
              href="/dashboard/ordenes-servicio?tab=dashboard"
            />
          </>
        ) : null}
        {has("ventas") ? (
          <>
            <KpiCard
              icon={TrendingUp}
              area="Ventas"
              label="Monto cotizado"
              value={formatMoney(sales.quoted.current ?? 0)}
              delta={delta(sales.quoted.current, sales.quoted.previous)}
              compareLabel={compare}
              footnote={`${formatNumber(sales.count.current ?? 0)} cotizaciones · pipeline ${formatMoney(sales.pipeline)}`}
              href="/dashboard/ventas?tab=dashboard"
            />
            <KpiCard
              icon={Target}
              area="Ventas"
              label="Tasa de cierre"
              value={formatPercent(sales.closeRate.current)}
              delta={delta(sales.closeRate.current, sales.closeRate.previous)}
              compareLabel={compare}
              footnote={`${sales.wonCount} aceptadas · ${formatMoney(sales.won.current ?? 0)} ganado`}
              href="/dashboard/ventas?tab=cotizaciones"
            />
          </>
        ) : null}
        {has("licitaciones") ? (
          <KpiCard
            icon={Gavel}
            area="Licitaciones"
            label="Licitaciones activas"
            value={formatNumber(tenders.active)}
            compareLabel={compare}
            footnote={`${formatMoney(tenders.offered)} en juego · ${tenders.won.current ?? 0} ganadas en el periodo`}
            href="/dashboard/licitaciones"
          />
        ) : null}
        {has("inventario") ? (
          <KpiCard
            icon={Boxes}
            area="Almacén"
            label="Valor del inventario"
            value={formatMoney(inventory.value)}
            compareLabel={compare}
            footnote={
              inventory.stockAlerts
                ? `${inventory.stockAlerts} productos en alerta (${inventory.outOfStock} agotados)`
                : `${formatNumber(inventory.items)} productos · stock en orden`
            }
            footnoteTone={inventory.outOfStock ? "danger" : "muted"}
            href="/dashboard/almacen?tab=dashboard"
          />
        ) : null}
        {has("calidad") ? (
          <KpiCard
            icon={Smile}
            area="Calidad"
            label="Satisfacción (CSAT)"
            value={quality.csat.current !== null ? `${quality.csat.current.toFixed(1)} / 5` : "—"}
            delta={delta(quality.csat.current, quality.csat.previous)}
            compareLabel={compare}
            footnote={`${quality.responses} encuestas · ${formatPercent(quality.recommendRate)} recomendaría`}
            href="/dashboard/calidad"
          />
        ) : null}
        {has("clientes") ? (
          <KpiCard
            icon={Building2}
            area="Clientes"
            label="Equipos instalados"
            value={formatNumber(clients.equipment)}
            compareLabel={compare}
            footnote={`${formatPercent(clients.operativeRate)} operativos · ${clients.active} clientes activos`}
            href="/dashboard/clientes"
          />
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {mode ? (
          <Panel
            title="Actividad de los últimos 12 meses"
            description="Pasa el cursor sobre un mes para ver el detalle"
            icon={Activity}
            className="xl:col-span-2"
            action={
              modes.length > 1 ? (
                <div className="inline-flex rounded-lg border border-border p-0.5">
                  {modes.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onChartMode(item.id)}
                      aria-pressed={mode.id === item.id}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap",
                        mode.id === item.id
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null
            }
          >
            <MonthlyChart
              months={metrics.months}
              series={chartSeries[mode.id]}
              format={mode.id === "montos" ? (value) => formatMoney(value, false) : formatNumber}
              axisPrefix={mode.id === "montos" ? "$" : ""}
            />
          </Panel>
        ) : null}
        <div className={cn(mode ? "" : "xl:col-span-3")}>
          <AlertsPanel alerts={metrics.alerts} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {has("servicio") ? (
          <>
            <Panel
              title="Órdenes abiertas por estatus"
              description="Situación actual del taller"
              icon={Gauge}
              action={<PanelLink href="/dashboard/ordenes-servicio?tab=ordenes" />}
            >
              <HorizontalBars
                data={service.openByStatus}
                color="#3B46A5"
                emptyText="No hay órdenes abiertas."
              />
            </Panel>
            <Panel
              title="Tipos de servicio"
              description="Órdenes recibidas en el periodo"
              icon={PieChart}
            >
              <HorizontalBars
                data={service.serviceTypes}
                color="#00BFFF"
                emptyText="Sin órdenes recibidas en el periodo."
              />
            </Panel>
          </>
        ) : null}
        {has("ventas") ? (
          <Panel
            title="Embudo comercial"
            description={`Pipeline ponderado: ${formatMoney(sales.weightedPipeline)}`}
            icon={TrendingUp}
            action={<PanelLink href="/dashboard/ventas?tab=cotizaciones" />}
          >
            <HorizontalBars
              data={sales.funnel.map((row) => ({ ...row, label: quoteStatusLabel(row.id) }))}
              color="#22A06B"
              formatAmount={(value) => formatMoney(value)}
              emptyText="Aún no hay cotizaciones registradas."
            />
          </Panel>
        ) : null}
        {has("clientes") ? (
          <Panel
            title="Estado de equipos instalados"
            description="Parque instalado en clientes (sin bajas)"
            icon={MonitorCog}
            action={<PanelLink href="/dashboard/clientes" />}
          >
            <HorizontalBars
              data={clients.equipmentStatus}
              color="#22A06B"
              emptyText="Sin equipos instalados registrados."
            />
          </Panel>
        ) : null}
      </div>

      {showClientTable ? (
        <Panel
          title="Clientes con más actividad"
          description="Acumulado del periodo en servicio, ventas, equipos instalados y calidad"
          icon={Users}
          action={has("clientes") ? <PanelLink href="/dashboard/clientes" label="Ir a clientes" /> : undefined}
        >
          <ClientActivityTable
            rows={metrics.clientActivity}
            show={{
              service: has("servicio"),
              sales: has("ventas"),
              clients: has("clientes"),
              quality: has("calidad"),
            }}
          />
        </Panel>
      ) : null}

      {has("servicio") ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel
            title="Equipos con más servicios"
            description="Por marca y modelo, órdenes recibidas en el periodo"
            icon={MonitorCog}
          >
            {metrics.topEquipment.length ? (
              <ul className="divide-y divide-border">
                {metrics.topEquipment.map((row, index) => (
                  <li key={row.key} className="flex items-center gap-3 py-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{row.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {row.clients} {row.clients === 1 ? "cliente" : "clientes"} · último{" "}
                        {formatShortDate(row.lastAt)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold tabular-nums">{row.orders} OS</span>
                      {row.corrective ? (
                        <span className="block text-[11px] text-amber-700 dark:text-amber-300">
                          {row.corrective} correctivos
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>Sin órdenes con equipo en el periodo.</EmptyState>
            )}
          </Panel>
          <Panel
            title="Carga por técnico"
            description="Abiertas hoy y entregadas en el periodo"
            icon={Wrench}
          >
            {metrics.technicians.length ? (
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead className="border-y border-border bg-muted/40 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <tr>
                      <th className="px-5 py-2 text-left">Técnico</th>
                      <th className="px-3 py-2 text-right">Abiertas</th>
                      <th className="px-3 py-2 text-right">Atrasadas</th>
                      <th className="px-3 py-2 text-right">Entregadas</th>
                      <th className="px-5 py-2 text-right">Ciclo prom.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {metrics.technicians.map((row) => (
                      <tr key={row.name}>
                        <td className="px-5 py-2.5 font-medium">{row.name}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{row.open}</td>
                        <td
                          className={cn(
                            "px-3 py-2.5 text-right tabular-nums",
                            row.overdue ? "font-semibold text-destructive" : "text-muted-foreground"
                          )}
                        >
                          {row.overdue || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{row.delivered || "—"}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">
                          {formatDays(row.avgCycle)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState>Sin órdenes asignadas.</EmptyState>
            )}
          </Panel>
        </div>
      ) : null}
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando tablero">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl border border-border bg-muted/40" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-muted/40 xl:col-span-2" />
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-muted/40" />
      </div>
    </div>
  );
}
