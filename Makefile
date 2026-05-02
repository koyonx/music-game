COMPOSE ?= docker compose

.DEFAULT_GOAL := help

.PHONY: help up up-d down down-v restart build ps logs logs-api logs-frontend logs-db \
        psql db-push db-generate api-shell frontend-shell api-install frontend-install \
        clean

help: ## 利用可能なターゲットを一覧表示
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_-]+:.*?## / {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

up: ## フォアグラウンドで起動 (Ctrl-C で停止)
	$(COMPOSE) up

up-d: ## バックグラウンドで起動
	$(COMPOSE) up -d

down: ## 停止 (ボリュームは保持)
	$(COMPOSE) down

down-v: ## 停止 + ボリューム削除 (DB / node_modules キャッシュも消える)
	$(COMPOSE) down -v

restart: ## 全サービス再起動
	$(COMPOSE) restart

build: ## イメージを再ビルド
	$(COMPOSE) build

ps: ## サービス状態
	$(COMPOSE) ps

logs: ## 全サービスのログを追従
	$(COMPOSE) logs -f

logs-api: ## api のログを追従
	$(COMPOSE) logs -f api

logs-frontend: ## frontend のログを追従
	$(COMPOSE) logs -f frontend

logs-db: ## postgres のログを追従
	$(COMPOSE) logs -f postgres

psql: ## DB に psql で接続
	$(COMPOSE) exec postgres psql -U musicgame -d musicgame

db-push: ## Drizzle スキーマを DB に適用 (起動中に手動再適用)
	$(COMPOSE) run --rm api npm run db:push

db-generate: ## Drizzle マイグレーションファイルを生成
	$(COMPOSE) run --rm api npm run db:generate

api-shell: ## api コンテナで sh
	$(COMPOSE) exec api sh

frontend-shell: ## frontend コンテナで sh
	$(COMPOSE) exec frontend sh

api-install: ## api に依存追加 例: make api-install pkg=zod
	$(COMPOSE) run --rm api npm install $(pkg)

frontend-install: ## frontend に依存追加 例: make frontend-install pkg=lodash
	$(COMPOSE) run --rm frontend npm install $(pkg)

clean: ## コンテナ + ボリューム + イメージを削除 (完全リセット)
	$(COMPOSE) down -v --rmi local --remove-orphans
