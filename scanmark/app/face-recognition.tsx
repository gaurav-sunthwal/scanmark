import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Dimensions, Animated } from 'react-native';
import CustomCamera from '@/components/Camera';
import { faceApi, classesApi, attendanceApi, studentsApi } from '@/utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function FaceRecognitionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const classId = params.classId as string;
  const className = (params.className as string) || 'Select Class';
  const [loading, setLoading] = useState(false);
  const [recognizedStudent, setRecognizedStudent] = useState<any>(null);
  
  // Animation values
  const panelTranslateY = useRef(new Animated.Value(height)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (recognizedStudent) {
      showPanel();
    } else {
      hidePanel();
    }
  }, [recognizedStudent]);

  const showPanel = () => {
    Animated.spring(panelTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 10
    }).start();
  };

  const hidePanel = () => {
    Animated.timing(panelTranslateY, {
      toValue: height,
      duration: 300,
      useNativeDriver: true
    }).start();
  };

  const startScanAnim = () => {
    scanAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true
        })
      ])
    ).start();
  };

  const handleCapture = async (base64: string) => {
    setLoading(true);
    startScanAnim();
    setRecognizedStudent(null);

    const date = new Date().toISOString().split('T')[0];

    try {
      const result = await faceApi.recognize(base64, className, date);
      
      // Find the matching student in the PostgreSQL DB to get their correct database ID
      let matchedStudent: Student | undefined = undefined;
      
      if (classId) {
        // First check in the current class roster
        const classStudents = await studentsApi.getAll(classId);
        matchedStudent = classStudents.find(
          s => s.rollNumber === result.prn || s.id === result.studentId
        );
        
        // If not found in current class, search globally across all classes
        if (!matchedStudent) {
          console.log(`[FACE-REC] Student ${result.name} not found in class ${classId}. Searching globally...`);
          const allStudents = await studentsApi.getAll(undefined, true);
          matchedStudent = allStudents.find(
            s => s.rollNumber === result.prn || s.id === result.studentId
          );
        }
      }

      if (!matchedStudent) {
        throw new Error(`Student "${result.name}" is not registered in the database!`);
      }
      
      // Set the recognized student to show in the UI card using mapped database details
      const finalStudent = {
        ...result,
        studentId: matchedStudent.id,
        name: matchedStudent.name,
        prn: matchedStudent.rollNumber
      };
      
      setRecognizedStudent(finalStudent);
      
      // Sync with Next.js database using the correct PostgreSQL student ID
      if (classId) {
        try {
          await attendanceApi.mark(matchedStudent.id, date, 'present', classId);
        } catch (syncError) {
          console.error('Failed to sync face recognition attendance to main DB:', syncError);
          alert('Face recognized but failed to mark attendance in database.');
        }
      }
    } catch (error: any) {
      console.error('Recognition error:', error.message);
      
      if (error.message === 'Student not recognized') {
        alert('Face not registered. Please enroll this student first!');
      } else {
        alert(error.message || 'Recognition failed');
      }
    } finally {
      setLoading(false);
      scanAnim.stopAnimation();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Background Camera */}
      <View style={styles.cameraContainer}>
        <CustomCamera 
          onCapture={handleCapture} 
          onClose={() => router.back()}
          hideControls={loading}
        />
      </View>

      {/* Top Header Overlay */}
      <SafeAreaView style={styles.headerOverlay}>
        <BlurView intensity={30} style={styles.headerBlur}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Individual Face Check</Text>
            <Text style={styles.headerSubtitle}>{className}</Text>
          </View>
          <View style={{ width: 44 }} />
        </BlurView>
      </SafeAreaView>

      {/* Scanning Indicator */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <Animated.View style={[
            styles.scanLine,
            {
              transform: [{
                translateY: scanAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, height * 0.4]
                })
              }]
            }
          ]}>
            <LinearGradient
              colors={['transparent', 'rgba(139, 92, 246, 0.5)', 'transparent']}
              style={styles.scanLineGradient}
            />
          </Animated.View>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Recognizing...</Text>
          </View>
        </View>
      )}

      {/* Result Panel */}
      <Animated.View style={[
        styles.resultsPanel,
        { transform: [{ translateY: panelTranslateY }] }
      ]}>
        <BlurView intensity={90} tint="light" style={styles.panelBlur}>
          <View style={styles.panelHandle} />
          
          <View style={styles.panelContent}>
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-done" size={32} color="#10b981" />
            </View>
            
            <Text style={styles.studentName}>{recognizedStudent?.name}</Text>
            <Text style={styles.studentDetails}>
              Roll No: {recognizedStudent?.prn}
            </Text>
            
            <View style={styles.statusPill}>
              <Ionicons name="shield-checkmark" size={16} color="#059669" />
              <Text style={styles.statusPillText}>ATTENDANCE MARKED</Text>
            </View>

            <TouchableOpacity 
              style={styles.nextBtn}
              onPress={() => setRecognizedStudent(null)}
            >
              <LinearGradient
                colors={['#8b5cf6', '#7c3aed']}
                style={styles.nextGradient}
              >
                <Text style={styles.nextBtnText}>Scan Next Student</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  cameraContainer: { flex: 1 },
  
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSubtitle: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 12, fontWeight: '600' },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  scanLine: {
    position: 'absolute',
    top: height * 0.3,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 6,
  },
  scanLineGradient: {
    flex: 1,
  },
  loadingBox: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },

  resultsPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.4,
    zIndex: 20,
  },
  panelBlur: {
    flex: 1,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    overflow: 'hidden',
    paddingTop: 12,
  },
  panelHandle: {
    width: 40,
    height: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 24,
  },
  panelContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  studentName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'center',
  },
  studentDetails: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    marginTop: 20,
  },
  statusPillText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  nextBtn: {
    marginTop: 30,
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  nextGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
});
