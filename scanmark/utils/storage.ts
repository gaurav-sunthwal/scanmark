import { AttendanceRecord, Student } from './types';
import { attendanceApi, classesApi, healthCheck, statsApi, studentsApi, userApi } from './api';

// No local storage keys besides auth (handled in api.ts)

export async function isApiMode(): Promise<boolean> {
  return true; // Always API mode
}

export async function setApiMode(enabled: boolean): Promise<void> {
  // No-op: API mode is mandatory
}

export async function checkBackendConnection(): Promise<boolean> {
  return await healthCheck();
}

export async function isFirstLaunch(): Promise<boolean> {
  return false; // Not tracking first launch in local storage anymore
}

export async function markAppLaunched(): Promise<void> {
  // No-op
}



// Excel Data Caching removed
export async function getCachedExcelData(): Promise<string | null> {
  return null;
}

export async function cacheExcelData(base64Data: string): Promise<void> {
  // No-op
}

export async function clearCachedExcelData(): Promise<void> {
  // No-op
}

// Students
export async function getStudents(): Promise<Student[]> {
  try {
    return await studentsApi.getAll();
  } catch (error) {
    console.error('Failed to fetch students from API:', error);
    return []; // Return empty if API fails, as nothing works offline
  }
}

export async function saveStudents(students: Student[]): Promise<void> {
  // No-op: We don't save bulk students to local storage anymore
}

export async function addStudent(student: Student): Promise<void> {
  await studentsApi.create(student.name, student.rollNumber, student.barcode, student.classId || '');
}

export async function clearStudents(): Promise<void> {
  await studentsApi.deleteAll();
}

export async function findStudentByBarcode(barcode: string): Promise<Student | null> {
  return await studentsApi.getByBarcode(barcode);
}

// Attendance
export async function getAttendance(): Promise<AttendanceRecord[]> {
  try {
    return await attendanceApi.getAll();
  } catch (error) {
    console.error('Failed to fetch attendance from API:', error);
    return [];
  }
}

export async function saveAttendance(records: AttendanceRecord[]): Promise<void> {
  // No-op
}

export async function markAttendance(studentId: string, status: 'present' | 'absent'): Promise<AttendanceRecord> {
  const today = new Date().toISOString().split('T')[0];
  return await attendanceApi.mark(studentId, today, status);
}

export async function getTodayAttendance(): Promise<AttendanceRecord[]> {
  const records = await getAttendance();
  const today = new Date().toISOString().split('T')[0];
  return records.filter(r => r.date === today);
}

export async function isStudentMarkedToday(studentId: string): Promise<boolean> {
  const todayRecords = await getTodayAttendance();
  return todayRecords.some(r => r.studentId === studentId);
}

export async function clearAttendance(): Promise<void> {
  await attendanceApi.deleteAll();
}

export async function clearAttendanceForDate(date: string): Promise<void> {
  await attendanceApi.deleteByDate(date);
}

// Session support removed
export async function getCurrentSession(): Promise<any | null> {
  return null;
}

export async function startNewSession(): Promise<any> {
  return {
    date: new Date().toISOString().split('T')[0],
    startedAt: Date.now(),
  };
}

export async function clearSession(): Promise<void> {
  // No-op
}

// Stats
export async function getAttendanceStats(): Promise<{ total: number; present: number; absent: number }> {
  try {
    const stats = await statsApi.get();
    return {
      total: stats.totalStudents,
      present: stats.present,
      absent: stats.absent,
    };
  } catch (error) {
    console.error('Failed to fetch stats from API:', error);
    return { total: 0, present: 0, absent: 0 };
  }
}

// End Today's Attendance
export async function endTodayAttendance(): Promise<{ markedAbsent: number; alreadyMarked: number }> {
  const classId = await classesApi.getSelectedClassId();
  if (!classId) throw new Error('No class selected');
  return await attendanceApi.endToday(classId);
}

export async function nukeAllData(): Promise<void> {
  try {
    await userApi.resetAllData();
  } catch (error) {
    console.error('Failed to clear API data:', error);
    throw error;
  }
}
