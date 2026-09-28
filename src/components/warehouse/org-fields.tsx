"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { roleLabel, type AppRole } from "@/lib/auth/permissions";
import {
  ORG_AREAS,
  findOrgArea,
  findOrgPosition,
  type OrgArea,
  type OrgPosition,
} from "@/lib/users/org-catalog";
import { cn } from "@/lib/utils";

const OTHER = "__other__";

const baseInputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";

type AreaSelectProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

export function AreaSelect({ value, onChange, disabled, className }: AreaSelectProps) {
  const match = findOrgArea(value);
  const [customMode, setCustomMode] = useState(false);
  const isCustom = customMode || (Boolean(value.trim()) && !match);
  const selectValue = isCustom ? OTHER : (match?.label ?? "");

  return (
    <div className="space-y-2">
      <select
        aria-label="Área"
        disabled={disabled}
        value={selectValue}
        onChange={(event) => {
          const next = event.target.value;
          if (next === OTHER) {
            setCustomMode(true);
            if (match) onChange("");
            return;
          }
          setCustomMode(false);
          onChange(next);
        }}
        className={cn(baseInputClass, className)}
      >
        <option value="">Sin asignar</option>
        {ORG_AREAS.map((area) => (
          <option key={area.id} value={area.label}>
            {area.label}
          </option>
        ))}
        <option value={OTHER}>Otra área (escribir)…</option>
      </select>
      {isCustom ? (
        <input
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Nombre del área"
          placeholder="Nombre del área"
          className={cn(baseInputClass, className)}
          autoFocus={customMode}
        />
      ) : match ? (
        <p className="text-xs text-muted-foreground">{match.description}</p>
      ) : null}
    </div>
  );
}

type PositionSelectProps = {
  value: string;
  area: string;
  onChange: (value: string, match: { area: OrgArea; position: OrgPosition } | null) => void;
  disabled?: boolean;
  className?: string;
};

export function PositionSelect({
  value,
  area,
  onChange,
  disabled,
  className,
}: PositionSelectProps) {
  const match = findOrgPosition(value, area);
  const [customMode, setCustomMode] = useState(false);
  const isCustom = customMode || (Boolean(value.trim()) && !match);
  const selectValue = isCustom ? OTHER : (match?.position.label ?? "");

  const currentArea = findOrgArea(area);
  const orderedAreas = currentArea
    ? [currentArea, ...ORG_AREAS.filter((item) => item.id !== currentArea.id)]
    : ORG_AREAS;

  return (
    <div className="space-y-2">
      <select
        aria-label="Puesto"
        disabled={disabled}
        value={selectValue}
        onChange={(event) => {
          const next = event.target.value;
          if (next === OTHER) {
            setCustomMode(true);
            if (match) onChange("", null);
            return;
          }
          setCustomMode(false);
          onChange(next, next ? findOrgPosition(next, area) : null);
        }}
        className={cn(baseInputClass, className)}
      >
        <option value="">Sin asignar</option>
        {orderedAreas.map((item, index) => (
          <optgroup
            key={item.id}
            label={
              currentArea && index === 0 ? `${item.label} (área actual)` : item.label
            }
          >
            {item.positions.map((position) => (
              <option key={`${item.id}-${position.label}`} value={position.label}>
                {position.label}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={OTHER}>Otro puesto (escribir)…</option>
      </select>
      {isCustom ? (
        <input
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value, null)}
          aria-label="Nombre del puesto"
          placeholder="Nombre del puesto"
          className={cn(baseInputClass, className)}
          autoFocus={customMode}
        />
      ) : null}
    </div>
  );
}

type RoleSuggestionProps = {
  suggested: AppRole | null;
  current: AppRole;
  onApply: (role: AppRole) => void;
  disabled?: boolean;
  className?: string;
};

export function RoleSuggestion({
  suggested,
  current,
  onApply,
  disabled,
  className,
}: RoleSuggestionProps) {
  if (!suggested) return null;
  const matches = suggested === current;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs",
        matches
          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200"
          : "border-sky-500/30 bg-sky-500/5 text-sky-900 dark:text-sky-100",
        className
      )}
    >
      <Sparkles className="size-3.5 shrink-0" />
      <span>
        Rol sugerido para este puesto: <strong>{roleLabel(suggested)}</strong>
        {matches ? " · coincide con el rol asignado" : ""}
      </span>
      {!matches && !disabled ? (
        <button
          type="button"
          onClick={() => onApply(suggested)}
          className="ml-auto rounded-md border border-current/30 px-2 py-0.5 font-medium hover:bg-current/10"
        >
          Usar este rol
        </button>
      ) : null}
    </div>
  );
}
