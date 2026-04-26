from fastapi import APIRouter, HTTPException
from models.schemas import RecognizeRequest, RecognizeResponse, GroupRecognizeResponse
from services.face_service import face_service
from services.aws_service import aws_service
from datetime import datetime
import numpy as np
import traceback

router = APIRouter()

@router.post("/recognize", response_model=RecognizeResponse)
async def recognize(request: RecognizeRequest):
    try:
        print(f"DEBUG: Received recognition request for class: {request.class_name}")
        # 1. Decode image
        image_bytes = face_service.decode_base64_image(request.photo_base64)

        unknown_encoding = face_service.get_encoding(image_bytes)
        
        if unknown_encoding is None:
            raise HTTPException(status_code=400, detail="No face detected in image")
        
        # 2. Fetch students for the class
        students = aws_service.get_students_by_class(request.class_name)
        print(f"DEBUG: Found {len(students)} students in DynamoDB for class {request.class_name}")
        
        if not students:
            raise HTTPException(status_code=404, detail=f"No students found for class {request.class_name}")
        
        # 3. Compare faces
        try:
            # Filter out students without encodings
            students_with_encodings = [s for s in students if 'encoding' in s]
            if not students_with_encodings:
                 raise HTTPException(status_code=404, detail="No students in this class have facial data enrolled")
                 
            known_encodings = [s['encoding'] for s in students_with_encodings]
            matches = face_service.compare_faces(known_encodings, np.array(unknown_encoding))
        except HTTPException:
            raise
        except Exception as e:
            print(f"ERROR during face comparison: {str(e)}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Face comparison failed: {str(e)}")
        
        if True in matches:
            first_match_index = matches.index(True)
            matched_student = students_with_encodings[first_match_index]
            print(f"DEBUG: Match found: {matched_student['name']} ({matched_student['studentId']})")
            
            # 4. Mark attendance
            try:
                aws_service.mark_attendance(
                    date=request.date,
                    student_id=matched_student['studentId'],
                    present=True,
                    marked_at=datetime.now().isoformat(),
                    method="face"
                )
            except Exception as e:
                print(f"WARNING: Failed to mark attendance in DynamoDB: {str(e)}")
            
            return {
                "success": True,
                "studentId": matched_student['studentId'],
                "name": matched_student['name'],
                "prn": matched_student['prn'],
                "barcode": matched_student.get('barcode', matched_student['prn']),
                "confidence": 1.0
            }
        
        raise HTTPException(status_code=404, detail="Student not recognized")
    except HTTPException:
        raise
    except Exception as e:
        print(f"CRITICAL ERROR in recognize route: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/recognize-group", response_model=GroupRecognizeResponse)
async def recognize_group(request: RecognizeRequest):
    try:
        image_bytes = face_service.decode_base64_image(request.photo_base64)

        unknown_encodings = face_service.get_all_encodings(image_bytes)
        
        students = aws_service.get_students_by_class(request.class_name)
        if not students:
            return {"recognized": [], "unrecognized_count": len(unknown_encodings)}
            
        students_with_encodings = [s for s in students if 'encoding' in s]
        if not students_with_encodings:
            return {"recognized": [], "unrecognized_count": len(unknown_encodings)}

        known_encodings = [s['encoding'] for s in students_with_encodings]
        recognized_students = []
        
        for unknown in unknown_encodings:
            matches = face_service.compare_faces(known_encodings, unknown)
            if True in matches:
                idx = matches.index(True)
                student = students_with_encodings[idx]
                recognized_students.append({
                    "studentId": student['studentId'],
                    "name": student['name'],
                    "prn": student['prn'],
                    "barcode": student.get('barcode', student['prn']),
                    "class_name": student.get('class', request.class_name)
                })
                
                # Mark attendance
                try:
                    aws_service.mark_attendance(
                        date=request.date,
                        student_id=student['studentId'],
                        present=True,
                        marked_at=datetime.now().isoformat(),
                        method="group_photo"
                    )
                except Exception:
                    pass
        
        unrecognized_count = len(unknown_encodings) - len(recognized_students)
        return {
            "recognized": recognized_students,
            "unrecognized_count": max(0, unrecognized_count)
        }
    except Exception as e:
        print(f"ERROR in recognize_group route: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
