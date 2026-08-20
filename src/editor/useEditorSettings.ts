import { useCallback, useSyncExternalStore } from "react";

export interface EditorSettings {
  theme: string;
  fontSize: number;
  wordWrap: boolean;
  showLineNumbers: boolean;
}

export const EDITOR_THEMES = [
  { value: "textmate", label: "Textmate (claro)" },
  { value: "github", label: "GitHub (claro)" },
  { value: "tomorrow", label: "Tomorrow (claro)" },
  { value: "solarized_light", label: "Solarized Light (claro)" },
  { value: "monokai", label: "Monokai (escuro)" },
  { value: "dracula", label: "Dracula (escuro)" },
  { value: "tomorrow_night", label: "Tomorrow Night (escuro)" },
  { value: "solarized_dark", label: "Solarized Dark (escuro)" },
] as const;

const DEFAULT_SETTINGS: EditorSettings = {
  theme: "textmate",
  fontSize: 14,
  wordWrap: true,
  showLineNumbers: true,
};

const STORAGE_KEY = "chordpro-editor-settings";

function loadSettings(): EditorSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// Store a nível de módulo: todas as instâncias do hook leem/escrevem o mesmo
// estado, por isso uma mudança num componente é vista de imediato nos outros.
let state: EditorSettings = loadSettings();
const listeners = new Set<() => void>();

function setState(updater: (prev: EditorSettings) => EditorSettings) {
  state = updater(state);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage indisponível — ignora silenciosamente
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

// Sincroniza entre separadores/janelas abertas na mesma origem
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        state = { ...DEFAULT_SETTINGS, ...JSON.parse(e.newValue) };
        listeners.forEach((l) => l());
      } catch {
        // ignora JSON inválido vindo de outro separador
      }
    }
  });
}

export function useEditorSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot);

  const updateSetting = useCallback(
    <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => {
      setState((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetSettings = useCallback(() => setState(() => DEFAULT_SETTINGS), []);

  return { settings, updateSetting, resetSettings };
}
