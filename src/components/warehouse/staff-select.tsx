"use client";

import type { StaffMember } from "@/lib/users/staff";

type StaffSelectProps = {
  label: string;
  value: string;
  options: StaffMember[];
  disabled?: boolean;
  emptyLabel: string;
  onChange: (value: string) => void;
  className?: string;
};

export function StaffSelect({
  label,
  value,
  options,
  disabled,
  emptyLabel,
  onChange,
  className,
}: StaffSelectProps) {
  const fieldClass =
    className ??
    "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";
  const currentMissing =
    value.trim() &&
    !options.some((option) => option.fullName === value.trim());

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <select
        className={fieldClass}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {currentMissing ? (
          <option value={value}>{value} (capturado)</option>
        ) : null}
        {options.map((option) => (
          <option key={option.id} value={option.fullName}>
            {option.fullName}
            {option.isActive ? "" : " · inactivo"}
          </option>
        ))}
      </select>
    </label>
  );
}
