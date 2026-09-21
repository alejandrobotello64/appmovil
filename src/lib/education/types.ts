export { COMPANY_BRAND } from "@/lib/brand/company";

export const TRAINING_SHIFTS = [
  { id: "matutino", label: "Matutino" },
  { id: "vespertino", label: "Vespertino" },
  { id: "nocturno", label: "Nocturno" },
  { id: "mixto", label: "Mixto" },
  { id: "fin_semana", label: "Fin de semana" },
  { id: "otro", label: "Otro" },
] as const;

export type TrainingShift = (typeof TRAINING_SHIFTS)[number]["id"];

export type EducationTrainingPhoto = {
  id: string;
  trainingId: string;
  caption: string;
  filePath: string;
  fileUrl: string;
  uploadedBy: string;
  createdAt: string;
};

export type EducationAttendee = {
  id: string;
  trainingId: string;
  fullName: string;
  shift: string;
  phone: string;
  jobTitle: string;
  employeeNumber: string;
  signaturePath: string;
  signatureUrl: string;
  notes: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EducationTraining = {
  id: string;
  folio: string;
  name: string;
  trainingDate: string;
  location: string;
  instructor: string;
  clientName: string;
  durationHours: number | null;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  attendees: EducationAttendee[];
  photos: EducationTrainingPhoto[];
};

export type EducationTrainingInput = {
  name: string;
  trainingDate?: string;
  location?: string;
  instructor?: string;
  clientName?: string;
  durationHours?: number | null;
  notes?: string;
  createdBy?: string;
};

export type EducationAttendeeInput = {
  fullName: string;
  shift?: string;
  phone?: string;
  jobTitle?: string;
  employeeNumber?: string;
  notes?: string;
  sortOrder?: number;
};

export function trainingShiftLabel(shift: string) {
  return (
    TRAINING_SHIFTS.find((item) => item.id === shift)?.label ??
    (shift.trim() || "—")
  );
}
