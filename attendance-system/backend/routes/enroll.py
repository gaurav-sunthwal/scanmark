from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Body
from services.face_service import face_service
from services.aws_service import aws_service
from datetime import datetime
from decimal import Decimal
from typing import Optional
import json
import traceback
import urllib.request
import urllib.parse

router = APIRouter()

@router.get("/photo/{prn}")
async def get_student_photo(prn: str):
    url = aws_service.get_student_photo_url(prn)
    if not url:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=url)
    
@router.delete("/enroll/{prn}")
async def delete_enrollment(prn: str):
    success = aws_service.delete_student_enrollment(prn)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete enrollment")
    return {"success": True}

@router.get("/enroll/status/{prn}")
async def check_enrollment(prn: str):
    """Check if a single student is enrolled in AWS"""
    try:
        # We assume if they have a photo key in DynamoDB, they are enrolled
        # For efficiency, we just check if a record exists for this PRN
        exists = aws_service.student_exists(prn)
        return {"enrolled": exists}
    except Exception as e:
        print(f"Error checking enrollment for {prn}: {str(e)}")
        return {"enrolled": False}

@router.post("/enroll/check")
async def check_multiple_enrollments(prns: list[str] = Body(..., embed=True)):
    """Check enrollment status for a list of PRNs in bulk"""
    try:
        # This could be optimized with BatchGetItem if needed
        # For now, let's use the aws_service to find enrolled PRNs
        enrolled_prns = aws_service.get_enrolled_prns(prns)
        return {"enrolled": enrolled_prns}
    except Exception as e:
        print(f"Error in bulk enrollment check: {str(e)}")
        return {"enrolled": []}

@router.post("/enroll")
async def enroll(
    studentId: Optional[str] = Form(None),
    name: Optional[str] = Form(None),
    prn: Optional[str] = Form(None),
    class_name: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    photo_base64: Optional[str] = Form(None)
):
    print(f"DEBUG: Received enrollment request. studentId={studentId}, name={name}, prn={prn}, class_name={class_name}")
    
    # Manual validation for better error messages
    missing = []
    if not studentId: missing.append("studentId")
    if not name: missing.append("name")
    if not prn: missing.append("prn")
    if not class_name: missing.append("class_name")
    
    if missing:
        error_msg = f"Missing required fields: {', '.join(missing)}"
        print(f"ERROR: {error_msg}")
        raise HTTPException(status_code=400, detail=error_msg)
    try:
        photo_bytes = b""
        if photo:
            photo_bytes = await photo.read()
            print(f"DEBUG: Received photo as file, size: {len(photo_bytes)} bytes")
        elif photo_base64:
            photo_bytes = face_service.decode_base64_image(photo_base64)
            print(f"DEBUG: Received photo as base64, size: {len(photo_bytes)} bytes")
        else:
            raise HTTPException(status_code=400, detail="No photo provided")

        if len(photo_bytes) == 0:
             raise HTTPException(status_code=400, detail="Invalid photo data")
        
        # 1. Extract face encoding
        try:
            encoding = face_service.get_encoding(photo_bytes)
        except Exception as e:
            print(f"ERROR extracting encoding: {str(e)}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Facial processing error: {str(e)}")

        if not encoding:
            print(f"DEBUG: No face detected in photo for {name}")
            raise HTTPException(status_code=400, detail="No face detected in photo. Please ensure your face is clearly visible and well-lit.")
        
        print(f"DEBUG: Face detected successfully for {name}")

        # 2. Upload photo to S3
        ext = "jpg"
        if photo and photo.filename and '.' in photo.filename:
            ext = photo.filename.split('.')[-1]
            
        safe_name = "".join([c if c.isalnum() else "_" for c in name]).lower()
        photo_key = f"students/{safe_name}_{prn}.{ext}"
        
        try:
            aws_service.upload_photo(photo_bytes, photo_key)
        except Exception as e:
            print(f"ERROR uploading to S3: {str(e)}")
            raise HTTPException(status_code=500, detail=f"S3 upload failed: {str(e)}")
        
        # 3. Save to DynamoDB
        student_data = {
            'studentId': studentId,
            'name': name,
            'prn': prn,
            'barcode': prn,
            'class': class_name,
            'photoS3Key': photo_key,
            'encoding': [Decimal(str(x)) for x in encoding]
        }
        
        try:
            print(f"DEBUG: Saving student data to DynamoDB: {studentId}")
            aws_service.save_student(student_data)
        except Exception as e:
            print(f"ERROR saving to DynamoDB: {str(e)}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Database save failed: {str(e)}")
            
        print(f"DEBUG: Successfully enrolled student {studentId}")
        
        print(f"DEBUG: Successfully enrolled student {studentId}")
        return {"success": True, "studentId": studentId}

    except HTTPException:
        raise
    except Exception as e:
        print(f"CRITICAL ERROR in enroll route: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
