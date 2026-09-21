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
  isActive?: boolean;
  createdBy?: string;
};

export function biomedicalInstrumentTypeLabel(type: string) {
  return (
    BIOMEDICAL_INSTRUMENT_TYPES.find((t) => t.id === type)?.label ?? type
  );
}
