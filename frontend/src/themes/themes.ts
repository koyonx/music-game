export interface ThemePalette {
  id: string;
  name: string;
  // CSS-side
  bg: string;
  bgPanel: string;
  fg: string;
  fgMuted: string;
  accent: string;
  accentFg: string;
  border: string;
  // Canvas-side (game scene)
  canvasBg: string;
  laneBg: [string, string]; // alternating lane backgrounds
  laneSeparator: string;
  judgmentLine: string;
  noteColors: [string, string, string, string, string, string]; // per lane
  holdColor: string;
  hitFlash: string;
  judgmentText: {
    perfect: string;
    great: string;
    good: string;
    miss: string;
  };
}

export const THEMES: ThemePalette[] = [
  {
    id: "default",
    name: "Default Dark",
    bg: "#0e0f14",
    bgPanel: "#171821",
    fg: "#e6e8ef",
    fgMuted: "#8a8fa3",
    accent: "#6ea8ff",
    accentFg: "#0a0d14",
    border: "#272a36",
    canvasBg: "#0a0b10",
    laneBg: ["#13141b", "#0f1016"],
    laneSeparator: "#23253080",
    judgmentLine: "#6ea8ff",
    noteColors: ["#ff6e9a", "#ffb86e", "#fff06e", "#9eff6e", "#6ee0ff", "#c06eff"],
    holdColor: "#6ea8ffaa",
    hitFlash: "#ffffff",
    judgmentText: {
      perfect: "#fff06e",
      great: "#6ee0ff",
      good: "#9eff6e",
      miss: "#ff6e9a",
    },
  },
  {
    id: "neon",
    name: "Neon",
    bg: "#06030c",
    bgPanel: "#100726",
    fg: "#ecf0ff",
    fgMuted: "#8a82c2",
    accent: "#ff2bd6",
    accentFg: "#06030c",
    border: "#2a1a55",
    canvasBg: "#03020a",
    laneBg: ["#0c0620", "#070414"],
    laneSeparator: "#ff2bd650",
    judgmentLine: "#00ffe0",
    noteColors: ["#ff2bd6", "#ff5e3a", "#ffd23a", "#3aff89", "#3ad8ff", "#9d3aff"],
    holdColor: "#ff2bd6aa",
    hitFlash: "#00ffe0",
    judgmentText: {
      perfect: "#00ffe0",
      great: "#ff2bd6",
      good: "#3aff89",
      miss: "#ff5e3a",
    },
  },
  {
    id: "pop",
    name: "Pop",
    bg: "#fff7f1",
    bgPanel: "#ffe6d4",
    fg: "#2a1d18",
    fgMuted: "#7a5a4a",
    accent: "#ff5b8a",
    accentFg: "#fff7f1",
    border: "#f0c8a8",
    canvasBg: "#fff2e6",
    laneBg: ["#ffe6d4", "#ffdcc0"],
    laneSeparator: "#ff5b8a40",
    judgmentLine: "#ff5b8a",
    noteColors: ["#ff5b8a", "#ff9e3a", "#ffd23a", "#7ad96a", "#3ab8ff", "#a26aff"],
    holdColor: "#ff5b8acc",
    hitFlash: "#ffffff",
    judgmentText: {
      perfect: "#ff5b8a",
      great: "#3ab8ff",
      good: "#7ad96a",
      miss: "#a23a3a",
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    bg: "#fafafa",
    bgPanel: "#ffffff",
    fg: "#111111",
    fgMuted: "#777777",
    accent: "#111111",
    accentFg: "#ffffff",
    border: "#e2e2e2",
    canvasBg: "#ffffff",
    laneBg: ["#fafafa", "#f0f0f0"],
    laneSeparator: "#cccccc",
    judgmentLine: "#111111",
    noteColors: ["#111111", "#333333", "#555555", "#555555", "#333333", "#111111"],
    holdColor: "#11111188",
    hitFlash: "#000000",
    judgmentText: {
      perfect: "#000000",
      great: "#444444",
      good: "#666666",
      miss: "#aa0000",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    bg: "#1a0a1f",
    bgPanel: "#28132f",
    fg: "#ffe9d6",
    fgMuted: "#c39b8e",
    accent: "#ff8a5b",
    accentFg: "#1a0a1f",
    border: "#5a2545",
    canvasBg: "#0f0613",
    laneBg: ["#1f0c25", "#170818"],
    laneSeparator: "#ff8a5b40",
    judgmentLine: "#ffd16e",
    noteColors: ["#ff5b8a", "#ff8a5b", "#ffd16e", "#ffec8a", "#ff8a5b", "#ff5b8a"],
    holdColor: "#ffd16eaa",
    hitFlash: "#ffec8a",
    judgmentText: {
      perfect: "#ffec8a",
      great: "#ff8a5b",
      good: "#ffd16e",
      miss: "#ff5b8a",
    },
  },
];

const STORAGE_KEY = "mg.theme";

export function getActiveTheme(): ThemePalette {
  const id = localStorage.getItem(STORAGE_KEY) ?? "default";
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function setActiveTheme(id: string) {
  localStorage.setItem(STORAGE_KEY, id);
  applyTheme(getActiveTheme());
  window.dispatchEvent(new CustomEvent("themechange"));
}

export function applyTheme(theme: ThemePalette) {
  const root = document.documentElement;
  root.style.setProperty("--bg", theme.bg);
  root.style.setProperty("--bg-panel", theme.bgPanel);
  root.style.setProperty("--fg", theme.fg);
  root.style.setProperty("--fg-muted", theme.fgMuted);
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-fg", theme.accentFg);
  root.style.setProperty("--border", theme.border);
}
