import { navigate, type ScreenFn } from "./router";
import type { Chart, Song } from "@shared/types";
import { getAudio } from "../storage/db";
import { loadAudio } from "../core/audio";
import { Game } from "../core/game";
import { renderResult } from "./result";
import { renderSongSelect } from "./songSelect";
import { getActiveTheme } from "../themes/themes";
import { api } from "../api/client";

export const renderGame = (host: HTMLElement, song: Song, chart: Chart) => {
  const root = document.createElement("div");
  root.className = "game-screen";
  root.innerHTML = `
    <div class="game-hud">
      <div class="left">
        <div>${escape(song.title)}</div>
        <div style="font-size:11px;color:var(--fg-muted)">${chart.difficulty.toUpperCase()} · Lv ${chart.level}</div>
      </div>
      <div class="right" id="score">000000  combo 0</div>
    </div>
    <canvas id="game-canvas" style="width:100%;height:100%"></canvas>
  `;
  host.appendChild(root);

  const canvas = root.querySelector<HTMLCanvasElement>("#game-canvas")!;
  const scoreEl = root.querySelector<HTMLDivElement>("#score")!;

  let game: Game | null = null;
  let cancelled = false;

  const onKey = (e: KeyboardEvent) => {
    if (e.code === "Escape") {
      cancelled = true;
      game?.stop();
      navigate(renderSongSelect);
    }
  };
  window.addEventListener("keydown", onKey);

  (async () => {
    const blob = await getAudio(song.audioHash);
    if (!blob) {
      alert("Audio not found in local storage. Re-upload the song.");
      navigate(renderSongSelect);
      return;
    }
    const audio = await loadAudio(blob);
    game = new Game({
      audio,
      chart,
      canvas,
      onComboChange: () => updateHud(),
      onJudgment: () => updateHud(),
      onEnd: async () => {
        if (cancelled) return;
        const summary = game!.judge.summary();
        const judgments = game!.judge.judgments();
        try {
          await api.scores.post({
            chartId: chart.id!,
            themeUsed: getActiveTheme().id,
            summary,
            judgments,
          });
        } catch (e) {
          console.error("save score failed:", e);
        }
        navigate((h) => renderResult(h, song, chart, summary));
      },
    });
    function updateHud() {
      const s = game!.judge.summary();
      scoreEl.textContent = `${s.score.toString().padStart(6, "0")}  combo ${game!.judge.combo}`;
    }
    // Allow user to read the chart for 800ms before audio starts.
    setTimeout(() => game!.start(), 800);
  })();

  return () => {
    cancelled = true;
    game?.stop();
    window.removeEventListener("keydown", onKey);
  };
};

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}
