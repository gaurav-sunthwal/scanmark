import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, FlatList, Dimensions, Animated, Platform } from 'react-native';
import CustomCamera from '@/components/Camera';
import { faceApi, classesApi, attendanceApi } from '@/utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

export default function FaceGroupScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [recognized, setRecognized] = useState<any[]>([]);
  const [unrecognizedCount, setUnrecognizedCount] = useState(0);
  const [className, setClassName] = useState('Select Class');
  const [classId, setClassId] = useState<string | null>(null);
  
  // Animation values
  const panelTranslateY = useRef(new Animated.Value(height)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadCurrentClass();
  }, []);

  useEffect(() => {
    if (recognized.length > 0 || unrecognizedCount > 0) {
      showPanel();
    } else {
      hidePanel();
    }
  }, [recognized, unrecognizedCount]);

  const loadCurrentClass = async () => {
    try {
      const id = await classesApi.getSelectedClassId();
      if (id) {
        setClassId(id);
        const classes = await classesApi.getAll();
        const current = classes.find(c => c.id.toString() === id.toString());
        if (current) setClassName(current.name);
      }
    } catch (error) {
      console.warn('Failed to load class info:', error);
    }
  };

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
          duration: 2000,
          useNativeDriver: true
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true
        })
      ])
    ).start();
  };

  const handleCapture = async (base64: string) => {
    setLoading(true);
    startScanAnim();
    setRecognized([]);
    setUnrecognizedCount(0);

    const date = new Date().toISOString().split('T')[0];

    try {
      const result = await faceApi.recognizeGroup(base64, className, date);
      
      // Sync with Next.js database if students were recognized
      if (result.recognized.length > 0 && classId) {
        try {
          const studentIds = result.recognized.map((s: any) => s.studentId);
          await attendanceApi.bulkMark(studentIds, classId, date, 'present');
        } catch (syncError) {
          console.error('Failed to sync group attendance to main DB:', syncError);
        }
      }

      setRecognized(result.recognized);
      setUnrecognizedCount(result.unrecognized_count);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Group recognition failed');
    } finally {
      setLoading(false);
      scanAnim.stopAnimation();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Background Camera (Always Active) */}
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
            <Text style={styles.headerTitle}>Bulk Scan</Text>
            <Text style={styles.headerSubtitle}>{className}</Text>
          </View>
          <View style={{ width: 44 }} />
        </BlurView>
      </SafeAreaView>

      {/* Scanning Indicator Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <Animated.View style={[
            styles.scanLine,
            {
              transform: [{
                translateY: scanAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, height * 0.6]
                })
              }]
            }
          ]}>
            <LinearGradient
              colors={['transparent', 'rgba(59, 130, 246, 0.5)', 'transparent']}
              style={styles.scanLineGradient}
            />
          </Animated.View>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Identifying students...</Text>
          </View>
        </View>
      )}

      {/* Results Sliding Panel */}
      <Animated.View style={[
        styles.resultsPanel,
        { transform: [{ translateY: panelTranslateY }] }
      ]}>
        <BlurView intensity={80} tint="light" style={styles.panelBlur}>
          <View style={styles.panelHandle} />
          
          <View style={styles.panelHeader}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={32} color="#10b981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.panelTitle}>
                {recognized.length} Students Found
              </Text>
              {unrecognizedCount > 0 && (
                <Text style={styles.panelSubtitle}>
                  {unrecognizedCount} unrecognized faces detected
                </Text>
              )}
            </View>
            <TouchableOpacity 
              style={styles.closePanelBtn}
              onPress={() => {
                setRecognized([]);
                setUnrecognizedCount(0);
              }}
            >
              <Ionicons name="refresh" size={24} color="#3b82f6" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={recognized}
            keyExtractor={(item, index) => item.studentId + index}
            renderItem={({ item }) => (
              <View style={styles.resultRow}>
                <View style={styles.resultAvatar}>
                  <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
                </View>
                <View style={styles.resultDetails}>
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Text style={styles.resultPrn}>Roll: {item.prn}</Text>
                </View>
                <View style={styles.markedBadge}>
                  <Text style={styles.markedText}>PRESENT</Text>
                </View>
              </View>
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  scanLine: {
    position: 'absolute',
    top: height * 0.2,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 6,
  },
  scanLineGradient: {
    flex: 1,
  },
  loadingBox: {
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  resultsPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.5,
    zIndex: 20,
  },
  panelBlur: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    paddingTop: 12,
  },
  panelHandle: {
    width: 40,
    height: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
    gap: 16,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
  },
  panelSubtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
  },
  closePanelBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
  },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    padding: 12,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  resultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#3b82f6',
  },
  resultDetails: {
    flex: 1,
    marginLeft: 16,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  resultPrn: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 2,
  },
  markedBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  markedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
