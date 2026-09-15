"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DesktopTable,
  ResponsiveDataList,
} from "@/components/ui/responsive-data-list";
import {
  createSupplier,
  deleteSupplier,
  getSuppliers,
  updateSupplier,
} from "@/lib/suppliers/storage";
import type { Supplier, SupplierInput } from "@/lib/suppliers/types";
import { cn } from "@/lib/utils";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { usePermissions } from "@/lib/auth/use-permissions";

const EMPTY_FORM: SupplierInput = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  rfc: "",
  address: "",
  city: "",
  notes: "",
  isActive: true,
};

export function SuppliersPanel() {
  const { canWrite } = usePermissions("proveedores");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierInput>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!editing) {
      setForm(EMPTY_FORM);
      return;
    }
    setForm({
      name: editing.name,
      contactName: editing.contactName,
      email: editing.email,
      phone: editing.phone,
      rfc: editing.rfc,
      address: editing.address,
      city: editing.city,
      notes: editing.notes,
      isActive: editing.isActive,
    });
  }, [editing]);

  const filtered = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter((supplier) =>
      [supplier.name, supplier.contactName, supplier.email, supplier.phone, supplier.rfc, supplier.city]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [suppliers, search]);

  async function refresh() {
    try {
      setLoading(true);
      setError("");
      setSuppliers(await getSuppliers());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los proveedores."
      );
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (editing) {
        await updateSupplier(editing.id, form);
      } else {
        await createSupplier(form);
      }
      await refresh();
      setFormOpen(false);
      setEditing(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar el proveedor."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(supplier: Supplier) {
    const confirmed = window.confirm(
      `¿Eliminar al proveedor "${supplier.name}"?`
    );
    if (!confirmed) return;

    try {
      setError("");
      await deleteSupplier(supplier.id);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo eliminar el proveedor."
      );
    }
  }

  return (
    <div className="space-y-6">
      <ReadOnlyBanner visible={!canWrite} />
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Alta de proveedores
            </h2>
            <p className="text-sm text-muted-foreground">
              Registra y administra proveedores del almacén médico.
            </p>
          </div>
          {canWrite ? (
          <Button
            onClick={openCreate}
            className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90"
          >
            <Plus className="size-4" />
            Nuevo proveedor
          </Button>
          ) : null}
        </div>

        <div className="border-b border-border p-4">
          <label className="relative block max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, contacto, RFC o ciudad..."
              className="h-10 w-full rounded-lg border border-input bg-background pr-3 pl-10 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
            />
          </label>
        </div>

        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">
            Cargando proveedores...
          </p>
        ) : (
          <>
          <ResponsiveDataList
            emptyMessage="No hay proveedores registrados."
            items={filtered.map((supplier) => ({
              key: supplier.id,
              title: supplier.name,
              subtitle: supplier.email || "Sin correo",
              badge: (
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                    supplier.isActive
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {supplier.isActive ? "Activo" : "Inactivo"}
                </span>
              ),
              fields: [
                { label: "Contacto", value: supplier.contactName || "—" },
                { label: "Teléfono", value: supplier.phone || "—" },
                { label: "RFC", value: supplier.rfc || "—" },
                { label: "Ciudad", value: supplier.city || "—" },
              ],
              actions: canWrite ? (
                <>
                  <button
                    type="button"
                    onClick={() => openEdit(supplier)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium"
                  >
                    <Pencil className="size-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(supplier)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-destructive/30 px-3 text-xs font-medium text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                    Eliminar
                  </button>
                </>
              ) : undefined,
            }))}
          />

          <DesktopTable>
            <table className="min-w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Proveedor</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium">Teléfono</th>
                  <th className="px-4 py-3 font-medium">RFC</th>
                  <th className="px-4 py-3 font-medium">Ciudad</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      No hay proveedores registrados.
                    </td>
                  </tr>
                ) : (
                  filtered.map((supplier) => (
                    <tr
                      key={supplier.id}
                      className="border-t border-border/70 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {supplier.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {supplier.email || "Sin correo"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {supplier.contactName || "—"}
                      </td>
                      <td className="px-4 py-3">{supplier.phone || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {supplier.rfc || "—"}
                      </td>
                      <td className="px-4 py-3">{supplier.city || "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                            supplier.isActive
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {supplier.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {canWrite ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(supplier)}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={`Editar ${supplier.name}`}
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(supplier)}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Eliminar ${supplier.name}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Consulta</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </DesktopTable>
          </>
        )}
      </section>

      {formOpen && canWrite ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-form-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl"
          >
            <div className="mb-4">
              <h3
                id="supplier-form-title"
                className="text-lg font-semibold text-foreground"
              >
                {editing ? "Editar proveedor" : "Alta de proveedor"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Completa los datos del proveedor para el almacén.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium">Nombre / razón social</span>
                <input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium">Contacto</span>
                <input
                  value={form.contactName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      contactName: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium">Teléfono</span>
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium">Correo</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium">RFC</span>
                <input
                  value={form.rfc}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      rfc: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium">Ciudad</span>
                <input
                  value={form.city}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      city: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
                />
              </label>

              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium">Dirección</span>
                <input
                  value={form.address}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      address: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
                />
              </label>

              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium">Notas</span>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#3B46A5] focus:ring-3 focus:ring-[#00BFFF]/20"
                />
              </label>

              <label className="flex items-center gap-2 md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                  className="size-4 rounded border-input"
                />
                <span className="text-sm">Proveedor activo</span>
              </label>

              <div className="flex justify-end gap-2 border-t border-border pt-4 md:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormOpen(false);
                    setEditing(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90"
                >
                  {submitting
                    ? "Guardando..."
                    : editing
                      ? "Guardar cambios"
                      : "Dar de alta"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
