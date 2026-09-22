export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string;
  visibleAreas: string[];
  notifyEmail: boolean;
  notifyWhatsapp: boolean;
  reminderDays: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CalendarEventInput = {
  title: string;
  description: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string;
  visibleAreas: string[];
  notifyEmail: boolean;
  notifyWhatsapp: boolean;
  reminderDays: number;
  createdBy?: string;
};

export type CalendarReminder = {
  id: string;
  eventId: string;
  channel: "email" | "whatsapp";
  recipientName: string;
  recipientTarget: string;
  message: string;
  status: "pendiente" | "enviado" | "fallido";
  sentAt: string;
  createdAt: string;
};

export type CalendarItemKind =
  | "mantenimiento"
  | "servicio"
  | "cumpleanos"
  | "aniversario"
  | "evento"
  | "descanso"
  | "fiesta_patria"
  | "licitacion";

export type CalendarItem = {
  id: string;
  kind: CalendarItemKind;
  date: string;
  title: string;
  subtitle: string;
  time: string;
  areas: string[];
  sourceId?: string;
};
