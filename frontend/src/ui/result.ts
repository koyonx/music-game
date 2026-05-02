import type { Chart, ScoreSummary, Song } from "@shared/types";
import { navigate } from "./router";
import { renderGame } from "./game";
import { renderSongSelect } from "./songSelect";

export const renderResult = (
  host: HTMLElement,
  song: Song,
  chart: Chart,
  summary: ScoreSummary,
) => {
  const root = document.createElement("div");
  root.className = "screen";
  root.innerHTML = `
    <div class="screen-header">
      <h1>Result</h1>
      <button id="back">← Songs</button>
    </div>
    <div class="result">
      <div style="text-align:center;color:var(--fg-muted);">${escape(song.title)} · ${chart.difficulty.toUpperCase()}</div>
      <div class="score-big">${summary.score.toString().padStart(6, "0")}</div>
      <div style="text-align:center;color:var(--fg-muted);font-size:13px;">Accuracy ${(summary.accuracy * 100).toFixed(2)}%</div>
      <div class="judgment-grid">
        <div><span>Perfect</span><b>${summary.perfect}</b></div>
        <div><span>Great</span><b>${summary.great}</b></div>
        <div><span>Good</span><b>${summary.good}</b></div>
        <div><span>Miss</span><b>${summary.miss}</b></div>
      </div>
      <div style="text-align:center;font-size:13px;color:var(--fg-muted);">
        Max Combo ${summary.maxCombo} / ${summary.totalNotes}
        ${summary.allPerfect ? " · 🏆 ALL PERFECT" : summary.fullCombo ? " · ⭐ FULL COMBO" : ""}
      </div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:24px;">
        <button id="retry" class="primary">Retry</button>
        <button id="quit">Quit</button>
      </div>
    </div>
  `;
  host.appendChild(root);
  const close = () => navigate(renderSongSelect);
  root.querySelector<HTMLButtonElement>("#back")!.onclick = close;
  root.querySelector<HTMLButtonElement>("#quit")!.onclick = close;
  root.querySelector<HTMLButtonElement>("#retry")!.onclick = () =>
    navigate((h) => renderGame(h, song, chart));
  return () => {};
};

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}
