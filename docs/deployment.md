# Deployment Guide

## Docker Compose (Recommended)

### 1. Create `docker-compose.yml`

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

### 2. Start

```bash
docker compose up -d
```

### 3. Verify

Open `http://localhost:3000` in a browser with a stylus.

## Building from Source

### Prerequisites

- [Bun](https://bun.sh/) (latest)
- resvg (optional — OCR returns empty string without it)
- NDLOCR-Lite (optional — OCR returns empty string without it)

### Install & Run

```bash
git clone https://github.com/miyabi/inkstation.git
cd inkstation
bun install
bun run build
bun run start
```

Or with custom settings:

```bash
PORT=12000 DATA_DIR=/var/data/inkstation bun run start
```

### Development

```bash
bun run dev
```

## Docker Build from Source

```bash
git clone https://github.com/miyabi/inkstation.git
cd inkstation
docker compose up -d --build
```

## CI/CD

The GitHub Actions workflow (`.github/workflows/docker-publish.yml`) automatically builds and pushes a Docker image to `ghcr.io` on every push to `main`.

### Image Tags

| Tag             | Description              |
| --------------- | ------------------------ |
| `latest`        | Latest main branch build |
| `sha-{commit}`  | Specific commit build    |

### Pull the Image

```bash
docker pull ghcr.io/miyabi/inkstation:latest
```

## Configuration

| Variable   | Default              | Description              |
| ---------- | -------------------- | ------------------------ |
| `PORT`     | `3000`               | Server listen port       |
| `DATA_DIR` | `./inkstation-data`  | Data storage root        |

## Data Persistence

All data is stored under `DATA_DIR` (default: `./inkstation-data`):

```
inkstation-data/
  history.db                  # SQLite — operation log
  2026-03-09/
    page.yaml                 # Page data (updated on every write)
    001_00001_add.svg         # Handwriting SVG records (permanent)
    002_00001_insert.svg
  2026-03-08/
    page.yaml
    ...
```

- SVG files are never deleted — they serve as the canonical handwriting record
- `history.db` is an append-only audit log
- When using Docker, mount `DATA_DIR` as a volume to persist data across container restarts

## OCR Dependencies

The Dockerfile installs resvg and NDLOCR-Lite for handwriting recognition. Without these tools, the server still runs — OCR simply returns empty strings (graceful degradation).

### Manual Installation (optional)

**resvg:**
```bash
cargo install resvg
```

**NDLOCR-Lite:**
```bash
git clone --depth 1 https://github.com/ndl-lab/ndlocr-lite.git /opt/ndlocr-lite
cd /opt/ndlocr-lite && pip install .
```
