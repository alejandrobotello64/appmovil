"use client";

import { cn } from "@/lib/utils";

type FlagCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
};

export function FlagCheckbox({
  checked,
  onChange,
  label,
  hint,
  disabled,
  className,
}: FlagCheckboxProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-background px-3 py-2.5 text-sm has-disabled:cursor-not-allowed has-disabled:opacity-60",
        className
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 rounded border-input accent-[#3B46A5]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block font-medium text-foreground">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}
