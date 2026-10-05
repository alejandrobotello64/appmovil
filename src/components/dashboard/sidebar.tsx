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
  KeyRound,
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
  BadgeCheck,
  BadgeDollarSign,
  Library,
  Shield,
  ShieldCheck,
  BookText,
  Hammer,
  HandHelping,
  ShoppingBag,
  Wallet,
  Plane,
  Receipt,
  PiggyBank,
  Coins,
  X,
} from "lucide-react";
import { EXPENSE_TABS, normalizeExpenseTab } from "@/lib/expenses/tabs";
import { WAREHOUSE_TABS, normalizeWarehouseTab } from "@/lib/warehouse/tabs";
import { SALES_TABS, SALES_TAB_MODULES, normalizeSalesTab } from "@/lib/sales/tabs";
import {
  PURCHASING_TABS,
  PURCHASING_TAB_MODULES,
  normalizePurchasingTab,
} from "@/lib/purchasing/tabs";
import { USERS_TABS, normalizeUsersTab } from "@/lib/users/tabs";
import {
  BIOMEDICA_MODULES,
  SERVICE_ORDER_TAB_MODULE,
  SERVICE_ORDER_TABS,
  normalizeServiceOrderTab,
} from "@/lib/service-orders/tabs";
import type { WarehouseModule } from "@/lib/auth/permissions";
import { useSessionAccess } from "@/lib/auth/use-permissions";
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
  registros_sanitarios: ShieldCheck,
  herramientas: Hammer,
  reporte: FileBarChart2,
} as const;

const USER_TAB_ICONS = {
  dashboard: LayoutDashboard,
  alta: UserPlus,
  baja: UserMinus,
  permisos: Shield,
} as const;

const SALES_TAB_ICONS = {
  dashboard: LayoutDashboard,
  cotizaciones: FileText,
  surtimientos: Truck,
  catalogo: Library,
} as const;

const PURCHASING_TAB_ICONS = {
  dashboard: LayoutDashboard,
  solicitudes: ClipboardCheck,
  ordenes: ShoppingCart,
  proveedores: Truck,
} as const;

const EXPENSE_TAB_ICONS = {
  resumen: FileBarChart2,
  viaticos: Plane,
  corriente: Receipt,
  caja_chica: PiggyBank,
  otros: Coins,
} as const;

const SERVICE_ORDER_TAB_ICONS = {
  dashboard: LayoutDashboard,
  ordenes: Wrench,
  instrumentos: Activity,
  solicitudes: Package,
  herramientas: HandHelping,
  plantillas: ClipboardList,
  documentos: BookText,
  contrasenas: KeyRound,
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
  const inSales =
    pathname.startsWith("/dashboard/ventas") ||
    pathname.startsWith("/dashboard/cotizaciones");
  const activeSalesTab = normalizeSalesTab(searchParams.get("tab"));
  const inPurchasing = pathname.startsWith("/dashboard/compras");
  const activePurchasingTab = normalizePurchasingTab(searchParams.get("tab"));
  const inServiceOrders = pathname.startsWith("/dashboard/ordenes-servicio");
  const inFleet = pathname.startsWith("/dashboard/flotilla");
  const inExpenses = pathname.startsWith("/dashboard/gastos");
  const activeExpenseTab = normalizeExpenseTab(searchParams.get("tab"));
  const inEducation = pathname.startsWith("/dashboard/educacion");
  const inQuality = pathname.startsWith("/dashboard/calidad");
  const [warehouseOpen, setWarehouseOpen] = useState(inWarehouse);
  const [usersOpen, setUsersOpen] = useState(inUsers);
  const [biomedicaOpen, setBiomedicaOpen] = useState(
    inServiceOrders || inEducation
  );
  const [salesOpen, setSalesOpen] = useState(inSales);
  const [wasInSales, setWasInSales] = useState(inSales);
  if (inSales !== wasInSales) {
    setWasInSales(inSales);
    if (inSales) setSalesOpen(true);
  }
  const [purchasingOpen, setPurchasingOpen] = useState(inPurchasing);
  const [wasInPurchasing, setWasInPurchasing] = useState(inPurchasing);
  if (inPurchasing !== wasInPurchasing) {
    setWasInPurchasing(inPurchasing);
    if (inPurchasing) setPurchasingOpen(true);
  }
  const [expensesOpen, setExpensesOpen] = useState(inExpenses);
  const [wasInExpenses, setWasInExpenses] = useState(inExpenses);
  if (inExpenses !== wasInExpenses) {
    setWasInExpenses(inExpenses);
    if (inExpenses) setExpensesOpen(true);
  }
  const { canView } = useSessionAccess();

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
      const firstTab = visibleServiceOrderTabs[0];
      if (firstTab) {
        router.push(firstTab.href);
      } else if (canView("educacion")) {
        router.push("/dashboard/educacion");
      }
    }
  }

  function handleSalesClick() {
    const nextOpen = !salesOpen;
    setSalesOpen(nextOpen);
    if (nextOpen && visibleSalesTabs[0]) {
      router.push(visibleSalesTabs[0].href);
    }
  }

  const visibleSalesTabs = SALES_TABS.filter((tab) =>
    SALES_TAB_MODULES[tab.id].some((module) => canView(module))
  );

  function handlePurchasingClick() {
    const nextOpen = !purchasingOpen;
    setPurchasingOpen(nextOpen);
    if (nextOpen && visiblePurchasingTabs[0]) {
      router.push(visiblePurchasingTabs[0].href);
    }
  }

  function handleExpensesClick() {
    const nextOpen = !expensesOpen;
    setExpensesOpen(nextOpen);
    if (nextOpen) router.push(EXPENSE_TABS[0].href);
  }

  const visiblePurchasingTabs = PURCHASING_TABS.filter((tab) =>
    PURCHASING_TAB_MODULES[tab.id].some((module) => canView(module))
  );

  const visibleServiceOrderTabs = SERVICE_ORDER_TABS.filter((tab) =>
    canView(SERVICE_ORDER_TAB_MODULE[tab.id])
  );
  const showBiomedica = BIOMEDICA_MODULES.some((module) => canView(module));
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
                  canView(tab.id as WarehouseModule)
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

          {canView("calendario") ? (
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

          {canView("clientes") ? (
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

          {canView("calidad") ? (
            <Link
              href="/dashboard/calidad"
              onClick={onClose}
              className={cn(
                "mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                inQuality
                  ? "bg-[linear-gradient(135deg,rgba(0,191,255,0.18),rgba(59,70,165,0.22))] text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <BadgeCheck className="size-4 shrink-0" />
              Calidad
            </Link>
          ) : null}

          {canView("licitaciones") ? (
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

          {visiblePurchasingTabs.length ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={handlePurchasingClick}
                aria-expanded={purchasingOpen}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  inPurchasing
                    ? "bg-[linear-gradient(135deg,rgba(0,191,255,0.18),rgba(59,70,165,0.22))] text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <ShoppingBag className="size-4 shrink-0" />
                <span className="flex-1">Compras</span>
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    purchasingOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              </button>

              {purchasingOpen ? (
                <div className="mt-1 ml-3 space-y-1 border-l border-border pl-3">
                  {visiblePurchasingTabs.map((tab) => {
                    const Icon = PURCHASING_TAB_ICONS[tab.id];
                    const isActive = inPurchasing && activePurchasingTab === tab.id;

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

          {visibleSalesTabs.length ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={handleSalesClick}
                aria-expanded={salesOpen}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  inSales
                    ? "bg-[linear-gradient(135deg,rgba(0,191,255,0.18),rgba(59,70,165,0.22))] text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <BadgeDollarSign className="size-4 shrink-0" />
                <span className="flex-1">Ventas</span>
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    salesOpen ? "rotate-180" : "rotate-0"
                  )}
                />
              </button>

              {salesOpen ? (
                <div className="mt-1 ml-3 space-y-1 border-l border-border pl-3">
                  {visibleSalesTabs.map((tab) => {
                    const Icon = SALES_TAB_ICONS[tab.id];
                    const isActive = inSales && activeSalesTab === tab.id;

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
                  {visibleServiceOrderTabs.map((tab) => {
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
                  })}

                  {canView("educacion") ? (
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

          {canView("flotilla") ? (
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

          {canView("gastos") ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={handleExpensesClick}
                aria-expanded={expensesOpen}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  inExpenses
                    ? "bg-[linear-gradient(135deg,rgba(0,191,255,0.18),rgba(59,70,165,0.22))] text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Wallet className="size-4 shrink-0" />
                <span className="flex-1">Gastos</span>
                <ChevronDown
                  className={cn("size-4 transition-transform", expensesOpen ? "rotate-180" : "rotate-0")}
                />
              </button>

              {expensesOpen ? (
                <div className="mt-1 ml-3 space-y-1 border-l border-border pl-3">
                  {EXPENSE_TABS.map((tab) => {
                    const Icon = EXPENSE_TAB_ICONS[tab.id];
                    const isActive = inExpenses && activeExpenseTab === tab.id;
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

          {canView("usuarios") ? (
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
            Panel principal, almacén, compras, ventas, biomédica, clientes, calidad y usuarios
          </p>
        </div>
      </aside>
    </>
  );
}
