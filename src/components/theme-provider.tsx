"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  APPEARANCE_STORAGE_KEY,
  applyAppearanceToDom,
  buildMonoTokens,
  defaultAppearance,
  isThemeMode,
  normalizeHex,
  PALETTE_PRESETS,
  parseStoredAppearance,
  THEME_MODE_KEY,
  type AppearanceTokens,
  type FontId,
  type PalettePresetId,
  type StoredAppearance,
  type ThemeMode,
} from "@/lib/theme/appearance";

export type Theme = ThemeMode;

type ThemeContextValue = {
  mode: ThemeMode;
  theme: ThemeMode;
  appearance: StoredAppearance;
  tokens: AppearanceTokens;
  presetId: PalettePresetId | "custom";
  fontId: FontId;
  monoSeed: string;
  setMode: (mode: ThemeMode) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setFontId: (fontId: FontId) => void;
  applyPreset: (presetId: PalettePresetId) => void;
  setMonoSeed: (hex: string) => void;
  setToken: (key: keyof AppearanceTokens, value: string) => void;
  resetTokensForMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function persist(state: StoredAppearance) {
  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(state));
  localStorage.setItem(THEME_MODE_KEY, state.mode);
  applyAppearanceToDom(state);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<StoredAppearance>(defaultAppearance);

  useEffect(() => {
    const stored = parseStoredAppearance(
      localStorage.getItem(APPEARANCE_STORAGE_KEY)
    );
    const legacyMode = localStorage.getItem(THEME_MODE_KEY);
    const initial = stored ?? defaultAppearance();
    if (!stored && isThemeMode(legacyMode)) {
      initial.mode = legacyMode;
    } else if (
      !stored &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      initial.mode = "dark";
    }
    setAppearance(initial);
    persist(initial);
  }, []);

  const update = useCallback((recipe: (current: StoredAppearance) => StoredAppearance) => {
    setAppearance((current) => {
      const next = recipe(current);
      persist(next);
      return next;
    });
  }, []);

  const setMode = useCallback(
    (mode: ThemeMode) => {
      update((current) => ({ ...current, mode }));
    },
    [update]
  );

  const toggleTheme = useCallback(() => {
    setMode(appearance.mode === "dark" ? "light" : "dark");
  }, [appearance.mode, setMode]);

  const setFontId = useCallback(
    (fontId: FontId) => {
      update((current) => ({ ...current, fontId }));
    },
    [update]
  );

  const applyPreset = useCallback(
    (presetId: PalettePresetId) => {
      update((current) => {
        const preset = PALETTE_PRESETS.find((item) => item.id === presetId);
        if (!preset) return current;
        const tokens = preset.build(current.mode, current.monoSeed);
        return {
          ...current,
          presetByMode: { ...current.presetByMode, [current.mode]: presetId },
          tokensByMode: { ...current.tokensByMode, [current.mode]: tokens },
        };
      });
    },
    [update]
  );

  const setMonoSeed = useCallback(
    (hex: string) => {
      update((current) => {
        const monoSeed = normalizeHex(hex, current.monoSeed);
        const next: StoredAppearance = { ...current, monoSeed };
        if (current.presetByMode[current.mode] === "mono") {
          next.tokensByMode = {
            ...current.tokensByMode,
            [current.mode]: buildMonoTokens(current.mode, monoSeed),
          };
        }
        return next;
      });
    },
    [update]
  );

  const setToken = useCallback(
    (key: keyof AppearanceTokens, value: string) => {
      update((current) => {
        const currentTokens = current.tokensByMode[current.mode];
        const nextValue = normalizeHex(value, currentTokens[key]);
        return {
          ...current,
          presetByMode: { ...current.presetByMode, [current.mode]: "custom" },
          tokensByMode: {
            ...current.tokensByMode,
            [current.mode]: { ...currentTokens, [key]: nextValue },
          },
        };
      });
    },
    [update]
  );

  const resetTokensForMode = useCallback(() => {
    update((current) => {
      const preset =
        PALETTE_PRESETS.find((item) => item.id === "mas") ?? PALETTE_PRESETS[0];
      return {
        ...current,
        presetByMode: { ...current.presetByMode, [current.mode]: "mas" },
        tokensByMode: {
          ...current.tokensByMode,
          [current.mode]: preset.build(current.mode, current.monoSeed),
        },
      };
    });
  }, [update]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode: appearance.mode,
      theme: appearance.mode,
      appearance,
      tokens: appearance.tokensByMode[appearance.mode],
      presetId: appearance.presetByMode[appearance.mode],
      fontId: appearance.fontId,
      monoSeed: appearance.monoSeed,
      setMode,
      setTheme: setMode,
      toggleTheme,
      setFontId,
      applyPreset,
      setMonoSeed,
      setToken,
      resetTokensForMode,
    }),
    [
      appearance,
      setMode,
      toggleTheme,
      setFontId,
      applyPreset,
      setMonoSeed,
      setToken,
      resetTokensForMode,
    ]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

export const themeInitScript = `(function(){try{var KEY='${APPEARANCE_STORAGE_KEY}';var MODE_KEY='${THEME_MODE_KEY}';var raw=localStorage.getItem(KEY);var mode=localStorage.getItem(MODE_KEY);var r=document.documentElement;if(mode!=='light'&&mode!=='dark'){mode=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}if(raw){try{var j=JSON.parse(raw);if(j&&(j.mode==='light'||j.mode==='dark'))mode=j.mode;if(j&&j.tokensByMode&&j.tokensByMode[mode]){var t=j.tokensByMode[mode];function on(h){var n=parseInt(String(h).replace('#',''),16);if(!isFinite(n))return'#FFFFFF';var R=(n>>16)&255,G=(n>>8)&255,B=n&255;return(0.299*R+0.587*G+0.114*B)/255>0.62?'#0F172A':'#FFFFFF'}function rgb(h){var n=parseInt(String(h).replace('#',''),16);if(!isFinite(n))return'0,191,255';return((n>>16)&255)+', '+((n>>8)&255)+', '+(n&255)}r.classList.toggle('dark',mode==='dark');r.style.colorScheme=mode;r.dataset.theme=mode;r.style.setProperty('--brand-from',t.primary);r.style.setProperty('--brand-to',t.primaryDark);r.style.setProperty('--brand-gradient','linear-gradient(135deg, '+t.primary+', '+t.primaryDark+')');r.style.setProperty('--brand-on',on(t.primaryDark));r.style.setProperty('--brand-from-rgb',rgb(t.primary));r.style.setProperty('--brand-to-rgb',rgb(t.primaryDark));r.style.setProperty('--background',t.background);r.style.setProperty('--foreground',t.text);r.style.setProperty('--card',t.panel);r.style.setProperty('--card-foreground',t.text);r.style.setProperty('--primary',t.primaryDark);r.style.setProperty('--primary-foreground',on(t.primaryDark));r.style.setProperty('--muted',t.tableAlt);r.style.setProperty('--muted-foreground',t.textMuted);r.style.setProperty('--accent',t.highlight);r.style.setProperty('--border',t.border);r.style.setProperty('--input',t.border);r.style.setProperty('--ring',t.primary);r.style.setProperty('--sidebar',t.menu);r.style.setProperty('--sidebar-foreground',t.text);r.style.setProperty('--sidebar-border',t.border);return}}catch(e){}}r.classList.toggle('dark',mode==='dark');r.style.colorScheme=mode;r.dataset.theme=mode}catch(e){}})();`;
