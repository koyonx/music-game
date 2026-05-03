import { navigate, toast, type ScreenFn } from "./router";
import { api } from "../api/client";
import { hashBlob, putAudio } from "../storage/db";
import { renderMenu } from "./menu";
import { renderSongSelect } from "./songSelect";

export const renderUpload: ScreenFn = (host) => {
  const root = document.createElement("div");
  root.className = "screen";
  root.innerHTML = `
    <div class="screen-header">
      <h1>Upload Song</h1>
      <button id="back">← Back</button>
    </div>
    <div class="upload-zone" id="zone">
      <p>音源ファイル（mp3 / ogg / wav / m4a）をここにドラッグ＆ドロップ<br/>もしくはクリックして選択</p>
      <input id="file" type="file" accept="audio/*" hidden />
    </div>
    <div class="field">
      <label>タイトル</label>
      <input id="title" placeholder="(自動: ファイル名)" />
    </div>
    <div class="field">
      <label>アーティスト</label>
      <input id="artist" placeholder="" />
    </div>
    <div class="row">
      <button class="primary" id="save" disabled>Save</button>
      <span id="status" style="color: var(--fg-muted); font-size: 12px;"></span>
    </div>
  `;
  host.appendChild(root);

  let file: File | null = null;

  const zone = root.querySelector<HTMLDivElement>("#zone")!;
  const fileInput = root.querySelector<HTMLInputElement>("#file")!;
  const titleEl = root.querySelector<HTMLInputElement>("#title")!;
  const artistEl = root.querySelector<HTMLInputElement>("#artist")!;
  const saveBtn = root.querySelector<HTMLButtonElement>("#save")!;
  const statusEl = root.querySelector<HTMLSpanElement>("#status")!;

  const setFile = (f: File) => {
    file = f;
    if (!titleEl.value) titleEl.value = f.name.replace(/\.[^.]+$/, "");
    saveBtn.disabled = false;
    statusEl.textContent = `${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`;
  };

  zone.onclick = () => fileInput.click();
  fileInput.onchange = () => {
    const f = fileInput.files?.[0];
    if (f) setFile(f);
  };
  zone.ondragover = (e) => {
    e.preventDefault();
    zone.classList.add("drag");
  };
  zone.ondragleave = () => zone.classList.remove("drag");
  zone.ondrop = (e) => {
    e.preventDefault();
    zone.classList.remove("drag");
    const f = e.dataTransfer?.files?.[0];
    if (f) setFile(f);
  };

  saveBtn.onclick = async () => {
    if (!file) return;
    saveBtn.disabled = true;
    statusEl.textContent = "Decoding & saving...";
    try {
      const blob = file;
      const hash = await hashBlob(blob);
      // Decode for duration only.
      const arr = await blob.arrayBuffer();
      const ctx = new AudioContext();
      const buf = await ctx.decodeAudioData(arr.slice(0));
      ctx.close();
      await putAudio(hash, blob);
      const song = await api.songs.upsert({
        title: titleEl.value || file.name,
        artist: artistEl.value,
        durationSec: buf.duration,
        audioHash: hash,
      });
      toast(`Saved "${song.title}"`);
      navigate(renderSongSelect);
    } catch (err) {
      console.error(err);
      statusEl.textContent = `Error: ${(err as Error).message}`;
      saveBtn.disabled = false;
    }
  };

  root.querySelector<HTMLButtonElement>("#back")!.onclick = () =>
    navigate(renderMenu);
  return () => {};
};
