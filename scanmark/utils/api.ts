// API configuration and service layer for backend integration
import * as SecureStore from 'expo-secure-store';
import { AttendanceRecord, Student } from './storage';

// Update this to your actual backend URL
// For local development: http://localhost:3000
// For production: your deployed backend URL
const API_BASE_URL = 'http://10.241.165.241:3000/api';
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

// Storage wrapper that works in Expo Go
async function setStorageItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.error('Failed to store item:', error);
    throw error;
  }
}

async function getStorageItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.warn('Failed to get item:', error);
    return null;
  }
}

async function removeStorageItem(key: string): Promise<void> {
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

// Students API
export const studentsApi = {
  // Get all students
  getAll: async (): Promise<Student[]> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/students`, { headers });
    const backendStudents = await handleResponse<any[]>(response);
    
    // Transform backend format to mobile app format
    return backendStudents.map(s => ({
      id: s.id.toString(),
      name: s.name,
      rollNumber: s.roll_number,
      barcode: s.barcode,
    }));
  },

  // Get student by barcode
  getByBarcode: async (barcode: string): Promise<Student | null> => {
    try {
      const headers = await getHeaders();
      const response = await fetch(`${API_BASE_URL}/students/barcode/${barcode}`, { headers });
      const student = await handleResponse<any>(response);
      
      return {
        id: student.id.toString(),
        name: student.name,
        rollNumber: student.roll_number,
        barcode: student.barcode,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  },

  // Add new student
  create: async (name: string, rollNumber: string, barcode: string): Promise<Student> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/students`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name,
        roll_number: rollNumber,
        barcode,
      }),
    });
    
    const student = await handleResponse<any>(response);
    return {
      id: student.id.toString(),
      name: student.name,
      rollNumber: student.roll_number,
      barcode: student.barcode,
    };
  },
};

// Attendance API
export const attendanceApi = {
  // Get all attendance records
  getAll: async (): Promise<AttendanceRecord[]> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/attendance`, { headers });
    const records = await handleResponse<any[]>(response);
    
    return records.map(r => ({
      id: r.id.toString(),
      studentId: r.student_id.toString(),
      date: r.date,
      status: r.status,
      timestamp: new Date(r.created_at).getTime(),
    }));
  },

  // Mark attendance
  mark: async (studentId: string, date: string, status: 'present' | 'absent'): Promise<AttendanceRecord> => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/attendance`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        student_id: parseInt(studentId),
        date,
        status,
      }),
    });
    
    const record = await handleResponse<any>(response);
    return {
      id: record.id.toString(),
      studentId: record.student_id.toString(),
      date: record.date,
      status: record.status,
      timestamp: new Date(record.created_at).getTime(),
    };
  },
};

// Stats API
export const statsApi = {
  get: async () => {
    const headers = await getHeaders();
    const response = await fetch(`${API_BASE_URL}/stats`, { headers });
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
    return data.status === 'ok';
  } catch {
    return false;
  }
};

// Authentication API
export const authApi = {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      
      return await handleResponse<{ valid: boolean; user?: any }>(response);
    } catch {
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
