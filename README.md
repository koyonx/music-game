# music-game

ブラウザで動く 6 鍵落下式音ゲー。譜面は手動エディタ / ブラウザ内 AI / Claude AI の 3 通りで作れます。スコアと判定詳細は Postgres に保存。

## 構成

- **frontend** — Vite + TypeScript + Canvas 2D（`http://localhost:5173`）
- **api** — Hono + Drizzle ORM + Postgres（`http://localhost:8787`）
- **postgres** — 16-alpine、永続ボリューム

すべて Docker compose で起動します。

## 起動

```bash
# 1. (Claude AI 譜面生成を使う場合のみ) 環境変数を用意
cp .env.example .env
# → .env の ANTHROPIC_API_KEY に自分のキーを書く

# 2. 起動
docker compose up
```

初回は npm install + DB スキーマ作成 (`drizzle-kit push`) が走ります。`http://localhost:5173` を開いてプレイ。

`docker compose down` で停止、`docker compose down -v` で DB やキャッシュごと削除。

## 操作

- 鍵盤レイアウト（デフォルト）: `S D F` `J K L`
- ESC でゲーム中断
- 譜面エディタ: 左クリックでノーツ追加、右クリックで削除（50ms グリッドにスナップ）

## AI 譜面生成

| モード | 動作 | 必要なもの |
|---|---|---|
| Local AI | ブラウザ内のオーディオ解析（オンセット検出 + BPM 推定）でノーツを配置 | なし |
| Claude AI | サーバ経由で Claude（Sonnet 4.6）に解析結果を送って譜面を生成 | `.env` の `ANTHROPIC_API_KEY` |

API キーはサーバ側 (env) にのみ置かれ、ブラウザには露出しません。

## データ

- 楽曲ファイル本体（mp3 等のバイナリ）は **ブラウザの IndexedDB** に保存（DB に上げない）
- 楽曲メタデータ・譜面・スコア・ノート単位の判定記録は **Postgres**

## 開発

| やりたいこと | コマンド |
|---|---|
| 起動 | `docker compose up` |
| バックグラウンド起動 | `docker compose up -d` |
| ログ | `docker compose logs -f api` |
| 依存追加（API） | `docker compose run --rm api npm install <pkg>` |
| 依存追加（Frontend） | `docker compose run --rm frontend npm install <pkg>` |
| DB スキーマを再適用 | `docker compose run --rm api npm run db:push` |
| DB に直接入る | `docker compose exec postgres psql -U musicgame -d musicgame` |
