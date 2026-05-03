import { LANE_COUNT, type Chart, type JudgmentKind, type Lane } from "@shared/types";
import type { AudioHandle } from "./audio";
import { InputManager } from "./input";
import { Judge, WINDOWS } from "./judgment";
import { getActiveTheme, type ThemePalette } from "../themes/themes";

// Extra real-time we keep the loop alive past the audio buffer end so that
// late notes (positive offset) and miss-window expiry have time to resolve.
const END_TAIL_SEC = 0.5;

export interface GameOptions {
  audio: AudioHandle;
  chart: Chart;
  canvas: HTMLCanvasElement;
  // Time (sec) it takes a note to fall from top to judgment line.
  scrollSec?: number;
  // Audio offset adjustment (sec). Positive = audio delayed.
  audioOffsetSec?: number;
  onEnd: () => void;
  onComboChange?: (combo: number) => void;
  onJudgment?: (kind: JudgmentKind, lane: Lane) => void;
}

interface HitFlash {
  lane: Lane;
  startedAt: number;
  kind: JudgmentKind;
}

export class Game {
  private opts: Required<Omit<GameOptions, "onComboChange" | "onJudgment">> & {
    onComboChange?: (combo: number) => void;
    onJudgment?: (kind: JudgmentKind, lane: Lane) => void;
  };
  private ctx: CanvasRenderingContext2D;
  private input: InputManager;
  judge: Judge;
  private theme: ThemePalette;
  private rafId = 0;
  private running = false;
  private flashes: HitFlash[] = [];
  private lastJudgment: { kind: JudgmentKind; at: number } | null = null;
  private dpr = Math.max(1, window.devicePixelRatio || 1);

  constructor(opts: GameOptions) {
    this.opts = {
      scrollSec: 1.1,
      audioOffsetSec: 0,
      ...opts,
    } as Required<Omit<GameOptions, "onComboChange" | "onJudgment">> & {
      onComboChange?: (combo: number) => void;
      onJudgment?: (kind: JudgmentKind, lane: Lane) => void;
    };
    const ctx = opts.canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.judge = new Judge(opts.chart);
    this.theme = getActiveTheme();
    this.input = new InputManager(() => this.now());
    this.input.onPress(({ lane, timeSec }) => this.handlePress(lane, timeSec));
    this.input.onRelease((lane, timeSec) => this.handleRelease(lane, timeSec));
    this.resizeCanvas();
  }

  async start() {
    this.resizeCanvas();
    this.input.attach();
    // Wait for audio to actually begin (resume on suspended contexts) so the
    // loop's first frame isn't drawn before playback exists.
    await this.opts.audio.start(0);
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.input.detach();
    // Best-effort: close the AudioContext so we don't accumulate them
    // across sessions. Browsers (notably Safari/iOS) cap concurrent
    // contexts and will silently refuse playback once the cap is hit.
    void this.opts.audio.close();
  }

  private now(): number {
    return this.opts.audio.elapsedSec() - this.opts.audioOffsetSec;
  }

  private handlePress(lane: Lane, t: number) {
    const result = this.judge.press(lane, t);
    if (result) {
      this.flashes.push({ lane, startedAt: performance.now(), kind: result.kind });
      // Hold notes don't show judgment text on press — wait for release.
      const isHold = !!(result.state.note.holdMs && result.state.note.holdMs > 0);
      if (!isHold) {
        this.lastJudgment = { kind: result.kind, at: performance.now() };
        this.opts.onComboChange?.(this.judge.combo);
      }
      this.opts.onJudgment?.(result.kind, lane);
    }
  }

  private handleRelease(lane: Lane, t: number) {
    const result = this.judge.release(lane, t);
    if (result) {
      this.lastJudgment = { kind: result.kind, at: performance.now() };
      this.opts.onComboChange?.(this.judge.combo);
      this.opts.onJudgment?.(result.kind, lane);
    }
  }

  private loop = () => {
    if (!this.running) return;
    const t = this.now();
    const expired = this.judge.expireMisses(t);
    if (expired.length) {
      this.lastJudgment = { kind: "miss", at: performance.now() };
      this.opts.onComboChange?.(this.judge.combo);
      for (const s of expired) this.opts.onJudgment?.("miss", s.note.lane);
    }
    this.draw(t);
    // End condition: judgment-clock has passed the chart's playable region.
    // The chart-time (`t`) the player sees is `audioElapsed - offset`, so the
    // last note becomes hittable up to `WINDOWS.miss` after its scheduled
    // chart-time. We give an additional `END_TAIL_SEC` margin before forcing
    // any leftover notes to miss. `now()` keeps ticking off the AudioContext
    // clock even after the buffer ends, so positive offsets don't truncate
    // the tail.
    const lastNoteTime = this.judge.states.length
      ? this.judge.states[this.judge.states.length - 1].note.time
      : 0;
    const playableEnd = Math.max(this.opts.audio.durationSec, lastNoteTime + WINDOWS.miss);
    if (t > playableEnd + END_TAIL_SEC) {
      this.judge.expireMisses(Number.POSITIVE_INFINITY);
      this.running = false;
      this.opts.onEnd();
      return;
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  private resizeCanvas() {
    const c = this.opts.canvas;
    const rect = c.getBoundingClientRect();
    c.width = Math.max(1, Math.floor(rect.width * this.dpr));
    c.height = Math.max(1, Math.floor(rect.height * this.dpr));
  }

  private draw(t: number) {
    const c = this.opts.canvas;
    const w = c.width;
    const h = c.height;
    const ctx = this.ctx;
    const theme = this.theme;

    ctx.fillStyle = theme.canvasBg;
    ctx.fillRect(0, 0, w, h);

    // Lane geometry: 6 lanes centered, with side margins.
    const playW = Math.min(w, h * 0.75); // keep aspect reasonable
    const laneW = playW / LANE_COUNT;
    const x0 = (w - playW) / 2;
    const judgeY = h - h * 0.12;

    // Lane backgrounds.
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

    // Pressed-key highlight at the judgment area.
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      if (this.input.isDown(lane as Lane)) {
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(x0 + lane * laneW, judgeY - h * 0.05, laneW, h * 0.05);
      }
    }

    // Judgment line.
    ctx.strokeStyle = theme.judgmentLine;
    ctx.lineWidth = 3 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(x0, judgeY);
    ctx.lineTo(x0 + playW, judgeY);
    ctx.stroke();

    // Notes: only those visible within scroll window.
    const scroll = this.opts.scrollSec;
    const visibleHeight = judgeY; // notes travel from y=0 to y=judgeY over `scroll` sec
    const noteH = Math.max(10 * this.dpr, h * 0.018);
    for (const s of this.judge.states) {
      if (s.judgment !== null && s.actualTime !== null) continue; // hit; don't draw
      if (s.judgment === "miss") continue;
      const dt = s.note.time - t; // seconds until hit
      if (dt > scroll || dt < -WINDOWS.miss) continue;
      const progress = 1 - dt / scroll; // 0 at top spawn, 1 at judgment line
      const y = progress * visibleHeight - noteH / 2;
      const lane = s.note.lane;
      ctx.fillStyle = theme.noteColors[lane];
      const nx = x0 + lane * laneW + 4 * this.dpr;
      const nw = laneW - 8 * this.dpr;
      ctx.fillRect(nx, y, nw, noteH);
      // Hold tail.
      if (s.note.holdMs && s.note.holdMs > 0) {
        const holdSec = s.note.holdMs / 1000;
        const holdEndDt = dt + holdSec;
        const tailProgress = 1 - holdEndDt / scroll;
        const tailY = tailProgress * visibleHeight - noteH / 2;
        ctx.fillStyle = theme.holdColor;
        const yTop = Math.min(y, tailY) + noteH;
        const yBot = Math.max(y, tailY);
        if (yBot > yTop) ctx.fillRect(nx + nw * 0.2, yTop, nw * 0.6, yBot - yTop);
      }
    }

    // Hit flashes.
    const nowMs = performance.now();
    this.flashes = this.flashes.filter((f) => nowMs - f.startedAt < 200);
    for (const f of this.flashes) {
      const age = (nowMs - f.startedAt) / 200;
      ctx.globalAlpha = 1 - age;
      ctx.fillStyle = theme.hitFlash;
      ctx.fillRect(x0 + f.lane * laneW, judgeY - h * 0.06, laneW, h * 0.06);
      ctx.globalAlpha = 1;
    }

    // Last judgment text.
    if (this.lastJudgment && nowMs - this.lastJudgment.at < 600) {
      const age = (nowMs - this.lastJudgment.at) / 600;
      ctx.globalAlpha = 1 - age;
      ctx.fillStyle = theme.judgmentText[this.lastJudgment.kind];
      ctx.font = `bold ${28 * this.dpr}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(
        this.lastJudgment.kind.toUpperCase(),
        x0 + playW / 2,
        judgeY - h * 0.15,
      );
      ctx.globalAlpha = 1;
    }

    // Combo.
    if (this.judge.combo > 0) {
      ctx.fillStyle = theme.fg;
      ctx.font = `bold ${20 * this.dpr}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`${this.judge.combo}`, x0 + playW / 2, judgeY - h * 0.22);
    }
  }
}
