import { attendanceApi, faceApi, statsApi, studentsApi } from '@/utils/api';
import { globalState } from '@/utils/state';
import { Student } from '@/utils/types';
import { Ionicons } from '@expo/vector-icons';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, Vibration, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [lastScanned, setLastScanned] = useState<{ student: Student; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0 });
  const router = useRouter();
  const params = useLocalSearchParams();
  const classId = params.classId as string;
  const className = params.className as string;

  // Local-First State
  const studentsRef = useRef<Student[]>([]);
  const pendingAttendanceRef = useRef<Set<string>>(new Set());
  const alreadyMarkedRef = useRef<Set<string>>(new Set());
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);
  const cameraRef = useRef<CameraView>(null);
  
  // Face Recognition State
  const [mode, setMode] = useState<'barcode' | 'face'>('barcode');
  const [recognizing, setRecognizing] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');


  // Add Student State
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentRoll, setNewStudentRoll] = useState('');
  const [pendingBarcode, setPendingBarcode] = useState('');
  const [isSaving, setIsSaving] = useState(false);


  const loadData = useCallback(async () => {
    if (!classId) return;
    try {
      setLoading(true);
      const [statsData, studentsData, attendanceData] = await Promise.all([
        statsApi.get(classId),
        studentsApi.getAll(classId),
        attendanceApi.getAll(classId) // Fetch existing records for today
      ]);

      studentsRef.current = studentsData;

      // Track who is already marked present today
      const today = new Date().toISOString().split('T')[0];
      const todayPresent = attendanceData
        .filter(r => r.date === today && r.status === 'present')
        .map(r => r.studentId);

      alreadyMarkedRef.current = new Set(todayPresent);

      setStats({
        total: statsData.totalStudents,
        present: statsData.present,
        absent: statsData.absent
      });
      setLoading(false);
    } catch (error) {
      console.error('Failed to load data:', error);
      setLoading(false);
    }
  }, [classId]);

  const syncToBackend = useCallback(async () => {
    if (pendingAttendanceRef.current.size === 0 || isSyncingRef.current || !classId) return;

    isSyncingRef.current = true;
    const idsToSync = Array.from(pendingAttendanceRef.current);
    const today = new Date().toISOString().split('T')[0];

    try {
      console.log('Syncing attendance to backend:', idsToSync.length);
      await attendanceApi.bulkMark(idsToSync, classId, today);

      // Clear synced IDs
      idsToSync.forEach(id => pendingAttendanceRef.current.delete(id));
      globalState.needsDashboardRefresh = true;
    } catch (error) {
      console.error('Failed to sync attendance:', error);
    } finally {
      isSyncingRef.current = false;
    }
  }, [classId]);

  // Handle auto-sync after 5s of inactivity
  const scheduleSync = useCallback(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      syncToBackend();
    }, 5000) as any;
  }, [syncToBackend]);

  useEffect(() => {
    if (!classId) {
      Alert.alert('Error', 'No class selected');
      router.back();
      return;
    }
    loadData();

    // Cleanup: sync on unmount
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncToBackend();
    };
  }, [classId, loadData, syncToBackend]);

  // Sync when screen loses focus
  useFocusEffect(
    useCallback(() => {
      return () => {
        syncToBackend();
      };
    }, [syncToBackend])
  );

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarcodeScanned = useCallback(async (result: BarcodeScanningResult) => {
    if (scanned || !classId) return;

    // Trim and normalize scanned barcode
    const scannedBarcode = result.data.trim();
    console.log(`Scanned barcode: "${scannedBarcode}"`);
    console.log(`Available students: ${studentsRef.current.length}`);

    // INSTANT LOCAL LOOKUP with normalized comparison
    const student = studentsRef.current.find(s =>
      s.barcode?.toString().trim().toLowerCase() === scannedBarcode.toLowerCase()
    );

    if (student) {
      console.log(`Student found: ${student.name}`);
      // INSTANT UI UPDATE
      Vibration.vibrate(200);
      setLastScanned({ student, status: 'present' });

      // ONLY increment present count if not already marked today (in DB or locally)
      if (!alreadyMarkedRef.current.has(student.id) && !pendingAttendanceRef.current.has(student.id)) {
        console.log(`Marking as NEW local scan: ${student.name}`);
        pendingAttendanceRef.current.add(student.id);
        setStats(prev => ({
          ...prev,
          present: prev.present + 1
        }));
      } else {
        console.log(`Already marked present: ${student.name}`);
      }

      setScanned(true);

      // Auto-reset for next scan
      setTimeout(() => {
        setScanned(false);
        setLastScanned(null);
      }, 2000);

      // Schedule sync with backend
      scheduleSync();

    } else {
      console.warn(`Student not found for barcode: "${scannedBarcode}"`);
      Vibration.vibrate([0, 100, 50, 100]);
      setScanned(true); // Pause scanning

      Alert.alert(
        'Student Not Found',
        `No student found with barcode: ${scannedBarcode}.\n\nWould you like to add this student to ${className || 'this class'}?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setScanned(false) },
          {
            text: 'Add Student',
            onPress: () => {
              setPendingBarcode(scannedBarcode);
              setIsAddModalVisible(true);
            }
          }
        ]
      );
    }
  }, [scanned, classId, className, scheduleSync]);

  const handleFaceRecognition = async () => {
    if (!cameraRef.current || recognizing || !classId) return;

    try {
      setRecognizing(true);
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
      });

      if (!photo?.base64) throw new Error('Failed to capture image');

      const today = new Date().toISOString().split('T')[0];
      const result = await faceApi.recognize(photo.base64, className || '', today);

      // result contains { studentId, name, prn, confidence }
      const student = studentsRef.current.find(s => s.id === result.studentId);
      
      if (student) {
        Vibration.vibrate(200);
        setLastScanned({ student, status: 'present' });

        if (!alreadyMarkedRef.current.has(student.id) && !pendingAttendanceRef.current.has(student.id)) {
          pendingAttendanceRef.current.add(student.id);
          setStats(prev => ({ ...prev, present: prev.present + 1 }));
        }

        setTimeout(() => setLastScanned(null), 3000);
        scheduleSync();
      }
    } catch (error: any) {
      console.error('Face recognition error:', error);
      Alert.alert('Error', error.message || 'Face not recognized');
    } finally {
      setRecognizing(false);
    }
  };


  const handleSaveNewStudent = async () => {
    if (!newStudentName.trim() || !newStudentRoll.trim() || !classId) {
      Alert.alert('Error', 'Please enter both Name and Roll Number');
      return;
    }

    try {
      setIsSaving(true);
      const student = await studentsApi.create(
        newStudentName.trim(),
        newStudentRoll.trim(),
        pendingBarcode,
        classId
      );

      // 1. Add to local cache
      studentsRef.current = [...studentsRef.current, student];

      // 2. Mark as present locally
      console.log(`Newly created student marked present: ${student.name}`);
      pendingAttendanceRef.current.add(student.id);
      setStats(prev => ({
        ...prev,
        total: prev.total + 1,
        present: prev.present + 1
      }));
      setLastScanned({ student, status: 'present' });

      // 3. Reset and Close
      setIsAddModalVisible(false);
      setNewStudentName('');
      setNewStudentRoll('');
      setPendingBarcode('');
      setScanned(false);

      // 4. Sync
      syncToBackend();
      globalState.needsDashboardRefresh = true;
      Vibration.vibrate(200);

    } catch (error) {
      console.error('Failed to create student:', error);
      Alert.alert('Error', 'Failed to add student. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };


  const handleEndAttendance = () => {
    if (!classId) return;
    const unmarked = stats.total - stats.present - stats.absent;

    Alert.alert(
      'End Today\'s Attendance',
      `${stats.present} students marked present.\n${unmarked} students will be marked absent for ${className || 'this class'}.\n\nAre you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Attendance',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await attendanceApi.endToday(classId);
              globalState.needsDashboardRefresh = true;
              await loadData();
              Alert.alert(
                'Attendance Ended',
                `${result.markedAbsent} students marked as absent in ${className || 'class'}.`
              );
            } catch (error) {
              console.error('Failed to end attendance:', error);
              Alert.alert('Error', 'Failed to end attendance session');
            }
          },
        },
      ]
    );
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{mode === 'barcode' ? 'Barcode Scanner' : 'Face Recognition'}</Text>
        <View style={styles.headerRight}>
          {mode === 'face' && (
            <TouchableOpacity 
              onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}
              style={styles.modeToggle}
            >
              <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            onPress={() => {
              const newMode = mode === 'barcode' ? 'face' : 'barcode';
              setMode(newMode);
              if (newMode === 'barcode') setFacing('back');
            }}
            style={[styles.modeToggle, mode === 'face' && styles.activeModeToggle]}
          >
            <Ionicons name={mode === 'barcode' ? 'person-outline' : 'barcode-outline'} size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>


      {/* Camera */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'pdf417'],
          }}
          onBarcodeScanned={mode === 'barcode' && !scanned ? handleBarcodeScanned : undefined}
        >

          {/* Scan Overlay */}
          <View style={styles.overlay}>
            {loading ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Loading Students...</Text>
              </View>
            ) : (
              <>
                <View style={styles.scanArea}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                </View>
                <Text style={styles.scanText}>
                  {mode === 'barcode' ? 'Align barcode within the frame' : 'Align face within the frame'}
                </Text>

                {mode === 'face' && (
                  <TouchableOpacity 
                    style={[styles.captureButton, recognizing && { opacity: 0.7 }]} 
                    onPress={handleFaceRecognition}
                    disabled={recognizing}
                  >
                    {recognizing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Ionicons name="camera" size={32} color="#fff" />
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

        </CameraView>
      </View>

      {/* Last Scanned Info */}
      {lastScanned && (
        <Animated.View entering={FadeInUp} style={styles.lastScannedContainer}>
          <Ionicons name="checkmark-circle" size={32} color="#22c55e" />
          <View style={styles.lastScannedInfo}>
            <Text style={styles.lastScannedName}>{lastScanned.student.name}</Text>
            <Text style={styles.lastScannedRoll}>{lastScanned.student.rollNumber}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: '#22c55e' }]}>
            <Text style={styles.statusText}>PRESENT</Text>
          </View>
        </Animated.View>
      )}

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Ionicons name="people" size={20} color="#3b82f6" />
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
            <Text style={[styles.statValue, { color: '#22c55e' }]}>{stats.present}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="close-circle" size={20} color="#ef4444" />
            <Text style={[styles.statValue, { color: '#ef4444' }]}>{stats.absent}</Text>
            <Text style={styles.statLabel}>Absent</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.viewStudentsButton}
            onPress={() => router.push('/students')}
          >
            <Ionicons name="list" size={20} color="#3b82f6" />
            <Text style={styles.viewStudentsText}>View Students</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.endButton}
            onPress={handleEndAttendance}
          >
            <Ionicons name="checkmark-done" size={20} color="#fff" />
            <Text style={styles.endButtonText}>End Attendance</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scan Again Button */}
      {scanned && (
        <Animated.View entering={FadeIn} style={styles.scanAgainContainer}>
          <TouchableOpacity style={styles.scanAgainButton} onPress={() => setScanned(false)}>
            <Ionicons name="scan" size={24} color="#fff" />
            <Text style={styles.scanAgainText}>Scan Again</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
      {/* Add Student Modal */}
      <Modal
        visible={isAddModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setIsAddModalVisible(false);
          setScanned(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Student</Text>
              <TouchableOpacity
                onPress={() => {
                  setIsAddModalVisible(false);
                  setScanned(false);
                }}
              >
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}> Register barcode: {pendingBarcode} </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: John Doe"
                value={newStudentName}
                onChangeText={setNewStudentName}
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Roll Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 101"
                value={newStudentRoll}
                onChangeText={setNewStudentRoll}
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
              onPress={handleSaveNewStudent}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="person-add" size={20} color="#fff" />
                  <Text style={styles.saveButtonText}>Add & Mark Present</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 44,
  },
  cameraContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 24,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scanArea: {
    width: 280,
    height: 280,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#3b82f6',
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 12,
  },
  scanText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
    fontWeight: '500',
  },
  lastScannedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
  },
  lastScannedInfo: {
    flex: 1,
    marginLeft: 12,
  },
  lastScannedName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  lastScannedRoll: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  viewStudentsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  viewStudentsText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  endButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  endButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  manualButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scanAgainContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 8,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  scanAgainText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  message: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 40,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
    marginTop: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modeToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeModeToggle: {
    backgroundColor: '#3b82f6',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  captureButton: {
    marginTop: 30,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});

