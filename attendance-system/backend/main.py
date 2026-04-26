from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Load .env before importing routes/services
load_dotenv(override=True)

from routes import enroll, recognize, attendance
import uvicorn


app = FastAPI(title="Face Recognition Attendance System API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(enroll.router, tags=["Enrollment"])
app.include_router(recognize.router, tags=["Recognition"])
app.include_router(attendance.router, tags=["Attendance"])

@app.get("/")
async def root():
    return {"message": "Face Recognition Attendance API is running"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
