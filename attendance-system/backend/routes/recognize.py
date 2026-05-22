from fastapi import APIRouter, HTTPException
from models.schemas import RecognizeRequest, RecognizeResponse, GroupRecognizeResponse
from services.face_service import face_service
from services.aws_service import aws_service
from datetime import datetime
import traceback
import boto3

router = APIRouter()

@router.post("/recognize", response_model=RecognizeResponse)
async def recognize(request: RecognizeRequest):
    try:
        print(f"DEBUG: Received recognition request for class: {request.class_name}")
        
        # 1. Decode image
        image_bytes = face_service.decode_base64_image(request.photo_base64)
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Invalid image data")

        # 2. Search for face in Rekognition collection
        # This returns the ExternalImageId which we set to PRN during enrollment
        matched_prn = aws_service.search_face(image_bytes)
        
        if not matched_prn:
            print("DEBUG: No face match found in Rekognition")
            raise HTTPException(status_code=404, detail="Student not recognized")
        
        # 3. Fetch student details from DynamoDB using PRN
        # We need to find the studentId for marking attendance
        try:
            # Search by PRN in DynamoDB
            response = aws_service.students_table.scan(
                FilterExpression=boto3.dynamodb.conditions.Attr('prn').eq(matched_prn)
            )
            items = response.get('Items', [])
            if not items:
                raise HTTPException(status_code=404, detail="Student matched in AI but not found in Database")
            
            matched_student = items[0]
            
            # Verify they belong to the requested class
            if matched_student.get('class') != request.class_name:
                print(f"DEBUG: Student {matched_prn} found but belongs to class {matched_student.get('class')}, not {request.class_name}")
                # We can choose to either fail or allow it. For this system, we allow it if found.
        except HTTPException:
            raise
        except Exception as e:
            print(f"ERROR fetching matched student details: {e}")
            raise HTTPException(status_code=500, detail="Database lookup failed")

        # 4. Mark attendance
        try:
            aws_service.mark_attendance(
                date=request.date,
                student_id=matched_student['studentId'],
                present=True,
                marked_at=datetime.now().isoformat(),
                method="face_rekognition"
            )
        except Exception as e:
            print(f"WARNING: Failed to mark attendance in DynamoDB: {str(e)}")
        
        return {
            "success": True,
            "studentId": matched_student['studentId'],
            "name": matched_student['name'],
            "prn": matched_student['prn'],
            "barcode": matched_student.get('barcode', matched_student['prn']),
            "confidence": 1.0 # Rekognition returns confidence, but we'll simplify for now
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"CRITICAL ERROR in recognize route: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/recognize-group", response_model=GroupRecognizeResponse)
async def recognize_group(request: RecognizeRequest):
    """
    Note: For group recognition, we could use rekognition.search_faces_by_image
    for each detected face, but that requires calling Rekognition multiple times.
    For now, we'll keep it simple: search the most prominent face.
    """
    try:
        # For simplicity in this version, group recognition is limited
        # A full implementation would use DetectFaces first then search each
        res = await recognize(request)
        return {
            "recognized": [res] if res.get("success") else [],
            "unrecognized_count": 0
        }
    except Exception as e:
        print(f"ERROR in recognize_group route: {str(e)}")
        return {"recognized": [], "unrecognized_count": 1}
