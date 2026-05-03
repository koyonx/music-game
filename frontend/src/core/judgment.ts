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

interface HoldInProgress {
  pressKind: Exclude<JudgmentKind, "miss">;
  pressTime: number;
  pressDeltaMs: number;
}

export interface NoteState {
  index: number;
  note: Note;
  judgment: JudgmentKind | null; // null until processed
  actualTime: number | null;
  deltaMs: number;
  // Set on a hold note between press and release. While non-null, the note
  // isn't counted yet — release() or expireMisses() will finalize it.
  hold: HoldInProgress | null;
}

function classifyTiming(absSec: number): JudgmentKind | null {
  if (absSec <= WINDOWS.perfect) return "perfect";
  if (absSec <= WINDOWS.great) return "great";
  if (absSec <= WINDOWS.good) return "good";
  return null;
}

const RANK: Record<JudgmentKind, number> = { perfect: 3, great: 2, good: 1, miss: 0 };
function worseOf(a: JudgmentKind, b: JudgmentKind): JudgmentKind {
  return RANK[a] <= RANK[b] ? a : b;
}

function isHoldNote(n: Note): boolean {
  return !!n.holdMs && n.holdMs > 0;
}

export class Judge {
  states: NoteState[];
  combo = 0;
  maxCombo = 0;
  counts: Record<JudgmentKind, number> = {
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,
  };

  constructor(chart: Chart) {
    this.states = chart.notes
      .map((n, i) => ({
        note: n,
        index: i,
        judgment: null,
        actualTime: null,
        deltaMs: 0,
        hold: null,
      }))
      .sort((a, b) => a.note.time - b.note.time);
  }

  totalNotes(): number {
    return this.states.length;
  }

  // Closest unjudged head-of-note in `lane` to `nowSec`, within miss window.
  findHitTarget(lane: Lane, nowSec: number): NoteState | null {
    let best: NoteState | null = null;
    let bestAbs = Infinity;
    for (const s of this.states) {
      if (s.judgment !== null) continue;
      if (s.hold !== null) continue; // already being held
      if (s.note.lane !== lane) continue;
      const dt = s.note.time - nowSec;
      if (dt > WINDOWS.miss) break;
      const abs = Math.abs(dt);
      if (abs <= WINDOWS.miss && abs < bestAbs) {
        best = s;
        bestAbs = abs;
      }
    }
    return best;
  }

  press(lane: Lane, nowSec: number): { state: NoteState; kind: JudgmentKind } | null {
    const target = this.findHitTarget(lane, nowSec);
    if (!target) return null;
    const dt = nowSec - target.note.time;
    const kind = classifyTiming(Math.abs(dt));
    if (!kind) return null;

    if (isHoldNote(target.note)) {
      // Don't finalize yet — wait for release (or auto-complete past tail).
      target.hold = { pressKind: kind, pressTime: nowSec, pressDeltaMs: dt * 1000 };
      return { state: target, kind };
    }

    this.commit(target, kind, nowSec, dt * 1000);
    return { state: target, kind };
  }

  // Called when a key is released. Finalizes any hold-in-progress for this
  // lane; ignored if there isn't one.
  release(lane: Lane, nowSec: number): { state: NoteState; kind: JudgmentKind } | null {
    const held = this.states.find(
      (s) => s.judgment === null && s.hold !== null && s.note.lane === lane,
    );
    if (!held || !held.hold) return null;
    const expectedEnd = held.note.time + (held.note.holdMs ?? 0) / 1000;
    const releaseDelta = nowSec - expectedEnd;
    let finalKind: JudgmentKind;
    // Any release outside the good window (early or late) is a miss; tap
    // notes have the same rule, so don't be looser here.
    const releaseKind = classifyTiming(Math.abs(releaseDelta));
    if (!releaseKind) {
      finalKind = "miss";
    } else {
      // The worse of press / release governs the final judgment.
      finalKind = worseOf(held.hold.pressKind, releaseKind);
    }
    // Use the release time as `actualTime`; deltaMs records release timing
    // relative to the hold tail.
    this.commit(held, finalKind, nowSec, releaseDelta * 1000);
    return { state: held, kind: finalKind };
  }

  // Force-finalize unjudged notes whose windows have passed.
  // For hold notes still being held, count them with their pressKind once
  // we're past the tail-end miss window (player held through the end).
  expireMisses(nowSec: number): NoteState[] {
    const newly: NoteState[] = [];
    for (const s of this.states) {
      if (s.judgment !== null) continue;
      if (s.hold !== null) {
        const expectedEnd = s.note.time + (s.note.holdMs ?? 0) / 1000;
        if (nowSec - expectedEnd > WINDOWS.miss) {
          this.commit(s, s.hold.pressKind, expectedEnd, s.hold.pressDeltaMs);
          newly.push(s);
        }
        continue;
      }
      if (nowSec - s.note.time > WINDOWS.miss) {
        this.commit(s, "miss", null, 0);
        newly.push(s);
      }
    }
    return newly;
  }

  private commit(
    s: NoteState,
    kind: JudgmentKind,
    actualTime: number | null,
    deltaMs: number,
  ) {
    s.judgment = kind;
    s.actualTime = actualTime;
    s.deltaMs = deltaMs;
    s.hold = null;
    this.counts[kind]++;
    if (kind === "miss") {
      this.combo = 0;
    } else {
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    }
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
