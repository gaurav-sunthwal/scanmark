import { Student } from '@/utils/types';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomCamera from '@/components/Camera';
import { faceApi, studentsApi } from '@/utils/api';

export default function StudentDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Parse student data from params
  const student = {
    id: params.id as string,
    name: params.name as string,
    rollNumber: params.rollNumber as string,
    barcode: params.barcode as string,
    classId: params.classId as string,
    imageUrl: params.imageUrl as string,
    isFaceEnrolled: params.isFaceEnrolled === 'true',
  } as Student;

  const className = params.className as string;

  const [imageError, setImageError] = React.useState(false);
  const [imageLoading, setImageLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [studentData, setStudentData] = React.useState<Student>(student);
  const [showCamera, setShowCamera] = useState(false);

  const imageUrl = studentData.imageUrl;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setImageError(false);
    setImageLoading(true);
    try {
      // Re-fetch students to get latest enrollment status
      // We don't have a single student fetch API yet, so we fetch all for this class
      if (studentData.classId) {
        const students = await studentsApi.getAll(studentData.classId);
        const updatedStudent = students.find(s => s.id === studentData.id);
        if (updatedStudent) {
          setStudentData(updatedStudent);
        }
      }
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRemoveFace = async () => {
    Alert.alert(
      'Remove Face Data',
      'Are you sure you want to remove the face recognition data for this student?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            console.log('DEBUG: Removing face data for student ID:', studentData.id);
            if (!studentData.id || studentData.id === 'undefined') {
              Alert.alert('Error', 'Invalid student ID');
              return;
            }
            setActionLoading(true);
            try {
              // 1. Delete from FastAPI/DynamoDB/S3
              await faceApi.remove(studentData.rollNumber);
              
              Alert.alert('Success', 'Face data removed successfully');
              handleRefresh(); // Refresh UI
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove face data');
            } finally {
              setActionLoading(false);
            }
          }
        },
      ]
    );
  };

  const onCaptureFace = async (base64: string) => {
    if (!studentData.id || studentData.id === 'undefined') {
      Alert.alert('Error', 'Invalid student ID');
      return;
    }
    setShowCamera(false);
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('studentId', studentData.id);
      formData.append('name', studentData.name);
      formData.append('prn', studentData.rollNumber);
      formData.append('class_name', params.className as string || 'Student');
      formData.append('photo_base64', base64);

      const response = await faceApi.enroll(formData);
      if (response.success) {
        Alert.alert('Success', `Face registered for ${studentData.name}`);
        handleRefresh();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Face enrollment failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Student Profile</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.backButton}>
          <Ionicons name="refresh" size={24} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.imageContainer}>
          {!imageError ? (
            <>
              <Image
                source={{ uri: imageUrl }}
                style={styles.profileImage}
                onLoadStart={() => {
                  setImageLoading(true);
                  setImageError(false);
                }}
                onLoadEnd={() => setImageLoading(false)}
                onError={(e) => {
                  console.warn('Image load error:', e.nativeEvent);
                  setImageError(true);
                  setImageLoading(false);
                }}
              />
              {imageLoading && (
                <View style={[styles.profileImage, styles.loaderContainer]}>
                  <ActivityIndicator color="#3b82f6" />
                </View>
              )}
            </>
          ) : (
            <View style={[styles.profileImage, styles.placeholderImage]}>
              <Ionicons name="person" size={60} color="#94a3b8" />
              {studentData.isFaceEnrolled && (
                <TouchableOpacity 
                  style={styles.retryBadge} 
                  onPress={handleRefresh}
                >
                  <Ionicons name="refresh" size={14} color="#fff" />
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <View style={styles.nameBadge}>
            <Text style={styles.detailName}>{studentData.name}</Text>
            <Text style={styles.detailClass}>{className || 'Student'}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Basic Information</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.iconBox}>
              <Ionicons name="person" size={20} color="#3b82f6" />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Full Name</Text>
              <Text style={styles.infoValue}>{studentData.name}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.iconBox}>
              <Ionicons name="card" size={20} color="#10b981" />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Roll Number / PRN</Text>
              <Text style={styles.infoValue}>{studentData.rollNumber}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.iconBox}>
              <Ionicons name="barcode" size={20} color="#f59e0b" />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Barcode</Text>
              <Text style={styles.infoValue}>{studentData.barcode}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.iconBox}>
              <Ionicons name="school" size={20} color="#8b5cf6" />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Class ID</Text>
              <Text style={styles.infoValue}>{studentData.classId}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.statusCard, !studentData.isFaceEnrolled && styles.statusCardError]}>
          <View style={[styles.statusIndicator, { backgroundColor: studentData.isFaceEnrolled ? '#22c55e' : '#ef4444' }]} />
          <View>
            <Text style={[styles.statusTitle, !studentData.isFaceEnrolled && styles.statusTitleError]}>
              {studentData.isFaceEnrolled ? 'Face Enrolled' : 'Face Not Enrolled'}
            </Text>
            <Text style={[styles.statusSubtitle, !studentData.isFaceEnrolled && styles.statusSubtitleError]}>
              {studentData.isFaceEnrolled 
                ? 'Student can mark attendance using face'
                : 'Please enroll the student to use face recognition'}
            </Text>
          </View>
        </View>

        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.enrollButton]} 
            onPress={() => setShowCamera(true)}
            disabled={actionLoading}
          >
            <Ionicons name="camera" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>
              {studentData.isFaceEnrolled ? 'Re-enroll Face' : 'Enroll Face'}
            </Text>
          </TouchableOpacity>

          {studentData.isFaceEnrolled && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.removeButton]} 
              onPress={handleRemoveFace}
              disabled={actionLoading}
            >
              <Ionicons name="trash" size={20} color="#ef4444" />
              <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>Remove Face Data</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {showCamera && (
        <View style={StyleSheet.absoluteFill}>
          <CustomCamera 
            onCapture={onCaptureFace} 
            onClose={() => setShowCamera(false)} 
          />
        </View>
      )}

      {actionLoading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.overlayText}>Updating...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  scrollContent: {
    padding: 20,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#e2e8f0',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  loaderContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(241, 245, 249, 0.5)',
  },
  nameBadge: {
    marginTop: 16,
    alignItems: 'center',
  },
  detailName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  detailClass: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
  },
  retryBadge: {
    position: 'absolute',
    bottom: 10,
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  retryText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 16,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  statusCardError: {
    backgroundColor: '#fef2f2',
    borderColor: '#fee2e2',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#166534',
  },
  statusTitleError: {
    color: '#991b1b',
  },
  statusSubtitle: {
    fontSize: 12,
    color: '#15803d',
    marginTop: 2,
  },
  statusSubtitleError: {
    color: '#b91c1c',
  },
  actionButtonsContainer: {
    marginTop: 24,
    gap: 12,
    marginBottom: 40,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
  },
  enrollButton: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  removeButton: {
    backgroundColor: '#fff',
    borderColor: '#fee2e2',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  overlayText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
  },
});
