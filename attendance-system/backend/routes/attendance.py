from fastapi import APIRouter, HTTPException
from services.aws_service import aws_service
from typing import List

router = APIRouter()

@router.get("/attendance/{date}/{class_name}")
async def get_attendance(date: str, class_name: str):
    try:
        # 1. Get all students for the class
        all_students = aws_service.get_students_by_class(class_name)
        
        # 2. Get attendance records for the date
        attendance_records = aws_service.get_attendance(date)
        present_ids = {r['studentId']: r for r in attendance_records}
        
        # 3. Merge data
        result = []
        for s in all_students:
            record = present_ids.get(s['studentId'])
            result.append({
                'studentId': s['studentId'],
                'name': s['name'],
                'prn': s['prn'],
                'barcode': s.get('barcode', s['prn']),
                'present': s['studentId'] in present_ids,
                'markedAt': record.get('markedAt') if record else None,
                'method': record.get('method') if record else None
            })
            
        return {"date": date, "class_name": class_name, "students": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/students/{class_name}")
async def get_students(class_name: str):
    try:
        students = aws_service.get_students_by_class(class_name)
        # Remove encodings from response for security/bandwidth
        for s in students:
            if 'encoding' in s:
                del s['encoding']
        return students
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
