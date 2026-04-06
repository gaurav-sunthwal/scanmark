import * as SecureStore from 'expo-secure-store';
import { AttendanceRecord, Student } from './types';

// Update this to your actual backend URL
// For local development: http://localhost:3000
// For production: your deployed backend URL
const API_BASE_URL = 'http://10.88.204.26:3000/api';
const FACE_API_BASE_URL = 'http://10.88.204.26:8000';
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';
const SELECTED_CLASS_KEY = 'selected_class_id';

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
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// Classes API
export const classesApi = {
  // Get all classes
  getAll: async (): Promise<any[]> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/classes`, { headers });
    return handleResponse<any[]>(response);
  },

  // Create new class
  create: async (name: string, description?: string): Promise<any> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/classes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, description }),
    });
    return handleResponse<any>(response);
  },

  // Delete class
  delete: async (id: string): Promise<void> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/classes/${id}`, {
      method: 'DELETE',
      headers,
    });
    await handleResponse<any>(response);
  },

  // Session persistence
  getSelectedClassId: () => getStorageItem(SELECTED_CLASS_KEY),
  setSelectedClassId: (id: string) => setStorageItem(SELECTED_CLASS_KEY, id),
};

// Students API
export const studentsApi = {
  // Get all students (optionally by class)
  getAll: async (classId?: string): Promise<Student[]> => {
    const headers = await getHeaders();
    let url = `${API_BASE_URL}/students`;
    if (classId) url += `?class_id=${classId}`;
    
    const response = await fetch(url, { headers });
    const backendStudents = await handleResponse<any[]>(response);
    
    // Transform backend format to mobile app format
    return backendStudents.map(s => ({
      id: s.id ? s.id.toString() : 'undefined',
      name: s.name,
      rollNumber: s.roll_number,
      barcode: s.barcode,
      classId: s.class_id?.toString(),
      faceDescriptor: s.face_descriptor,
      photoUrls: s.photo_urls,
    }));
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
        faceDescriptor: student.face_descriptor,
        photoUrls: student.photo_urls,
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
    return {
      id: student.id ? student.id.toString() : 'undefined',
      name: student.name,
      rollNumber: student.roll_number,
      barcode: student.barcode,
      classId: student.class_id?.toString(),
      faceDescriptor: student.face_descriptor,
      photoUrls: student.photo_urls,
    };
  },

  // Bulk import students
  import: async (students: Omit<Student, 'id'>[], classId: string): Promise<{ message: string; students: Student[] }> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/students/import`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        class_id: parseInt(classId),
        students: students.map(s => ({
          name: s.name,
          roll_number: s.rollNumber,
          barcode: s.barcode,
        })),
      }),
    });
    
    const data = await handleResponse<any>(response);
    return {
      message: data.message,
      students: data.students.map((s: any) => ({
        id: s.id ? s.id.toString() : 'undefined',
        name: s.name,
        rollNumber: s.roll_number,
        barcode: s.barcode,
        classId: s.class_id?.toString(),
        faceDescriptor: s.face_descriptor,
        photoUrls: s.photo_urls,
      })),
    };
  },

  // Delete students (optionally by class)
  deleteAll: async (classId?: string): Promise<void> => {
    const headers = await getHeaders();
    let url = `${API_BASE_URL}/students`;
    if (classId) url += `?class_id=${classId}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({}),
    });
    await handleResponse<any>(response);
  },

  // Enroll face for students
  enrollFace: async (studentId: string, images: string[]): Promise<{ success: boolean; message: string }> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/students/${studentId}/face`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ images }),
    });
    return handleResponse<{ success: boolean; message: string }>(response);
  },
};

// Attendance API
export const attendanceApi = {
  // Get attendance records (optionally by class)
  getAll: async (classId?: string, limit?: number, offset?: number): Promise<(AttendanceRecord & { name?: string, roll_number?: string })[]> => {
    const headers = await getHeaders();
    let url = `${API_BASE_URL}/attendance`;
    const params = new URLSearchParams();
    if (classId) params.append('class_id', classId);
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    
    if (params.toString()) url += `?${params.toString()}`;
    
    const response = await fetch(url, { headers });
    const records = await handleResponse<any[]>(response);
    
    return records.map(r => ({
      id: r.id.toString(),
      studentId: r.student_id.toString(),
      classId: r.class_id?.toString(),
      date: r.date,
      status: r.status,
      timestamp: new Date(r.created_at).getTime(),
      name: r.name,
      roll_number: r.roll_number,
    }));
  },

  // Mark attendance by barcode (Optimized for scanner)
  scan: async (barcode: string, classId: string, date: string, status: 'present' | 'absent' = 'present') : Promise<{ student: Student, record: AttendanceRecord, stats: { totalStudents: number, present: number, absent: number } }> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/attendance/scan`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        barcode,
        class_id: parseInt(classId),
        date,
        status,
      }),
    });
    
    const data = await handleResponse<any>(response);
    return {
      student: {
        id: data.student.id.toString(),
        name: data.student.name,
        rollNumber: data.student.roll_number,
        barcode: data.student.barcode,
        classId: data.student.class_id?.toString(),
      },
      record: {
        id: data.record.id.toString(),
        studentId: data.student.id.toString(),
        classId: data.student.class_id?.toString(),
        date: data.record.date,
        status: data.record.status,
        timestamp: Date.now(),
      },
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
    return {
      id: record.id.toString(),
      studentId: record.student_id.toString(),
      classId: record.class_id?.toString(),
      date: record.date,
      status: record.status,
      timestamp: new Date(record.created_at).getTime(),
    };
  },

  // End attendance for today (marks unmarked as absent)
  endToday: async (classId: string): Promise<{ markedAbsent: number; alreadyMarked: number }> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/attendance/end`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ class_id: parseInt(classId) }),
    });
    return handleResponse<{ markedAbsent: number; alreadyMarked: number }>(response);
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
  },

  deleteByDate: async (date: string): Promise<void> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/attendance`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ date }),
    });
    await handleResponse<any>(response);
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
    
    return handleResponse<{ count: number }>(response);
  },

  // Recognize face and mark attendance
  recognizeFace: async (classId: string, image: string, date?: string): Promise<{ success: boolean; student: Student; message: string; alreadyMarked?: boolean }> => {
    try {
      // 1. Fetch all students for this class to get their descriptors
      const studentsInClass = await studentsApi.getAll(classId);
      const studentsWithDescriptors = studentsInClass
        .filter(s => (s as any).face_descriptor)
        .map(s => ({
          id: parseInt(s.id),
          descriptor: (s as any).face_descriptor
        }));

      if (studentsWithDescriptors.length === 0) {
        throw new Error("No students in this class have enrolled faces yet.");
      }

      // 2. Call the Python Recognition API
      const pythonResponse = await fetch(`${FACE_API_BASE_URL}/recognize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: image,
          students: studentsWithDescriptors
        }),
      });

      const recognitionResult = await handleResponse<any>(pythonResponse);

      if (!recognitionResult.success) {
        return {
          success: false,
          student: {} as Student,
          message: recognitionResult.error || "Recognition failed"
        };
      }

      // 3. Mark attendance on main backend using the recognized studentId
      const studentId = recognitionResult.studentId.toString();
      const markResponse = await attendanceApi.mark(
        studentId,
        date || new Date().toISOString().split('T')[0],
        'present',
        classId
      );

      // 4. Find student details from our local list
      const matchedStudent = studentsInClass.find(s => s.id === studentId);

      return {
        success: true,
        student: matchedStudent || { id: studentId } as Student,
        message: "Attendance marked successfully"
      };
    } catch (error: any) {
      console.error('Recognition error:', error);
      return {
        success: false,
        student: {} as Student,
        message: error.message || "Failed to process face recognition"
      };
    }
  },
};

// Stats API
export const statsApi = {
  get: async (classId?: string) => {
    const headers = await getHeaders();
    let url = `${API_BASE_URL}/stats`;
    if (classId) url += `?class_id=${classId}`;
    
    const response = await fetch(url, { headers });
    return handleResponse<{
      totalStudents: number;
      present: number;
      absent: number;
      unmarked: number;
      date: string;
    }>(response);
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
