"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Activity,
  Beaker,
  ChevronDown,
  ClipboardList,
  ClipboardCheck,
  FileBarChart2,
  LayoutDashboard,
  Package,
  Pill,
  Puzzle,
  Settings2,
  ShoppingCart,
  Truck,
  Building2,
  Users,
  UserMinus,
  UserPlus,
  Warehouse,
  Wrench,
  History,
  Bookmark,
  BookOpen,
  Car,
  CalendarDays,
  Gavel,
  FileText,
  GraduationCap,
  Shield,
  X,
} from "lucide-react";
import { WAREHOUSE_TABS, normalizeWarehouseTab } from "@/lib/warehouse/tabs";
import { USERS_TABS, normalizeUsersTab } from "@/lib/users/tabs";
import {
  SERVICE_ORDER_TABS,
  normalizeServiceOrderTab,
} from "@/lib/service-orders/tabs";
import { canViewModule, type WarehouseModule } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AnesthesiaMachineIcon } from "@/components/icons/anesthesia-machine-icon";

const TAB_ICONS = {
  dashboard: LayoutDashboard,
  insumos: Package,
  medicamentos: Pill,
  refacciones: Settings2,
  accesorios: Puzzle,
  reactivos: Beaker,
  entradas: ArrowDownToLine,
  salidas: ArrowUpFromLine,
  apartados: Bookmark,
  solicitudes: ClipboardCheck,
  movimientos: History,
  kardex: BookOpen,
  pedidos: ShoppingCart,
  proveedores: Truck,
  equipo: Wrench,
  mantenimientos: ClipboardList,
  reporte: FileBarChart2,
} as const;

const USER_TAB_ICONS = {
  dashboard: LayoutDashboard,
  alta: UserPlus,
  baja: UserMinus,
  permisos: Shield,
} as const;

const SERVICE_ORDER_TAB_ICONS = {
  dashboard: LayoutDashboard,
  ordenes: Wrench,
  instrumentos: Activity,
  solicitudes: Package,
  plantillas: ClipboardList,
} as const;

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ open, onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeWarehouseTab = normalizeWarehouseTab(searchParams.get("tab"));
  const activeUsersTab = normalizeUsersTab(searchParams.get("tab"));
  const activeServiceOrderTab = normalizeServiceOrderTab(searchParams.get("tab"));
  const inWarehouse = pathname.startsWith("/dashboard/almacen");
  const inUsers = pathname.startsWith("/dashboard/usuarios");
  const inCalendar = pathname.startsWith("/dashboard/calendario");
  const inClients = pathname.startsWith("/dashboard/clientes");
  const inTenders = pathname.startsWith("/dashboard/licitaciones");
  const inQuotes = pathname.startsWith("/dashboard/cotizaciones");
  const inServiceOrders = pathname.startsWith("/dashboard/ordenes-servicio");
  const inFleet = pathname.startsWith("/dashboard/flotilla");
  const inEducation = pathname.startsWith("/dashboard/educacion");
  const [warehouseOpen, setWarehouseOpen] = useState(inWarehouse);
  const [usersOpen, setUsersOpen] = useState(inUsers);
  const [biomedicaOpen, setBiomedicaOpen] = useState(
    inServiceOrders || inEducation
  );
  const [role, setRole] = useState("administrador");

  useEffect(() => {
    setRole(getSession()?.role ?? "administrador");
  }, []);

  useEffect(() => {
    if (inWarehouse) setWarehouseOpen(true);
  }, [inWarehouse]);

  useEffect(() => {
    if (inUsers) setUsersOpen(true);
  }, [inUsers]);

  useEffect(() => {
    if (inServiceOrders || inEducation) setBiomedicaOpen(true);
  }, [inServiceOrders, inEducation]);

  function handleWarehouseClick() {
    const nextOpen = !warehouseOpen;
    setWarehouseOpen(nextOpen);
    if (nextOpen) {
      router.push("/dashboard/almacen?tab=dashboard");
    }
  }

  function handleUsersClick() {
    const nextOpen = !usersOpen;
    setUsersOpen(nextOpen);
    if (nextOpen) {
      router.push("/dashboard/usuarios?tab=dashboard");
    }
  }

  function handleBiomedicaClick() {
    const nextOpen = !biomedicaOpen;
    setBiomedicaOpen(nextOpen);
    if (nextOpen) {
      if (canViewModule(role, "ordenes_servicio")) {
        router.push("/dashboard/ordenes-servicio?tab=dashboard");
      } else if (canViewModule(role, "educacion")) {
        router.push("/dashboard/educacion");
      }
    }
  }

  const showBiomedica =
    canViewModule(role, "ordenes_servicio") ||
    canViewModule(role, "educacion");
  const biomedicaActive = inServiceOrders || inEducation;

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card transition-transform duration-300 lg:static lg:translate-x-0",
          open
            ? "translate-x-0"
            : "-translate-x-full lg:w-0 lg:overflow-hidden lg:border-r-0"
        )}
      >
        <div className="sidebar-header flex items-center justify-between border-b border-border">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[#00BFFF] uppercase">
              MAS
            </p>
            <p className="text-sm font-semibold text-foreground">
              Medical Advanced Supplies
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touch-target inline-flex size-11 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <p className="px-3 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Menú principal
          </p>

          <Link
            href="/dashboard"
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              pathname === "/dashboard"
                ? "bg-[linear-gradient(135deg,rgba(0,191,255,0.18),rgba(59,70,165,0.22))] text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <LayoutDashboard className="size-4 shrink-0" />
            Inicio
          </Link>

          <div className="mt-2">
            <button
              type="button"
              onClick={handleWarehouseClick}
              aria-expanded={warehouseOpen}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                inWarehouse
                  ? "bg-[linear-gradient(135deg,rgba(0,191,255,0.18),rgba(59,70,165,0.22))] text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Warehouse className="size-4 shrink-0" />
              <span className="flex-1">Almacén</span>
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  warehouseOpen ? "rotate-180" : "rotate-0"
                )}
              />
            </button>

            {warehouseOpen ? (
              <div className="mt-1 ml-3 space-y-1 border-l border-border pl-3">
                {WAREHOUSE_TABS.filter((tab) =>
                  canViewModule(role, tab.id as WarehouseModule)
                ).map((tab) => {
                  const Icon = TAB_ICONS[tab.id];
                  const isActive =
                    inWarehouse &&
                    (activeWarehouseTab === tab.id ||
                      (!activeWarehouseTab && tab.id === "dashboard"));

                  return (
                    <Link
                      key={tab.id}
                      href={tab.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" />
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>

          {canViewModule(role, "calendario") ? (
            <Link
              href="/dashboard/calendario"
              onClick={onClose}
              className={cn(
                "mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                inCalendar
                  ? "bg-[linear-gradient(135deg,rgba(0,191,255,0.18),rgba(59,70,165,0.22))] text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <CalendarDays className="size-4 shrink-0" />
              Calendario
            </Link>
          ) : null}

          {canViewModule(role, "clientes") ? (
            <Link
              href="/dashboard/clientes"
              onClick={onClose}
              className={cn(
                "mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                inClients
                  ? "bg-[linear-gradient(135deg,rgba(0,191,255,0.18),rgba(59,70,165,0.22))] text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Building2 className="size-4 shrink-0" />
              Clientes
            </Link>
          ) : null}

          {canViewModule(role, "licitaciones") ? (
            <Link
              href="/dashboard/licitaciones"
              onClick={onClose}
              className={cn(
                "mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                inTenders
                  ? "bg-[linear-gradient(135deg,rgba(0,191,255,0.18),rgba(59,70,165,0.22))] text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Gavel className="size-4 shrink-0" />
              Licitaciones
            </Link>
          ) : null}

          {canViewModule(role, "cotizaciones") ? (
            <Link
              href="/dashboard/cotizaciones"
              onClick={onClose}
              className={cn(
                "mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                inQuotes
                  ? "bg-[linear-gradient(135deg,rgba(0,191,255,0.18),rgba(59,70,165,0.22))] text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <FileText className="size-4 shrink-0" />
              Cotizaciones
            </Link>
          ) : null}

          {showBiomedica ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={handleBiomedicaClick}
                aria-expanded={biomedicaOpen}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  biomedicaActive
                    ? "bg-[linear-gradient(135deg,rgba(0,191,255,0.18),rgba(59,70,165,0.22))] text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <AnesthesiaMachineIcon className="size-4 shrink-0" />
                <span className="flex-1">Biomédica</span>
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    biomedicaOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              </button>

              {biomedicaOpen ? (
                <div className="mt-1 ml-3 space-y-1 border-l border-border pl-3">
                  {canViewModule(role, "ordenes_servicio")
                    ? SERVICE_ORDER_TABS.map((tab) => {
                        const Icon = SERVICE_ORDER_TAB_ICONS[tab.id];
                        const isActive =
                          inServiceOrders && activeServiceOrderTab === tab.id;

                        return (
                          <Link
                            key={tab.id}
                            href={tab.href}
                            onClick={onClose}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                              isActive
                                ? "bg-muted font-medium text-foreground"
                                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                            )}
                          >
                            <Icon className="size-3.5 shrink-0" />
                            {tab.label}
                          </Link>
                        );
                      })
                    : null}

                  {canViewModule(role, "educacion") ? (
                    <Link
                      href="/dashboard/educacion"
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                        inEducation
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                      )}
                    >
                      <GraduationCap className="size-3.5 shrink-0" />
                      Educación
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {canViewModule(role, "flotilla") ? (
            <Link
              href="/dashboard/flotilla"
              onClick={onClose}
              className={cn(
                "mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                inFleet
                  ? "bg-[linear-gradient(135deg,rgba(0,191,255,0.18),rgba(59,70,165,0.22))] text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Car className="size-4 shrink-0" />
              Flotilla
            </Link>
          ) : null}

          {canViewModule(role, "usuarios") ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={handleUsersClick}
                aria-expanded={usersOpen}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  inUsers
                    ? "bg-[linear-gradient(135deg,rgba(0,191,255,0.18),rgba(59,70,165,0.22))] text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Users className="size-4 shrink-0" />
                <span className="flex-1">Usuarios</span>
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    usersOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              </button>

              {usersOpen ? (
                <div className="mt-1 ml-3 space-y-1 border-l border-border pl-3">
                  {USERS_TABS.map((tab) => {
                    const Icon = USER_TAB_ICONS[tab.id];
                    const isActive = inUsers && activeUsersTab === tab.id;

                    return (
                      <Link
                        key={tab.id}
                        href={tab.href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                        )}
                      >
                        <Icon className="size-3.5 shrink-0" />
                        {tab.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </nav>

        <div className="border-t border-border p-4 pb-[max(1rem,calc(env(safe-area-inset-bottom,0px)+0.75rem))]">
          <p className="text-xs text-muted-foreground">
            Panel principal, almacén, biomédica, clientes, cotizaciones y usuarios
          </p>
        </div>
      </aside>
    </>
  );
}
