from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Body
from services.face_service import face_service
from services.aws_service import aws_service
from datetime import datetime
from typing import Optional
import traceback

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
    exists = aws_service.student_exists(prn)
    return {"enrolled": exists}

@router.post("/enroll/check")
async def check_multiple_enrollments(prns: list[str] = Body(..., embed=True)):
    try:
        # Note: In production, optimize with DynamoDB Query
        enrolled_prns = []
        for prn in prns:
            if aws_service.student_exists(prn):
                enrolled_prns.append(prn)
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
    print(f"DEBUG: Received enrollment request for {name}")
    
    if not all([studentId, name, prn, class_name]):
        raise HTTPException(status_code=400, detail="Missing required fields")

    try:
        # 1. Get photo bytes
        photo_bytes = b""
        if photo:
            photo_bytes = await photo.read()
        elif photo_base64:
            photo_bytes = face_service.decode_base64_image(photo_base64)
        else:
            raise HTTPException(status_code=400, detail="No photo provided")

        if not photo_bytes:
             raise HTTPException(status_code=400, detail="Invalid photo data")
        
        # 2. Index face in AWS Rekognition
        try:
            face_id = aws_service.index_face(photo_bytes, prn)
        except Exception as e:
            print(f"ERROR indexing face: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Facial processing error: {str(e)}")

        if not face_id:
            raise HTTPException(status_code=400, detail="No face detected in photo. Please ensure your face is clearly visible.")
        
        # 3. Upload photo to S3
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
        
        # 4. Save to DynamoDB
        student_data = {
            'studentId': studentId,
            'name': name,
            'prn': prn,
            'barcode': prn,
            'class': class_name,
            'photoS3Key': photo_key,
            'faceId': face_id # Store FaceId from Rekognition
        }
        
        try:
            aws_service.save_student(student_data)
        except Exception as e:
            print(f"ERROR saving to DynamoDB: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Database save failed: {str(e)}")
            
        print(f"DEBUG: Successfully enrolled student {studentId}")
        return {"success": True, "studentId": studentId}

    except HTTPException:
        raise
    except Exception as e:
        print(f"CRITICAL ERROR in enroll route: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
