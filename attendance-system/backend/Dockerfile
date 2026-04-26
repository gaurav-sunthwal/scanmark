# Use a pre-built image that already has dlib and face_recognition
# This avoids the high-memory compilation step on Render
FROM animenosekai/face_recognition:latest

# Set working directory
WORKDIR /app

# Copy requirements and install only missing dependencies
# (face_recognition, numpy, dlib are already in the base image)
COPY requirements.txt .
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    python-multipart \
    boto3 \
    python-dotenv \
    pydantic \
    pillow

# Copy the rest of the application
COPY . .

# Expose the port FastAPI runs on
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
