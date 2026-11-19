export type ThemeMode = "light" | "dark";

export type AppearanceTokens = {
  primary: string;
  primaryDark: string;
  background: string;
  menu: string;
  panel: string;
  text: string;
  textMuted: string;
  border: string;
  tableRow: string;
  tableAlt: string;
  highlight: string;
  success: string;
  warning: string;
};

export type FontId =
  | "manrope"
  | "inter"
  | "dmSans"
  | "sourceSans"
  | "ibmPlex"
  | "nunito"
  | "roboto";

export const APPEARANCE_STORAGE_KEY = "mas-appearance-v2";
export const THEME_MODE_KEY = "mas-theme";

export const TOKEN_FIELDS: {
  key: keyof AppearanceTokens;
  labelKey: string;
}[] = [
  { key: "primary", labelKey: "appearance.token.primary" },
  { key: "primaryDark", labelKey: "appearance.token.primaryDark" },
  { key: "background", labelKey: "appearance.token.background" },
  { key: "menu", labelKey: "appearance.token.menu" },
  { key: "panel", labelKey: "appearance.token.panel" },
  { key: "text", labelKey: "appearance.token.text" },
  { key: "textMuted", labelKey: "appearance.token.textMuted" },
  { key: "border", labelKey: "appearance.token.border" },
  { key: "tableRow", labelKey: "appearance.token.tableRow" },
  { key: "tableAlt", labelKey: "appearance.token.tableAlt" },
  { key: "highlight", labelKey: "appearance.token.highlight" },
  { key: "success", labelKey: "appearance.token.success" },
  { key: "warning", labelKey: "appearance.token.warning" },
];

export const FONT_OPTIONS: { id: FontId; label: string; stack: string }[] = [
  {
    id: "manrope",
    label: "Manrope",
    stack: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: "inter",
    label: "Inter",
    stack: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: "dmSans",
    label: "DM Sans",
    stack: "var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: "sourceSans",
    label: "Source Sans 3",
    stack: "var(--font-source-sans), ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: "ibmPlex",
    label: "IBM Plex Sans",
    stack: "var(--font-ibm-plex), ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: "nunito",
    label: "Nunito",
    stack: "var(--font-nunito), ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: "roboto",
    label: "Roboto",
    stack: "var(--font-roboto), ui-sans-serif, system-ui, sans-serif",
  },
];

const HEX_RE = /^#([0-9A-Fa-f]{6})$/;

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}

export function isFontId(value: unknown): value is FontId {
  return FONT_OPTIONS.some((font) => font.id === value);
}

export function normalizeHex(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (HEX_RE.test(trimmed)) return trimmed.toUpperCase();
  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return `#${trimmed.toUpperCase()}`;
  return fallback.toUpperCase();
}

export function contrastText(hex: string): string {
  const m = HEX_RE.exec(hex);
  if (!m) return "#FFFFFF";
  const n = Number.parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.62 ? "#0F172A" : "#FFFFFF";
}

function hexToRgb(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function rgbToHex(r: number, g: number, b: number) {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(
    A.r + (B.r - A.r) * t,
    A.g + (B.g - A.g) * t,
    A.b + (B.b - A.b) * t
  );
}

function lighten(hex: string, amount: number) {
  return mix(hex, "#FFFFFF", amount);
}

function darken(hex: string, amount: number) {
  return mix(hex, "#0F172A", amount);
}

export const DEFAULT_LIGHT_TOKENS: AppearanceTokens = {
  primary: "#00BFFF",
  primaryDark: "#3B46A5",
  background: "#F4F7FB",
  menu: "#FFFFFF",
  panel: "#FFFFFF",
  text: "#1E293B",
  textMuted: "#64748B",
  border: "#D7E0EC",
  tableRow: "#FFFFFF",
  tableAlt: "#F8FAFC",
  highlight: "#E0F2FE",
  success: "#16A34A",
  warning: "#EA580C",
};

export const DEFAULT_DARK_TOKENS: AppearanceTokens = {
  primary: "#38BDF8",
  primaryDark: "#818CF8",
  background: "#0F172A",
  menu: "#1E293B",
  panel: "#1E293B",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
  border: "#334155",
  tableRow: "#1E293B",
  tableAlt: "#172033",
  highlight: "#0C4A6E",
  success: "#4ADE80",
  warning: "#FB923C",
};

export type PalettePresetId =
  | "mas"
  | "emerald"
  | "wine"
  | "sunset"
  | "lavender"
  | "graphite"
  | "mono";

export type PalettePreset = {
  id: PalettePresetId;
  labelKey: string;
  /** 5 swatches shown in the preset card */
  swatches: (tokens: AppearanceTokens) => string[];
  build: (mode: ThemeMode, monoSeed?: string) => AppearanceTokens;
};

function buildFromAccent(
  mode: ThemeMode,
  accent: string,
  accentDark: string,
  extras?: Partial<Pick<AppearanceTokens, "success" | "warning">>
): AppearanceTokens {
  if (mode === "dark") {
    return {
      primary: lighten(accent, 0.15),
      primaryDark: lighten(accentDark, 0.2),
      background: "#0F172A",
      menu: "#1E293B",
      panel: "#1E293B",
      text: "#F8FAFC",
      textMuted: "#94A3B8",
      border: "#334155",
      tableRow: "#1E293B",
      tableAlt: darken(accent, 0.82),
      highlight: darken(accent, 0.55),
      success: extras?.success ?? "#4ADE80",
      warning: extras?.warning ?? "#FB923C",
    };
  }
  return {
    primary: accent,
    primaryDark: accentDark,
    background: lighten(accent, 0.92),
    menu: "#FFFFFF",
    panel: "#FFFFFF",
    text: darken(accentDark, 0.55),
    textMuted: "#64748B",
    border: lighten(accent, 0.75),
    tableRow: "#FFFFFF",
    tableAlt: lighten(accent, 0.94),
    highlight: lighten(accent, 0.82),
    success: extras?.success ?? "#16A34A",
    warning: extras?.warning ?? "#EA580C",
  };
}

export function buildMonoTokens(mode: ThemeMode, seed: string): AppearanceTokens {
  const base = normalizeHex(seed, "#7C3AED");
  if (mode === "dark") {
    return {
      primary: lighten(base, 0.25),
      primaryDark: lighten(base, 0.05),
      background: darken(base, 0.82),
      menu: darken(base, 0.72),
      panel: darken(base, 0.68),
      text: lighten(base, 0.9),
      textMuted: lighten(base, 0.65),
      border: darken(base, 0.55),
      tableRow: darken(base, 0.7),
      tableAlt: darken(base, 0.74),
      highlight: darken(base, 0.45),
      success: lighten(base, 0.35),
      warning: lighten(base, 0.2),
    };
  }
  return {
    primary: base,
    primaryDark: darken(base, 0.25),
    background: lighten(base, 0.92),
    menu: lighten(base, 0.96),
    panel: "#FFFFFF",
    text: darken(base, 0.55),
    textMuted: mix(base, "#64748B", 0.55),
    border: lighten(base, 0.78),
    tableRow: "#FFFFFF",
    tableAlt: lighten(base, 0.94),
    highlight: lighten(base, 0.82),
    success: darken(base, 0.05),
    warning: darken(base, 0.15),
  };
}

export const PALETTE_PRESETS: PalettePreset[] = [
  {
    id: "mas",
    labelKey: "appearance.preset.mas",
    swatches: (t) => [t.background, t.panel, t.primaryDark, t.success, t.warning],
    build: (mode) =>
      mode === "dark" ? { ...DEFAULT_DARK_TOKENS } : { ...DEFAULT_LIGHT_TOKENS },
  },
  {
    id: "emerald",
    labelKey: "appearance.preset.emerald",
    swatches: (t) => [t.background, t.panel, t.primaryDark, t.success, t.warning],
    build: (mode) =>
      buildFromAccent(mode, "#10B981", "#065F46", {
        success: "#059669",
        warning: "#D97706",
      }),
  },
  {
    id: "wine",
    labelKey: "appearance.preset.wine",
    swatches: (t) => [t.background, t.panel, t.primaryDark, t.success, t.warning],
    build: (mode) =>
      buildFromAccent(mode, "#BE123C", "#881337", {
        success: "#15803D",
        warning: "#EA580C",
      }),
  },
  {
    id: "sunset",
    labelKey: "appearance.preset.sunset",
    swatches: (t) => [t.background, t.panel, t.primary, t.primaryDark, t.success],
    build: (mode) =>
      buildFromAccent(mode, "#F97316", "#C2410C", {
        success: "#16A34A",
        warning: "#EA580C",
      }),
  },
  {
    id: "lavender",
    labelKey: "appearance.preset.lavender",
    swatches: (t) => [t.background, t.panel, t.primaryDark, t.success, t.warning],
    build: (mode) =>
      buildFromAccent(mode, "#8B5CF6", "#5B21B6", {
        success: "#16A34A",
        warning: "#EA580C",
      }),
  },
  {
    id: "graphite",
    labelKey: "appearance.preset.graphite",
    swatches: (t) => [t.background, t.panel, t.primaryDark, t.text, t.textMuted],
    build: (mode) =>
      buildFromAccent(mode, "#64748B", "#1E293B", {
        success: "#22C55E",
        warning: "#F59E0B",
      }),
  },
  {
    id: "mono",
    labelKey: "appearance.preset.mono",
    swatches: (t) => [
      t.background,
      lighten(t.primary, 0.55),
      t.primary,
      t.primaryDark,
      t.text,
    ],
    build: (mode, monoSeed) => buildMonoTokens(mode, monoSeed ?? "#7C3AED"),
  },
];

export type StoredAppearance = {
  mode: ThemeMode;
  fontId: FontId;
  monoSeed: string;
  presetByMode: Record<ThemeMode, PalettePresetId | "custom">;
  tokensByMode: Record<ThemeMode, AppearanceTokens>;
};

export function defaultAppearance(): StoredAppearance {
  return {
    mode: "light",
    fontId: "manrope",
    monoSeed: "#7C3AED",
    presetByMode: { light: "mas", dark: "mas" },
    tokensByMode: {
      light: { ...DEFAULT_LIGHT_TOKENS },
      dark: { ...DEFAULT_DARK_TOKENS },
    },
  };
}

export function parseStoredAppearance(raw: string | null): StoredAppearance | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAppearance>;
    const base = defaultAppearance();
    const mode = isThemeMode(parsed.mode) ? parsed.mode : base.mode;
    const fontId = isFontId(parsed.fontId) ? parsed.fontId : base.fontId;
    const monoSeed = normalizeHex(String(parsed.monoSeed ?? base.monoSeed), base.monoSeed);
    const tokensByMode = {
      light: sanitizeTokens(parsed.tokensByMode?.light, base.tokensByMode.light),
      dark: sanitizeTokens(parsed.tokensByMode?.dark, base.tokensByMode.dark),
    };
    const presetByMode = {
      light: sanitizePreset(parsed.presetByMode?.light),
      dark: sanitizePreset(parsed.presetByMode?.dark),
    };
    return { mode, fontId, monoSeed, tokensByMode, presetByMode };
  } catch {
    return null;
  }
}

function sanitizePreset(value: unknown): PalettePresetId | "custom" {
  if (value === "custom") return "custom";
  if (PALETTE_PRESETS.some((preset) => preset.id === value)) {
    return value as PalettePresetId;
  }
  return "mas";
}

function sanitizeTokens(
  value: Partial<AppearanceTokens> | undefined,
  fallback: AppearanceTokens
): AppearanceTokens {
  const next = { ...fallback };
  for (const field of TOKEN_FIELDS) {
    const raw = value?.[field.key];
    if (typeof raw === "string") {
      next[field.key] = normalizeHex(raw, fallback[field.key]);
    }
  }
  return next;
}

export function applyAppearanceToDom(state: StoredAppearance) {
  const root = document.documentElement;
  const tokens = state.tokensByMode[state.mode];
  const font =
    FONT_OPTIONS.find((item) => item.id === state.fontId) ?? FONT_OPTIONS[0];

  root.classList.toggle("dark", state.mode === "dark");
  root.style.colorScheme = state.mode;
  root.dataset.theme = state.mode;
  root.dataset.font = state.fontId;
  root.style.setProperty("--font-sans", font.stack);

  root.style.setProperty("--brand-from", tokens.primary);
  root.style.setProperty("--brand-to", tokens.primaryDark);
  root.style.setProperty(
    "--brand-gradient",
    `linear-gradient(135deg, ${tokens.primary}, ${tokens.primaryDark})`
  );
  root.style.setProperty("--brand-on", contrastText(tokens.primaryDark));
  root.style.setProperty("--brand-from-rgb", hexToRgbChannels(tokens.primary));
  root.style.setProperty("--brand-to-rgb", hexToRgbChannels(tokens.primaryDark));

  root.style.setProperty("--background", tokens.background);
  root.style.setProperty("--foreground", tokens.text);
  root.style.setProperty("--card", tokens.panel);
  root.style.setProperty("--card-foreground", tokens.text);
  root.style.setProperty("--popover", tokens.panel);
  root.style.setProperty("--popover-foreground", tokens.text);
  root.style.setProperty("--primary", tokens.primaryDark);
  root.style.setProperty("--primary-foreground", contrastText(tokens.primaryDark));
  root.style.setProperty("--secondary", tokens.highlight);
  root.style.setProperty("--secondary-foreground", tokens.text);
  root.style.setProperty("--muted", tokens.tableAlt);
  root.style.setProperty("--muted-foreground", tokens.textMuted);
  root.style.setProperty("--accent", tokens.highlight);
  root.style.setProperty("--accent-foreground", tokens.text);
  root.style.setProperty("--border", tokens.border);
  root.style.setProperty("--input", tokens.border);
  root.style.setProperty("--ring", tokens.primary);
  root.style.setProperty("--sidebar", tokens.menu);
  root.style.setProperty("--sidebar-foreground", tokens.text);
  root.style.setProperty("--sidebar-border", tokens.border);
  root.style.setProperty("--sidebar-accent", tokens.highlight);
  root.style.setProperty("--sidebar-accent-foreground", tokens.text);
  root.style.setProperty("--table-row", tokens.tableRow);
  root.style.setProperty("--table-row-alt", tokens.tableAlt);
  root.style.setProperty("--success", tokens.success);
  root.style.setProperty("--warning", tokens.warning);
}

function hexToRgbChannels(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
}
