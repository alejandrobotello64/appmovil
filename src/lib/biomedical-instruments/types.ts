export const BIOMEDICAL_INSTRUMENT_TYPES = [
  {
    id: "seguridad_electrica",
    label: "Seguridad eléctrica",
    description: "Analizadores / equipos de seguridad eléctrica",
  },
  {
    id: "simulador",
    label: "Simulador",
    description: "Simuladores de paciente u otros",
  },
  {
    id: "analizador",
    label: "Analizador",
    description: "Analizadores de gases, flujo, etc.",
  },
] as const;

export type BiomedicalInstrumentType =
  (typeof BIOMEDICAL_INSTRUMENT_TYPES)[number]["id"];

export type BiomedicalInstrument = {
  id: string;
  instrumentType: BiomedicalInstrumentType;
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  assetTag: string;
  location: string;
  notes: string;
  imagePath: string;
  imageUrl: string;
  certificatePath: string;
  certificateUrl: string;
  certificateName: string;
  certificateNumber: string;
  certificateExpiresAt: string;
  nextCalibrationAt: string;
  calibrationEventId: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type BiomedicalInstrumentInput = {
  instrumentType: BiomedicalInstrumentType;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  assetTag?: string;
  location?: string;
  notes?: string;
  certificateNumber?: string;
  certificateExpiresAt?: string;
  nextCalibrationAt?: string;
  isActive?: boolean;
  createdBy?: string;
};

export function biomedicalInstrumentTypeLabel(type: string) {
  return (
    BIOMEDICAL_INSTRUMENT_TYPES.find((t) => t.id === type)?.label ?? type
  );
}

/** Servicio en el que se usó un simulador o analizador. */
export type InstrumentServiceUse = {
  id: string;
  serviceOrderId: string;
  instrumentId: string | null;
  instrumentSerial: string;
  usageNotes: string;
  folio: string;
  status: string;
  serviceType: string;
  orderKind: string;
  technician: string;
  clientName: string;
  equipmentName: string;
  equipmentSerial: string;
  receptionAt: string;
  createdAt: string;
};

/** Servicios del equipo, por id o por serie cuando el vínculo no guardó el id. */
export function usesForInstrument(item: BiomedicalInstrument, uses: InstrumentServiceUse[]) {
  const serial = item.serialNumber.trim().toLowerCase();
  const seen = new Set<string>();
  return uses.filter((use) => {
    const byId = use.instrumentId === item.id;
    const bySerial =
      !use.instrumentId && serial.length > 0 && use.instrumentSerial.trim().toLowerCase() === serial;
    if (!byId && !bySerial) return false;
    if (seen.has(use.serviceOrderId)) return false;
    seen.add(use.serviceOrderId);
    return true;
  });
}
