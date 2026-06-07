FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy service code. Since we are running the service as a package services.user, 
# we structure the working directory carefully or set pythonpath.
COPY . /app/services/user

EXPOSE 8000

ENV PYTHONPATH=/app
CMD ["uvicorn", "services.user.main:app", "--host", "0.0.0.0", "--port", "8000"]
