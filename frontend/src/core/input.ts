import type { Lane } from "@shared/types";

export interface KeyMap {
  // key.code (e.g. "KeyS") -> lane
  [code: string]: Lane;
}

export const DEFAULT_KEYMAP: KeyMap = {
  KeyS: 0,
  KeyD: 1,
  KeyF: 2,
  KeyJ: 3,
  KeyK: 4,
  KeyL: 5,
};

export function loadKeymap(): KeyMap {
  try {
    const raw = localStorage.getItem("mg.keymap");
    if (!raw) return DEFAULT_KEYMAP;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_KEYMAP;
  }
}

export function saveKeymap(map: KeyMap) {
  localStorage.setItem("mg.keymap", JSON.stringify(map));
}

export interface KeyEvent {
  lane: Lane;
  // Time in seconds since the game's audio clock started. Computed at the
  // call site; the input layer just reports lane + nowFn.
  timeSec: number;
}

export class InputManager {
  private keymap: KeyMap;
  private down = new Set<string>();
  private onPressCb: ((e: KeyEvent) => void) | null = null;
  private onReleaseCb: ((lane: Lane, t: number) => void) | null = null;
  private nowFn: () => number;

  constructor(nowFn: () => number, keymap: KeyMap = loadKeymap()) {
    this.nowFn = nowFn;
    this.keymap = keymap;
    this.handleDown = this.handleDown.bind(this);
    this.handleUp = this.handleUp.bind(this);
  }

  attach() {
    window.addEventListener("keydown", this.handleDown);
    window.addEventListener("keyup", this.handleUp);
  }

  detach() {
    window.removeEventListener("keydown", this.handleDown);
    window.removeEventListener("keyup", this.handleUp);
    this.down.clear();
  }

  onPress(cb: (e: KeyEvent) => void) {
    this.onPressCb = cb;
  }

  onRelease(cb: (lane: Lane, t: number) => void) {
    this.onReleaseCb = cb;
  }

  isDown(lane: Lane): boolean {
    for (const code in this.keymap) {
      if (this.keymap[code] === lane && this.down.has(code)) return true;
    }
    return false;
  }

  private handleDown(e: KeyboardEvent) {
    const lane = this.keymap[e.code];
    if (lane === undefined) return;
    if (this.down.has(e.code)) return; // ignore auto-repeat
    this.down.add(e.code);
    e.preventDefault();
    this.onPressCb?.({ lane, timeSec: this.nowFn() });
  }

  private handleUp(e: KeyboardEvent) {
    const lane = this.keymap[e.code];
    if (lane === undefined) return;
    this.down.delete(e.code);
    e.preventDefault();
    this.onReleaseCb?.(lane, this.nowFn());
  }
}
