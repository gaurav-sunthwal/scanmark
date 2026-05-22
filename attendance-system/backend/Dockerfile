FROM python:3.9-slim

# 1. Install minimal system libs for OpenCV (if needed) and basics
USER root
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 2. Create user
RUN useradd -m -u 1000 user
USER user
WORKDIR /app
ENV PATH="/home/user/.local/bin:$PATH"

# 3. Copy and install requirements
# (dlib and face_recognition removed - now using AWS Rekognition)
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. Copy app files
COPY --chown=user . .

# Set default port for AWS
ENV PORT=8080
EXPOSE 8080

CMD ["python", "main.py"]
