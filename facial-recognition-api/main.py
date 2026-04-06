from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import face_recognition
import numpy as np
import io
import json
from typing import List, Optional, Dict
import base64
from pydantic import BaseModel
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ScanMark-API")

app = FastAPI(title="ScanMark Facial Recognition API v2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class StudentDescriptor(BaseModel):
    id: int
    descriptor: str # JSON string of the list (or list of lists)

class RecognitionRequest(BaseModel):
    image_base64: str
    students: List[StudentDescriptor]

def get_image_from_base64(base64_str: str):
    try:
        if "base64," in base64_str:
            base64_str = base64_str.split("base64,")[1]
        img_data = base64.b64decode(base64_str)
        return face_recognition.load_image_file(io.BytesIO(img_data))
    except Exception as e:
        logger.error(f"Base64 decode error: {e}")
        return None

def detect_and_encode(img):
    """Robust face detection and encoding with multiple strategies"""
    # Strategy 1: Standard HOG (Fast)
    logger.info("Attempting standard HOG detection...")
    face_locations = face_recognition.face_locations(img, model="hog")
    
    # Strategy 2: Upsampled HOG (Better for smaller faces/angles)
    if not face_locations:
        logger.info("Standard HOG failed. Trying upsampled HOG (x1)...")
        face_locations = face_recognition.face_locations(img, number_of_times_to_upsample=1, model="hog")
    
    # Strategy 3: Extreme Upsampling (x2)
    if not face_locations:
        logger.info("Upsampled HOG x1 failed. Trying x2...")
        face_locations = face_recognition.face_locations(img, number_of_times_to_upsample=2, model="hog")
        
    # Strategy 4: CNN (If available/fallback - note: requires dlib compiled with cuda for speed)
    # We'll skip CNN for now as it's very slow on CPU, but mention it as a potential upgrade.
    
    if not face_locations:
        return None
        
    logger.info(f"Detected {len(face_locations)} faces. Encoding...")
    # Use 'large' model for better accuracy in enrollment
    encodings = face_recognition.face_encodings(img, face_locations, model="small") # 'small' is default, 'large' is better
    return encodings[0] if encodings else None

@app.post("/enroll")
async def enroll_face(images: List[str]):
    """
    Enrolls a student by processing multiple views and creating a robust face profile.
    """
    logger.info(f"Enrollment request received with {len(images)} images.")
    descriptors = []
    errors = []
    
    for idx, img_b64 in enumerate(images):
        try:
            img = get_image_from_base64(img_b64)
            if img is None:
                errors.append(f"Image {idx}: Decode failed")
                continue
                
            embedding = detect_and_encode(img)
            
            if embedding is not None:
                descriptors.append(embedding)
                logger.info(f"Image {idx}: Face detected and encoded successfully.")
            else:
                logger.warning(f"Image {idx}: No face detected even with upsampling.")
                errors.append(f"Image {idx}: No face detected")
        except Exception as e:
            logger.error(f"Error processing image {idx}: {e}")
            errors.append(f"Image {idx}: Internal error")
            
    if not descriptors:
        error_msg = "; ".join(errors) if errors else "No faces detected in any image"
        raise HTTPException(status_code=400, detail=f"Face enrollment failed: {error_msg}")
        
    # Calculate robust average descriptor (training a "profile")
    avg_descriptor = np.mean(descriptors, axis=0).tolist()
    
    # Optional: We could also return the count of successfully processed images
    return {
        "success": True,
        "descriptor": avg_descriptor,
        "processedCount": len(descriptors),
        "totalCount": len(images)
    }

@app.post("/recognize")
async def recognize_face(request: RecognitionRequest):
    """
    Recognizes a face by comparing a query image against a list of known student descriptors.
    """
    try:
        # 1. Process query image
        query_img = get_image_from_base64(request.image_base64)
        if query_img is None:
            return {"success": False, "error": "Invalid base64 image data"}
            
        logger.info("Recognizing face in query image...")
        query_encoding = detect_and_encode(query_img)
        
        if query_encoding is None:
            return {"success": False, "error": "No face detected in query image"}
            
        # 2. Prepare known faces
        known_encodings = []
        student_ids = []
        
        for s in request.students:
            try:
                desc = json.loads(s.descriptor)
                # Handle both single vector and list of vectors (if we upgrade later)
                if isinstance(desc[0], list):
                    # Multi-vector support: comparing against the best match in the student's profile
                    for vector in desc:
                        known_encodings.append(np.array(vector))
                        student_ids.append(s.id)
                else:
                    known_encodings.append(np.array(desc))
                    student_ids.append(s.id)
            except Exception as e:
                logger.error(f"Error parsing descriptor for student {s.id}: {e}")
                continue
                
        if not known_encodings:
            return {"success": False, "error": "No valid student descriptors provided for matching"}
            
        # 3. Compare faces
        # Threshold (lower is stricter, 0.6 is default for dlib)
        # We'll use 0.45 for high precision in attendance
        face_distances = face_recognition.face_distance(known_encodings, query_encoding)
        
        # Find best match
        best_match_index = np.argmin(face_distances)
        min_distance = face_distances[best_match_index]
        
        THRESHOLD = 0.45 
        
        if min_distance < THRESHOLD:
            # Calculate confidence based on threshold
            # 1.0 at distance 0, 0.0 at distance THRESHOLD/0.6
            confidence = max(0, 1 - (min_distance / 0.6))
            
            return {
                "success": True, 
                "studentId": int(student_ids[best_match_index]),
                "confidence": float(confidence),
                "distance": float(min_distance)
            }
        else:
            return {
                "success": False, 
                "error": "Student not recognized", 
                "min_distance": float(min_distance),
                "threshold": THRESHOLD
            }
            
    except Exception as e:
        logger.error(f"Recognition error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
