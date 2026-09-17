"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CalendarDays,
  Cake,
  ChevronLeft,
  ChevronRight,
  Mail,
  MapPin,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import { ReadOnlyBanner } from "@/components/warehouse/read-only-banner";
import { getSession } from "@/lib/auth";
import { usePermissions } from "@/lib/auth/use-permissions";
import {
  COMPANY_AREAS,
  areaLabel,
  normalizeArea,
  roleToArea,
} from "@/lib/calendar/areas";
import {
  createCalendarEvent,
  createCalendarReminders,
  deleteCalendarEvent,
  getCalendarCollaborators,
  getCalendarEvents,
  getCalendarRemindersAll,
  mailtoHref,
  markReminderSent,
  whatsappHref,
  type CalendarCollaborator,
} from "@/lib/calendar/storage";
import type {
  CalendarEvent,
  CalendarItem,
  CalendarItemKind,
  CalendarReminder,
} from "@/lib/calendar/types";
import { getInventoryItems } from "@/lib/inventory/storage";
import { getMaintenances } from "@/lib/warehouse/maintenances";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const KIND_LABEL: Record<CalendarItemKind, string> = {
  mantenimiento: "Mantenimiento",
  cumpleanos: "Cumpleaños",
  evento: "Evento",
};

const KIND_CLASS: Record<CalendarItemKind, string> = {
  mantenimiento: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  cumpleanos: "bg-rose-500/15 text-rose-800 dark:text-rose-200",
  evento: "bg-violet-500/15 text-violet-800 dark:text-violet-200",
};

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";

type FilterId = "todos" | CalendarItemKind;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function formatLongDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return key;
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}

function birthdayOnYear(birthDate: string, year: number) {
  const month = birthDate.slice(5, 7);
  const day = birthDate.slice(8, 10);
  if (!month || !day) return null;
  if (month === "02" && day === "29") {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return `${year}-02-${leap ? "29" : "28"}`;
  }
  return `${year}-${month}-${day}`;
}

function ageOnYear(birthDate: string, year: number) {
  const born = Number(birthDate.slice(0, 4));
  if (!born) return null;
  return Math.max(0, year - born);
}

function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const weekday = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - weekday);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: dateKey(date.getFullYear(), date.getMonth(), date.getDate()),
      day: date.getDate(),
      inMonth: date.getMonth() === month,
    };
  });
}

function eventVisibleToArea(event: CalendarEvent, area: string, isAdmin: boolean) {
  if (isAdmin) return true;
  if (event.visibleAreas.length === 0) return true;
  return event.visibleAreas.includes(area);
}

function collaboratorsForAreas(
  people: CalendarCollaborator[],
  areas: string[]
) {
  const active = people.filter((person) => person.isActive);
  if (areas.length === 0) return active;
  return active.filter((person) => {
    const department = normalizeArea(person.department);
    const roleArea = roleToArea(person.role);
    return areas.includes(department) || areas.includes(roleArea);
  });
}

function reminderMessage(event: CalendarEvent) {
  const when = [formatLongDate(event.eventDate), event.startTime]
    .filter(Boolean)
    .join(" · ");
  const place = event.location ? `\nLugar: ${event.location}` : "";
  const extra = event.description ? `\n${event.description}` : "";
  const lead =
    event.reminderDays === 1
      ? "Recordatorio para mañana"
      : `Recordatorio con ${event.reminderDays} días de anticipación`;
  return `${lead} — MAS\n\n${event.title}\n${when}${place}${extra}`;
}

function birthdayMessage(name: string) {
  return `¡Feliz cumpleaños, ${name}! Te deseamos un excelente día el equipo de Medical Advanced Supplies.`;
}

export function CalendarPanel() {
  const { canWrite, role } = usePermissions("calendario");
  const userArea = roleToArea(role);
  const isAdmin = role === "administrador";
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const [filter, setFilter] = useState<FilterId>("todos");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [people, setPeople] = useState<CalendarCollaborator[]>([]);
  const [reminders, setReminders] = useState<CalendarReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState(todayKey);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [visibleAreas, setVisibleAreas] = useState<string[]>([]);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);
  const [reminderDays, setReminderDays] = useState(1);
  const [composeEventId, setComposeEventId] = useState<string | null>(null);

  const cells = useMemo(
    () => monthGrid(cursor.year, cursor.month),
    [cursor.year, cursor.month]
  );

  async function refresh() {
    const [eventRows, maintenances, collaborators, reminderRows, equipment] =
      await Promise.all([
        getCalendarEvents(),
        getMaintenances(),
        getCalendarCollaborators(),
        getCalendarRemindersAll(),
        getInventoryItems({ kind: "equipo", includeInactive: true }),
      ]);

    const names = new Map(equipment.map((item) => [item.id, item.name]));
    const visibleEvents = eventRows.filter((event) =>
      eventVisibleToArea(event, userArea, isAdmin)
    );
    const built: CalendarItem[] = [
      ...visibleEvents.map((event) => ({
        id: `evento-${event.id}`,
        kind: "evento" as const,
        date: event.eventDate,
        title: event.title,
        subtitle:
          event.visibleAreas.length === 0
            ? "Visible para todas las áreas"
            : event.visibleAreas.map(areaLabel).join(", "),
        time: [event.startTime, event.endTime].filter(Boolean).join(" – "),
        areas: event.visibleAreas,
        sourceId: event.id,
      })),
      ...maintenances
        .filter((row) => row.status !== "cancelado")
        .map((row) => ({
          id: `mto-${row.id}`,
          kind: "mantenimiento" as const,
          date: row.scheduledDate,
          title: `${row.maintenanceType === "calibracion" ? "Calibración" : row.maintenanceType === "correctivo" ? "Correctivo" : "Preventivo"} · ${names.get(row.equipmentId) ?? "Equipo"}`,
          subtitle: [row.technician, row.status.replace("_", " ")]
            .filter(Boolean)
            .join(" · "),
          time: "",
          areas: ["servicio", "almacen"],
          sourceId: row.id,
        })),
    ];

    for (const person of collaborators) {
      if (!person.isActive || !person.birthDate) continue;
      const date = birthdayOnYear(person.birthDate, cursor.year);
      if (!date) continue;
      const years = ageOnYear(person.birthDate, cursor.year);
      built.push({
        id: `bday-${person.id}-${cursor.year}`,
        kind: "cumpleanos",
        date,
        title: person.fullName,
        subtitle: [
          years ? `Cumple ${years} años` : "Cumpleaños",
          person.department || areaLabel(roleToArea(person.role)),
        ]
          .filter(Boolean)
          .join(" · "),
        time: "",
        areas: [normalizeArea(person.department) || roleToArea(person.role)],
        sourceId: person.id,
      });
    }

    setEvents(visibleEvents);
    setPeople(collaborators);
    setReminders(reminderRows);
    setItems(built);
  }

  useEffect(() => {
    setLoading(true);
    void refresh()
      .catch((err) =>
        setError(
          err instanceof Error ? err.message : "No se pudo cargar el calendario"
        )
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor.year, role]);

  const filtered = items.filter((item) =>
    filter === "todos" ? true : item.kind === filter
  );
  const byDay = new Map<string, CalendarItem[]>();
  for (const item of filtered) {
    const list = byDay.get(item.date) ?? [];
    list.push(item);
    byDay.set(item.date, list);
  }
  const selectedItems = byDay.get(selectedDay) ?? [];
  const upcoming = filtered
    .filter((item) => item.date >= todayKey() && item.date.slice(0, 7) === `${cursor.year}-${pad(cursor.month + 1)}`)
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
    .slice(0, 12);

  const composeEvent = events.find((event) => event.id === composeEventId) ?? null;
  const composeReminders = reminders.filter(
    (row) => row.eventId === composeEventId
  );

  function openCreate(day = selectedDay) {
    setTitle("");
    setDescription("");
    setEventDate(day);
    setStartTime("");
    setEndTime("");
    setLocation("");
    setVisibleAreas([]);
    setNotifyEmail(true);
    setNotifyWhatsapp(true);
    setReminderDays(1);
    setFormOpen(true);
  }

  function toggleArea(id: string) {
    setVisibleAreas((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const session = getSession();
      const created = await createCalendarEvent({
        title,
        description,
        eventDate,
        startTime,
        endTime,
        location,
        visibleAreas,
        notifyEmail,
        notifyWhatsapp,
        reminderDays,
        createdBy: session?.username ?? "",
      });
      const recipients = collaboratorsForAreas(people, visibleAreas);
      const message = reminderMessage(created);
      const rows: Array<{
        eventId: string;
        channel: "email" | "whatsapp";
        recipientName: string;
        recipientTarget: string;
        message: string;
      }> = [];
      for (const person of recipients) {
        if (notifyEmail && person.email.includes("@")) {
          rows.push({
            eventId: created.id,
            channel: "email",
            recipientName: person.fullName,
            recipientTarget: person.email,
            message,
          });
        }
        if (notifyWhatsapp && person.phone.replace(/\D/g, "").length >= 10) {
          rows.push({
            eventId: created.id,
            channel: "whatsapp",
            recipientName: person.fullName,
            recipientTarget: person.phone,
            message,
          });
        }
      }
      if (rows.length > 0) {
        await createCalendarReminders(rows);
      }
      setFormOpen(false);
      setSelectedDay(eventDate);
      setComposeEventId(created.id);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar el evento"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setError("");
    try {
      await deleteCalendarEvent(id);
      if (composeEventId === id) setComposeEventId(null);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo eliminar el evento"
      );
    }
  }

  async function sendEmails(rows: CalendarReminder[]) {
    const pending = rows.filter(
      (row) => row.channel === "email" && row.status === "pendiente"
    );
    if (pending.length === 0) return;
    const href = mailtoHref(
      pending.map((row) => row.recipientTarget),
      pending[0].message.split("\n")[0] || "Recordatorio MAS",
      pending[0].message
    );
    window.open(href, "_blank");
    await Promise.all(pending.map((row) => markReminderSent(row.id)));
    await refresh();
  }

  async function sendWhatsapp(row: CalendarReminder) {
    window.open(whatsappHref(row.recipientTarget, row.message), "_blank");
    await markReminderSent(row.id);
    await refresh();
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Cargando calendario...</p>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <ReadOnlyBanner visible={!canWrite} />
      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Calendario operativo</h2>
            <p className="text-sm text-muted-foreground">
              Servicios de mantenimiento, cumpleaños del equipo y eventos con
              aviso por correo o WhatsApp.
            </p>
          </div>
          {canWrite ? (
            <Button
              onClick={() => openCreate(selectedDay)}
              className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90"
            >
              <Plus className="size-4" />
              Nuevo evento
            </Button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["todos", "Todos"],
              ["mantenimiento", "Mantenimientos"],
              ["cumpleanos", "Cumpleaños"],
              ["evento", "Eventos"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium",
                filter === id
                  ? "border-transparent bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                  : "border-border bg-background text-muted-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
        <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-xl border border-border hover:bg-muted"
              onClick={() =>
                setCursor((current) => {
                  const date = new Date(current.year, current.month - 1, 1);
                  return { year: date.getFullYear(), month: date.getMonth() };
                })
              }
              aria-label="Mes anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="text-center">
              <p className="text-base font-semibold capitalize">
                {MONTHS[cursor.month]} {cursor.year}
              </p>
              <button
                type="button"
                className="text-xs text-[#00BFFF] hover:underline"
                onClick={() => {
                  const now = new Date();
                  setCursor({ year: now.getFullYear(), month: now.getMonth() });
                  setSelectedDay(todayKey());
                }}
              >
                Ir a hoy
              </button>
            </div>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-xl border border-border hover:bg-muted"
              onClick={() =>
                setCursor((current) => {
                  const date = new Date(current.year, current.month + 1, 1);
                  return { year: date.getFullYear(), month: date.getMonth() };
                })
              }
              aria-label="Mes siguiente"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              const dayItems = byDay.get(cell.key) ?? [];
              const isSelected = cell.key === selectedDay;
              const isToday = cell.key === todayKey();
              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => {
                    setSelectedDay(cell.key);
                    setCursor({
                      year: Number(cell.key.slice(0, 4)),
                      month: Number(cell.key.slice(5, 7)) - 1,
                    });
                  }}
                  className={cn(
                    "min-h-[4.6rem] rounded-xl border p-1.5 text-left transition-colors sm:min-h-[5.5rem]",
                    cell.inMonth
                      ? "border-border bg-background"
                      : "border-transparent bg-muted/40 text-muted-foreground",
                    isSelected && "ring-2 ring-[#3B46A5]",
                    isToday && "border-[#00BFFF]"
                  )}
                >
                  <span className="text-xs font-semibold">{cell.day}</span>
                  <div className="mt-1 space-y-0.5">
                    {dayItems.slice(0, 3).map((item) => (
                      <p
                        key={item.id}
                        className={cn(
                          "truncate rounded px-1 py-0.5 text-[10px] leading-tight",
                          KIND_CLASS[item.kind]
                        )}
                      >
                        {item.title}
                      </p>
                    ))}
                    {dayItems.length > 3 ? (
                      <p className="text-[10px] text-muted-foreground">
                        +{dayItems.length - 3}
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{formatLongDate(selectedDay)}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedItems.length === 0
                    ? "Sin actividades este día."
                    : `${selectedItems.length} actividad${selectedItems.length === 1 ? "" : "es"}`}
                </p>
              </div>
              {canWrite ? (
                <Button variant="outline" size="sm" onClick={() => openCreate(selectedDay)}>
                  Agregar
                </Button>
              ) : null}
            </div>
            <ul className="mt-3 space-y-2">
              {selectedItems.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-border px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {KIND_LABEL[item.kind]}
                        {item.time ? ` · ${item.time}` : ""}
                      </p>
                      {item.subtitle ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.subtitle}
                        </p>
                      ) : null}
                    </div>
                    {item.kind === "evento" && item.sourceId ? (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setComposeEventId(item.sourceId ?? null)}
                          aria-label="Recordatorios"
                        >
                          <Mail className="size-4" />
                        </Button>
                        {canWrite ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => void handleDelete(item.sourceId!)}
                            aria-label="Eliminar evento"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    {item.kind === "cumpleanos" && item.sourceId ? (
                      <BirthdayActions
                        person={people.find((row) => row.id === item.sourceId)}
                      />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="font-semibold">Próximo en este mes</h3>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No hay actividades pendientes en {MONTHS[cursor.month]}.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {upcoming.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedDay(item.date)}
                      className="flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-muted"
                    >
                      {item.kind === "mantenimiento" ? (
                        <Wrench className="mt-0.5 size-4 text-sky-600" />
                      ) : item.kind === "cumpleanos" ? (
                        <Cake className="mt-0.5 size-4 text-rose-600" />
                      ) : (
                        <CalendarDays className="mt-0.5 size-4 text-violet-600" />
                      )}
                      <span>
                        <span className="block text-sm font-medium">
                          {item.title}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {formatLongDate(item.date)}
                          {item.time ? ` · ${item.time}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {composeEvent ? (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-semibold">Recordatorios · {composeEvent.title}</h3>
              <p className="text-sm text-muted-foreground">
                {formatLongDate(composeEvent.eventDate)}
                {composeEvent.location ? ` · ${composeEvent.location}` : ""}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setComposeEventId(null)}>
              Cerrar
            </Button>
          </div>
          {composeReminders.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Este evento no tiene destinatarios con correo o WhatsApp en las
              áreas seleccionadas.
            </p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => void sendEmails(composeReminders)}
                >
                  <Mail className="size-4" />
                  Enviar correos pendientes
                </Button>
              </div>
              <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
                {composeReminders.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">{row.recipientName}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.channel === "email" ? "Correo" : "WhatsApp"} ·{" "}
                        {row.recipientTarget} · {row.status}
                      </p>
                    </div>
                    {row.channel === "whatsapp" && row.status === "pendiente" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void sendWhatsapp(row)}
                      >
                        Abrir WhatsApp
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Los avisos se abren en tu correo o WhatsApp Web. No hay un
                servidor SMTP ni API de WhatsApp configurados en este entorno.
              </p>
            </>
          )}
        </section>
      ) : null}

      {formOpen ? (
        <ModalShell
          title="Nuevo evento"
          description="Elige fecha, áreas que lo verán y cómo se enviarán los recordatorios."
        >
          <form className="space-y-4" onSubmit={(event) => void handleCreate(event)}>
            <label className="block text-sm font-medium">
              Título
              <input
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={cn(inputClass, "mt-1")}
                placeholder="Junta de almacén, visita a cliente..."
              />
            </label>
            <label className="block text-sm font-medium">
              Descripción
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-1 min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm font-medium">
                Fecha
                <input
                  required
                  type="date"
                  value={eventDate}
                  onChange={(event) => setEventDate(event.target.value)}
                  className={cn(inputClass, "mt-1")}
                />
              </label>
              <label className="block text-sm font-medium">
                Inicio
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className={cn(inputClass, "mt-1")}
                />
              </label>
              <label className="block text-sm font-medium">
                Fin
                <input
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className={cn(inputClass, "mt-1")}
                />
              </label>
            </div>
            <label className="block text-sm font-medium">
              Lugar
              <span className="relative mt-1 block">
                <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  className={cn(inputClass, "pl-9")}
                  placeholder="Sala de juntas, almacén, cliente..."
                />
              </span>
            </label>

            <fieldset>
              <legend className="text-sm font-medium">
                Áreas que verán y recibirán el aviso
              </legend>
              <p className="mt-1 text-xs text-muted-foreground">
                Si no marcas ninguna, el evento queda visible para toda la
                empresa.
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {COMPANY_AREAS.map((area) => (
                  <label
                    key={area.id}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={visibleAreas.includes(area.id)}
                      onChange={() => toggleArea(area.id)}
                    />
                    {area.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifyEmail}
                  onChange={(event) => setNotifyEmail(event.target.checked)}
                />
                Correo electrónico
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={notifyWhatsapp}
                  onChange={(event) => setNotifyWhatsapp(event.target.checked)}
                />
                WhatsApp
              </label>
              <label className="block text-sm font-medium">
                Avisar con
                <select
                  value={reminderDays}
                  onChange={(event) =>
                    setReminderDays(Number(event.target.value))
                  }
                  className={cn(inputClass, "mt-1")}
                >
                  <option value={0}>El mismo día</option>
                  <option value={1}>1 día de anticipación</option>
                  <option value={2}>2 días</option>
                  <option value={3}>3 días</option>
                  <option value={7}>7 días</option>
                </select>
              </label>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white hover:opacity-90"
              >
                {saving ? "Guardando..." : "Crear evento"}
              </Button>
            </div>
          </form>
        </ModalShell>
      ) : null}
    </div>
  );
}

function BirthdayActions({ person }: { person?: CalendarCollaborator }) {
  if (!person) return null;
  const message = birthdayMessage(person.fullName);
  const mail = person.email.includes("@")
    ? mailtoHref([person.email], `Feliz cumpleaños, ${person.fullName}`, message)
    : "";
  const phone = person.phone.replace(/\D/g, "").length >= 10;
  if (!mail && !phone) return null;
  return (
    <div className="flex shrink-0 gap-1">
      {mail ? (
        <a
          href={mail}
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          aria-label="Felicitación por correo"
        >
          <Mail className="size-4" />
        </a>
      ) : null}
      {phone ? (
        <a
          href={whatsappHref(person.phone, message)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          WhatsApp
        </a>
      ) : null}
    </div>
  );
}
