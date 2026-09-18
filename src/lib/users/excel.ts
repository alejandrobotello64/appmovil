import * as XLSX from "xlsx";
import { normalizeRole, type AppRole } from "@/lib/auth/permissions";

export const USER_EXCEL_HEADERS = [
  "usuario",
  "nombre",
  "rol",
  "correo",
  "telefono",
  "numero_empleado",
  "curp",
  "rfc",
  "puesto",
  "departamento",
  "fecha_ingreso",
  "fecha_nacimiento",
  "direccion",
  "tipo_sangre",
  "contacto_emergencia",
  "telefono_emergencia",
  "parentesco_emergencia",
  "notas",
  "activo",
  "password",
] as const;

export type UserExcelHeader = (typeof USER_EXCEL_HEADERS)[number];

export type UserExcelRow = {
  rowNumber: number;
  username: string;
  fullName: string;
  role: AppRole;
  email: string;
  phone: string;
  employeeNumber: string;
  curp: string;
  rfc: string;
  jobTitle: string;
  department: string;
  hireDate: string;
  birthDate: string;
  address: string;
  bloodType: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  notes: string;
  isActive: boolean;
  password: string;
};

export type ListedUserExcelSource = {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  email: string;
  phone: string;
  employee_number: string;
  curp: string;
  rfc: string;
  job_title: string;
  department: string;
  hire_date: string | null;
  birth_date: string | null;
  address: string;
  notes: string;
  blood_type: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
};

export type ParsedUserWorkbook = {
  rows: UserExcelRow[];
  errors: Array<{ row: number; username: string; message: string }>;
  sheetName: string;
  headers: string[];
};

const HEADER_ALIASES: Record<string, UserExcelHeader> = {
  usuario: "usuario",
  username: "usuario",
  user: "usuario",
  login: "usuario",
  nombre: "nombre",
  nombre_completo: "nombre",
  full_name: "nombre",
  name: "nombre",
  rol: "rol",
  role: "rol",
  perfil: "rol",
  correo: "correo",
  email: "correo",
  mail: "correo",
  telefono: "telefono",
  phone: "telefono",
  celular: "telefono",
  numero_empleado: "numero_empleado",
  no_empleado: "numero_empleado",
  employee_number: "numero_empleado",
  curp: "curp",
  rfc: "rfc",
  puesto: "puesto",
  job_title: "puesto",
  cargo: "puesto",
  departamento: "departamento",
  department: "departamento",
  area: "departamento",
  fecha_ingreso: "fecha_ingreso",
  hire_date: "fecha_ingreso",
  ingreso: "fecha_ingreso",
  fecha_nacimiento: "fecha_nacimiento",
  birth_date: "fecha_nacimiento",
  nacimiento: "fecha_nacimiento",
  direccion: "direccion",
  address: "direccion",
  tipo_sangre: "tipo_sangre",
  blood_type: "tipo_sangre",
  sangre: "tipo_sangre",
  contacto_emergencia: "contacto_emergencia",
  emergency_contact_name: "contacto_emergencia",
  telefono_emergencia: "telefono_emergencia",
  emergency_contact_phone: "telefono_emergencia",
  parentesco_emergencia: "parentesco_emergencia",
  emergency_contact_relation: "parentesco_emergencia",
  notas: "notas",
  notes: "notas",
  activo: "activo",
  is_active: "activo",
  active: "activo",
  password: "password",
  contrasena: "password",
  contraseña: "password",
  clave: "password",
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel serial date
    if (value > 20000 && value < 80000) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
      }
    }
    return String(value);
  }
  return String(value).trim();
}

function cellBool(value: unknown, fallback = true): boolean {
  const text = cellText(value).toLowerCase();
  if (!text) return fallback;
  if (["si", "sí", "yes", "true", "1", "activo", "active"].includes(text)) {
    return true;
  }
  if (["no", "false", "0", "inactivo", "inactive", "baja"].includes(text)) {
    return false;
  }
  return fallback;
}

function yesNo(value: boolean) {
  return value ? "si" : "no";
}

function downloadWorkbook(workbook: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(workbook, filename);
}

function userToExcelRecord(user: ListedUserExcelSource) {
  return {
    usuario: user.username,
    nombre: user.full_name ?? "",
    rol: normalizeRole(user.role),
    correo: user.email ?? "",
    telefono: user.phone ?? "",
    numero_empleado: user.employee_number ?? "",
    curp: user.curp ?? "",
    rfc: user.rfc ?? "",
    puesto: user.job_title ?? "",
    departamento: user.department ?? "",
    fecha_ingreso: user.hire_date ? String(user.hire_date).slice(0, 10) : "",
    fecha_nacimiento: user.birth_date
      ? String(user.birth_date).slice(0, 10)
      : "",
    direccion: user.address ?? "",
    tipo_sangre: user.blood_type ?? "",
    contacto_emergencia: user.emergency_contact_name ?? "",
    telefono_emergencia: user.emergency_contact_phone ?? "",
    parentesco_emergencia: user.emergency_contact_relation ?? "",
    notas: user.notes ?? "",
    activo: yesNo(user.is_active),
    password: "",
  };
}

function exampleRow() {
  return {
    usuario: "jperez",
    nombre: "Juan Pérez López",
    rol: "almacen",
    correo: "juan.perez@mas.mx",
    telefono: "9931234567",
    numero_empleado: "MAS-001",
    curp: "",
    rfc: "",
    puesto: "Auxiliar de almacén",
    departamento: "Almacén",
    fecha_ingreso: "2024-01-15",
    fecha_nacimiento: "1990-05-20",
    direccion: "Villahermosa, Tabasco",
    tipo_sangre: "O+",
    contacto_emergencia: "María Pérez",
    telefono_emergencia: "9937654321",
    parentesco_emergencia: "Madre",
    notas: "",
    activo: "si",
    password: "Temporal123",
  };
}

function withInstructionSheet(workbook: XLSX.WorkBook) {
  const lines = [
    ["Plantilla de colaboradores MAS"],
    ["1. Completa la hoja Usuarios. La primera fila son encabezados."],
    ["2. usuario y nombre son obligatorios."],
    [
      "3. rol: administrador, almacen, compras, ventas, servicio, direccion.",
    ],
    [
      "4. password: obligatorio al crear un usuario nuevo (mín. 6 caracteres). En actualización déjalo vacío para no cambiarla.",
    ],
    ["5. activo: si / no. Controla si puede iniciar sesión."],
    ["6. Fechas en formato AAAA-MM-DD."],
    [
      "7. Puedes exportar la lista, editarla en Excel y volver a importarla. Los usuarios existentes se actualizan por nombre de usuario.",
    ],
  ];
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(lines),
    "Instrucciones"
  );
}

export function downloadUserTemplate() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet([exampleRow()], {
    header: [...USER_EXCEL_HEADERS],
  });
  XLSX.utils.book_append_sheet(workbook, sheet, "Usuarios");
  withInstructionSheet(workbook);
  downloadWorkbook(workbook, "plantilla-usuarios-mas.xlsx");
}

export function exportUsersToExcel(
  users: ListedUserExcelSource[],
  filename?: string
) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(users.map(userToExcelRecord), {
    header: [...USER_EXCEL_HEADERS],
  });
  XLSX.utils.book_append_sheet(workbook, sheet, "Usuarios");
  withInstructionSheet(workbook);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadWorkbook(workbook, filename ?? `usuarios-mas-${stamp}.xlsx`);
}

function pickSheetName(workbook: XLSX.WorkBook): string | undefined {
  const names = workbook.SheetNames;
  if (names.length === 0) return undefined;
  const skip = (name: string) =>
    /instrucc|instruction|ayuda|readme/i.test(name);
  return (
    names.find((name) => /usuario|user|colabor/i.test(name) && !skip(name)) ??
    names.find((name) => !skip(name)) ??
    names[0]
  );
}

export async function parseUserWorkbook(file: File): Promise<ParsedUserWorkbook> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = pickSheetName(workbook);
  if (!sheetName) {
    throw new Error("El archivo no tiene hojas legibles.");
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
    sheet,
    { header: 1, defval: "", raw: true }
  ) as unknown[][];

  if (!matrix.length) {
    return { rows: [], errors: [], sheetName, headers: [] };
  }

  const headerRow = (matrix[0] ?? []).map((cell) => normalizeHeader(cell));
  const headers = headerRow.filter(Boolean);
  const columnMap = new Map<number, UserExcelHeader>();
  headerRow.forEach((header, index) => {
    const mapped = HEADER_ALIASES[header];
    if (mapped) columnMap.set(index, mapped);
  });

  if (![...columnMap.values()].includes("usuario")) {
    throw new Error(
      'No se encontró la columna "usuario". Descarga la plantilla MAS.'
    );
  }

  const rows: UserExcelRow[] = [];
  const errors: ParsedUserWorkbook["errors"] = [];
  const seen = new Set<string>();

  for (let i = 1; i < matrix.length; i++) {
    const raw = matrix[i] ?? [];
    if (raw.every((cell) => cellText(cell) === "")) continue;

    const record: Partial<Record<UserExcelHeader, string>> = {};
    columnMap.forEach((key, index) => {
      record[key] = cellText(raw[index]);
    });

    const rowNumber = i + 1;
    const username = (record.usuario ?? "").toLowerCase().trim();
    const fullName = (record.nombre ?? "").trim();

    if (!username) {
      errors.push({
        row: rowNumber,
        username: "",
        message: "El usuario es obligatorio.",
      });
      continue;
    }
    if (!fullName) {
      errors.push({
        row: rowNumber,
        username,
        message: "El nombre completo es obligatorio.",
      });
      continue;
    }
    if (seen.has(username)) {
      errors.push({
        row: rowNumber,
        username,
        message: "Usuario duplicado en el archivo.",
      });
      continue;
    }
    seen.add(username);

    let role: AppRole = "almacen";
    try {
      role = normalizeRole(record.rol || "almacen");
    } catch {
      role = "almacen";
    }

    rows.push({
      rowNumber,
      username,
      fullName,
      role,
      email: record.correo ?? "",
      phone: record.telefono ?? "",
      employeeNumber: record.numero_empleado ?? "",
      curp: (record.curp ?? "").toUpperCase(),
      rfc: (record.rfc ?? "").toUpperCase(),
      jobTitle: record.puesto ?? "",
      department: record.departamento ?? "",
      hireDate: record.fecha_ingreso ?? "",
      birthDate: record.fecha_nacimiento ?? "",
      address: record.direccion ?? "",
      bloodType: (record.tipo_sangre ?? "").toUpperCase(),
      emergencyContactName: record.contacto_emergencia ?? "",
      emergencyContactPhone: record.telefono_emergencia ?? "",
      emergencyContactRelation: record.parentesco_emergencia ?? "",
      notes: record.notas ?? "",
      isActive: cellBool(record.activo, true),
      password: record.password ?? "",
    });
  }

  return { rows, errors, sheetName, headers };
}
