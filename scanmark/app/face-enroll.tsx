import { studentsApi } from '@/utils/api';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function FaceEnrollScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Robustly extract and log parameters for debugging
  const studentId = params.studentId as string;
  const studentName = params.studentName as string;
  const rollNumber = params.rollNumber as string;
  const barcode = params.barcode as string;

  console.log('[FaceEnroll] Params received:', { studentId, studentName, rollNumber, barcode });

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0); // 0: Center, 1: Left, 2: Right
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const steps = [
    { label: 'Look Straight', icon: 'person-outline' },
    { label: 'Turn Left', icon: 'arrow-back-outline' },
    { label: 'Turn Right', icon: 'arrow-forward-outline' },
  ];

  useEffect(() => {
    // Check if studentId is actually valid (not undefined, null, or the string "undefined")
    if (!studentId || studentId === 'undefined' || studentId === 'null') {
      console.error('[FaceEnroll] Invalid studentId detected:', studentId);
      Alert.alert(
        'Invalid Student',
        'We couldn\'t find the student ID. Please go back and select the student again.',
        [{ text: 'Go Back', onPress: () => router.back() }]
      );
      return;
    }
  }, [studentId]);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return;

    // Double check studentId before proceeding
    if (!studentId || studentId === 'undefined') {
        Alert.alert('Error', 'Missing student ID. Please restart enrollment.');
        router.back();
        return;
    }

    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });

      if (photo?.uri) {
        // Increase resolution for better backend detection/training
        const manipulated = await manipulateAsync(
            photo.uri,
            [{ resize: { height: 1024 } }], 
            { base64: true, compress: 0.8, format: SaveFormat.JPEG }
        );

        const newImages = [...capturedImages, `data:image/jpeg;base64,${manipulated.base64}`];
        setCapturedImages(newImages);
        
        if (currentStep < 2) {
          setCurrentStep(currentStep + 1);
        } else {
          // Final step: Upload
          uploadImages(newImages);
        }
      }
    } catch (error) {
      console.error('Failed to take picture:', error);
      Alert.alert('Error', 'Failed to capture image');
    } finally {
      setIsCapturing(false);
    }
  };

  const uploadImages = async (images: string[]) => {
    if (!studentId || studentId === 'undefined') {
        Alert.alert('Error', 'Invalid student ID during upload. Please restart enrollment.');
        return;
    }

    try {
      setIsUploading(true);
      console.log(`[FaceEnroll] Uploading ${images.length} images for studentId: ${studentId}`);
      const result = await studentsApi.enrollFace(studentId, images);
      
      if (result.success) {
        Alert.alert('Success', 'Face trained and enrolled successfully!', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        Alert.alert('Enrollment Error', result.message || 'Face enrollment failed. Please ensure your face is clearly visible.');
        setCapturedImages([]);
        setCurrentStep(0);
      }
    } catch (error: any) {
      console.error('Failed to upload faces:', error);
      // Pass the specific error message from the backend if available
      const errorMsg = error.message.includes('No face detected') 
        ? "We couldn't detect your face in one or more photos. Please ensure good lighting and look directly at the camera."
        : `Face enrollment failed: ${error.message}`;
        
      Alert.alert('Recognition Error', errorMsg);
      setCapturedImages([]);
      setCurrentStep(0);
    } finally {
      setIsUploading(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>We need your permission to use the camera</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Face Enrollment</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <Text style={styles.studentName}>Enrolling: {studentName}</Text>
        <Text style={styles.studentMeta}>Roll: {rollNumber} | ID: {barcode}</Text>
        
        <View style={styles.stepIndicator}>
          {steps.map((step, index) => (
            <View key={index} style={styles.stepItem}>
              <View style={[
                styles.stepCircle,
                currentStep === index && styles.activeStepCircle,
                currentStep > index && styles.completedStepCircle
              ]}>
                {currentStep > index ? (
                  <Ionicons name="checkmark" size={20} color="#fff" />
                ) : (
                  <Text style={[
                      styles.stepNumber,
                      currentStep === index && styles.activeStepNumber
                  ]}>{index + 1}</Text>
                )}
              </View>
              <Text style={[
                  styles.stepLabel,
                  currentStep === index && styles.activeStepLabel
              ]}>{step.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cameraWrapper}>
          <CameraView 
            ref={cameraRef}
            style={styles.camera} 
            facing="front"
          >
            <View style={styles.guidelineOverlay}>
                <View style={styles.faceGuideline} />
            </View>
          </CameraView>
        </View>

        <View style={styles.instructionsContainer}>
            <Animated.View key={currentStep} entering={FadeInUp} style={styles.instructionBox}>
                <Ionicons name={steps[currentStep].icon as any} size={40} color="#3b82f6" />
                <Text style={styles.instructionText}>{steps[currentStep].label}</Text>
                <Text style={styles.instructionSubtext}>Hold still while we capture your facial features</Text>
            </Animated.View>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.captureButton, (isCapturing || isUploading) && styles.disabledButton]}
          onPress={takePicture}
          disabled={isCapturing || isUploading}
        >
          {isUploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.captureInner}>
                <Ionicons name="camera" size={32} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
        {isUploading && <Text style={styles.uploadingText}>Processing features...</Text>}
      </View>
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
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 28,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  studentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  studentMeta: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 24,
    textAlign: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  stepItem: {
    alignItems: 'center',
    gap: 8,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  activeStepCircle: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  completedStepCircle: {
    borderColor: '#22c55e',
    backgroundColor: '#22c55e',
  },
  stepNumber: {
    color: '#64748b',
    fontWeight: 'bold',
  },
  activeStepNumber: {
    color: '#3b82f6',
  },
  stepLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  activeStepLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  cameraWrapper: {
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: (width * 0.8) / 2,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#334155',
  },
  camera: {
    flex: 1,
  },
  guidelineOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  faceGuideline: {
    width: '70%',
    height: '80%',
    borderRadius: 100,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderStyle: 'dashed',
  },
  instructionsContainer: {
    marginTop: 40,
    width: '100%',
    alignItems: 'center',
  },
  instructionBox: {
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 24,
    borderRadius: 20,
    width: '100%',
  },
  instructionText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  instructionSubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  captureInner: {
    flex: 1,
    width: '100%',
    borderRadius: 34,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  uploadingText: {
    color: '#3b82f6',
    marginTop: 12,
    fontWeight: '600',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
