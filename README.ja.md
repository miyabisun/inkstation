# InkStation

手書きバレットジャーナル Web アプリケーション。スタイラスで日々のタスクやメモを書き込めば、InkStation が OCR で文字を認識し、デジタルバレットジャーナルとして整理します。

## バレットジャーナルとは？

バレットジャーナルは、シンプルな記号（バレット）を使ってエントリを分類する高速ロギングシステムです：

| 記号 | 意味       |
|------|-----------|
| `·`  | タスク     |
| `×`  | 完了       |
| `-`  | メモ       |
| `>`  | 移行済み   |
| `o`  | イベント   |

1日1ページ。手書きでエントリを書き、バレットにマークを付けて進捗を管理し、過去のページを振り返って整理します。InkStation はこのワークフローをデジタル化します — スタイラスで書くだけで、アプリが手書き文字を自動認識します。

## クイックスタート（Docker Compose）

1. 空のディレクトリに `docker-compose.yml` を作成：

```yaml
services:
  inkstation:
    image: ghcr.io/miyabi/inkstation:latest
    ports:
      - "3000:3000"
    volumes:
      - ./inkstation-data:/app/inkstation-data
    environment:
      - DATA_DIR=/app/inkstation-data
    restart: unless-stopped
```

2. サーバーを起動：

```bash
docker compose up -d
```

3. スタイラス付きデバイスのブラウザで `http://localhost:3000` を開きます。

データは `./inkstation-data` ディレクトリに保存され、再起動しても保持されます。

### ソースからビルド

ビルド済みイメージが利用できない場合：

```bash
git clone https://github.com/miyabi/inkstation.git
cd inkstation
docker compose up -d --build
```

### 設定

| 変数       | デフォルト          | 説明                 |
|------------|---------------------|---------------------|
| `PORT`     | `3000`              | サーバーリッスンポート |
| `DATA_DIR` | `./inkstation-data` | データ保存パス        |

## ライセンス

InkStation のソースコードは [MIT License](LICENSE) の下でライセンスされています。

Copyright (c) 2026 Miyabi

### サードパーティライセンス

InkStation は以下のライブラリに依存しています。各ライブラリはそれぞれ独自のライセンスに従います：

| ライブラリ | ライセンス |
|-----------|-----------|
| [Bun](https://bun.sh/) | MIT |
| [Hono](https://hono.dev/) | MIT |
| [Svelte](https://svelte.dev/) | MIT |
| [Vite](https://vite.dev/) | MIT |
| [js-yaml](https://github.com/nodeca/js-yaml) | MIT |
| [TypeScript](https://www.typescriptlang.org/) | Apache-2.0 |
| [resvg](https://github.com/linebender/resvg) | MPL-2.0 |
| [NDLOCR-Lite](https://github.com/ndl-lab/ndlocr-lite) | CC BY 4.0 |

本プロジェクトの MIT License は InkStation のソースコード自体にのみ適用されます。サードパーティライブラリにはそれぞれのライセンスが適用されます。ライセンス全文は各ライブラリのリポジトリをご覧ください。
