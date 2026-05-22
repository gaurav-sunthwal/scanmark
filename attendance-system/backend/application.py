from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Load .env if present (mostly for local testing)
load_dotenv(override=True)

from routes import enroll, recognize, attendance
import uvicorn

# Elastic Beanstalk looks for a variable named 'application' by default
application = FastAPI(title="Face Recognition Attendance System API")
app = application # Keep 'app' for backward compatibility

# Enable CORS
application.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
application.include_router(enroll.router, tags=["Enrollment"])
application.include_router(recognize.router, tags=["Recognition"])
application.include_router(attendance.router, tags=["Attendance"])

@application.get("/")
async def root():
    return {"message": "Face Recognition Attendance API is running"}

# Use the PORT environment variable provided by EB, or default to 8000
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(application, host="0.0.0.0", port=port)
