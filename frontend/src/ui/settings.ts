import { navigate, toast } from "./router";
import { renderMenu } from "./menu";
import {
  THEMES,
  applyTheme,
  getActiveTheme,
  setActiveTheme,
} from "../themes/themes";
import {
  DEFAULT_KEYMAP,
  loadKeymap,
  saveKeymap,
  type KeyMap,
} from "../core/input";

export const renderSettings = (host: HTMLElement) => {
  const root = document.createElement("div");
  root.className = "screen";
  const km = loadKeymap();
  const active = getActiveTheme();
  root.innerHTML = `
    <div class="screen-header">
      <h1>Settings</h1>
      <button id="back">← Menu</button>
    </div>

    <h3 style="margin-top:0;">Theme</h3>
    <div class="theme-grid" id="themes"></div>

    <h3 style="margin-top:24px;">Keys (lane 0..5)</h3>
    <div class="row" id="keys"></div>
    <button id="reset-keys" style="margin-top:8px;">Reset to S D F J K L</button>

    <h3 style="margin-top:24px;">Audio Offset</h3>
    <div class="field" style="max-width:200px;">
      <label>Offset (ms) — positive = audio late</label>
      <input id="audio-offset" type="number" step="1" value="${localStorage.getItem("mg.audioOffsetMs") ?? "0"}" />
    </div>
    <button id="save-offset">Save</button>
  `;
  host.appendChild(root);

  // Themes.
  const themesEl = root.querySelector<HTMLDivElement>("#themes")!;
  for (const t of THEMES) {
    const card = document.createElement("div");
    card.className = "theme-card" + (t.id === active.id ? " active" : "");
    card.innerHTML = `
      <div class="swatch">
        <span style="background:${t.bg}"></span>
        <span style="background:${t.bgPanel}"></span>
        <span style="background:${t.accent}"></span>
        ${t.noteColors
          .slice(0, 3)
          .map((c) => `<span style="background:${c}"></span>`)
          .join("")}
      </div>
      <div style="margin-top:8px;font-size:13px;">${t.name}</div>
    `;
    card.onclick = () => {
      setActiveTheme(t.id);
      applyTheme(t);
      navigate(renderSettings); // re-render to update active card
    };
    themesEl.appendChild(card);
  }

  // Keys.
  const keysEl = root.querySelector<HTMLDivElement>("#keys")!;
  const buttonsByLane: HTMLButtonElement[] = [];
  for (let lane = 0; lane < 6; lane++) {
    const b = document.createElement("button");
    b.style.minWidth = "64px";
    const code = Object.keys(km).find((k) => km[k] === lane) ?? "?";
    b.textContent = `${lane}: ${code.replace("Key", "")}`;
    b.onclick = () => {
      b.textContent = `${lane}: …`;
      const handler = (e: KeyboardEvent) => {
        e.preventDefault();
        // Remove existing assignment of same code or same lane.
        for (const k of Object.keys(km)) {
          if (km[k] === lane || k === e.code) delete km[k];
        }
        km[e.code] = lane as KeyMap[string];
        saveKeymap(km);
        b.textContent = `${lane}: ${e.code.replace("Key", "")}`;
        window.removeEventListener("keydown", handler);
      };
      window.addEventListener("keydown", handler, { once: true });
    };
    buttonsByLane.push(b);
    keysEl.appendChild(b);
  }

  root.querySelector<HTMLButtonElement>("#reset-keys")!.onclick = () => {
    saveKeymap({ ...DEFAULT_KEYMAP });
    navigate(renderSettings);
  };

  root.querySelector<HTMLButtonElement>("#save-offset")!.onclick = () => {
    const v = root.querySelector<HTMLInputElement>("#audio-offset")!.value;
    localStorage.setItem("mg.audioOffsetMs", v);
    toast("Saved");
  };

  root.querySelector<HTMLButtonElement>("#back")!.onclick = () =>
    navigate(renderMenu);

  return () => {};
};
