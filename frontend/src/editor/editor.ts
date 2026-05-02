// Manual chart editor: piano-roll style timeline, click to place notes,
// click again to remove. Audio plays via the AudioHandle.

import { LANE_COUNT, type Chart, type Lane, type Note } from "@shared/types";
import type { AudioHandle } from "../core/audio";
import { getActiveTheme } from "../themes/themes";

export interface EditorOptions {
  audio: AudioHandle;
  canvas: HTMLCanvasElement;
  initialNotes?: Note[];
  onChange: (notes: Note[]) => void;
}

// Pixels per second of audio; controls vertical zoom.
const PX_PER_SEC = 200;

export class Editor {
  private notes: Note[];
  private opts: EditorOptions;
  private ctx: CanvasRenderingContext2D;
  private dpr = Math.max(1, window.devicePixelRatio || 1);
  private playhead = 0;
  private rafId = 0;
  private dragScroll = 0;

  constructor(opts: EditorOptions) {
    this.opts = opts;
    this.notes = (opts.initialNotes ?? []).slice();
    const ctx = opts.canvas.getContext("2d");
    if (!ctx) throw new Error("2d ctx unavailable");
    this.ctx = ctx;
    this.resize();
    opts.canvas.addEventListener("click", (e) => this.onClick(e));
    opts.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.onRightClick(e);
    });
    this.tick();
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
  }

  private resize() {
    const c = this.opts.canvas;
    const totalSec = this.opts.audio.durationSec;
    c.style.height = `${totalSec * PX_PER_SEC}px`;
    const rect = c.getBoundingClientRect();
    c.width = Math.max(300, Math.floor(rect.width * this.dpr));
    c.height = Math.max(100, Math.floor(rect.height * this.dpr));
  }

  setNotes(notes: Note[]) {
    this.notes = notes.slice();
    this.opts.onChange(this.notes);
  }

  getNotes(): Note[] {
    return this.notes.slice();
  }

  setPlayhead(sec: number) {
    this.playhead = sec;
  }

  private tick = () => {
    if (this.opts.audio.isPlaying()) {
      this.playhead = this.opts.audio.elapsedSec();
      // Auto-scroll the wrapping element so the playhead stays centered.
      const wrap = this.opts.canvas.parentElement;
      if (wrap) {
        const target = this.playhead * PX_PER_SEC - wrap.clientHeight / 2;
        wrap.scrollTop = target;
      }
    }
    this.draw();
    this.rafId = requestAnimationFrame(this.tick);
  };

  private xyToNote(e: MouseEvent): { time: number; lane: Lane } | null {
    const rect = this.opts.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * this.dpr;
    const y = (e.clientY - rect.top) * this.dpr;
    const w = this.opts.canvas.width;
    const playW = Math.min(w, this.opts.canvas.height * 0.5);
    const x0 = (w - playW) / 2;
    if (x < x0 || x > x0 + playW) return null;
    const laneW = playW / LANE_COUNT;
    const lane = Math.min(LANE_COUNT - 1, Math.max(0, Math.floor((x - x0) / laneW))) as Lane;
    // Time: top of canvas = 0, bottom = durationSec. y in canvas px / dpr / PX_PER_SEC.
    const sec = (y / this.dpr) / PX_PER_SEC;
    return { time: +sec.toFixed(3), lane };
  }

  private onClick(e: MouseEvent) {
    const hit = this.xyToNote(e);
    if (!hit) return;
    // Snap to nearest 1/16 note? For MVP, snap to 50ms grid.
    const snapped = +(Math.round(hit.time / 0.05) * 0.05).toFixed(3);
    // If a note already exists very close in this lane, do nothing (use right-click to remove).
    const exists = this.notes.find(
      (n) => n.lane === hit.lane && Math.abs(n.time - snapped) < 0.04,
    );
    if (exists) return;
    this.notes.push({ time: snapped, lane: hit.lane });
    this.notes.sort((a, b) => a.time - b.time);
    this.opts.onChange(this.notes);
  }

  private onRightClick(e: MouseEvent) {
    const hit = this.xyToNote(e);
    if (!hit) return;
    const idx = this.notes.findIndex(
      (n) => n.lane === hit.lane && Math.abs(n.time - hit.time) < 0.06,
    );
    if (idx >= 0) {
      this.notes.splice(idx, 1);
      this.opts.onChange(this.notes);
    }
  }

  private draw() {
    const c = this.opts.canvas;
    const ctx = this.ctx;
    const w = c.width;
    const h = c.height;
    const theme = getActiveTheme();
    ctx.fillStyle = theme.canvasBg;
    ctx.fillRect(0, 0, w, h);

    const playW = Math.min(w, h * 0.5);
    const x0 = (w - playW) / 2;
    const laneW = playW / LANE_COUNT;
    for (let i = 0; i < LANE_COUNT; i++) {
      ctx.fillStyle = theme.laneBg[i % 2];
      ctx.fillRect(x0 + i * laneW, 0, laneW, h);
    }
    // Lane separators.
    ctx.strokeStyle = theme.laneSeparator;
    ctx.lineWidth = 1 * this.dpr;
    for (let i = 0; i <= LANE_COUNT; i++) {
      ctx.beginPath();
      ctx.moveTo(x0 + i * laneW, 0);
      ctx.lineTo(x0 + i * laneW, h);
      ctx.stroke();
    }
    // Beat grid lines (every 0.5 sec).
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    for (let s = 0; s < this.opts.audio.durationSec; s += 0.5) {
      const y = s * PX_PER_SEC * this.dpr;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + playW, y);
      ctx.stroke();
    }
    // Notes.
    const noteH = 12 * this.dpr;
    for (const n of this.notes) {
      const y = n.time * PX_PER_SEC * this.dpr - noteH / 2;
      ctx.fillStyle = theme.noteColors[n.lane];
      ctx.fillRect(x0 + n.lane * laneW + 4 * this.dpr, y, laneW - 8 * this.dpr, noteH);
    }
    // Playhead.
    const py = this.playhead * PX_PER_SEC * this.dpr;
    ctx.strokeStyle = theme.judgmentLine;
    ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(x0, py);
    ctx.lineTo(x0 + playW, py);
    ctx.stroke();
  }
}
