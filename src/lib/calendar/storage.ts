import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type {
  CalendarEvent,
  CalendarEventInput,
  CalendarReminder,
} from "./types";

type EventRow = Database["public"]["Tables"]["calendar_events"]["Row"];
type ReminderRow = Database["public"]["Tables"]["calendar_reminders"]["Row"];

function mapEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    eventDate: row.event_date,
    startTime: row.start_time ?? "",
    endTime: row.end_time ?? "",
    location: row.location ?? "",
    visibleAreas: row.visible_areas ?? [],
    notifyEmail: Boolean(row.notify_email),
    notifyWhatsapp: Boolean(row.notify_whatsapp),
    reminderDays: row.reminder_days ?? 1,
    createdBy: row.created_by ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReminder(row: ReminderRow): CalendarReminder {
  return {
    id: row.id,
    eventId: row.event_id,
    channel: row.channel as CalendarReminder["channel"],
    recipientName: row.recipient_name ?? "",
    recipientTarget: row.recipient_target ?? "",
    message: row.message ?? "",
    status: row.status as CalendarReminder["status"],
    sentAt: row.sent_at ?? "",
    createdAt: row.created_at,
  };
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .order("event_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapEvent);
}

export async function createCalendarEvent(
  input: CalendarEventInput
): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      title: input.title.trim(),
      description: input.description.trim(),
      event_date: input.eventDate,
      start_time: input.startTime.trim(),
      end_time: input.endTime.trim(),
      location: input.location.trim(),
      visible_areas: input.visibleAreas,
      notify_email: input.notifyEmail,
      notify_whatsapp: input.notifyWhatsapp,
      reminder_days: input.reminderDays,
      created_by: input.createdBy ?? "",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapEvent(data);
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type CalendarCollaborator = {
  id: string;
  fullName: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  birthDate: string;
  isActive: boolean;
};

export async function getCalendarCollaborators(): Promise<CalendarCollaborator[]> {
  const { data, error } = await supabase.rpc("list_app_users");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: (row.full_name ?? "").trim() || row.username,
    role: row.role,
    department: row.department ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    birthDate: row.birth_date ?? "",
    isActive: Boolean(row.is_active),
  }));
}

export async function getCalendarRemindersAll(): Promise<CalendarReminder[]> {
  const { data, error } = await supabase
    .from("calendar_reminders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapReminder);
}

export async function getCalendarReminders(
  eventId: string
): Promise<CalendarReminder[]> {
  const { data, error } = await supabase
    .from("calendar_reminders")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapReminder);
}

export async function createCalendarReminders(
  rows: Array<{
    eventId: string;
    channel: "email" | "whatsapp";
    recipientName: string;
    recipientTarget: string;
    message: string;
  }>
): Promise<CalendarReminder[]> {
  if (rows.length === 0) return [];
  const { data, error } = await supabase
    .from("calendar_reminders")
    .insert(
      rows.map((row) => ({
        event_id: row.eventId,
        channel: row.channel,
        recipient_name: row.recipientName,
        recipient_target: row.recipientTarget,
        message: row.message,
        status: "pendiente",
      }))
    )
    .select("*");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapReminder);
}

export async function markReminderSent(id: string): Promise<void> {
  const { error } = await supabase
    .from("calendar_reminders")
    .update({ status: "enviado", sent_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export function whatsappHref(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  const n =
    digits.length === 10 ? `52${digits}` : digits.replace(/^0+/, "");
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

export function mailtoHref(emails: string[], subject: string, body: string) {
  const bcc = emails.filter(Boolean).join(",");
  return `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
