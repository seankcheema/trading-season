# Multi-stage build for Python Flask Reporting Service

# Stage 1: Builder
FROM python:3.14-slim as builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and build wheels
COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /build/wheels -r requirements.txt


# Stage 2: Runtime
FROM python:3.14-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy wheels from builder
COPY --from=builder /build/wheels /wheels
COPY --from=builder /build/requirements.txt .

# Install Python packages
RUN pip install --no-cache /wheels/*

# Copy application code
COPY . .

# Create non-root user for security. /data/reporting is the event and report
# store; a named volume mounted there is initialised from this path, ownership
# included, so the consumer can write to it as appuser. (A bind mount is not
# initialised this way and must be writable by uid 1000 on the host.)
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app \
    && mkdir -p /data/reporting && chown appuser:appuser /data/reporting
USER appuser

# Where the consumer writes and the web service reads; matplotlib needs a
# writable cache directory for its font index.
ENV REPORTING_FILES_DIR=/data/reporting \
    MPLCONFIGDIR=/tmp/matplotlib

# Expose Flask port
EXPOSE 8083

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://127.0.0.1:8083/health', timeout=3)" || exit 1

# Run with Gunicorn. The consumer container overrides this with
# ["python", "consumer.py"] in Compose; same image, different process.
CMD ["gunicorn", "--bind", "0.0.0.0:8083", "--workers", "4", "--threads", "2", "--worker-class", "gthread", "--timeout", "60", "--access-logfile", "-", "--error-logfile", "-", "wsgi:app"]

