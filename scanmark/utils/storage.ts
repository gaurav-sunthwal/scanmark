import * as SecureStore from 'expo-secure-store';
import { attendanceApi, healthCheck, statsApi, studentsApi } from './api';

const STUDENTS_KEY = 'students';
const ATTENDANCE_KEY = 'attendance';
const SESSION_KEY = 'current_session';
const API_MODE_KEY = 'api_mode';
const FIRST_LAUNCH_KEY = 'first_launch';
const OFFLINE_MODE_KEY = 'offline_mode';
const EXCEL_DATA_KEY = 'excel_data';

// In-memory fallback storage for when storage fails
let memoryStorage: {
  students: Student[];
  attendance: AttendanceRecord[];
  session: Session | null;
  apiMode: boolean;
  offlineMode: boolean;
  firstLaunch: boolean;
  excelData: string | null;
} = {
  students: [],
  attendance: [],
  session: null,
  apiMode: true, // Default to API mode
  offlineMode: false,
  firstLaunch: true,
  excelData: null,
};

// Storage wrapper using SecureStore for small data
async function setStorageItem(key: string, value: string): Promise<void> {
  try {
    // SecureStore has a 2KB limit, so use it for small values only
    if (value.length < 2048) {
      await SecureStore.setItemAsync(key, value);
    } else {
      // For larger data, store in memory only
      console.warn(`Value too large for SecureStore (${value.length} bytes), using memory only`);
      // Store in appropriate memory location based on key
      if (key === STUDENTS_KEY) memoryStorage.students = JSON.parse(value);
      else if (key === ATTENDANCE_KEY) memoryStorage.attendance = JSON.parse(value);
      else if (key === EXCEL_DATA_KEY) memoryStorage.excelData = value;
    }
  } catch (error) {
    console.warn('Storage setItem failed:', error);
  }
}

async function getStorageItem(key: string): Promise<string | null> {
  try {
    const value = await SecureStore.getItemAsync(key);
    if (value) return value;
    
    // Fallback to memory storage
    if (key === STUDENTS_KEY && memoryStorage.students.length > 0) {
      return JSON.stringify(memoryStorage.students);
    }
    if (key === ATTENDANCE_KEY && memoryStorage.attendance.length > 0) {
      return JSON.stringify(memoryStorage.attendance);
    }
    if (key === EXCEL_DATA_KEY && memoryStorage.excelData) {
      return memoryStorage.excelData;
    }
    
    return null;
  } catch (error) {
    console.warn('Storage getItem failed:', error);
    return null;
  }
}

async function removeStorageItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.warn('Storage removeItem failed:', error);
  }
}

async function safeSetItem(key: string, value: string): Promise<void> {
  await setStorageItem(key, value);
}

async function safeGetItem(key: string): Promise<string | null> {
  return await getStorageItem(key);
}

async function safeRemoveItem(key: string): Promise<void> {
  await removeStorageItem(key);
}

// API Mode Management
export async function isApiMode(): Promise<boolean> {
  try {
    const mode = await safeGetItem(API_MODE_KEY);
    if (mode !== null) {
      return mode === 'true';
    }
    return memoryStorage.apiMode;
  } catch {
    return memoryStorage.apiMode;
  }
}

export async function setApiMode(enabled: boolean): Promise<void> {
  memoryStorage.apiMode = enabled;
  await safeSetItem(API_MODE_KEY, enabled.toString());
}

export async function checkBackendConnection(): Promise<boolean> {
  return await healthCheck();
}

// First Launch & Offline Mode Management
export async function isFirstLaunch(): Promise<boolean> {
  try {
    const launched = await safeGetItem(FIRST_LAUNCH_KEY);
    // If key exists and is 'true', app was already launched (NOT first launch)
    // If key doesn't exist, it IS the first launch
    if (launched !== null) {
      return launched !== 'true'; // Returns false if launched='true', true otherwise
    }
    return true; // No key found = first launch
  } catch {
    return true; // Default to first launch on error
  }
}

export async function markAppLaunched(): Promise<void> {
  memoryStorage.firstLaunch = false;
  await safeSetItem(FIRST_LAUNCH_KEY, 'true');
}

export async function isOfflineMode(): Promise<boolean> {
  try {
    const mode = await safeGetItem(OFFLINE_MODE_KEY);
    if (mode !== null) {
      return mode === 'true';
    }
    return memoryStorage.offlineMode;
  } catch {
    return memoryStorage.offlineMode;
  }
}

export async function setOfflineMode(enabled: boolean): Promise<void> {
  memoryStorage.offlineMode = enabled;
  // If offline mode is enabled, also disable API mode
  if (enabled) {
    memoryStorage.apiMode = false;
    await safeSetItem(API_MODE_KEY, 'false');
  }
  await safeSetItem(OFFLINE_MODE_KEY, enabled.toString());
}

// Excel Data Caching for Offline Mode
export async function getCachedExcelData(): Promise<string | null> {
  try {
    const data = await safeGetItem(EXCEL_DATA_KEY);
    if (data) return data;
    return memoryStorage.excelData;
  } catch {
    return memoryStorage.excelData;
  }
}

export async function cacheExcelData(base64Data: string): Promise<void> {
  memoryStorage.excelData = base64Data;
  await safeSetItem(EXCEL_DATA_KEY, base64Data);
}

export async function clearCachedExcelData(): Promise<void> {
  memoryStorage.excelData = null;
  await safeRemoveItem(EXCEL_DATA_KEY);
}

export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  barcode: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  status: 'present' | 'absent';
  timestamp: number;
}

export interface Session {
  date: string;
  startedAt: number;
}

// Students
export async function getStudents(): Promise<Student[]> {
  const useApi = await isApiMode();
  
  if (useApi) {
    try {
      const students = await studentsApi.getAll();
      // Cache locally as backup
      memoryStorage.students = students;
      await safeSetItem(STUDENTS_KEY, JSON.stringify(students));
      return students;
    } catch (error) {
      console.warn('API failed, using local cache:', error);
      // Fallback to local storage
    }
  }
  
  try {
    const data = await safeGetItem(STUDENTS_KEY);
    if (data) return JSON.parse(data);
    return memoryStorage.students;
  } catch {
    return memoryStorage.students;
  }
}

export async function saveStudents(students: Student[]): Promise<void> {
  try {
    const data = JSON.stringify(students);
    console.log('Saving students, count:', students.length);
    memoryStorage.students = students; // Always save to memory
    await safeSetItem(STUDENTS_KEY, data);
    console.log('Students saved successfully');
  } catch (error) {
    console.error('Error saving students:', error);
    memoryStorage.students = students;
  }
  
  // Note: Individual students should be added via addStudent which uses API
}

export async function addStudent(student: Student): Promise<void> {
  const useApi = await isApiMode();
  
  if (useApi) {
    try {
      await studentsApi.create(student.name, student.rollNumber, student.barcode);
      // Refresh local cache
      await getStudents();
      return;
    } catch (error) {
      console.warn('API failed, saving locally:', error);
    }
  }
  
  const students = await getStudents();
  students.push(student);
  await saveStudents(students);
}

export async function clearStudents(): Promise<void> {
  memoryStorage.students = [];
  await safeRemoveItem(STUDENTS_KEY);
}

export async function findStudentByBarcode(barcode: string): Promise<Student | null> {
  const useApi = await isApiMode();
  
  if (useApi) {
    try {
      return await studentsApi.getByBarcode(barcode);
    } catch (error) {
      console.warn('API failed, searching locally:', error);
    }
  }
  
  const students = await getStudents();
  return students.find(s => s.barcode === barcode) || null;
}

// Attendance
export async function getAttendance(): Promise<AttendanceRecord[]> {
  const useApi = await isApiMode();
  
  if (useApi) {
    try {
      const records = await attendanceApi.getAll();
      // Cache locally as backup
      memoryStorage.attendance = records;
      await safeSetItem(ATTENDANCE_KEY, JSON.stringify(records));
      return records;
    } catch (error) {
      console.warn('API failed, using local cache:', error);
    }
  }
  
  try {
    const data = await safeGetItem(ATTENDANCE_KEY);
    if (data) return JSON.parse(data);
    return memoryStorage.attendance;
  } catch {
    return memoryStorage.attendance;
  }
}

export async function saveAttendance(records: AttendanceRecord[]): Promise<void> {
  memoryStorage.attendance = records;
  try {
    await safeSetItem(ATTENDANCE_KEY, JSON.stringify(records));
  } catch {
    // Already saved to memory
  }
}

export async function markAttendance(studentId: string, status: 'present' | 'absent'): Promise<AttendanceRecord> {
  const today = new Date().toISOString().split('T')[0];
  const useApi = await isApiMode();
  
  if (useApi) {
    try {
      const record = await attendanceApi.mark(studentId, today, status);
      // Refresh local cache
      await getAttendance();
      return record;
    } catch (error) {
      console.warn('API failed, saving locally:', error);
    }
  }
  
  const records = await getAttendance();
  
  // Check if already marked today
  const existingIndex = records.findIndex(r => r.studentId === studentId && r.date === today);
  
  const record: AttendanceRecord = {
    id: existingIndex >= 0 ? records[existingIndex].id : Date.now().toString(),
    studentId,
    date: today,
    status,
    timestamp: Date.now(),
  };
  
  if (existingIndex >= 0) {
    records[existingIndex] = record;
  } else {
    records.push(record);
  }
  
  await saveAttendance(records);
  return record;
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
  memoryStorage.attendance = [];
  await safeRemoveItem(ATTENDANCE_KEY);
}

// Clear attendance for a specific date
export async function clearAttendanceForDate(date: string): Promise<void> {
  const records = await getAttendance();
  const filteredRecords = records.filter(r => r.date !== date);
  await saveAttendance(filteredRecords);
}

// Session
export async function getCurrentSession(): Promise<Session | null> {
  try {
    const data = await safeGetItem(SESSION_KEY);
    if (data) return JSON.parse(data);
    return memoryStorage.session;
  } catch {
    return memoryStorage.session;
  }
}

export async function startNewSession(): Promise<Session> {
  const session: Session = {
    date: new Date().toISOString().split('T')[0],
    startedAt: Date.now(),
  };
  memoryStorage.session = session;
  try {
    await safeSetItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Already saved to memory
  }
  return session;
}

export async function clearSession(): Promise<void> {
  memoryStorage.session = null;
  await safeRemoveItem(SESSION_KEY);
}

// Stats
export async function getAttendanceStats(): Promise<{ total: number; present: number; absent: number }> {
  const useApi = await isApiMode();
  
  if (useApi) {
    try {
      const stats = await statsApi.get();
      return {
        total: stats.totalStudents,
        present: stats.present,
        absent: stats.absent,
      };
    } catch (error) {
      console.warn('API failed, calculating locally:', error);
    }
  }
  
  const students = await getStudents();
  const todayAttendance = await getTodayAttendance();
  
  return {
    total: students.length,
    present: todayAttendance.filter(r => r.status === 'present').length,
    absent: todayAttendance.filter(r => r.status === 'absent').length,
  };
}

// End Today's Attendance - Mark all unscanned students as absent
export async function endTodayAttendance(): Promise<{ markedAbsent: number; alreadyMarked: number }> {
  const students = await getStudents();
  const todayAttendance = await getTodayAttendance();
  const today = new Date().toISOString().split('T')[0];
  const useApi = await isApiMode();
  
  let markedAbsent = 0;
  
  for (const student of students) {
    const alreadyMarked = todayAttendance.some(r => r.studentId === student.id);
    
    if (!alreadyMarked) {
      if (useApi) {
        try {
          await attendanceApi.mark(student.id, today, 'absent');
          markedAbsent++;
        } catch (error) {
          console.warn('API failed for student', student.id, error);
        }
      } else {
        const records = await getAttendance();
        const record: AttendanceRecord = {
          id: Date.now().toString() + '_' + student.id,
          studentId: student.id,
          date: today,
          status: 'absent',
          timestamp: Date.now(),
        };
        records.push(record);
        await saveAttendance(records);
        markedAbsent++;
      }
    }
  }
  
  // Refresh cache if using API
  if (useApi) {
    await getAttendance();
  }
  
  return {
    markedAbsent,
    alreadyMarked: todayAttendance.length,
  };
}
