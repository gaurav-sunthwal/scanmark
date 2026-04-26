from pydantic import BaseModel
from typing import List, Optional

class StudentBase(BaseModel):
    studentId: str
    name: str
    prn: str
    barcode: str
    class_name: str  # 'class' is a reserved keyword in Python

class StudentEnroll(StudentBase):
    pass

class RecognizeRequest(BaseModel):
    photo_base64: str  # base64 string
    class_name: str
    date: str

class RecognizeResponse(BaseModel):
    success: bool
    studentId: str
    name: str
    prn: str
    barcode: str
    confidence: float

class GroupRecognizeResponse(BaseModel):
    recognized: List[StudentBase]
    unrecognized_count: int

class AttendanceRecord(BaseModel):
    studentId: str
    name: str
    prn: str
    barcode: str
    present: bool
    markedAt: Optional[str] = None
    method: Optional[str] = None

class AttendanceList(BaseModel):
    date: str
    class_name: str
    students: List[AttendanceRecord]
