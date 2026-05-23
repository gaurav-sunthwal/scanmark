import AsyncStorage from '@react-native-async-storage/async-storage';
import { Student, AttendanceRecord } from './types';
import { classesApi, studentsApi, attendanceApi, statsApi, healthCheck } from './api';

// Cache keys
const KEYS = {
  CLASSES: 'scanmark_cache_classes',
  SELECTED_CLASS_ID: 'scanmark_selected_class_id',
  SYNC_QUEUE: 'scanmark_offline_sync_queue',
  STUDENTS: (classId: string) => `scanmark_cache_students_${classId}`,
  STATS: (classId: string) => `scanmark_cache_stats_${classId}`,
  RECENT_SCANS: (classId: string) => `scanmark_cache_recent_scans_${classId}`,
  ATTENDANCE: (classId: string) => `scanmark_cache_attendance_${classId}`,
};

export interface SyncAction {
  id: string;
  type: 'CREATE_CLASS' | 'DELETE_CLASS' | 'CREATE_STUDENT' | 'MARK_ATTENDANCE' | 'BULK_MARK_ATTENDANCE' | 'END_SESSION' | 'CLEAR_ATTENDANCE';
  payload: any;
  createdAt: number;
}

type Listener = () => void;

class AppStoreClass {
  // In-memory states for synchronous rapid access
  private classes: any[] = [];
  private selectedClassId: string | null = null;
  private students: Record<string, Student[]> = {};
  private stats: Record<string, { total: number; present: number; absent: number }> = {};
  private recentScans: Record<string, any[]> = {};
  private attendanceRecords: Record<string, any[]> = {};
  private syncQueue: SyncAction[] = [];
  
  private listeners: Set<Listener> = new Set();
  
  public isInitialized = false;
  public isSyncing = false;
  
  // Keep track of mapping: temporary local IDs -> actual backend IDs
  private idMap: Record<string, string> = {};

  // Register subscription listeners
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in AppStore listener:', err);
      }
    });
  }

  // Load persistent cache from AsyncStorage into fast memory
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      console.log('AppStore initializing...');
      
      // Load general configs
      const [classesStr, selectedId, queueStr] = await Promise.all([
        AsyncStorage.getItem(KEYS.CLASSES),
        AsyncStorage.getItem(KEYS.SELECTED_CLASS_ID),
        AsyncStorage.getItem(KEYS.SYNC_QUEUE),
      ]);

      if (classesStr) this.classes = JSON.parse(classesStr);
      if (selectedId) this.selectedClassId = selectedId;
      if (queueStr) this.syncQueue = JSON.parse(queueStr);

      // Pre-load class-specific data
      const preloadPromises = this.classes.map(async (cls) => {
        const classIdStr = cls.id.toString();
        const [studStr, statsStr, recentStr, attendStr] = await Promise.all([
          AsyncStorage.getItem(KEYS.STUDENTS(classIdStr)),
          AsyncStorage.getItem(KEYS.STATS(classIdStr)),
          AsyncStorage.getItem(KEYS.RECENT_SCANS(classIdStr)),
          AsyncStorage.getItem(KEYS.ATTENDANCE(classIdStr)),
        ]);

        if (studStr) this.students[classIdStr] = JSON.parse(studStr);
        if (statsStr) this.stats[classIdStr] = JSON.parse(statsStr);
        if (recentStr) this.recentScans[classIdStr] = JSON.parse(recentStr);
        if (attendStr) this.attendanceRecords[classIdStr] = JSON.parse(attendStr);
      });

      await Promise.all(preloadPromises);
      this.isInitialized = true;
      console.log(`AppStore initialized successfully. Classes: ${this.classes.length}, Sync Queue: ${this.syncQueue.length}`);
      
      this.notify();
      
      // Kickstart background synchronization
      this.syncQueueBackground();
    } catch (error) {
      console.error('Failed to initialize AppStore:', error);
      this.isInitialized = true; // Still allow app to run
      this.notify();
    }
  }

  // Helper to save a key to storage asynchronously
  private async persist(key: string, data: any): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Failed to persist cache key ${key}:`, error);
    }
  }

  // Clear memory and AsyncStorage caches
  async clearAllCaches(): Promise<void> {
    this.classes = [];
    this.selectedClassId = null;
    this.students = {};
    this.stats = {};
    this.recentScans = {};
    this.attendanceRecords = {};
    this.syncQueue = [];
    this.idMap = {};
    
    const allKeys = [
      KEYS.CLASSES,
      KEYS.SELECTED_CLASS_ID,
      KEYS.SYNC_QUEUE,
    ];
    
    // We can also clear all cached class-specific keys by iterating through local keys,
    // but clearing the standard items is sufficient for logout.
    await AsyncStorage.clear();
    this.notify();
  }

  // ==========================================
  // READ DATA (Synchronous Memory + Async Background Revalidation)
  // ==========================================

  getClasses(forceRefresh = false): any[] {
    if (this.classes.length === 0 || forceRefresh) {
      this.revalidateClasses();
    }
    return this.classes;
  }

  private async revalidateClasses(): Promise<void> {
    try {
      const freshClasses = await classesApi.getAll();
      this.classes = freshClasses;
      await this.persist(KEYS.CLASSES, freshClasses);
      this.notify();
    } catch (error) {
      console.warn('Revalidating classes failed (using cache):', error);
    }
  }

  async getSelectedClassId(): Promise<string | null> {
    if (!this.selectedClassId) {
      const stored = await classesApi.getSelectedClassId();
      if (stored) {
        this.selectedClassId = stored;
        this.notify();
      }
    }
    return this.selectedClassId;
  }

  async setSelectedClassId(id: string): Promise<void> {
    this.selectedClassId = id;
    await AsyncStorage.setItem(KEYS.SELECTED_CLASS_ID, id);
    await classesApi.setSelectedClassId(id);
    this.notify();
  }

  getStats(classId: string, forceRefresh = false): { total: number; present: number; absent: number } {
    const cached = this.stats[classId];
    if (!cached || forceRefresh) {
      this.revalidateStats(classId);
    }
    return cached || { total: 0, present: 0, absent: 0 };
  }

  private async revalidateStats(classId: string): Promise<void> {
    if (classId.startsWith('temp_')) return; // Can't fetch stats for temp class
    try {
      const statsData = await statsApi.get(classId);
      this.stats[classId] = {
        total: statsData.totalStudents,
        present: statsData.present,
        absent: statsData.absent,
      };
      await this.persist(KEYS.STATS(classId), this.stats[classId]);
      this.notify();
    } catch (error) {
      console.warn(`Revalidating stats failed for class ${classId}:`, error);
    }
  }

  getRecentActivity(classId: string, forceRefresh = false): any[] {
    const cached = this.recentScans[classId];
    if (!cached || forceRefresh) {
      this.revalidateRecentActivity(classId);
    }
    return cached || [];
  }

  private async revalidateRecentActivity(classId: string): Promise<void> {
    if (classId.startsWith('temp_')) return;
    try {
      const recentAttendance = await attendanceApi.getAll(classId, 5);
      const mapped = recentAttendance.map((record) => ({
        ...record,
        student: {
          id: record.studentId,
          name: record.name || 'Unknown',
          rollNumber: record.roll_number || '',
          barcode: '',
          classId: record.classId || '',
        },
      }));
      this.recentScans[classId] = mapped;
      await this.persist(KEYS.RECENT_SCANS(classId), mapped);
      this.notify();
    } catch (error) {
      console.warn(`Revalidating recent activity failed for class ${classId}:`, error);
    }
  }

  getStudents(classId: string, forceRefresh = false): Student[] {
    const cached = this.students[classId];
    if (!cached || forceRefresh) {
      this.revalidateStudents(classId);
    }
    return cached || [];
  }

  private async revalidateStudents(classId: string): Promise<void> {
    if (classId.startsWith('temp_')) return;
    try {
      const freshStudents = await studentsApi.getAll(classId);
      this.students[classId] = freshStudents;
      await this.persist(KEYS.STUDENTS(classId), freshStudents);
      
      // Also update total student stats dynamically based on fresh list count
      if (!this.stats[classId]) {
        this.stats[classId] = { total: freshStudents.length, present: 0, absent: 0 };
      } else {
        this.stats[classId].total = freshStudents.length;
      }
      await this.persist(KEYS.STATS(classId), this.stats[classId]);
      
      this.notify();
    } catch (error) {
      console.warn(`Revalidating students failed for class ${classId}:`, error);
    }
  }

  getAttendanceRecords(classId: string, forceRefresh = false): any[] {
    const cached = this.attendanceRecords[classId];
    if (!cached || forceRefresh) {
      this.revalidateAttendance(classId);
    }
    return cached || [];
  }

  private async revalidateAttendance(classId: string): Promise<void> {
    if (classId.startsWith('temp_')) return;
    try {
      const records = await attendanceApi.getAll(classId);
      const enrichedRecords = records
        .sort((a, b) => b.timestamp - a.timestamp)
        .map((record) => ({
          ...record,
          student: {
            id: record.studentId,
            name: record.name || 'Unknown',
            rollNumber: record.roll_number || '',
            barcode: '',
            classId: record.classId || '',
          },
        }));
      this.attendanceRecords[classId] = enrichedRecords;
      await this.persist(KEYS.ATTENDANCE(classId), enrichedRecords);
      this.notify();
    } catch (error) {
      console.warn(`Revalidating attendance records failed for class ${classId}:`, error);
    }
  }

  // ==========================================
  // MUTATIONS (Optimistic UI Update + Persistence + Queueing)
  // ==========================================

  private queueAction(type: SyncAction['type'], payload: any) {
    const newAction: SyncAction = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      createdAt: Date.now(),
    };
    this.syncQueue.push(newAction);
    this.persist(KEYS.SYNC_QUEUE, this.syncQueue);
    this.notify();
    
    // Trigger synchronization in the background
    this.syncQueueBackground();
  }

  async createClass(name: string, description?: string): Promise<any> {
    const tempId = `temp_class_${Date.now()}`;
    const optimisticClass = {
      id: tempId,
      name,
      description: description || '',
      created_at: new Date().toISOString(),
    };

    // Optimistic memory write
    this.classes.push(optimisticClass);
    await this.persist(KEYS.CLASSES, this.classes);
    
    // Init stats for this class
    this.stats[tempId] = { total: 0, present: 0, absent: 0 };
    this.students[tempId] = [];
    this.recentScans[tempId] = [];
    this.attendanceRecords[tempId] = [];
    
    this.notify();

    // Queue background syncing
    this.queueAction('CREATE_CLASS', { tempId, name, description });
    return optimisticClass;
  }

  async deleteClass(id: string): Promise<void> {
    // Optimistic memory delete
    this.classes = this.classes.filter(c => c.id.toString() !== id);
    await this.persist(KEYS.CLASSES, this.classes);
    
    delete this.stats[id];
    delete this.students[id];
    delete this.recentScans[id];
    delete this.attendanceRecords[id];
    
    this.notify();

    this.queueAction('DELETE_CLASS', { id });
  }

  async createStudent(name: string, rollNumber: string, barcode: string, classId: string): Promise<Student> {
    const tempId = `temp_student_${Date.now()}`;
    const optimisticStudent: Student = {
      id: tempId,
      name,
      rollNumber,
      barcode,
      classId,
      isFaceEnrolled: false,
    };

    // Optimistic memory write
    if (!this.students[classId]) this.students[classId] = [];
    this.students[classId].push(optimisticStudent);
    await this.persist(KEYS.STUDENTS(classId), this.students[classId]);

    // Optimistic Stats increment
    if (!this.stats[classId]) this.stats[classId] = { total: 0, present: 0, absent: 0 };
    this.stats[classId].total += 1;
    await this.persist(KEYS.STATS(classId), this.stats[classId]);

    this.notify();

    this.queueAction('CREATE_STUDENT', { tempId, name, rollNumber, barcode, classId });
    return optimisticStudent;
  }

  async importStudents(parsedStudents: Omit<Student, 'id'>[], classId: string): Promise<void> {
    // For bulk import, we queue individual or bulk creation depending on backend support.
    // To make it easy and fast, we'll queue them in bulk.
    // Let's create optimistic students
    const optimisticStudents = parsedStudents.map((s, index) => ({
      id: `temp_student_${Date.now()}_${index}`,
      name: s.name,
      rollNumber: s.rollNumber,
      barcode: s.barcode,
      classId,
      isFaceEnrolled: false,
    }));

    if (!this.students[classId]) this.students[classId] = [];
    this.students[classId] = [...this.students[classId], ...optimisticStudents];
    await this.persist(KEYS.STUDENTS(classId), this.students[classId]);

    if (!this.stats[classId]) this.stats[classId] = { total: 0, present: 0, absent: 0 };
    this.stats[classId].total += parsedStudents.length;
    await this.persist(KEYS.STATS(classId), this.stats[classId]);

    this.notify();

    // We'll queue a bulk creation (using standard studentsApi.import payload structure)
    this.queueAction('CREATE_STUDENT', {
      isBulk: true,
      students: parsedStudents,
      classId,
      tempIds: optimisticStudents.map(s => s.id),
    });
  }

  async markAttendance(studentId: string, classId: string, date: string, status: 'present' | 'absent'): Promise<AttendanceRecord> {
    const tempId = `temp_att_${Date.now()}`;
    const optimisticRecord: AttendanceRecord = {
      id: tempId,
      studentId,
      classId,
      date,
      status,
      timestamp: Date.now(),
    };

    await this.applyOptimisticAttendance(classId, optimisticRecord);
    this.queueAction('MARK_ATTENDANCE', { studentId, classId, date, status });
    return optimisticRecord;
  }

  async bulkMarkAttendance(studentIds: string[], classId: string, date: string, status: 'present' | 'absent' = 'present'): Promise<void> {
    const records = studentIds.map((studentId, idx) => ({
      id: `temp_att_${Date.now()}_${idx}`,
      studentId,
      classId,
      date,
      status,
      timestamp: Date.now(),
    }));

    for (const r of records) {
      await this.applyOptimisticAttendance(classId, r);
    }
    
    this.queueAction('BULK_MARK_ATTENDANCE', { studentIds, classId, date, status });
  }

  async endSession(classId: string): Promise<{ markedAbsent: number; alreadyMarked: number }> {
    const today = new Date().toISOString().split('T')[0];
    const classStudents = this.students[classId] || [];
    const todayRecords = this.attendanceRecords[classId]?.filter(r => r.date === today) || [];
    
    const alreadyMarkedIds = new Set(todayRecords.map(r => r.studentId));
    const unmarkedStudents = classStudents.filter(s => !alreadyMarkedIds.has(s.id));
    
    const markedAbsentCount = unmarkedStudents.length;
    
    // Optimistically mark all unmarked students as absent locally
    const absentRecords = unmarkedStudents.map((s, idx) => ({
      id: `temp_att_absent_${Date.now()}_${idx}`,
      studentId: s.id,
      classId,
      date: today,
      status: 'absent' as const,
      timestamp: Date.now(),
    }));

    for (const r of absentRecords) {
      await this.applyOptimisticAttendance(classId, r);
    }

    this.queueAction('END_SESSION', { classId });
    
    return {
      markedAbsent: markedAbsentCount,
      alreadyMarked: alreadyMarkedIds.size,
    };
  }

  async clearAttendance(classId: string, date?: string): Promise<void> {
    // Optimistically clear local data
    if (!this.attendanceRecords[classId]) this.attendanceRecords[classId] = [];
    
    if (date) {
      this.attendanceRecords[classId] = this.attendanceRecords[classId].filter(r => r.date !== date);
    } else {
      this.attendanceRecords[classId] = [];
    }
    await this.persist(KEYS.ATTENDANCE(classId), this.attendanceRecords[classId]);

    // Reset stats
    this.stats[classId] = {
      total: this.students[classId]?.length || 0,
      present: 0,
      absent: 0,
    };
    await this.persist(KEYS.STATS(classId), this.stats[classId]);

    // Reset recent scans
    if (date) {
      this.recentScans[classId] = this.recentScans[classId]?.filter(r => r.date !== date) || [];
    } else {
      this.recentScans[classId] = [];
    }
    await this.persist(KEYS.RECENT_SCANS(classId), this.recentScans[classId]);

    this.notify();

    this.queueAction('CLEAR_ATTENDANCE', { classId, date });
  }

  // Helper to apply attendance scan to memory cache optimistically
  private async applyOptimisticAttendance(classId: string, record: AttendanceRecord): Promise<void> {
    // 1. Add to full attendance records cache
    if (!this.attendanceRecords[classId]) this.attendanceRecords[classId] = [];
    
    // Prevent duplicate records for the same student on the same date
    this.attendanceRecords[classId] = this.attendanceRecords[classId].filter(
      r => !(r.studentId === record.studentId && r.date === record.date)
    );
    
    // Find student details for enriched display
    const student = this.students[classId]?.find(s => s.id === record.studentId);
    const enrichedRecord = {
      ...record,
      name: student?.name || 'Unknown',
      roll_number: student?.rollNumber || '',
      student,
    };

    this.attendanceRecords[classId].unshift(enrichedRecord);
    await this.persist(KEYS.ATTENDANCE(classId), this.attendanceRecords[classId]);

    // 2. Update Stats counts
    if (!this.stats[classId]) {
      this.stats[classId] = { total: this.students[classId]?.length || 0, present: 0, absent: 0 };
    }
    
    // Recalculate stats entirely based on today's attendance records to prevent drifting stats counters
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = this.attendanceRecords[classId].filter(r => r.date === today);
    const present = todayRecords.filter(r => r.status === 'present').length;
    const absent = todayRecords.filter(r => r.status === 'absent').length;

    this.stats[classId] = {
      total: this.students[classId]?.length || 0,
      present,
      absent,
    };
    await this.persist(KEYS.STATS(classId), this.stats[classId]);

    // 3. Update Recent scans cache (limit to 5)
    if (!this.recentScans[classId]) this.recentScans[classId] = [];
    this.recentScans[classId] = this.recentScans[classId].filter(
      r => !(r.studentId === record.studentId && r.date === record.date)
    );
    this.recentScans[classId].unshift(enrichedRecord);
    this.recentScans[classId] = this.recentScans[classId].slice(0, 5);
    await this.persist(KEYS.RECENT_SCANS(classId), this.recentScans[classId]);

    this.notify();
  }

  // ==========================================
  // BACKGROUND SYNCHRONIZATION QUEUE SCHEDULER
  // ==========================================

  public async syncQueueBackground(): Promise<void> {
    if (this.isSyncing || this.syncQueue.length === 0) return;
    
    // Direct network connectivity health check
    const isOnline = await healthCheck();
    if (!isOnline) {
      console.log('AppStore Sync: Device is currently offline. Postponing sync.');
      return;
    }

    this.isSyncing = true;
    this.notify();
    console.log(`AppStore Sync: Commencing queue processing. Current size: ${this.syncQueue.length}`);

    try {
      while (this.syncQueue.length > 0) {
        const action = this.syncQueue[0];
        console.log(`AppStore Sync: Processing action [${action.type}] ID: ${action.id}`);
        
        const success = await this.executeSyncAction(action);
        
        if (success) {
          // Success! Pop the completed item and save the new queue state
          this.syncQueue.shift();
          await this.persist(KEYS.SYNC_QUEUE, this.syncQueue);
          this.notify();
          console.log(`AppStore Sync: Action completed and removed. Remaining size: ${this.syncQueue.length}`);
        } else {
          // Failure (e.g. timeout, network issue). Halt loop to maintain ordering.
          console.warn('AppStore Sync: Action failed due to network/server timeout. Halting queue.');
          break;
        }
      }
    } catch (error) {
      console.error('AppStore Sync: Error in queue background loop:', error);
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  // Execute a single sync operation, returns TRUE if it succeeded or should be discarded, FALSE if network offline/timeout (and should retry)
  private async executeSyncAction(action: SyncAction): Promise<boolean> {
    const { type, payload } = action;

    try {
      switch (type) {
        case 'CREATE_CLASS': {
          const classId = payload.tempId;
          const backendClass = await classesApi.create(payload.name, payload.description);
          const backendId = backendClass.id.toString();

          this.idMap[classId] = backendId;
          console.log(`AppStore Sync [CREATE_CLASS]: Mapped temp ID ${classId} -> backend ID ${backendId}`);

          // Update memory and cached classes to replace temp class ID
          this.classes = this.classes.map(c => c.id === classId ? { ...c, id: backendId } : c);
          await this.persist(KEYS.CLASSES, this.classes);

          // Update other class keys in cache
          if (this.students[classId]) {
            this.students[backendId] = this.students[classId].map(s => ({ ...s, classId: backendId }));
            delete this.students[classId];
            await this.persist(KEYS.STUDENTS(backendId), this.students[backendId]);
            await AsyncStorage.removeItem(KEYS.STUDENTS(classId));
          }

          if (this.stats[classId]) {
            this.stats[backendId] = this.stats[classId];
            delete this.stats[classId];
            await this.persist(KEYS.STATS(backendId), this.stats[backendId]);
            await AsyncStorage.removeItem(KEYS.STATS(classId));
          }

          if (this.recentScans[classId]) {
            this.recentScans[backendId] = this.recentScans[classId].map(r => ({ ...r, classId: backendId }));
            delete this.recentScans[classId];
            await this.persist(KEYS.RECENT_SCANS(backendId), this.recentScans[backendId]);
            await AsyncStorage.removeItem(KEYS.RECENT_SCANS(classId));
          }

          if (this.attendanceRecords[classId]) {
            this.attendanceRecords[backendId] = this.attendanceRecords[classId].map(r => ({ ...r, classId: backendId }));
            delete this.attendanceRecords[classId];
            await this.persist(KEYS.ATTENDANCE(backendId), this.attendanceRecords[backendId]);
            await AsyncStorage.removeItem(KEYS.ATTENDANCE(classId));
          }

          if (this.selectedClassId === classId) {
            this.selectedClassId = backendId;
            await AsyncStorage.setItem(KEYS.SELECTED_CLASS_ID, backendId);
            await classesApi.setSelectedClassId(backendId);
          }

          this.notify();
          return true;
        }

        case 'DELETE_CLASS': {
          const resolvedClassId = this.resolveId(payload.id);
          if (resolvedClassId.startsWith('temp_')) {
            console.log(`AppStore Sync [DELETE_CLASS]: Skipping since class was never created on backend.`);
            return true; // Temp class deleted, no-op on backend
          }
          await classesApi.delete(resolvedClassId);
          return true;
        }

        case 'CREATE_STUDENT': {
          if (payload.isBulk) {
            const resolvedClassId = this.resolveId(payload.classId);
            if (resolvedClassId.startsWith('temp_')) {
              console.warn(`AppStore Sync [CREATE_STUDENT bulk]: Class ID is still temp, postponing student import.`);
              return false;
            }

            const result = await studentsApi.import(payload.students, resolvedClassId);
            
            // Map the bulk temp IDs to the newly returned backend student IDs
            payload.tempIds.forEach((tempId: string, index: number) => {
              const realStud = result.students[index];
              if (realStud) {
                this.idMap[tempId] = realStud.id;
                
                // Update local student in-memory cache
                if (this.students[resolvedClassId]) {
                  this.students[resolvedClassId] = this.students[resolvedClassId].map(
                    s => s.id === tempId ? { ...s, id: realStud.id } : s
                  );
                }
              }
            });

            await this.persist(KEYS.STUDENTS(resolvedClassId), this.students[resolvedClassId]);
            this.notify();
            return true;
          } else {
            const resolvedClassId = this.resolveId(payload.classId);
            if (resolvedClassId.startsWith('temp_')) {
              console.warn(`AppStore Sync [CREATE_STUDENT]: Class ID is still temp, postponing student creation.`);
              return false;
            }

            const student = await studentsApi.create(payload.name, payload.rollNumber, payload.barcode, resolvedClassId);
            const backendStudentId = student.id;
            this.idMap[payload.tempId] = backendStudentId;

            // Update local student ID in cache
            if (this.students[resolvedClassId]) {
              this.students[resolvedClassId] = this.students[resolvedClassId].map(
                s => s.id === payload.tempId ? { ...s, id: backendStudentId } : s
              );
              await this.persist(KEYS.STUDENTS(resolvedClassId), this.students[resolvedClassId]);
            }

            // Update any optimistic attendance records that referenced student's temp ID
            if (this.attendanceRecords[resolvedClassId]) {
              this.attendanceRecords[resolvedClassId] = this.attendanceRecords[resolvedClassId].map(
                r => r.studentId === payload.tempId ? { ...r, studentId: backendStudentId } : r
              );
              await this.persist(KEYS.ATTENDANCE(resolvedClassId), this.attendanceRecords[resolvedClassId]);
            }
            if (this.recentScans[resolvedClassId]) {
              this.recentScans[resolvedClassId] = this.recentScans[resolvedClassId].map(
                r => r.studentId === payload.tempId ? { ...r, studentId: backendStudentId } : r
              );
              await this.persist(KEYS.RECENT_SCANS(resolvedClassId), this.recentScans[resolvedClassId]);
            }

            this.notify();
            return true;
          }
        }

        case 'MARK_ATTENDANCE': {
          const resolvedClassId = this.resolveId(payload.classId);
          const resolvedStudentId = this.resolveId(payload.studentId);

          if (resolvedClassId.startsWith('temp_') || resolvedStudentId.startsWith('temp_')) {
            console.log('AppStore Sync [MARK_ATTENDANCE]: Waiting for student or class dependency ID resolution.');
            return false; // Wait for parent sync tasks to complete
          }

          const backendRecord = await attendanceApi.mark(resolvedStudentId, payload.date, payload.status, resolvedClassId);
          
          // Re-align our optimistic record ID with the backend returned record ID
          if (this.attendanceRecords[resolvedClassId]) {
            this.attendanceRecords[resolvedClassId] = this.attendanceRecords[resolvedClassId].map(
              r => (r.studentId === resolvedStudentId && r.date === payload.date) 
                ? { ...r, id: backendRecord.id }
                : r
            );
            await this.persist(KEYS.ATTENDANCE(resolvedClassId), this.attendanceRecords[resolvedClassId]);
          }
          if (this.recentScans[resolvedClassId]) {
            this.recentScans[resolvedClassId] = this.recentScans[resolvedClassId].map(
              r => (r.studentId === resolvedStudentId && r.date === payload.date) 
                ? { ...r, id: backendRecord.id }
                : r
            );
            await this.persist(KEYS.RECENT_SCANS(resolvedClassId), this.recentScans[resolvedClassId]);
          }

          return true;
        }

        case 'BULK_MARK_ATTENDANCE': {
          const resolvedClassId = this.resolveId(payload.classId);
          const resolvedStudentIds = payload.studentIds.map((id: string) => this.resolveId(id));

          if (resolvedClassId.startsWith('temp_') || resolvedStudentIds.some((id: string) => id.startsWith('temp_'))) {
            console.log('AppStore Sync [BULK_MARK_ATTENDANCE]: Waiting for student or class ID resolution.');
            return false;
          }

          await attendanceApi.bulkMark(resolvedStudentIds, resolvedClassId, payload.date, payload.status);
          
          // Trigger background stats/recent refresh to ensure database alignment
          this.revalidateStats(resolvedClassId);
          this.revalidateRecentActivity(resolvedClassId);
          return true;
        }

        case 'END_SESSION': {
          const resolvedClassId = this.resolveId(payload.classId);
          if (resolvedClassId.startsWith('temp_')) {
            return false;
          }
          await attendanceApi.endToday(resolvedClassId);
          this.revalidateStats(resolvedClassId);
          this.revalidateAttendance(resolvedClassId);
          return true;
        }

        case 'CLEAR_ATTENDANCE': {
          const resolvedClassId = this.resolveId(payload.classId);
          if (resolvedClassId.startsWith('temp_')) {
            return true; // No-op
          }
          await attendanceApi.deleteAll(resolvedClassId, payload.date);
          this.revalidateStats(resolvedClassId);
          return true;
        }

        default:
          console.warn(`AppStore Sync: Unknown action type [${type}]. Discarding.`);
          return true;
      }
    } catch (error: any) {
      console.error(`AppStore Sync Action Error [${type}]:`, error);
      
      // Determine if network issue (e.g. fetch timeout, offline, ECONNREFUSED) OR user input validation error (400, 404, etc.)
      const isNetworkError = error.message?.includes('Network request failed') || 
                             error.message?.includes('HTTP 502') || 
                             error.message?.includes('HTTP 503') ||
                             error.message?.includes('HTTP 504') ||
                             error.message?.includes('Failed to fetch') ||
                             error.name === 'AbortError' ||
                             error.message?.includes('timeout');

      if (isNetworkError) {
        // Return false so we halt sync execution and retry later
        return false;
      } else {
        // Permanent coding error (e.g. 400 Bad Request, 409 Conflict, 422 Validation).
        // Logging the failure and discarding it ensures the queue is NOT permanently stuck.
        console.error(`AppStore Sync: Permanent client validation error. Discarding action [${type}] to prevent pipeline lock.`, error);
        return true;
      }
    }
  }

  // Map temporary client-side IDs to backend-generated IDs recursively
  private resolveId(id: string): string {
    let currentId = id;
    while (this.idMap[currentId]) {
      currentId = this.idMap[currentId];
    }
    return currentId;
  }

  getPendingQueueLength(): number {
    return this.syncQueue.length;
  }
}

export const AppStore = new AppStoreClass();

// Custom hook to automatically subscribe component states to AppStore
import { useEffect, useState } from 'react';

export function useAppStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    // Automatically trigger visual redraws in active components when storage state mutates
    return AppStore.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  return AppStore;
}
