import { navigate, type ScreenFn } from "./router";
import { renderSongSelect } from "./songSelect";
import { renderSettings } from "./settings";
import { renderScoreHistory } from "./scoreHistory";
import { renderUpload } from "./upload";

export const renderMenu: ScreenFn = (host) => {
  const root = document.createElement("div");
  root.className = "screen";
  root.innerHTML = `
    <div class="screen-header">
      <h1>Music Game</h1>
      <div class="actions">
        <button id="settings">Settings</button>
      </div>
    </div>
    <div class="menu">
      <button id="play">▶ Play
        <span class="sub">楽曲を選んでプレイ</span>
      </button>
      <button id="upload">＋ Upload Song
        <span class="sub">音源をアップロードして譜面を作る</span>
      </button>
      <button id="history">📊 Score History
        <span class="sub">プレイ履歴・ベストスコア</span>
      </button>
      <button id="settings2">⚙ Settings
        <span class="sub">テーマ / キー / オフセット</span>
      </button>
    </div>
  `;
  host.appendChild(root);
  root.querySelector<HTMLButtonElement>("#play")!.onclick = () =>
    navigate(renderSongSelect);
  root.querySelector<HTMLButtonElement>("#upload")!.onclick = () =>
    navigate(renderUpload);
  root.querySelector<HTMLButtonElement>("#history")!.onclick = () =>
    navigate(renderScoreHistory);
  root.querySelector<HTMLButtonElement>("#settings")!.onclick = () =>
    navigate(renderSettings);
  root.querySelector<HTMLButtonElement>("#settings2")!.onclick = () =>
    navigate(renderSettings);
  return () => {};
};
