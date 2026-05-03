// Minimal screen router. Each screen is a function that mounts into a host
// element and returns a teardown function.

export type ScreenFn = (host: HTMLElement) => () => void | undefined;

let currentTeardown: (() => void) | undefined;
let host: HTMLElement | null = null;

export function setHost(el: HTMLElement) {
  host = el;
}

export function navigate(screen: ScreenFn) {
  if (!host) throw new Error("router host not set");
  if (currentTeardown) {
    try {
      currentTeardown();
    } catch {}
  }
  host.innerHTML = "";
  currentTeardown = screen(host) || undefined;
}

export function toast(message: string, ms = 2200) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}
