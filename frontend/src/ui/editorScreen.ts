import type { Chart, Song } from "@shared/types";
import { navigate, toast, type ScreenFn } from "./router";
import { getAudio } from "../storage/db";
import { loadAudio, type AudioHandle } from "../core/audio";
import { Editor } from "../editor/editor";
import { api } from "../api/client";
import { renderSongSelect } from "./songSelect";
import { renderGame } from "./game";

export const renderEditor = (host: HTMLElement, song: Song, chart: Chart) => {
  const root = document.createElement("div");
  root.className = "screen editor";
  root.innerHTML = `
    <div class="editor-toolbar">
      <button id="back">← Back</button>
      <button id="play">▶ Play</button>
      <button id="pause">■ Stop</button>
      <span style="margin-left:12px;font-size:12px;color:var(--fg-muted);">${escape(song.title)} · ${chart.difficulty.toUpperCase()}</span>
      <span style="flex:1"></span>
      <label style="font-size:12px;color:var(--fg-muted);">BPM</label>
      <input id="bpm" type="number" min="40" max="300" step="0.1" value="${chart.bpm}" style="width:80px;" />
      <label style="font-size:12px;color:var(--fg-muted);">Offset(ms)</label>
      <input id="offset" type="number" step="1" value="${chart.offsetMs}" style="width:80px;" />
      <label style="font-size:12px;color:var(--fg-muted);">Lvl</label>
      <input id="level" type="number" min="1" max="30" value="${chart.level}" style="width:60px;" />
      <button id="save" class="primary">Save</button>
      <button id="test" class="primary">Test Play</button>
    </div>
    <div class="editor-canvas-wrap" id="wrap">
      <canvas id="ec" style="width:100%"></canvas>
    </div>
    <div class="editor-status" id="status">クリック: ノーツ追加 / 右クリック: 削除 / 50ms グリッドにスナップ</div>
  `;
  host.appendChild(root);

  let audio: AudioHandle | null = null;
  let editor: Editor | null = null;
  let notes = chart.notes.slice();
  let cancelled = false;

  (async () => {
    const blob = await getAudio(song.audioHash);
    if (cancelled) return;
    if (!blob) {
      toast("Audio not found");
      navigate(renderSongSelect);
      return;
    }
    const loaded = await loadAudio(blob);
    if (cancelled) {
      void loaded.close();
      return;
    }
    audio = loaded;
    editor = new Editor({
      audio,
      canvas: root.querySelector<HTMLCanvasElement>("#ec")!,
      initialNotes: notes,
      onChange: (n) => {
        notes = n;
        root.querySelector<HTMLDivElement>("#status")!.textContent =
          `Notes: ${n.length}`;
      },
    });
  })();

  root.querySelector<HTMLButtonElement>("#back")!.onclick = () => {
    cancelled = true;
    void audio?.close();
    audio = null;
    editor?.destroy();
    navigate(renderSongSelect);
  };
  root.querySelector<HTMLButtonElement>("#play")!.onclick = () => {
    void audio?.start(0);
  };
  root.querySelector<HTMLButtonElement>("#pause")!.onclick = () => audio?.stop();

  root.querySelector<HTMLButtonElement>("#save")!.onclick = async () => {
    const bpm = +root.querySelector<HTMLInputElement>("#bpm")!.value || chart.bpm;
    const offsetMs = +root.querySelector<HTMLInputElement>("#offset")!.value || 0;
    const level = +root.querySelector<HTMLInputElement>("#level")!.value || 1;
    await api.charts.update(chart.id!, {
      songId: song.id,
      difficulty: chart.difficulty,
      level,
      bpm,
      offsetMs,
      source: chart.source,
      notes,
    });
    toast(`Saved (${notes.length} notes)`);
  };

  root.querySelector<HTMLButtonElement>("#test")!.onclick = async () => {
    // Save first, then play.
    const bpm = +root.querySelector<HTMLInputElement>("#bpm")!.value || chart.bpm;
    const offsetMs = +root.querySelector<HTMLInputElement>("#offset")!.value || 0;
    const level = +root.querySelector<HTMLInputElement>("#level")!.value || 1;
    const updated = await api.charts.update(chart.id!, {
      songId: song.id,
      difficulty: chart.difficulty,
      level,
      bpm,
      offsetMs,
      source: chart.source,
      notes,
    });
    cancelled = true;
    void audio?.close();
    audio = null;
    editor?.destroy();
    navigate((h) => renderGame(h, song, updated));
  };

  return () => {
    cancelled = true;
    void audio?.close();
    audio = null;
    editor?.destroy();
  };
};

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}
