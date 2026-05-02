import { navigate } from "./router";
import { api } from "../api/client";
import { renderMenu } from "./menu";
import type { Chart, ScoreRecord, Song } from "@shared/types";

export const renderScoreHistory = (host: HTMLElement) => {
  const root = document.createElement("div");
  root.className = "screen";
  root.innerHTML = `
    <div class="screen-header">
      <h1>Score History</h1>
      <button id="back">← Menu</button>
    </div>
    <div id="content">Loading...</div>
  `;
  host.appendChild(root);
  root.querySelector<HTMLButtonElement>("#back")!.onclick = () => navigate(renderMenu);

  (async () => {
    const [scores, songs] = await Promise.all([
      api.scores.list(undefined, 200),
      api.songs.list(),
    ]);
    if (!scores.length) {
      root.querySelector<HTMLDivElement>("#content")!.innerHTML =
        `<div class="empty">プレイ履歴がまだありません。</div>`;
      return;
    }
    // Need chart->song mapping; fetch each chart referenced.
    const chartIds = Array.from(new Set(scores.map((s) => s.chartId)));
    const charts = (await Promise.all(chartIds.map((id) => api.charts.get(id).catch(() => null))))
      .filter((c): c is Chart => !!c);
    const songMap = new Map(songs.map((s) => [s.id, s]));
    const chartMap = new Map(charts.map((c) => [c.id!, c]));

    const html = `
      <table class="score-table">
        <thead>
          <tr>
            <th>Date</th><th>Song</th><th>Diff</th><th>Score</th><th>Acc</th>
            <th>Combo</th><th>P/G/G/M</th><th>Theme</th>
          </tr>
        </thead>
        <tbody>
          ${scores
            .map((s: ScoreRecord) => {
              const chart = chartMap.get(s.chartId);
              const song = chart ? songMap.get(chart.songId) : undefined;
              const date = new Date(s.playedAt).toLocaleString();
              return `
                <tr>
                  <td>${date}</td>
                  <td>${escape(song?.title ?? "(deleted)")}</td>
                  <td>${chart ? chart.difficulty : "-"}</td>
                  <td>${s.score.toString().padStart(6, "0")}${s.allPerfect ? " 🏆" : s.fullCombo ? " ⭐" : ""}</td>
                  <td>${(s.accuracy * 100).toFixed(2)}%</td>
                  <td>${s.maxCombo}</td>
                  <td>${s.perfect}/${s.great}/${s.good}/${s.miss}</td>
                  <td>${s.themeUsed}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
    root.querySelector<HTMLDivElement>("#content")!.innerHTML = html;
  })().catch((e) => {
    root.querySelector<HTMLDivElement>("#content")!.textContent = `Error: ${e.message}`;
  });

  return () => {};
};

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}
