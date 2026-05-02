import type {
  Chart,
  JudgmentKind,
  JudgmentRecord,
  Lane,
  Note,
  ScoreSummary,
} from "@shared/types";

// Timing windows in seconds (delta from expected note time).
export const WINDOWS = {
  perfect: 0.045, // ±45ms
  great: 0.09,
  good: 0.14,
  // Beyond this, a press in the lane is ignored (no judgment); the note will
  // miss naturally when it passes the late-miss threshold.
  miss: 0.2,
};

export const SCORE_WEIGHTS: Record<JudgmentKind, number> = {
  perfect: 1.0,
  great: 0.7,
  good: 0.4,
  miss: 0,
};

export interface NoteState {
  index: number;
  note: Note;
  judgment: JudgmentKind | null; // null until processed
  actualTime: number | null;
  deltaMs: number;
}

export class Judge {
  states: NoteState[];
  combo = 0;
  maxCombo = 0;
  // Per-judgment counts.
  counts: Record<JudgmentKind, number> = {
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,
  };

  constructor(chart: Chart) {
    // Sort by time ascending for efficient lookup.
    this.states = chart.notes
      .map((n, i) => ({ note: n, index: i, judgment: null, actualTime: null, deltaMs: 0 }))
      .sort((a, b) => a.note.time - b.note.time);
  }

  totalNotes(): number {
    return this.states.length;
  }

  // Returns the unjudged note in `lane` whose expected time is closest to
  // `nowSec`, or null if none within MISS window.
  findHitTarget(lane: Lane, nowSec: number): NoteState | null {
    let best: NoteState | null = null;
    let bestAbs = Infinity;
    for (const s of this.states) {
      if (s.judgment !== null) continue;
      if (s.note.lane !== lane) continue;
      const dt = s.note.time - nowSec;
      if (dt > WINDOWS.miss) break; // sorted; no later note can be closer
      const abs = Math.abs(dt);
      if (abs <= WINDOWS.miss && abs < bestAbs) {
        best = s;
        bestAbs = abs;
      }
    }
    return best;
  }

  // Apply a key press at time t; returns the resulting judgment for the
  // hit note (or null if no note was within window).
  press(lane: Lane, nowSec: number): { state: NoteState; kind: JudgmentKind } | null {
    const target = this.findHitTarget(lane, nowSec);
    if (!target) return null;
    const dt = nowSec - target.note.time;
    const abs = Math.abs(dt);
    let kind: JudgmentKind;
    if (abs <= WINDOWS.perfect) kind = "perfect";
    else if (abs <= WINDOWS.great) kind = "great";
    else if (abs <= WINDOWS.good) kind = "good";
    else return null; // shouldn't happen given findHitTarget bound
    target.judgment = kind;
    target.actualTime = nowSec;
    target.deltaMs = dt * 1000;
    this.counts[kind]++;
    if (kind === "miss") {
      this.combo = 0;
    } else {
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    }
    return { state: target, kind };
  }

  // Mark all notes whose expected time + miss window has passed as miss.
  // Called every frame.
  expireMisses(nowSec: number): NoteState[] {
    const newly: NoteState[] = [];
    for (const s of this.states) {
      if (s.judgment !== null) continue;
      if (nowSec - s.note.time > WINDOWS.miss) {
        s.judgment = "miss";
        s.actualTime = null;
        s.deltaMs = 0;
        this.counts.miss++;
        this.combo = 0;
        newly.push(s);
      }
    }
    return newly;
  }

  summary(): ScoreSummary {
    const total = this.totalNotes();
    let weighted = 0;
    for (const k of ["perfect", "great", "good", "miss"] as JudgmentKind[]) {
      weighted += this.counts[k] * SCORE_WEIGHTS[k];
    }
    const accuracy = total > 0 ? weighted / total : 0;
    const score = Math.round(accuracy * 1_000_000);
    const fullCombo = this.counts.miss === 0;
    const allPerfect = this.counts.miss === 0 && this.counts.great === 0 && this.counts.good === 0;
    return {
      perfect: this.counts.perfect,
      great: this.counts.great,
      good: this.counts.good,
      miss: this.counts.miss,
      maxCombo: this.maxCombo,
      totalNotes: total,
      score,
      accuracy,
      fullCombo,
      allPerfect,
    };
  }

  judgments(): JudgmentRecord[] {
    return this.states.map((s) => ({
      noteIndex: s.index,
      lane: s.note.lane,
      expectedTime: s.note.time,
      actualTime: s.actualTime,
      judgment: s.judgment ?? "miss",
      deltaMs: s.deltaMs,
    }));
  }
}
