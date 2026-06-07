FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy service code structure to support package paths
COPY . /app/services/analytics

EXPOSE 8003

ENV PYTHONPATH=/app
CMD ["uvicorn", "services.analytics.main:app", "--host", "0.0.0.0", "--port", "8003"]
