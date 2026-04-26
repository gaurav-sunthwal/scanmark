# Use a standard Python image
FROM python:3.9-slim

# Install system dependencies (needed for face_recognition)
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements FIRST to leverage Docker cache
COPY requirements.txt .

# Install dependencies
# We use --no-cache-dir to keep the image small
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port
EXPOSE 8080

# Run the app
# Note: Google Cloud Run expects the app to listen on the $PORT environment variable
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}


