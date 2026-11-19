"use client";
import { Ui } from "@/components/ui/ui-text";

import { useEffect, useState } from "react";
import { CalendarPlus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  biomedicalInstrumentTypeLabel,
  usesForInstrument,
  type BiomedicalInstrument,
  type InstrumentServiceUse,
} from "@/lib/biomedical-instruments/types";
import {
  SERVICE_ORDER_KINDS,
  serviceOrderStatusLabel,
  serviceTypeLabel,
} from "@/lib/service-orders/types";

function formatIsoDate(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function orderKindLabel(kind: string) {
  return SERVICE_ORDER_KINDS.find((item) => item.id === kind)?.label ?? "Orden de servicio";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm break-words">{value || "—"}</dd>
    </div>
  );
}

export function BiomedicalInstrumentSheet({
  item,
  uses,
  historyError,
  canEdit,
  onClose,
  onEdit,
  onSchedule,
}: {
  item: BiomedicalInstrument;
  uses: InstrumentServiceUse[];
  historyError: string;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSchedule: (date: string) => Promise<void>;
}) {
  const [calibrationDate, setCalibrationDate] = useState(item.nextCalibrationAt);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleNote, setScheduleNote] = useState("");
  useEffect(() => {
    setCalibrationDate(item.nextCalibrationAt);
  }, [item.id, item.nextCalibrationAt]);
  const history = usesForInstrument(item, uses);
  const today = todayIso();
  const expired = Boolean(item.certificateExpiresAt) && item.certificateExpiresAt < today;
  const certificateValue = [
    item.certificateNumber,
    item.certificateExpiresAt
      ? `vence ${formatIsoDate(item.certificateExpiresAt)}${expired ? " · vencido" : ""}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <ModalShell
      title={item.name || "Equipo"}
      description={`${biomedicalInstrumentTypeLabel(item.instrumentType)}${item.isActive ? "" : " · Inactivo"}`}
      className="max-w-4xl"
      headerAction={
        <div className="flex gap-2">
          {canEdit ? (
            <Button type="button" size="sm" variant="outline" onClick={onEdit}><Ui>Editar</Ui></Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={onClose}><Ui>Cerrar</Ui></Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt={item.name} className="aspect-[4/3] w-full object-cover sm:aspect-square" />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center text-xs text-muted-foreground sm:aspect-square">
                Sin foto
              </div>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Marca" value={item.brand} />
            <Field label="Modelo" value={item.model} />
            <Field label="Número de serie" value={item.serialNumber} />
            <Field label="Inventario" value={item.assetTag} />
            <Field label="Ubicación" value={item.location} />
            <Field label="Estado" value={item.isActive ? "Activo" : "Inactivo"} />
            <Field label="Certificado" value={certificateValue} />
            <Field
              label="Próxima calibración"
              value={item.nextCalibrationAt ? formatIsoDate(item.nextCalibrationAt) : ""}
            />
            <Field label="Registró" value={item.createdBy} />
          </dl>
        </div>

        {item.certificateUrl ? (
          <a
            href={item.certificateUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-[#3B46A5] hover:underline"
          >
            <FileText className="size-4" />
            {item.certificateName || "Ver certificado PDF"}
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">Sin PDF de certificación.</p>
        )}

        <section className="rounded-xl border border-border p-3">
          <h4 className="font-semibold">Próxima calibración</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            La fecha queda en la ficha. Calendarizar la publica en el calendario, visible para Servicio.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground"><Ui>Fecha</Ui></span>
              <input
                type="date"
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                value={calibrationDate}
                disabled={!canEdit || scheduling}
                onChange={(event) => setCalibrationDate(event.target.value)}
              />
            </label>
            <Button
              type="button"
              disabled={!canEdit || scheduling || !calibrationDate}
              onClick={() => {
                setScheduling(true);
                setScheduleNote("");
                void onSchedule(calibrationDate)
                  .then(() => setScheduleNote("Quedó en el calendario del área de Servicio."))
                  .catch((err: unknown) =>
                    setScheduleNote(err instanceof Error ? err.message : "No se pudo calendarizar.")
                  )
                  .finally(() => setScheduling(false));
              }}
            >
              <CalendarPlus className="size-4" />
              {scheduling ? "Guardando…" : item.calibrationEventId ? "Actualizar en el calendario" : "Calendarizar"}
            </Button>
            {item.calibrationEventId ? (
              <a href="/dashboard/calendario" className="text-sm text-[#3B46A5] hover:underline">
                Ver calendario
              </a>
            ) : null}
          </div>
          {scheduleNote ? <p className="mt-2 text-sm text-muted-foreground">{scheduleNote}</p> : null}
          {!canEdit ? (
            <p className="mt-2 text-sm text-muted-foreground">Solo lectura: no puedes cambiar la fecha.</p>
          ) : null}
        </section>

        {item.notes ? (
          <div>
            <h4 className="text-sm font-medium"><Ui>Notas</Ui></h4>
            <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{item.notes}</p>
          </div>
        ) : null}

        <section>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h4 className="font-semibold">Servicios en los que participó</h4>
            <span className="text-xs text-muted-foreground">
              {history.length === 1 ? "1 servicio" : `${history.length} servicios`}
            </span>
          </div>
          {historyError ? <p className="text-sm text-destructive">{historyError}</p> : null}
          {history.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              Este equipo aún no está ligado a una orden de servicio.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {history.map((use) => {
                const equipment = [use.equipmentName, use.equipmentSerial ? `serie ${use.equipmentSerial}` : ""]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={use.id} className="px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <a
                          href={`/dashboard/ordenes-servicio?tab=ordenes&order=${use.serviceOrderId}`}
                          className="font-medium text-[#3B46A5] hover:underline"
                        >
                          {use.folio || "Sin folio"}
                        </a>
                        <p className="text-sm text-muted-foreground">
                          {orderKindLabel(use.orderKind)} · {serviceTypeLabel(use.serviceType)} ·{" "}
                          {serviceOrderStatusLabel(use.status)}
                        </p>
                      </div>
                      <p className="text-sm tabular-nums text-muted-foreground">{formatIsoDate(use.receptionAt)}</p>
                    </div>
                    <p className="mt-1 text-sm">
                      {use.clientName || "Sin cliente"}
                      {equipment ? ` · ${equipment}` : ""}
                    </p>
                    {use.technician ? (
                      <p className="text-xs text-muted-foreground">Técnico: {use.technician}</p>
                    ) : null}
                    {use.usageNotes ? (
                      <p className="mt-1 text-xs text-muted-foreground">{use.usageNotes}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </ModalShell>
  );
}
