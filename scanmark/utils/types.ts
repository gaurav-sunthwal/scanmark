export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  barcode: string;
  classId?: string;
  imageUrl?: string;
  isFaceEnrolled?: boolean;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classId?: string;
  date: string;
  status: 'present' | 'absent';
  timestamp: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
}
