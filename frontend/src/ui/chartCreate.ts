// "New Chart" wizard: pick a creation method (manual blank, local AI, Claude AI),
// then route to the editor (or directly save the AI-generated chart).

import { navigate, toast, type ScreenFn } from "./router";
import type { Chart, Difficulty, Song } from "@shared/types";
import { api } from "../api/client";
import { getAudio } from "../storage/db";
import { analyzeAudio, generateChart as generateLocalChart } from "../ai/localAnalyzer";
import { generateChartViaClaude } from "../ai/claudeClient";
import { renderEditor } from "./editorScreen";
import { renderSongSelect } from "./songSelect";

export const renderChartCreate = (host: HTMLElement, song: Song) => {
  const root = document.createElement("div");
  root.className = "screen";
  root.innerHTML = `
    <div class="screen-header">
      <h1>New Chart — ${escape(song.title)}</h1>
      <button id="back">← Back</button>
    </div>
    <div class="field">
      <label>Difficulty</label>
      <select id="difficulty">
        <option value="easy">Easy</option>
        <option value="normal" selected>Normal</option>
        <option value="hard">Hard</option>
        <option value="expert">Expert</option>
      </select>
    </div>
    <div class="menu">
      <button id="manual">✏ Manual
        <span class="sub">空の譜面を作ってエディタで編集</span>
      </button>
      <button id="localAI">🎵 Local AI
        <span class="sub">ブラウザ内のオーディオ解析で自動生成</span>
      </button>
      <button id="claudeAI">✨ Claude AI
        <span class="sub">サーバ経由で Claude API に生成依頼</span>
      </button>
    </div>
    <div id="status" style="color: var(--fg-muted); font-size: 13px; margin-top: 16px;"></div>
  `;
  host.appendChild(root);

  const difficultyEl = root.querySelector<HTMLSelectElement>("#difficulty")!;
  const status = root.querySelector<HTMLDivElement>("#status")!;

  root.querySelector<HTMLButtonElement>("#back")!.onclick = () =>
    navigate(renderSongSelect);

  root.querySelector<HTMLButtonElement>("#manual")!.onclick = async () => {
    // Empty chart — go straight to editor.
    const chart = await api.charts.create({
      songId: song.id,
      difficulty: difficultyEl.value as Difficulty,
      level: 1,
      bpm: song.bpm ?? 120,
      offsetMs: 0,
      source: "manual",
      notes: [],
    });
    navigate((h) => renderEditor(h, song, chart));
  };

  root.querySelector<HTMLButtonElement>("#localAI")!.onclick = async () => {
    status.textContent = "Loading audio...";
    const blob = await getAudio(song.audioHash);
    if (!blob) {
      status.textContent = "Audio file not found in local storage. Re-upload the song.";
      return;
    }
    status.textContent = "Analyzing audio (onset detection, BPM)... this may take 5–15s.";
    try {
      const features = await analyzeAudio(blob);
      const chart = generateLocalChart(features, difficultyEl.value as Difficulty);
      const created = await api.charts.create({ songId: song.id, ...chart });
      toast(`Generated ${chart.notes.length} notes`);
      navigate((h) => renderEditor(h, song, created));
    } catch (e) {
      status.textContent = `Error: ${(e as Error).message}`;
    }
  };

  root.querySelector<HTMLButtonElement>("#claudeAI")!.onclick = async () => {
    status.textContent = "Loading audio...";
    const blob = await getAudio(song.audioHash);
    if (!blob) {
      status.textContent = "Audio file not found in local storage.";
      return;
    }
    status.textContent = "Analyzing audio for features...";
    let features;
    try {
      features = await analyzeAudio(blob);
    } catch (e) {
      status.textContent = `Audio analysis failed: ${(e as Error).message}`;
      return;
    }
    status.textContent = "Calling Claude (this may take 10–30s)...";
    try {
      const chart = await generateChartViaClaude(
        song.title,
        features,
        difficultyEl.value as Difficulty,
      );
      const created = await api.charts.create({ songId: song.id, ...chart, source: "claude-ai" });
      toast(`Claude generated ${created.notes.length} notes`);
      navigate((h) => renderEditor(h, song, created));
    } catch (e) {
      status.textContent = `Claude error: ${(e as Error).message}`;
    }
  };

  return () => {};
};

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}
