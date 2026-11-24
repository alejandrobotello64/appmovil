export const CLIENT_VIEWS = ["clientes", "equipos", "historial"] as const;

export type ClientViewId = (typeof CLIENT_VIEWS)[number];

export type ClientsNavState = {
  view: ClientViewId;
  client?: string;
  equipment?: string;
  ficha?: string;
  status?: string;
};

export function isClientViewId(value: string | null): value is ClientViewId {
  return CLIENT_VIEWS.includes(value as ClientViewId);
}

export function normalizeClientView(value: string | null): ClientViewId {
  return isClientViewId(value) ? value : "clientes";
}

/** Deep link del módulo clientes (tabs + filtros). */
export function buildClientsHref(nav: ClientsNavState) {
  const params = new URLSearchParams();
  if (nav.view !== "clientes") params.set("view", nav.view);
  if (nav.client) params.set("client", nav.client);
  if (nav.view === "historial" && nav.equipment) {
    params.set("equipment", nav.equipment);
  }
  if (nav.view === "clientes" && nav.ficha) {
    params.set("ficha", nav.ficha);
  }
  if (nav.view === "equipos" && nav.status) {
    params.set("status", nav.status);
  }
  const query = params.toString();
  return query ? `/dashboard/clientes?${query}` : "/dashboard/clientes";
}
