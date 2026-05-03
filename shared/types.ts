// Shared types between frontend and api.
// Both services bind-mount /shared in dev.

export const LANE_COUNT = 6;
export type Lane = 0 | 1 | 2 | 3 | 4 | 5;

export type Difficulty = "easy" | "normal" | "hard" | "expert";
export type ChartSource = "manual" | "local-ai" | "claude-ai";

export type JudgmentKind = "perfect" | "great" | "good" | "miss";

// A single note. `time` is seconds from song start.
// `holdMs` (optional, in milliseconds) for long notes; omit/0 = tap.
export interface Note {
  time: number;
  lane: Lane;
  holdMs?: number;
}

export interface Chart {
  id?: string;
  songId: string;
  difficulty: Difficulty;
  level: number; // 1-20 ish
  bpm: number;
  offsetMs: number;
  source: ChartSource;
  notes: Note[];
  createdAt?: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  durationSec: number;
  bpm?: number;
  audioHash: string; // sha-256 of the audio file, used as IndexedDB key
  createdAt?: string;
}

export interface ScoreSummary {
  perfect: number;
  great: number;
  good: number;
  miss: number;
  maxCombo: number;
  totalNotes: number;
  score: number; // 0..1_000_000
  accuracy: number; // 0..1
  fullCombo: boolean;
  allPerfect: boolean;
}

export interface JudgmentRecord {
  noteIndex: number;
  lane: Lane;
  expectedTime: number; // sec
  actualTime: number | null; // sec; null if missed (no input)
  judgment: JudgmentKind;
  deltaMs: number; // actualTime - expectedTime in ms; 0 if miss with no input
}

export interface ScorePost {
  chartId: string;
  playerId?: string;
  themeUsed: string;
  summary: ScoreSummary;
  judgments: JudgmentRecord[];
  playedAt?: string;
}

export interface ScoreRecord extends ScorePost {
  id: string;
  playedAt: string;
}

export interface ChartStats {
  chartId: string;
  bestScore: number;
  bestAccuracy: number;
  playCount: number;
  lastPlayedAt: string | null;
  fullComboCount: number;
  allPerfectCount: number;
}

// ---------- AI generation ----------

export interface AudioFeatures {
  durationSec: number;
  bpm: number;
  // Beat times in seconds.
  beats: number[];
  // Onsets with optional spectral band (0=low, 1=mid, 2=high) hint for lane mapping.
  onsets: { time: number; band: 0 | 1 | 2; strength: number }[];
}

export interface AiGenerateRequest {
  songTitle: string;
  difficulty: Difficulty;
  features: AudioFeatures;
}

export interface AiGenerateResponse {
  chart: Omit<Chart, "id" | "songId" | "createdAt">;
}
