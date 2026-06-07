FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy service code
COPY . /app/services/counseling

EXPOSE 8000

ENV PYTHONPATH=/app
CMD ["uvicorn", "services.counseling.main:app", "--host", "0.0.0.0", "--port", "8000"]
