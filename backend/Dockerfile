# Legilimens — Backend Dockerfile (Production)
# Multi-stage build: Python 3.11-slim → minimal runtime image
# Handles: faster-whisper, pyodbc, motor, all ML deps

FROM python:3.11-slim AS builder

WORKDIR /build

# System build deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    unixodbc-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps into /install prefix (for clean copy to runtime)
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ─── Runtime stage ────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

WORKDIR /app

# Only runtime system libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    unixodbc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy source
COPY . .

# Pre-create directories the app writes to at runtime
RUN mkdir -p recordings /tmp/legilimens-audio

# Non-root user for security
RUN useradd -m -u 1001 legilimens && chown -R legilimens:legilimens /app /tmp/legilimens-audio
USER legilimens

EXPOSE 8001

# Healthcheck so DO App Platform knows when the app is ready
HEALTHCHECK --interval=20s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
