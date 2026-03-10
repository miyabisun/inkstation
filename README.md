# InkStation

[日本語版 / Japanese](README.ja.md)

A handwritten bullet journal web application. Write your daily tasks and notes with a stylus — InkStation handles OCR and organizes everything as a digital bullet journal.

## What is a Bullet Journal?

A bullet journal is a rapid logging system that uses simple symbols (bullets) to categorize entries:

| Symbol | Meaning   |
|--------|-----------|
| `·`    | Task      |
| `×`    | Completed |
| `-`    | Note      |
| `>`    | Migrated  |
| `o`    | Event     |

Each day gets one page. You write entries by hand, mark bullets to track status, and review past pages to stay organized. InkStation digitizes this workflow — you write with a stylus, and the app recognizes your handwriting automatically.

## Quick Start (Docker Compose)

1. Create a `docker-compose.yml` in an empty directory:

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

2. Start the server:

```bash
docker compose up -d
```

3. Open `http://localhost:3000` in a browser on a device with a stylus.

Your data is stored in the `./inkstation-data` directory and persists across restarts.

### Building from Source

If no pre-built image is available:

```bash
git clone https://github.com/miyabi/inkstation.git
cd inkstation
docker compose up -d --build
```

### Configuration

| Variable   | Default             | Description        |
|------------|---------------------|--------------------|
| `PORT`     | `3000`              | Server listen port |
| `DATA_DIR` | `./inkstation-data` | Data storage path  |

## License

The InkStation source code is licensed under the [MIT License](LICENSE).

Copyright (c) 2026 Miyabi

### Third-Party Licenses

InkStation depends on the following libraries. Each library is subject to its own license:

| Library | License |
|---------|---------|
| [Bun](https://bun.sh/) | MIT |
| [Hono](https://hono.dev/) | MIT |
| [Svelte](https://svelte.dev/) | MIT |
| [Vite](https://vite.dev/) | MIT |
| [js-yaml](https://github.com/nodeca/js-yaml) | MIT |
| [TypeScript](https://www.typescriptlang.org/) | Apache-2.0 |
| [resvg](https://github.com/linebender/resvg) | MPL-2.0 |
| [NDLOCR-Lite](https://github.com/ndl-lab/ndlocr-lite) | CC BY 4.0 |

The MIT License of this project applies only to the InkStation source code itself. Third-party libraries retain their respective licenses. See each library's repository for full license text.
