FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy service code. Since we run the service as a package services.notification,
# we copy the source code to the services/notification subdirectory inside /app
COPY . /app/services/notification

EXPOSE 8000

ENV PYTHONPATH=/app
CMD ["uvicorn", "services.notification.main:app", "--host", "0.0.0.0", "--port", "8000"]
