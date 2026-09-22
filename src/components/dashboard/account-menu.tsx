"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Camera, KeyRound, Settings, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  createSession,
  getSession,
  type SessionData,
} from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import {
  removeUserPhoto,
  setUserPhotoUrl,
  uploadUserPhoto,
} from "@/lib/users/photo";
import { cn } from "@/lib/utils";
import { FlagCheckbox } from "@/components/ui/flag-checkbox";

const BLOOD_TYPES = ["", "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"] as const;

const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none";

type ProfileForm = {
  fullName: string;
  email: string;
  phone: string;
  curp: string;
  rfc: string;
  birthDate: string;
  address: string;
  bloodType: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  notes: string;
  isTechnician: boolean;
  isServiceAdvisor: boolean;
};

const EMPTY_PROFILE: ProfileForm = {
  fullName: "",
  email: "",
  phone: "",
  curp: "",
  rfc: "",
  birthDate: "",
  address: "",
  bloodType: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",
  notes: "",
  isTechnician: false,
  isServiceAdvisor: false,
};

type AccountMenuProps = {
  username: string;
  onSessionUpdated?: (session: SessionData) => void;
};

export function AccountMenu({ username, onSessionUpdated }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"menu" | "profile" | "password" | null>(
    null
  );
  const [profile, setProfile] = useState<ProfileForm>(EMPTY_PROFILE);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function updateMenuPosition() {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updateMenuPosition();
    function onReposition() {
      updateMenuPosition();
    }
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview("");
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  async function loadProfile() {
    const session = getSession();
    if (!session) return;
    setLoadingProfile(true);
    setError("");
    setPhotoFile(null);
    setRemovePhoto(false);
    try {
      const { data, error: rpcError } = await supabase.rpc("get_app_user_by_id", {
        p_user_id: session.id,
      });
      if (rpcError) throw new Error(rpcError.message);
      const row = data?.[0];
      if (!row) throw new Error("No se encontró tu ficha de usuario.");
      setProfile({
        fullName: row.full_name ?? "",
        email: row.email ?? "",
        phone: row.phone ?? "",
        curp: row.curp ?? "",
        rfc: row.rfc ?? "",
        birthDate: row.birth_date ? String(row.birth_date).slice(0, 10) : "",
        address: row.address ?? "",
        bloodType: row.blood_type ?? "",
        emergencyContactName: row.emergency_contact_name ?? "",
        emergencyContactPhone: row.emergency_contact_phone ?? "",
        emergencyContactRelation: row.emergency_contact_relation ?? "",
        notes: row.notes ?? "",
        isTechnician: Boolean(row.is_technician),
        isServiceAdvisor: Boolean(row.is_service_advisor),
      });
      setPhotoUrl(row.photo_url ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el perfil.");
    } finally {
      setLoadingProfile(false);
    }
  }

  function openPanel(next: "profile" | "password") {
    setOpen(false);
    setPanel(next);
    setError("");
    setMessage("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    if (next === "profile") void loadProfile();
  }

  function closePanel() {
    setPanel(null);
    setError("");
    setMessage("");
  }

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault();
    const session = getSession();
    if (!session) return;
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const { data, error: rpcError } = await supabase.rpc("update_own_profile", {
        p_user_id: session.id,
        p_full_name: profile.fullName.trim(),
        p_email: profile.email.trim(),
        p_phone: profile.phone.trim(),
        p_curp: profile.curp.trim(),
        p_rfc: profile.rfc.trim(),
        p_birth_date: profile.birthDate || null,
        p_address: profile.address.trim(),
        p_blood_type: profile.bloodType.trim(),
        p_emergency_contact_name: profile.emergencyContactName.trim(),
        p_emergency_contact_phone: profile.emergencyContactPhone.trim(),
        p_emergency_contact_relation: profile.emergencyContactRelation.trim(),
        p_notes: profile.notes.trim(),
        p_is_technician: profile.isTechnician,
        p_is_service_advisor: profile.isServiceAdvisor,
      });
      if (rpcError) throw new Error(rpcError.message);
      let nextPhoto = session.photoUrl ?? "";
      if (removePhoto && !photoFile) {
        await removeUserPhoto(session.id);
        nextPhoto = "";
        setPhotoUrl("");
        setRemovePhoto(false);
      } else if (photoFile) {
        nextPhoto = await uploadUserPhoto(session.id, photoFile);
        await setUserPhotoUrl(session.id, nextPhoto);
        setPhotoUrl(nextPhoto);
        setPhotoFile(null);
      }
      const updated = data?.[0];
      if (updated) {
        const nextSession: SessionData = {
          ...session,
          fullName: updated.full_name,
          username: updated.username,
          role: updated.role,
          photoUrl: nextPhoto,
        };
        createSession({
          id: nextSession.id,
          username: nextSession.username,
          fullName: nextSession.fullName,
          role: nextSession.role,
          photoUrl: nextSession.photoUrl,
        });
        onSessionUpdated?.(nextSession);
      }
      setMessage("Datos personales actualizados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los datos.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    const session = getSession();
    if (!session) return;
    if (newPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("La confirmación no coincide con la nueva contraseña.");
      return;
    }
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const { error: rpcError } = await supabase.rpc("change_own_password", {
        p_user_id: session.id,
        p_current_password: currentPassword,
        p_new_password: newPassword,
      });
      if (rpcError) throw new Error(rpcError.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Contraseña actualizada correctamente.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo cambiar la contraseña."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div ref={rootRef} className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="touch-target inline-flex size-11 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted sm:size-9"
          aria-label="Configuración de cuenta"
          aria-expanded={open}
        >
          <Settings className="size-4" />
        </button>
      </div>

      {open && menuPos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[110] w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              <div className="border-b border-border px-3 py-2">
                <p className="truncate text-xs text-muted-foreground">Sesión</p>
                <p className="truncate text-sm font-medium">{username}</p>
              </div>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted"
                onClick={() => openPanel("profile")}
              >
                <UserRound className="size-4 text-muted-foreground" />
                Datos personales
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted"
                onClick={() => openPanel("password")}
              >
                <KeyRound className="size-4 text-muted-foreground" />
                Cambiar contraseña
              </button>
            </div>,
            document.body
          )
        : null}

      {panel === "profile" ? (
        <ModalShell
          title="Mi cuenta"
          description="Actualiza tus datos personales. El usuario de acceso y el rol solo los cambia un administrador."
          className="max-w-2xl"
          headerAction={
            <Button type="button" variant="outline" size="sm" onClick={closePanel}>
              <X className="size-4" /> Cerrar
            </Button>
          }
        >
          {error ? (
            <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              {message}
            </p>
          ) : null}
          {loadingProfile ? (
            <p className="text-sm text-muted-foreground">Cargando ficha…</p>
          ) : (
            <form onSubmit={handleSaveProfile} className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-muted/20 p-3 sm:col-span-2">
                <UserAvatar
                  name={profile.fullName || username}
                  photoUrl={photoPreview || (removePhoto ? "" : photoUrl)}
                  size="lg"
                />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Tu foto</p>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium hover:bg-muted">
                      <Camera className="size-3.5" />
                      {photoFile || photoUrl ? "Cambiar foto" : "Agregar foto"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setPhotoFile(file);
                          setRemovePhoto(false);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    {(photoUrl || photoFile) && !removePhoto ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPhotoFile(null);
                          setRemovePhoto(true);
                        }}
                      >
                        Quitar
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-muted-foreground">Nombre completo *</span>
                <input
                  required
                  className={fieldClass}
                  value={profile.fullName}
                  onChange={(e) =>
                    setProfile((f) => ({ ...f, fullName: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Correo</span>
                <input
                  type="email"
                  className={fieldClass}
                  value={profile.email}
                  onChange={(e) =>
                    setProfile((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Teléfono</span>
                <input
                  className={fieldClass}
                  value={profile.phone}
                  onChange={(e) =>
                    setProfile((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">CURP</span>
                <input
                  className={fieldClass}
                  value={profile.curp}
                  onChange={(e) =>
                    setProfile((f) => ({ ...f, curp: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">RFC</span>
                <input
                  className={fieldClass}
                  value={profile.rfc}
                  onChange={(e) =>
                    setProfile((f) => ({ ...f, rfc: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Fecha de nacimiento</span>
                <input
                  type="date"
                  className={fieldClass}
                  value={profile.birthDate}
                  onChange={(e) =>
                    setProfile((f) => ({ ...f, birthDate: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Tipo de sangre</span>
                <select
                  className={fieldClass}
                  value={profile.bloodType}
                  onChange={(e) =>
                    setProfile((f) => ({ ...f, bloodType: e.target.value }))
                  }
                >
                  {BLOOD_TYPES.map((type) => (
                    <option key={type || "empty"} value={type}>
                      {type || "Sin especificar"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-muted-foreground">Dirección</span>
                <input
                  className={fieldClass}
                  value={profile.address}
                  onChange={(e) =>
                    setProfile((f) => ({ ...f, address: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">
                  Contacto de emergencia
                </span>
                <input
                  className={fieldClass}
                  value={profile.emergencyContactName}
                  onChange={(e) =>
                    setProfile((f) => ({
                      ...f,
                      emergencyContactName: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Tel. emergencia</span>
                <input
                  className={fieldClass}
                  value={profile.emergencyContactPhone}
                  onChange={(e) =>
                    setProfile((f) => ({
                      ...f,
                      emergencyContactPhone: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-muted-foreground">Parentesco</span>
                <input
                  className={fieldClass}
                  value={profile.emergencyContactRelation}
                  onChange={(e) =>
                    setProfile((f) => ({
                      ...f,
                      emergencyContactRelation: e.target.value,
                    }))
                  }
                />
              </label>
              <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                <FlagCheckbox
                  checked={profile.isTechnician}
                  label="Soy técnico"
                  hint="Te podrán elegir al asignar técnico en una orden de servicio."
                  onChange={(checked) =>
                    setProfile((f) => ({ ...f, isTechnician: checked }))
                  }
                />
                <FlagCheckbox
                  checked={profile.isServiceAdvisor}
                  label="Soy asesor de servicios"
                  hint="Te podrán elegir al asignar asesor en una orden de servicio."
                  onChange={(checked) =>
                    setProfile((f) => ({ ...f, isServiceAdvisor: checked }))
                  }
                />
              </div>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-muted-foreground">Notas</span>
                <textarea
                  className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  value={profile.notes}
                  onChange={(e) =>
                    setProfile((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </label>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" variant="outline" onClick={closePanel}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
                >
                  {submitting ? "Guardando…" : "Guardar cambios"}
                </Button>
              </div>
            </form>
          )}
        </ModalShell>
      ) : null}

      {panel === "password" ? (
        <ModalShell
          title="Cambiar contraseña"
          description="Ingresa tu contraseña actual y define una nueva de al menos 6 caracteres."
          className="max-w-md"
          headerAction={
            <Button type="button" variant="outline" size="sm" onClick={closePanel}>
              <X className="size-4" /> Cerrar
            </Button>
          }
        >
          {error ? (
            <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              {message}
            </p>
          ) : null}
          <form onSubmit={handleChangePassword} className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Contraseña actual</span>
              <input
                required
                type="password"
                autoComplete="current-password"
                className={fieldClass}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Nueva contraseña</span>
              <input
                required
                type="password"
                autoComplete="new-password"
                className={fieldClass}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Confirmar nueva</span>
              <input
                required
                type="password"
                autoComplete="new-password"
                className={cn(fieldClass)}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closePanel}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-[linear-gradient(135deg,#00BFFF,#3B46A5)] text-white"
              >
                {submitting ? "Guardando…" : "Actualizar contraseña"}
              </Button>
            </div>
          </form>
        </ModalShell>
      ) : null}
    </>
  );
}
