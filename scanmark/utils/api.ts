import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AttendanceRecord, Student } from './types';

// Update this to your actual backend URL
// For local development: http://localhost:3000
// For production: your deployed backend URL
// Set this to true to use production URLs, false for local development
const IS_PROD = false;

const SERVER_IP = '10.169.181.85';
const API_BASE_URL = IS_PROD
  ? 'https://scanmark-ksrz.vercel.app/api'
  : `http://${SERVER_IP}:3000/api`;

// Always use the deployed Render cloud API to save local resources on your Mac
const FACE_API_BASE_URL = 'https://scanmark-2.onrender.com';

const TOKEN_KEY = 'scanmark_auth_token';
const USER_KEY = 'scanmark_user_data';
const SELECTED_CLASS_KEY = 'scanmark_selected_class';

// --- LOCAL-FIRST CACHING SYSTEM ---
const CACHE_KEY = 'scanmark_app_cache_v1';

interface CacheData {
  classes: any[] | null;
  students: Record<string, Student[]>;
  attendance: Record<string, any[]>;
  stats: Record<string, any>;
}

export const memoryCache: CacheData = {
  classes: null,
  students: {},
  attendance: {},
  stats: {},
};

let isSavingCache = false;
let hasPendingCacheSave = false;

export async function saveCacheToDisk() {
  if (isSavingCache) {
    hasPendingCacheSave = true;
    return;
  }
  isSavingCache = true;
  try {
    const serialized = JSON.stringify(memoryCache);
    await AsyncStorage.setItem(CACHE_KEY, serialized);
  } catch (error) {
    console.error('Failed to save memoryCache to disk:', error);
  } finally {
    isSavingCache = false;
    if (hasPendingCacheSave) {
      hasPendingCacheSave = false;
      saveCacheToDisk();
    }
  }
}

export async function loadCacheFromDisk() {
  try {
    const serialized = await AsyncStorage.getItem(CACHE_KEY);
    if (serialized) {
      const parsed = JSON.parse(serialized);
      if (parsed) {
        if (Array.isArray(parsed.classes)) memoryCache.classes = parsed.classes;
        if (parsed.students) memoryCache.students = parsed.students;
        if (parsed.attendance) memoryCache.attendance = parsed.attendance;
        if (parsed.stats) memoryCache.stats = parsed.stats;
        console.log('[CACHE] Loaded successfully from disk');
      }
    }
  } catch (error) {
    console.error('Failed to load memoryCache from disk:', error);
  }
}

export function invalidateCache(type?: 'classes' | 'students' | 'attendance' | 'stats' | 'all', classId?: string) {
  if (!type || type === 'all') {
    memoryCache.classes = null;
    memoryCache.students = {};
    memoryCache.attendance = {};
    memoryCache.stats = {};
  } else if (type === 'classes') {
    memoryCache.classes = null;
  } else if (type === 'students') {
    if (classId) {
      delete memoryCache.students[classId];
    } else {
      memoryCache.students = {};
    }
  } else if (type === 'attendance') {
    if (classId) {
      delete memoryCache.attendance[classId];
    } else {
      memoryCache.attendance = {};
    }
  } else if (type === 'stats') {
    if (classId) {
      delete memoryCache.stats[classId];
    } else {
      memoryCache.stats = {};
    }
  }
  saveCacheToDisk();
}

// Load cache immediately
loadCacheFromDisk();
// ----------------------------------


// Storage wrapper that works in Expo Go
export async function setStorageItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.error('Failed to store item:', error);
    throw error;
  }
}

export async function getStorageItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.warn('Failed to get item:', error);
    return null;
  }
}

export async function removeStorageItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.warn('Failed to remove item:', error);
  }
}

// Get stored auth token
async function getAuthToken(): Promise<string | null> {
  return await getStorageItem(TOKEN_KEY);
}
// Helper to add auth headers
async function getHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    // Support both Next.js 'error' and FastAPI 'detail' formats
    const message = error.detail || error.error || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return response.json();
}

// Classes API
export const classesApi = {
  // Get all classes
  getAll: async (force = false): Promise<any[]> => {
    if (!force && memoryCache.classes) {
      console.log('[CACHE] Returning cached classes list');
      // Silent background fetch to update cache for next time
      classesApi.getAll(true).catch(err => console.warn('[CACHE] Silent classes background refresh failed:', err));
      return memoryCache.classes;
    }
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/classes`, { headers });
    const data = await handleResponse<any[]>(response);
    memoryCache.classes = data;
    saveCacheToDisk();
    return data;
  },

  // Create new class
  create: async (name: string, description?: string): Promise<any> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/classes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, description }),
    });
    const data = await handleResponse<any>(response);
    // Invalidate classes cache
    memoryCache.classes = null;
    saveCacheToDisk();
    return data;
  },

  // Delete class
  delete: async (id: string): Promise<void> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/classes/${id}`, {
      method: 'DELETE',
      headers,
    });
    await handleResponse<any>(response);
    // Invalidate cache for this class and general classes list
    memoryCache.classes = null;
    delete memoryCache.students[id];
    delete memoryCache.attendance[id];
    delete memoryCache.stats[id];
    saveCacheToDisk();
  },

  // Session persistence
  getSelectedClassId: () => getStorageItem(SELECTED_CLASS_KEY),
  setSelectedClassId: (id: string) => setStorageItem(SELECTED_CLASS_KEY, id),
};

// Students API
export const studentsApi = {
  // Get all students (optionally by class)
  getAll: async (classId?: string, force = false): Promise<Student[]> => {
    if (classId && !force && memoryCache.students[classId]) {
      console.log(`[CACHE] Returning cached students for class ${classId}`);
      // Silent background fetch to update cache for next time
      studentsApi.getAll(classId, true).catch(err => console.warn('[CACHE] Silent students background refresh failed:', err));
      return memoryCache.students[classId];
    }
    const headers = await getHeaders();
    let url = `${API_BASE_URL}/students`;
    if (classId) url += `?class_id=${classId}`;

    const response = await fetch(url, { headers });
    const backendStudents = await handleResponse<any[]>(response);

    // 2. Fetch enrollment status from FastAPI for all students in bulk
    let enrolledPrns: string[] = [];
    try {
      const prns = backendStudents.map(s => s.roll_number);
      if (prns.length > 0) {
        const checkResult = await faceApi.checkBulkStatus(prns);
        enrolledPrns = checkResult.enrolled;
      }
    } catch (err) {
      console.warn('Failed to fetch enrollment status from AWS:', err);
    }

    // 3. Transform backend format to mobile app format
    const transformed = backendStudents.map(s => {
      const prn = s.roll_number;
      const imageUrl = `${FACE_API_BASE_URL}/photo/${prn}?t=${Date.now()}`;

      return {
        id: s.id ? s.id.toString() : 'undefined',
        name: s.name,
        rollNumber: s.roll_number,
        barcode: s.barcode,
        classId: s.class_id?.toString(),
        imageUrl: imageUrl,
        isFaceEnrolled: enrolledPrns.includes(prn),
      };
    });

    if (classId) {
      memoryCache.students[classId] = transformed;
      saveCacheToDisk();
    }
    return transformed;
  },

  // Get student by barcode
  getByBarcode: async (barcode: string, classId?: string): Promise<Student | null> => {
    try {
      const headers = await getHeaders();
      let url = `${API_BASE_URL}/students/barcode/${barcode}`;
      if (classId) {
        url += `?class_id=${classId}`;
      }
      const response = await fetch(url, { headers });
      const student = await handleResponse<any>(response);

      return {
        id: student.id ? student.id.toString() : 'undefined',
        name: student.name,
        rollNumber: student.roll_number,
        barcode: student.barcode,
        classId: student.class_id?.toString(),
      };
    } catch (error) {
      if (error instanceof Error && (error.message.includes('404') || error.message.includes('not found'))) {
        return null;
      }
      throw error;
    }
  },

  // Add new student
  create: async (name: string, rollNumber: string, barcode: string, classId: string): Promise<Student> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/students`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name,
        roll_number: rollNumber,
        barcode,
        class_id: parseInt(classId),
      }),
    });

    const student = await handleResponse<any>(response);
    const transformed: Student = {
      id: student.id ? student.id.toString() : 'undefined',
      name: student.name,
      rollNumber: student.roll_number,
      barcode: student.barcode,
      classId: student.class_id?.toString(),
      imageUrl: `${FACE_API_BASE_URL}/photo/${student.roll_number}?t=${Date.now()}`,
      isFaceEnrolled: false,
    };

    // Update local cache
    if (memoryCache.students[classId]) {
      memoryCache.students[classId] = [...memoryCache.students[classId], transformed];
    } else {
      memoryCache.students[classId] = [transformed];
    }

    // Increment total in stats cache
    if (memoryCache.stats[classId]) {
      memoryCache.stats[classId] = {
        ...memoryCache.stats[classId],
        totalStudents: (memoryCache.stats[classId].totalStudents || 0) + 1,
        unmarked: (memoryCache.stats[classId].unmarked || 0) + 1,
      };
    }

    saveCacheToDisk();
    return transformed;
  },

  // Bulk import students
  import: async (students: Omit<Student, 'id'>[], classId: string): Promise<{ message: string; students: Student[] }> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/students/import`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        students: students.map(s => ({
          name: s.name,
          roll_number: s.rollNumber,
          barcode: s.barcode,
          class_id: parseInt(classId),
        })),
        class_id: parseInt(classId),
      }),
    });

    const data = await handleResponse<any>(response);
    const imported = data.students.map((s: any) => ({
      id: s.id.toString(),
      name: s.name,
      rollNumber: s.roll_number,
      barcode: s.barcode,
      classId: s.class_id.toString(),
      imageUrl: `${FACE_API_BASE_URL}/photo/${s.roll_number}?t=${Date.now()}`,
      isFaceEnrolled: false,
    }));

    // Invalidate local cache
    delete memoryCache.students[classId];
    delete memoryCache.stats[classId];
    saveCacheToDisk();

    return {
      message: data.message,
      students: imported,
    };
  },

  // Delete all students (primarily clears local cache and resets)
  deleteAll: async (): Promise<void> => {
    console.log('[CACHE] Clearing students cache');
    memoryCache.students = {};
    saveCacheToDisk();
  },
};

// Attendance API
export const attendanceApi = {
  // Get all attendance records with optional classId and limit
  getAll: async (classId?: string, limit?: number, force = false): Promise<any[]> => {
    if (classId && !force && memoryCache.attendance[classId]) {
      console.log(`[CACHE] Returning cached attendance for class ${classId}`);
      // Silent background fetch to update cache for next time
      attendanceApi.getAll(classId, undefined, true).catch(err => console.warn('[CACHE] Silent attendance background refresh failed:', err));
      
      const cached = memoryCache.attendance[classId];
      return limit ? cached.slice(0, limit) : cached;
    }
    const headers = await getHeaders();
    let url = `${API_BASE_URL}/attendance`;
    const params = [];
    if (classId) params.push(`class_id=${classId}`);
    if (limit && force) params.push(`limit=${limit}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    const response = await fetch(url, { headers });
    const data = await handleResponse<any[]>(response);

    const transformed = data.map((r: any) => ({
      id: r.id.toString(),
      studentId: r.student_id.toString(),
      classId: r.class_id?.toString(),
      date: r.date,
      status: r.status,
      timestamp: new Date(r.created_at).getTime(),
      name: r.name,
      roll_number: r.roll_number,
    }));

    if (classId && !limit) {
      memoryCache.attendance[classId] = transformed;
      saveCacheToDisk();
    }

    return limit ? transformed.slice(0, limit) : transformed;
  },

  // Get attendance by date and class
  getByDate: async (date: string, classId: string): Promise<{ records: AttendanceRecord[]; stats: any }> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/attendance?date=${date}&class_id=${classId}`, { headers });
    const data = await handleResponse<any>(response);

    return {
      records: data.records.map((r: any) => ({
        id: r.id.toString(),
        studentId: r.student_id.toString(),
        classId: r.class_id?.toString(),
        date: r.date,
        status: r.status,
        timestamp: new Date(r.created_at).getTime(),
      })),
      stats: data.stats,
    };
  },

  // Get report data (with student names)
  getReport: async (date: string, classId: string): Promise<{ records: any[]; stats: any }> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/attendance/report?date=${date}&class_id=${classId}`, { headers });
    const data = await handleResponse<any>(response);

    return {
      records: data.records.map((r: any) => ({
        id: r.id.toString(),
        studentId: r.student_id.toString(),
        name: r.student_name,
        rollNumber: r.roll_number,
        status: r.status,
        timestamp: new Date(r.created_at).getTime(),
      })),
      stats: data.stats,
    };
  },

  // Get summary for a date range
  getSummary: async (classId: string, startDate: string, endDate: string): Promise<any> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/attendance/summary?class_id=${classId}&start_date=${startDate}&end_date=${endDate}`, { headers });
    return handleResponse<any>(response);
  },

  // Get student attendance history
  getStudentHistory: async (studentId: string): Promise<AttendanceRecord[]> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/attendance/student/${studentId}`, { headers });
    const data = await handleResponse<any[]>(response);

    return data.map((r: any) => ({
      id: r.id.toString(),
      studentId: r.student_id.toString(),
      classId: r.class_id?.toString(),
      date: r.date,
      status: r.status,
      timestamp: new Date(r.created_at).getTime(),
    }));
  },

  // Get detailed session data
  getSession: async (classId: string, date: string): Promise<any> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/attendance/session?class_id=${classId}&date=${date}`, { headers });
    const data = await handleResponse<any>(response);

    return {
      records: data.records.map((r: any) => ({
        id: r.id.toString(),
        studentId: r.student_id.toString(),
        name: r.student_name,
        rollNumber: r.roll_number,
        status: r.status,
        timestamp: new Date(r.created_at).getTime(),
      })),
      stats: data.stats,
    };
  },

  // Sync offline records
  sync: async (records: Omit<AttendanceRecord, 'id' | 'timestamp'>[]): Promise<{ count: number }> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/attendance/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ records }),
    });
    return handleResponse<{ count: number }>(response);
  },

  // Mock function for scanner sync if backend doesn't support bulk yet
  syncScanner: async (studentPrns: string[], classId: string, date: string): Promise<any> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/attendance/sync-scanner`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prns: studentPrns,
        class_id: parseInt(classId),
        date,
      }),
    });
    const data = await handleResponse<any>(response);
    
    // Invalidate local cache
    delete memoryCache.attendance[classId];
    delete memoryCache.stats[classId];
    saveCacheToDisk();

    return {
      records: data.records.map((r: any) => ({
        id: r.id.toString(),
        studentId: r.student_id.toString(),
        date: r.date,
        status: r.status,
        timestamp: Date.now(),
      })),
      stats: {
        totalStudents: data.stats.totalStudents,
        present: data.stats.present,
        absent: data.stats.absent,
      }
    };
  },

  // Mark attendance by ID
  mark: async (studentId: string, date: string, status: 'present' | 'absent', classId: string): Promise<AttendanceRecord> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/attendance`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        student_id: parseInt(studentId),
        class_id: parseInt(classId),
        date,
        status,
      }),
    });

    const record = await handleResponse<any>(response);
    const transformed = {
      id: record.id.toString(),
      studentId: record.student_id.toString(),
      classId: record.class_id?.toString(),
      date: record.date,
      status: record.status,
      timestamp: new Date(record.created_at).getTime(),
    };

    // Update local cache
    if (classId) {
      if (memoryCache.attendance[classId]) {
        const filtered = memoryCache.attendance[classId].filter(
          r => !(r.studentId === studentId && r.date === date)
        );
        memoryCache.attendance[classId] = [transformed, ...filtered];
      } else {
        memoryCache.attendance[classId] = [transformed];
      }

      // Update stats cache
      if (memoryCache.stats[classId]) {
        const stats = memoryCache.stats[classId];
        const isPresent = status === 'present';
        const wasPresent = memoryCache.attendance[classId]?.some(
          r => r.studentId === studentId && r.date === date && r.status === 'present'
        );
        const wasAbsent = memoryCache.attendance[classId]?.some(
          r => r.studentId === studentId && r.date === date && r.status === 'absent'
        );

        let newPresent = stats.present;
        let newAbsent = stats.absent;

        if (isPresent) {
          if (!wasPresent) {
            newPresent += 1;
            if (wasAbsent) newAbsent -= 1;
          }
        } else {
          if (!wasAbsent) {
            newAbsent += 1;
            if (wasPresent) newPresent -= 1;
          }
        }

        const unmarked = Math.max(0, stats.totalStudents - newPresent - newAbsent);
        memoryCache.stats[classId] = {
          ...stats,
          present: newPresent,
          absent: newAbsent,
          unmarked,
        };
      }
      saveCacheToDisk();
    }

    return transformed;
  },

  // End attendance for today (marks unmarked as absent)
  endToday: async (classId: string): Promise<{ markedAbsent: number; alreadyMarked: number }> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/attendance/end`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ class_id: parseInt(classId) }),
    });
    const data = await handleResponse<{ markedAbsent: number; alreadyMarked: number }>(response);
    
    // Invalidate local cache
    delete memoryCache.attendance[classId];
    delete memoryCache.stats[classId];
    saveCacheToDisk();

    return data;
  },

  // Delete attendance records
  deleteAll: async (classId?: string, date?: string): Promise<void> => {
    const headers = await getHeaders();
    let url = `${API_BASE_URL}/attendance`;
    if (classId) url += `?class_id=${classId}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ date }),
    });
    await handleResponse<any>(response);

    if (classId) {
      delete memoryCache.attendance[classId];
      delete memoryCache.stats[classId];
    } else {
      memoryCache.attendance = {};
      memoryCache.stats = {};
    }
    saveCacheToDisk();
  },

  deleteByDate: async (date: string): Promise<void> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/attendance`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ date }),
    });
    await handleResponse<any>(response);

    memoryCache.attendance = {};
    memoryCache.stats = {};
    saveCacheToDisk();
  },

  // Bulk mark attendance (Optimized for scanner sync)
  bulkMark: async (studentIds: string[], classId: string, date: string, status: 'present' | 'absent' = 'present'): Promise<{ count: number }> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/attendance/bulk`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        student_ids: studentIds,
        class_id: parseInt(classId),
        date,
        status,
      }),
    });

    const data = await handleResponse<{ count: number }>(response);
    
    // Invalidate local cache
    delete memoryCache.attendance[classId];
    delete memoryCache.stats[classId];
    saveCacheToDisk();

    return data;
  },
};

// Stats API
export const statsApi = {
  get: async (classId?: string, force = false) => {
    if (classId && !force && memoryCache.stats[classId]) {
      console.log(`[CACHE] Returning cached stats for class ${classId}`);
      // Silent background fetch to update cache for next time
      statsApi.get(classId, true).catch(err => console.warn('[CACHE] Silent stats background refresh failed:', err));
      return memoryCache.stats[classId];
    }
    const headers = await getHeaders();
    let url = `${API_BASE_URL}/stats`;
    if (classId) url += `?class_id=${classId}`;

    const response = await fetch(url, { headers });
    const data = await handleResponse<{
      totalStudents: number;
      present: number;
      absent: number;
      unmarked: number;
      date: string;
    }>(response);

    if (classId) {
      memoryCache.stats[classId] = data;
      saveCacheToDisk();
    }
    return data;
  },
};

// Health check
export const healthCheck = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await handleResponse<{ status: string }>(response);
    return data.status === 'ok' || data.status === 'connected';
  } catch {
    return false;
  }
};

// User data management
export const userApi = {
  // Clear all user data from backend
  resetAllData: async (): Promise<void> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/user/reset`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({}),
    });
    await handleResponse<{ success: boolean }>(response);
  },
};

// Authentication API
export const authApi = {
  // Register
  register: async (name: string, email: string, password: string): Promise<{ token: string; user: any }> => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await handleResponse<{ token: string; user: any }>(response);

    // Store token and user data
    await setStorageItem(TOKEN_KEY, data.token);
    await setStorageItem(USER_KEY, JSON.stringify(data.user));

    return data;
  },

  // Login
  login: async (email: string, password: string): Promise<{ token: string; user: any }> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await handleResponse<{ token: string; user: any }>(response);

    // Store token and user data
    await setStorageItem(TOKEN_KEY, data.token);
    await setStorageItem(USER_KEY, JSON.stringify(data.user));

    return data;
  },

  // Verify token
  verify: async (token: string): Promise<{ valid: boolean; user?: any }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ token }),
      });

      return await handleResponse<{ valid: boolean; user?: any }>(response);
    } catch (error) {
      console.log('Verification failed:', error);
      return { valid: false };
    }
  },

  // Logout
  logout: async (): Promise<void> => {
    await removeStorageItem(TOKEN_KEY);
    await removeStorageItem(USER_KEY);
  },

  // Get current user
  getCurrentUser: async (): Promise<any | null> => {
    const userStr = await getStorageItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  // Check if logged in
  isLoggedIn: async (): Promise<boolean> => {
    try {
      const token = await getAuthToken();
      if (!token) return false;

      const result = await authApi.verify(token);
      return result.valid;
    } catch (error) {
      console.log('isLoggedIn check failed:', error);
      return false;
    }
  },
};


// Face Recognition API (FastAPI)
export const faceApi = {
  enroll: async (formData: FormData): Promise<{ success: boolean; studentId: string }> => {

    console.log('DEBUG: Sending enrollment request for:', formData.get('name'), 'ID:', formData.get('studentId'));
    const response = await fetch(`${FACE_API_BASE_URL}/enroll`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });
    return await handleResponse(response);
  },

  remove: async (prn: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${FACE_API_BASE_URL}/enroll/${prn}`, {
      method: 'DELETE',
    });
    return await handleResponse(response);
  },

  recognize: async (base64: string, className: string, date: string): Promise<{ success: boolean; studentId: string; name: string; prn: string }> => {
    const response = await fetch(`${FACE_API_BASE_URL}/recognize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photo_base64: base64,
        class_name: className,
        date: date
      }),
    });
    return await handleResponse(response);
  },

  recognizeGroup: async (base64: string, className: string, date: string): Promise<{ success: boolean; recognized: any[]; unrecognized_count: number }> => {
    const response = await fetch(`${FACE_API_BASE_URL}/recognize-group`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photo_base64: base64,
        class_name: className,
        date: date
      }),
    });
    return await handleResponse(response);
  },

  checkStatus: async (prn: string): Promise<{ enrolled: boolean }> => {
    const response = await fetch(`${FACE_API_BASE_URL}/enroll/status/${prn}`);
    return await handleResponse(response);
  },

  checkBulkStatus: async (prns: string[]): Promise<{ enrolled: string[] }> => {
    const response = await fetch(`${FACE_API_BASE_URL}/enroll/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prns }),
    });
    return await handleResponse(response);
  }
};
