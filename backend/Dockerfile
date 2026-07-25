# Legilimens — Backend Dockerfile
# Builds the FastAPI orchestrator for docker-compose.
#
# Multi-stage: build deps → copy source → install runtime deps → run.
# In dev mode, docker-compose mounts ./backend as a volume for live reload.

FROM python:3.11-slim AS base

WORKDIR /app

# Install system deps needed by pyodbc (Actian Vector ODBC driver)
# TODO VERIFY: confirm whether Actian Vector Community ships its own ODBC driver
#   or if we need to install unixodbc + the Ingres driver here.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    unixodbc-dev \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Source code (overridden by volume mount in dev)
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
