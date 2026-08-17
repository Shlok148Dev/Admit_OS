# Multi-stage production Dockerfile for Career Service
FROM python:3.11-slim as builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY pyproject.toml .
RUN pip install --no-cache-dir fastapi uvicorn[standard] psycopg2-binary pydantic pydantic-settings

FROM python:3.11-slim as runner
WORKDIR /app
RUN groupadd -g 10001 appgroup && useradd -u 10001 -g appgroup -s /bin/sh appuser
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONPATH=/app
COPY services/career /app/services/career
USER appuser
EXPOSE 8004
CMD ["uvicorn", "services.career.main:app", "--host", "0.0.0.0", "--port", "8004"]
