# Multi-stage production Dockerfile for Notification Service
FROM python:3.11-slim as builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY pyproject.toml .
RUN pip install --no-cache-dir fastapi uvicorn[standard] psycopg2-binary pydantic pydantic-settings pyjwt

FROM python:3.11-slim as runner
WORKDIR /app
RUN groupadd -g 10001 appgroup && useradd -u 10001 -g appgroup -s /bin/sh appuser
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONPATH=/app
COPY services/notification /app/services/notification
USER appuser
EXPOSE 8003
CMD ["uvicorn", "services.notification.main:app", "--host", "0.0.0.0", "--port", "8003"]
