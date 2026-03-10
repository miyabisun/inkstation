FROM python:3.12-slim AS ocr-tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends git curl && \
    rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://github.com/linebender/resvg/releases/latest/download/resvg-linux-x86_64.tar.gz \
    | tar xz -C /usr/local/bin/
RUN git clone --depth 1 https://github.com/ndl-lab/ndlocr-lite.git /opt/ndlocr-lite && \
    cd /opt/ndlocr-lite && pip install --no-cache-dir .

FROM python:3.12-slim
WORKDIR /app

# Install Bun (system-wide so appuser can also access it)
ENV BUN_INSTALL="/usr/local"
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl unzip && \
    curl -fsSL https://bun.sh/install | bash && \
    rm -rf /var/lib/apt/lists/*

# Build frontend
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY src/ ./src/
COPY index.html vite.config.ts svelte.config.js tsconfig.json ./
RUN bun run build

# Remove devDependencies
RUN rm -rf node_modules && bun install --frozen-lockfile --production

# OCR tools
COPY --from=ocr-tools /usr/local/bin/resvg /usr/local/bin/resvg
COPY --from=ocr-tools /opt/ndlocr-lite /opt/ndlocr-lite
COPY --from=ocr-tools /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=ocr-tools /usr/local/bin/ndlocr /usr/local/bin/ndlocr

# Non-root user
RUN adduser --disabled-password --gecos '' appuser && \
    mkdir -p /app/inkstation-data && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 3000
CMD ["bun", "run", "src/server/index.ts"]
