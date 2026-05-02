// Browser-only audio analysis: onset detection, tempo estimation,
// 6-lane note generation. Pure Web Audio API + arithmetic — no extra deps.

import type { AudioFeatures, Chart, Difficulty, Lane, Note } from "@shared/types";

const HOP = 512;
const FFT = 1024;
// Spectral band split (0=low/bass, 1=mid, 2=high) by FFT bin index.
function bandFor(bin: number, totalBins: number): 0 | 1 | 2 {
  const r = bin / totalBins;
  if (r < 0.1) return 0;
  if (r < 0.45) return 1;
  return 2;
}

interface OnsetCandidate {
  time: number;
  band: 0 | 1 | 2;
  strength: number;
}

// Decode + analyze audio Blob into features.
export async function analyzeAudio(blob: Blob): Promise<AudioFeatures> {
  const arr = await blob.arrayBuffer();
  // OfflineAudioContext for fast offline decode/processing.
  const tempCtx = new OfflineAudioContext(1, 1, 44100);
  const buffer = await tempCtx.decodeAudioData(arr.slice(0));
  const sampleRate = buffer.sampleRate;
  // Mix to mono.
  const mono = mixToMono(buffer);
  const onsets = detectOnsets(mono, sampleRate);
  const beats = inferBeats(onsets, mono.length / sampleRate);
  const bpm = estimateBpm(onsets);
  return {
    durationSec: buffer.duration,
    bpm,
    beats,
    onsets,
  };
}

function mixToMono(buf: AudioBuffer): Float32Array {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0);
  const len = buf.length;
  const out = new Float32Array(len);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const c = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) out[i] += c[i];
  }
  for (let i = 0; i < len; i++) out[i] /= buf.numberOfChannels;
  return out;
}

// Simple spectral-flux onset detector.
function detectOnsets(samples: Float32Array, sr: number): OnsetCandidate[] {
  const window = makeHann(FFT);
  const re = new Float32Array(FFT);
  const im = new Float32Array(FFT);
  let prevMag: Float32Array | null = null;
  const flux: { time: number; total: number; bandFlux: [number, number, number] }[] = [];
  for (let pos = 0; pos + FFT <= samples.length; pos += HOP) {
    for (let i = 0; i < FFT; i++) {
      re[i] = samples[pos + i] * window[i];
      im[i] = 0;
    }
    fftInPlace(re, im);
    const mag = new Float32Array(FFT / 2);
    for (let i = 0; i < FFT / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
    if (prevMag) {
      let total = 0;
      const bandFlux: [number, number, number] = [0, 0, 0];
      for (let i = 0; i < FFT / 2; i++) {
        const d = mag[i] - prevMag[i];
        if (d > 0) {
          total += d;
          bandFlux[bandFor(i, FFT / 2)] += d;
        }
      }
      flux.push({ time: pos / sr, total, bandFlux });
    }
    prevMag = mag;
  }
  // Adaptive threshold: peaks above local mean * factor.
  const out: OnsetCandidate[] = [];
  const window2 = 8;
  for (let i = 1; i < flux.length - 1; i++) {
    const start = Math.max(0, i - window2);
    const end = Math.min(flux.length, i + window2 + 1);
    let mean = 0;
    for (let j = start; j < end; j++) mean += flux[j].total;
    mean /= end - start;
    const cur = flux[i];
    if (
      cur.total > mean * 1.6 &&
      cur.total > flux[i - 1].total &&
      cur.total > flux[i + 1].total
    ) {
      // Pick dominant band.
      let band: 0 | 1 | 2 = 0;
      let bMax = -1;
      for (let b = 0; b < 3; b++) {
        const v = cur.bandFlux[b];
        if (v > bMax) {
          bMax = v;
          band = b as 0 | 1 | 2;
        }
      }
      const strength = Math.min(1, cur.total / (mean * 4 + 1e-6));
      out.push({ time: cur.time, band, strength });
    }
  }
  return out;
}

function makeHann(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}

// Iterative radix-2 Cooley-Tukey FFT in-place. n must be power of 2.
function fftInPlace(re: Float32Array, im: Float32Array) {
  const n = re.length;
  // Bit reversal.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const tRe = curRe * re[i + k + len / 2] - curIm * im[i + k + len / 2];
        const tIm = curRe * im[i + k + len / 2] + curIm * re[i + k + len / 2];
        re[i + k + len / 2] = re[i + k] - tRe;
        im[i + k + len / 2] = im[i + k] - tIm;
        re[i + k] += tRe;
        im[i + k] += tIm;
        const ncRe = curRe * wRe - curIm * wIm;
        const ncIm = curRe * wIm + curIm * wRe;
        curRe = ncRe;
        curIm = ncIm;
      }
    }
  }
}

// Estimate BPM via inter-onset interval histogram.
function estimateBpm(onsets: OnsetCandidate[]): number {
  if (onsets.length < 4) return 120;
  // Build histogram of intervals in 60..180 BPM range.
  const intervals: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    const dt = onsets[i].time - onsets[i - 1].time;
    if (dt > 0.2 && dt < 1.5) intervals.push(dt);
  }
  if (!intervals.length) return 120;
  // Vote for BPMs.
  const votes = new Map<number, number>();
  for (const dt of intervals) {
    const bpm = 60 / dt;
    // Fold octaves into 70..180.
    let folded = bpm;
    while (folded < 70) folded *= 2;
    while (folded > 180) folded /= 2;
    const rounded = Math.round(folded);
    votes.set(rounded, (votes.get(rounded) ?? 0) + 1);
  }
  let bestBpm = 120;
  let bestVotes = -1;
  for (const [bpm, v] of votes) {
    if (v > bestVotes) {
      bestVotes = v;
      bestBpm = bpm;
    }
  }
  return bestBpm;
}

function inferBeats(onsets: OnsetCandidate[], duration: number): number[] {
  // Estimate beat times by snapping to BPM grid starting at first strong onset.
  if (!onsets.length) return [];
  const bpm = estimateBpm(onsets);
  const period = 60 / bpm;
  const start = onsets[0].time;
  const beats: number[] = [];
  for (let t = start; t < duration; t += period) beats.push(t);
  return beats;
}

const DENSITY: Record<Difficulty, number> = {
  easy: 1.5,
  normal: 3.0,
  hard: 5.0,
  expert: 8.0,
};

// Convert features to a Chart by selecting onsets to fit target density.
export function generateChart(
  features: AudioFeatures,
  difficulty: Difficulty,
): Omit<Chart, "id" | "songId" | "createdAt"> {
  const target = DENSITY[difficulty];
  const playable = Math.max(1, features.durationSec - 2.0); // 1.5s lead-in + 0.5s tail
  const targetCount = Math.round(target * playable);

  const candidates = features.onsets
    .filter((o) => o.time > 1.5 && o.time < features.durationSec - 0.5)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, Math.max(targetCount * 2, 20))
    .sort((a, b) => a.time - b.time);

  const notes: Note[] = [];
  const lastInLane: number[] = [-1, -1, -1, -1, -1, -1];
  // Simple round-robin within band group, with per-lane cooldown.
  const lanesByBand: Record<0 | 1 | 2, Lane[]> = {
    0: [0, 1, 4, 5],
    1: [1, 2, 3, 4],
    2: [0, 2, 3, 5],
  };
  let placed = 0;
  for (const o of candidates) {
    if (placed >= targetCount) break;
    const lanes = lanesByBand[o.band];
    // Pick the lane in the group with the oldest last-note (most cooled down).
    let bestLane: Lane = lanes[0];
    let bestT = lastInLane[bestLane];
    for (const l of lanes) {
      if (lastInLane[l] < bestT) {
        bestLane = l;
        bestT = lastInLane[l];
      }
    }
    if (o.time - lastInLane[bestLane] < 0.08) continue; // cooldown 80ms
    notes.push({ time: +o.time.toFixed(3), lane: bestLane });
    lastInLane[bestLane] = o.time;
    placed++;
  }

  // Suggested level (1..20-ish) by density.
  const level = Math.max(1, Math.min(20, Math.round(target * 2.5)));

  return {
    difficulty,
    level,
    bpm: features.bpm,
    offsetMs: 0,
    source: "local-ai",
    notes,
  };
}
