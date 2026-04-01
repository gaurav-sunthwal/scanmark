import { endTodayAttendance, findStudentByBarcode, getAttendanceStats, getStudents, markAttendance, Student } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [lastScanned, setLastScanned] = useState<{ student: Student; status: string } | null>(null);
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0 });
  const router = useRouter();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const attendanceStats = await getAttendanceStats();
    setStats(attendanceStats);
  };

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarcodeScanned = useCallback(async (result: BarcodeScanningResult) => {
    if (scanned) return;
    
    setScanned(true);
    Vibration.vibrate(200);
    
    const barcode = result.data;
    const student = await findStudentByBarcode(barcode);
    
    if (student) {
      const record = await markAttendance(student.id, 'present');
      setLastScanned({ student, status: record.status });
      await loadStats();
      
      Alert.alert(
        'Attendance Marked',
        `${student.name} (${student.rollNumber}) marked as Present`,
        [{ text: 'OK', onPress: () => setScanned(false) }]
      );
    } else {
      Alert.alert(
        'Student Not Found',
        `No student found with barcode: ${barcode}`,
        [{ text: 'OK', onPress: () => setScanned(false) }]
      );
    }
  }, [scanned]);

  const handleEndAttendance = () => {
    const unmarked = stats.total - stats.present - stats.absent;
    
    Alert.alert(
      'End Today\'s Attendance',
      `${stats.present} students marked present.\n${unmarked} students will be marked absent.\n\nAre you sure you want to end today's attendance?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Attendance',
          style: 'destructive',
          onPress: async () => {
            const result = await endTodayAttendance();
            await loadStats();
            Alert.alert(
              'Attendance Ended',
              `${result.markedAbsent} students marked as absent.\nTotal attendance: ${result.alreadyMarked + result.markedAbsent} students.`
            );
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
        <Text style={styles.headerTitle}>Scan Attendance</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Camera */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'pdf417'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        >
          {/* Scan Overlay */}
          <View style={styles.overlay}>
            <View style={styles.scanArea}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.scanText}>Align barcode within the frame</Text>
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
});
