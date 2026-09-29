"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlarmClock,
  ClipboardList,
  FileDown,
  Hammer,
  HandHelping,
  History,
  Plus,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { usePermissions, useSessionAccess } from "@/lib/auth/use-permissions";
import { downloadToolsCustodyPdf } from "@/lib/tools/pdf";
import { getToolRequests, getTools } from "@/lib/tools/storage";
import {
  isRequestOverdue,
  requestOutstanding,
  type ToolRequest,
  type ToolWithAvailability,
} from "@/lib/tools/types";
import { cn } from "@/lib/utils";
import { ToolRequestDetail } from "./tool-request-detail";
import { ToolRequestForm } from "./tool-request-form";
import { ToolRequestsList, type RequestFilter } from "./tool-requests-list";
import { ToolsCatalog } from "./tools-catalog";
import { Notice, primaryButtonClass, StatCard, SubTabs, type SubTab } from "./tools-shared";

type Side = "almacen" | "biomedica";
type TabId = "solicitudes" | "mias" | "catalogo" | "historial";
type LoadedData = { tools: ToolWithAvailability[]; requests: ToolRequest[]; loadedAt: Date };

export function WarehouseToolsPanel() {
  return <ToolsModule side="almacen" />;
}

export function BiomedicalToolRequestsPanel() {
  return <ToolsModule side="biomedica" />;
}

function ToolsModule({ side }: { side: Side }) {
  const warehouse = usePermissions("herramientas");
  const requester = usePermissions("solicitud_herramientas");
  const { session, role } = useSessionAccess();
  const [data, setData] = useState<LoadedData | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabId>(side === "almacen" ? "solicitudes" : "mias");
  const [activeFilter, setActiveFilter] = useState<RequestFilter>("activas");
  const [historyFilter, setHistoryFilter] = useState<RequestFilter>("todas");
  const [openId, setOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getTools({ includeInactive: side === "almacen" }), getToolRequests()])
      .then(([tools, requests]) => {
        if (!active) return;
        setData({ tools, requests, loadedAt: new Date() });
        setError("");
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "No se pudo cargar el módulo de herramientas.");
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [side, reloadKey]);

  function refresh() {
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  }

  const username = session?.username ?? "";
  const tools = useMemo(() => data?.tools ?? [], [data]);
  const requests = useMemo(() => data?.requests ?? [], [data]);
  const mine = useMemo(
    () => requests.filter((request) => request.requester.username === username),
    [requests, username]
  );
  const today = data?.loadedAt ?? null;

  const scope = side === "biomedica" ? mine : requests;
  const stats = useMemo(() => {
    if (!today) return null;
    return {
      pending: scope.filter((request) => request.status === "solicitada").length,
      out: scope.reduce((acc, request) => acc + (request.deliveredAt ? requestOutstanding(request) : 0), 0),
      overdue: scope.filter((request) => isRequestOverdue(request, today)).length,
      available: tools.reduce((acc, tool) => acc + tool.quantityAvailable, 0),
      total: tools.reduce((acc, tool) => acc + (tool.isActive ? tool.quantityTotal : 0), 0),
    };
  }, [scope, tools, today]);

  const tabs: SubTab<TabId>[] =
    side === "almacen"
      ? [
          { id: "solicitudes", label: "Solicitudes", icon: ClipboardList, count: stats?.pending },
          { id: "catalogo", label: "Catálogo", icon: Hammer },
          { id: "historial", label: "Historial", icon: History },
        ]
      : [
          { id: "mias", label: "Mis solicitudes", icon: HandHelping, count: stats?.overdue },
          { id: "catalogo", label: "Catálogo", icon: Hammer },
          { id: "historial", label: "Historial", icon: History },
        ];

  const canExport = side === "almacen" ? warehouse.canExport : requester.canExport;
  const readOnly = side === "almacen" ? !warehouse.canWrite : !requester.canCreate;
  const openRequest = openId ? requests.find((request) => request.id === openId) ?? null : null;

  function goToFilter(filter: RequestFilter) {
    if (side === "almacen") {
      setTab("solicitudes");
      setActiveFilter(filter);
    } else {
      setTab("mias");
      setActiveFilter(filter);
    }
  }

  async function onCustodyPdf() {
    if (!today) return;
    try {
      await downloadToolsCustodyPdf(requests, today);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el PDF.");
    }
  }

  function onRequestChanged(updated: ToolRequest, text: string) {
    setData((current) =>
      current
        ? { ...current, requests: current.requests.map((r) => (r.id === updated.id ? updated : r)) }
        : current
    );
    setMessage(text);
    refresh();
  }

  return (
    <section className="space-y-4">
      {readOnly ? (
        <ReadOnlyBanner
          visible
          message={
            side === "almacen"
              ? "Tu rol es de consulta: puedes ver herramientas y vales, pero no entregar ni recibir devoluciones."
              : "Tu rol es de consulta: puedes ver el catálogo y el historial, pero no crear solicitudes."
          }
        />
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#3B46A5]">
            {side === "almacen" ? "Herramientas de almacén" : "Solicitud de herramientas"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {side === "almacen"
              ? "Administra el catálogo, entrega herramientas a biomédica y registra las devoluciones en el mismo vale."
              : "Pide herramientas a almacén. Cada solicitud genera un vale con folio que sirve de resguardo hasta la devolución."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {side === "biomedica" && requester.canCreate ? (
            <Button
              type="button"
              className={cn("h-10 px-4", primaryButtonClass)}
              disabled={!data || !session}
              onClick={() => setFormOpen(true)}
            >
              <Plus className="size-4" /> Nueva solicitud
            </Button>
          ) : null}
          {canExport ? (
            <Button type="button" variant="outline" className="h-10 px-3" disabled={!data} onClick={() => void onCustodyPdf()}>
              <FileDown className="size-4" /> Resguardo PDF
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-10 px-3"
            disabled={refreshing}
            onClick={refresh}
            aria-label="Actualizar"
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={ClipboardList}
            label={side === "almacen" ? "Por entregar" : "Mis solicitudes por entregar"}
            value={stats.pending}
            tone={stats.pending ? "warning" : "default"}
            onClick={() => goToFilter("pendientes")}
          />
          <StatCard
            icon={Wrench}
            label={side === "almacen" ? "Piezas prestadas" : "Piezas en mi resguardo"}
            value={stats.out}
            onClick={() => goToFilter("prestadas")}
          />
          <StatCard
            icon={AlarmClock}
            label="Vales vencidos"
            value={stats.overdue}
            tone={stats.overdue ? "danger" : "default"}
            hint={stats.overdue ? "Pasaron su fecha de devolución" : undefined}
            onClick={() => goToFilter("vencidas")}
          />
          <StatCard
            icon={Hammer}
            label="Piezas disponibles en almacén"
            value={`${stats.available} / ${stats.total}`}
            onClick={() => setTab("catalogo")}
          />
        </div>
      ) : null}

      <SubTabs tabs={tabs} active={tab} onChange={setTab} />

      <Notice tone="error">{error}</Notice>
      <Notice tone="success">{message}</Notice>

      {!data || !today ? (
        error ? null : (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-muted/40" />
            ))}
          </div>
        )
      ) : (
        <>
          {tab === "solicitudes" ? (
            <ToolRequestsList
              requests={requests}
              today={today}
              filter={activeFilter}
              onFilterChange={setActiveFilter}
              emptyText="Aún no hay solicitudes de herramientas."
              onOpen={setOpenId}
            />
          ) : null}
          {tab === "mias" ? (
            <ToolRequestsList
              requests={mine}
              today={today}
              filter={activeFilter}
              onFilterChange={setActiveFilter}
              emptyText={
                requester.canCreate
                  ? "Aún no has solicitado herramientas. Usa «Nueva solicitud» para pedirlas a almacén."
                  : "No tienes solicitudes registradas."
              }
              onOpen={setOpenId}
            />
          ) : null}
          {tab === "catalogo" ? (
            <ToolsCatalog
              tools={tools}
              requests={requests}
              canCreate={side === "almacen" && warehouse.canCreate}
              canEdit={side === "almacen" && warehouse.canEdit}
              canDelete={side === "almacen" && warehouse.canDelete}
              actor={session?.fullName || username}
              onChanged={refresh}
              onOpenRequest={setOpenId}
            />
          ) : null}
          {tab === "historial" ? (
            <ToolRequestsList
              requests={requests}
              today={today}
              filter={historyFilter}
              onFilterChange={setHistoryFilter}
              showDateRange
              emptyText="El historial está vacío: aún no se han solicitado herramientas."
              onOpen={setOpenId}
            />
          ) : null}
        </>
      )}

      {formOpen && session && today ? (
        <ToolRequestForm
          tools={tools}
          session={session}
          today={today}
          onClose={() => setFormOpen(false)}
          onCreated={(created) => {
            setFormOpen(false);
            setMessage(`Solicitud ${created.folio} enviada a almacén.`);
            setData((current) => (current ? { ...current, requests: [created, ...current.requests] } : current));
            setTab("mias");
            setActiveFilter("activas");
            setOpenId(created.id);
            refresh();
          }}
        />
      ) : null}

      {openRequest && session && today ? (
        <ToolRequestDetail
          key={openRequest.id}
          request={openRequest}
          tools={tools}
          session={session}
          today={today}
          permissions={{
            canManage: side === "almacen" && warehouse.canEdit,
            canCancel:
              requester.canDelete &&
              (openRequest.requester.username === username || role === "administrador"),
            canExport,
          }}
          onClose={() => setOpenId(null)}
          onChanged={onRequestChanged}
        />
      ) : null}
    </section>
  );
}
