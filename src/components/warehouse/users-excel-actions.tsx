"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  downloadUserTemplate,
  exportUsersToExcel,
  parseUserWorkbook,
  type ListedUserExcelSource,
  type UserExcelRow,
} from "@/lib/users/excel";
import { bulkImportUsers } from "@/lib/users/bulk-import";

type UsersExcelActionsProps = {
  users: ListedUserExcelSource[];
  canWrite: boolean;
  onImported: () => Promise<void>;
  onError: (message: string) => void;
  onMessage?: (message: string) => void;
};

export function UsersExcelActions({
  users,
  canWrite,
  onImported,
  onError,
  onMessage,
}: UsersExcelActionsProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [progress, setProgress] = useState("");
  const [preview, setPreview] = useState<UserExcelRow[]>([]);
  const [parseErrors, setParseErrors] = useState<
    Array<{ row: number; username: string; message: string }>
  >([]);
  const [result, setResult] = useState("");

  function handleExport() {
    try {
      exportUsersToExcel(users);
      onMessage?.(`Exportados ${users.length} colaboradores a Excel.`);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "No se pudo exportar el Excel."
      );
    }
  }

  async function handleFile(file: File) {
    setBusy(true);
    setResult("");
    setFileName(file.name);
    try {
      const parsed = await parseUserWorkbook(file);
      setPreview(parsed.rows);
      setParseErrors(parsed.errors);
      setSheetName(parsed.sheetName);
      setHeaders(parsed.headers.filter(Boolean));
      setOpen(true);
      if (parsed.rows.length === 0 && parsed.errors.length === 0) {
        onError("El archivo no tiene usuarios para importar.");
      }
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : "No se pudo leer el archivo de Excel."
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleImport() {
    if (preview.length === 0) return;
    setBusy(true);
    setResult("");
    setProgress("");
    try {
      const existingByUsername = new Map(
        users.map((user) => [
          user.username.toLowerCase(),
          { id: user.id, is_active: user.is_active },
        ])
      );
      const outcome = await bulkImportUsers(
        preview,
        existingByUsername,
        (done, total) => setProgress(`${done} / ${total}`)
      );
      const parts = [
        outcome.created ? `${outcome.created} nuevos` : "",
        outcome.updated ? `${outcome.updated} actualizados` : "",
      ].filter(Boolean);
      const extra =
        outcome.errors.length > 0
          ? ` · ${outcome.errors.length} con error`
          : "";
      const summary =
        parts.length > 0
          ? `Listo: ${parts.join(", ")}${extra}.`
          : `No se importó ningún usuario${extra}.`;
      setResult(summary);
      onMessage?.(summary);
      if (outcome.errors.length > 0) {
        setParseErrors(
          outcome.errors.map((item) => ({
            row: 0,
            username: item.username,
            message: item.message,
          }))
        );
      }
      await onImported();
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : "No se pudo importar la lista de usuarios."
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <Button type="button" variant="outline" className="h-10" onClick={handleExport}>
        <Download className="size-4" />
        Descargar Excel
      </Button>

      {canWrite ? (
        <>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={downloadUserTemplate}
          >
            <FileSpreadsheet className="size-4" />
            Plantilla
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-4" />
            {busy ? "Leyendo..." : "Carga masiva"}
          </Button>
        </>
      ) : null}

      {open ? (
        <ModalShell
          title="Importar usuarios Excel"
          description="Crea o actualiza colaboradores por nombre de usuario. Los nuevos requieren password."
          className="max-w-3xl"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Archivo:{" "}
              <span className="font-medium text-foreground">{fileName}</span>
              {sheetName ? ` · hoja ${sheetName}` : ""}
              {" · "}
              {preview.length} fila{preview.length === 1 ? "" : "s"} lista
              {preview.length === 1 ? "" : "s"} para importar.
            </p>
            {headers.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Columnas detectadas: {headers.join(", ")}
              </p>
            ) : null}
            {progress ? (
              <p className="text-sm text-foreground">Importando {progress}...</p>
            ) : null}

            {preview.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Usuario</th>
                      <th className="px-3 py-2 font-medium">Nombre</th>
                      <th className="px-3 py-2 font-medium">Rol</th>
                      <th className="px-3 py-2 font-medium">Activo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 8).map((row) => (
                      <tr
                        key={`${row.username}-${row.rowNumber}`}
                        className="border-t border-border/70"
                      >
                        <td className="px-3 py-2 font-mono text-xs">
                          {row.username}
                        </td>
                        <td className="px-3 py-2">{row.fullName}</td>
                        <td className="px-3 py-2">{row.role}</td>
                        <td className="px-3 py-2">
                          {row.isActive ? "Sí" : "No"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 8 ? (
                  <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                    Y {preview.length - 8} más...
                  </p>
                ) : null}
              </div>
            ) : null}

            {parseErrors.length > 0 ? (
              <ul className="space-y-1 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {parseErrors.slice(0, 40).map((item, index) => (
                  <li key={`${item.username}-${item.row}-${index}`}>
                    {item.row ? `Fila ${item.row}` : item.username || "Error"}:{" "}
                    {item.message}
                  </li>
                ))}
              </ul>
            ) : null}

            {result ? (
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                {result}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setPreview([]);
                  setParseErrors([]);
                  setResult("");
                  setProgress("");
                  setHeaders([]);
                  setSheetName("");
                }}
              >
                Cerrar
              </Button>
              <Button
                type="button"
                disabled={busy || preview.length === 0}
                onClick={() => void handleImport()}
                className="border-0 bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
              >
                {busy
                  ? progress
                    ? `Importando ${progress}`
                    : "Importando..."
                  : `Importar ${preview.length}`}
              </Button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}
