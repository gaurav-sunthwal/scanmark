import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import CustomCamera from '@/components/Camera';
import { faceApi } from '@/utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FaceEnrollScreen() {
  const router = useRouter();
  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [prn, setPrn] = useState('');
  const [className, setClassName] = useState('CSE A'); // Changed default to CSE A to match scanner
  const [showCamera, setShowCamera] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCapture = async (base64: string) => {
    setShowCamera(false);
    if (!studentId || !name || !prn || !className) {
      Alert.alert('Error', 'Please fill all fields before capturing photo');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('studentId', studentId);
      formData.append('name', name);
      formData.append('prn', prn);
      formData.append('class_name', className);
      
      // Send base64 directly to the backend
      formData.append('photo_base64', base64);

      const response = await faceApi.enroll(formData);
      if (response.success) {
        Alert.alert('Success', `Student ${name} enrolled successfully!`);
        setStudentId('');
        setName('');
        setPrn('');
      }
    } catch (error: any) {
      console.error('Enrollment error:', error);
      Alert.alert('Error', error.message || 'Failed to enroll student');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Face Enrollment</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.form}>
          <Text style={styles.label}>Student ID</Text>
          <TextInput style={styles.input} value={studentId} onChangeText={setStudentId} placeholder="e.g. 101" />

          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. John Doe" />

          <Text style={styles.label}>Barcode / PRN</Text>
          <TextInput style={styles.input} value={prn} onChangeText={setPrn} placeholder="e.g. 1032232584" />

          <Text style={styles.label}>Class</Text>
          <TextInput style={styles.input} value={className} onChangeText={setClassName} placeholder="e.g. CSE A" />

          <TouchableOpacity style={styles.captureBtn} onPress={() => setShowCamera(true)} disabled={loading}>
            <Text style={styles.captureBtnText}>Capture Photo & Enroll</Text>
          </TouchableOpacity>

          {loading && <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 20 }} />}
        </View>
      </ScrollView>

      {showCamera && (
        <View style={StyleSheet.absoluteFill}>
          <CustomCamera onCapture={handleCapture} onClose={() => setShowCamera(false)} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  scrollContent: { padding: 20 },
  form: { backgroundColor: '#fff', padding: 20, borderRadius: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
  label: { fontSize: 14, color: '#64748b', marginBottom: 6, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 16, color: '#1e293b' },
  captureBtn: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 12, alignItems: 'center' },
  captureBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
