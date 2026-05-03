import { navigate, toast, type ScreenFn } from "./router";
import { api } from "../api/client";
import type { Chart, ChartStats, Song } from "@shared/types";
import { renderMenu } from "./menu";
import { renderGame } from "./game";
import { renderChartCreate } from "./chartCreate";
import { renderEditor } from "./editorScreen";

export const renderSongSelect: ScreenFn = (host) => {
  const root = document.createElement("div");
  root.className = "screen";
  root.innerHTML = `
    <div class="screen-header">
      <h1>Songs</h1>
      <div class="actions">
        <button id="back">← Menu</button>
      </div>
    </div>
    <div id="list" class="song-list"></div>
  `;
  host.appendChild(root);
  root.querySelector<HTMLButtonElement>("#back")!.onclick = () => navigate(renderMenu);

  const list = root.querySelector<HTMLDivElement>("#list")!;
  list.textContent = "Loading...";

  (async () => {
    let songs: Song[] = [];
    try {
      songs = await api.songs.list();
    } catch (e) {
      list.textContent = `Error: ${(e as Error).message}`;
      return;
    }
    if (!songs.length) {
      list.innerHTML = `<div class="empty">楽曲がありません。<br/>メニューに戻って "Upload Song" から追加してください。</div>`;
      return;
    }
    list.innerHTML = "";
    for (const song of songs) {
      const row = document.createElement("div");
      row.className = "song-item";
      row.innerHTML = `
        <div>
          <div class="title">${escape(song.title)}</div>
          <div class="meta">${escape(song.artist || "(no artist)")} · ${song.durationSec.toFixed(1)}s</div>
        </div>
        <button data-act="charts">Charts</button>
        <button data-act="del">Delete</button>
      `;
      list.appendChild(row);
      row.querySelector<HTMLButtonElement>('[data-act="charts"]')!.onclick = (e) => {
        e.stopPropagation();
        showCharts(song);
      };
      row.querySelector<HTMLButtonElement>('[data-act="del"]')!.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm(`Delete "${song.title}"?`)) return;
        await api.songs.delete(song.id);
        navigate(renderSongSelect);
      };
      row.onclick = () => showCharts(song);
    }
  })();

  return () => {};
};

async function showCharts(song: Song) {
  const charts = await api.charts.listForSong(song.id);
  const wrap = document.createElement("div");
  wrap.className = "screen";
  wrap.innerHTML = `
    <div class="screen-header">
      <h1>${escape(song.title)} <small style="color:var(--fg-muted);font-weight:400;">${escape(song.artist || "")}</small></h1>
      <div class="actions">
        <button id="back">← Songs</button>
      </div>
    </div>
    <div class="row" style="margin-bottom: 16px;">
      <button class="primary" id="new">＋ New Chart</button>
    </div>
    <div id="charts" class="song-list"></div>
  `;
  document.getElementById("app")!.innerHTML = "";
  document.getElementById("app")!.appendChild(wrap);

  wrap.querySelector<HTMLButtonElement>("#back")!.onclick = () =>
    navigate(renderSongSelect);
  wrap.querySelector<HTMLButtonElement>("#new")!.onclick = () =>
    navigate((host) => renderChartCreate(host, song));

  const cl = wrap.querySelector<HTMLDivElement>("#charts")!;
  if (!charts.length) {
    cl.innerHTML = `<div class="empty">譜面がまだありません。"+ New Chart" から作成してください。</div>`;
    return;
  }
  for (const chart of charts) {
    let stats: ChartStats | null = null;
    try {
      stats = await api.scores.stats(chart.id!);
    } catch {}
    const item = document.createElement("div");
    item.className = "song-item";
    item.innerHTML = `
      <div>
        <div class="title">${chart.difficulty.toUpperCase()} · Lv ${chart.level} · ${chart.notes.length} notes</div>
        <div class="meta">source: ${chart.source} · BPM ${Math.round(chart.bpm)} · best: ${stats?.bestScore ?? 0} (${((stats?.bestAccuracy ?? 0) * 100).toFixed(1)}%) · plays: ${stats?.playCount ?? 0}</div>
      </div>
      <button data-act="play" class="primary">Play</button>
      <button data-act="edit">Edit</button>
    `;
    cl.appendChild(item);
    item.querySelector<HTMLButtonElement>('[data-act="play"]')!.onclick = () =>
      navigate((h) => renderGame(h, song, chart));
    item.querySelector<HTMLButtonElement>('[data-act="edit"]')!.onclick = () =>
      navigate((h) => renderEditor(h, song, chart));
  }
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}
