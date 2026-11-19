"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Moon, Sun, Type, X } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  FONT_OPTIONS,
  PALETTE_PRESETS,
  TOKEN_FIELDS,
  type PalettePresetId,
} from "@/lib/theme/appearance";
import { cn } from "@/lib/utils";

type AppearancePanelProps = {
  open: boolean;
  onClose: () => void;
};

export function AppearancePanel({ open, onClose }: AppearancePanelProps) {
  const { t } = useLocale();
  const {
    mode,
    setMode,
    tokens,
    presetId,
    fontId,
    monoSeed,
    applyPreset,
    setMonoSeed,
    setToken,
    setFontId,
    resetTokensForMode,
  } = useTheme();
  const [editOpen, setEditOpen] = useState(true);
  const [monoDraft, setMonoDraft] = useState(monoSeed);
  useEffect(() => {
    setMonoDraft(monoSeed);
  }, [monoSeed]);

  const presetCards = useMemo(
    () =>
      PALETTE_PRESETS.map((preset) => {
        const preview =
          preset.id === "mono"
            ? preset.build(mode, monoSeed)
            : preset.build(mode);
        return {
          ...preset,
          preview,
          swatches: preset.swatches(preview),
        };
      }),
    [mode, monoSeed]
  );

  if (!open) return null;

  return (
    <ModalShell
      title={t("appearance.title")}
      description={t("appearance.description")}
      className="max-w-3xl"
      headerAction={
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="size-4" /> {t("account.close")}
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{t("appearance.section")}</p>
          <div className="inline-flex overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setMode("light")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium",
                mode === "light"
                  ? "brand-gradient text-[var(--brand-on)]"
                  : "hover:bg-muted"
              )}
            >
              <Sun className="size-3.5" />
              {t("account.nightOff")}
            </button>
            <button
              type="button"
              onClick={() => setMode("dark")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium",
                mode === "dark"
                  ? "brand-gradient text-[var(--brand-on)]"
                  : "hover:bg-muted"
              )}
            >
              <Moon className="size-3.5" />
              {t("account.nightOn")}
            </button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{t("appearance.hint")}</p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {presetCards.map((preset) => {
            const active = presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id as PalettePresetId)}
                className={cn(
                  "rounded-xl border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md",
                  active
                    ? "border-[var(--brand-from)] ring-2 ring-[var(--brand-from)]/40"
                    : "border-border"
                )}
              >
                <div className="mb-2 flex h-8 overflow-hidden rounded-md border border-border">
                  {preset.swatches.map((color, index) => (
                    <span
                      key={`${preset.id}-${index}`}
                      className="h-full flex-1"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <p className="text-sm font-medium">{t(preset.labelKey)}</p>
                {preset.id === "mono" ? (
                  <div
                    className="mt-2 flex items-center gap-2"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="color"
                      value={monoSeed}
                      onChange={(event) => {
                        const value = event.target.value.toUpperCase();
                        setMonoDraft(value);
                        setMonoSeed(value);
                        applyPreset("mono");
                      }}
                      className="size-7 cursor-pointer rounded border border-border bg-background p-0.5"
                    />
                    <input
                      type="text"
                      value={monoDraft}
                      onChange={(event) => {
                        const value = event.target.value.toUpperCase();
                        setMonoDraft(value);
                        if (/^#[0-9A-F]{6}$/.test(value)) {
                          setMonoSeed(value);
                          applyPreset("mono");
                        }
                      }}
                      onBlur={() => setMonoDraft(monoSeed)}
                      className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-[11px]"
                      maxLength={7}
                    />
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-card">
          <button
            type="button"
            onClick={() => setEditOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium"
          >
            <span>{t("appearance.editOneByOne")}</span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                editOpen ? "rotate-180" : "rotate-0"
              )}
            />
          </button>
          {editOpen ? (
            <div className="space-y-2 border-t border-border px-4 py-3">
              {TOKEN_FIELDS.map((field) => (
                <ColorRow
                  key={field.key}
                  label={t(field.labelKey)}
                  value={tokens[field.key]}
                  onChange={(value) => setToken(field.key, value)}
                />
              ))}
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetTokensForMode}
                >
                  {t("appearance.resetPalette")}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Type className="size-4 text-muted-foreground" />
            {t("appearance.typography")}
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">
              {t("appearance.fontFamily")}
            </span>
            <select
              value={fontId}
              onChange={(event) => setFontId(event.target.value as typeof fontId)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.id} value={font.id}>
                  {font.label}
                </option>
              ))}
            </select>
          </label>
          <p
            className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {t("appearance.fontPreview")}
          </p>
        </div>
      </div>
    </ModalShell>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="min-w-0 flex-1 text-muted-foreground">{label}</span>
      <span className="inline-flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => {
            const next = event.target.value.toUpperCase();
            setDraft(next);
            onChange(next);
          }}
          className="size-8 cursor-pointer rounded border border-border bg-background p-0.5"
        />
        <input
          type="text"
          value={draft}
          onChange={(event) => {
            const next = event.target.value.toUpperCase();
            setDraft(next);
            if (/^#[0-9A-F]{6}$/.test(next)) onChange(next);
          }}
          onBlur={() => setDraft(value)}
          className="h-8 w-[5.5rem] rounded-md border border-input bg-background px-2 font-mono text-[11px]"
          maxLength={7}
        />
      </span>
    </label>
  );
}
