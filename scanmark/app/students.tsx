import { exportTemplateExcel, parseExcelFile, shareExcelFile } from '@/utils/excel';
import { Student } from '@/utils/types';
import { studentsApi } from '@/utils/api';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StudentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const classId = params.classId as string;
  
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadStudents = useCallback(async () => {
    if (!classId) return;
    try {
      setLoading(true);
      const data = await studentsApi.getAll(classId);
      setStudents(data);
      setFilteredStudents(data);
    } catch (error) {
      console.error('Failed to load students:', error);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    if (!classId) {
      Alert.alert('Error', 'No class selected');
      router.back();
      return;
    }
    loadStudents();
  }, [loadStudents, classId]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredStudents(students);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = students.filter(
        s => s.name.toLowerCase().includes(query) || 
             s.rollNumber.toLowerCase().includes(query) ||
             s.barcode.toLowerCase().includes(query)
      );
      setFilteredStudents(filtered);
    }
  }, [searchQuery, students]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStudents();
    setRefreshing(false);
  }, [loadStudents]);

  const handleImportExcel = async () => {
    if (!classId) {
      Alert.alert('Error', 'Please select a class first');
      return;
    }

    try {
      setImporting(true);
      
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'application/excel',
          'application/x-excel',
          'application/x-msexcel',
          '*/*'
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setImporting(false);
        return;
      }

      const file = result.assets[0];
      const fileName = file.name?.toLowerCase() || '';
      if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
        Alert.alert('Warning', 'Please select an Excel file (.xlsx or .xls)');
        setImporting(false);
        return;
      }
      
      let base64Content: string | null = null;
      try {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        base64Content = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = () => reject(new Error('Failed to read blob'));
          reader.readAsDataURL(blob);
        });
      } catch (fileError) {
        throw new Error('Could not read file: ' + (fileError instanceof Error ? fileError.message : 'Unknown error'));
      }

      if (!base64Content) throw new Error('Could not read file content');

      const parsedStudents = await parseExcelFile(base64Content);
      if (parsedStudents.length === 0) {
        Alert.alert('Error', 'No valid student data found in the Excel file.');
        setImporting(false);
        return;
      }

      await studentsApi.import(parsedStudents, classId);
      await loadStudents();
      
      Alert.alert('Success', `Imported ${parsedStudents.length} students successfully!`);
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Error', 'Failed to import Excel file: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const filePath = await exportTemplateExcel();
      await shareExcelFile(filePath);
    } catch (error) {
      Alert.alert('Error', 'Failed to download template');
    }
  };

  const renderStudent = ({ item, index }: { item: Student; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50)} style={styles.studentCard}>
      <View style={styles.studentInfo}>
        <View style={styles.studentHeader}>
          <Text style={styles.studentName}>{item.name}</Text>
        </View>
        <Text style={styles.studentRoll}>Roll: {item.rollNumber}</Text>
        <Text style={styles.studentBarcode}>Barcode: {item.barcode}</Text>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Students</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{students.length}</Text>
          <Text style={styles.statLabel}>Total Students</Text>
        </View>
      </View>

      {students.length > 0 && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, roll number, or barcode..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      )}

      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={[styles.importButton, importing && styles.importingButton]}
          onPress={handleImportExcel}
          disabled={importing}
        >
          <Ionicons name="cloud-upload" size={24} color="#fff" />
          <Text style={styles.importButtonText}>
            {importing ? 'Importing...' : 'Import Excel'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.templateButton} onPress={handleDownloadTemplate}>
          <Ionicons name="download" size={20} color="#3b82f6" />
          <Text style={styles.templateButtonText}>Template</Text>
        </TouchableOpacity>
      </View>
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading Students...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredStudents}
          renderItem={renderStudent}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  statsContainer: { paddingHorizontal: 20, marginBottom: 16 },
  statBox: { backgroundColor: '#3b82f6', borderRadius: 16, padding: 20, alignItems: 'center' },
  statNumber: { fontSize: 36, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20, marginBottom: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, elevation: 2 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: '#1e293b' },
  actionsContainer: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
  importButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#22c55e', paddingVertical: 14, borderRadius: 12, gap: 8 },
  importingButton: { backgroundColor: '#86efac' },
  importButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  templateButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dbeafe', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, gap: 8 },
  templateButtonText: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },
  listContainer: { paddingHorizontal: 20, paddingBottom: 20 },
  studentCard: { 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 12, 
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  studentInfo: { flex: 1, marginRight: 12 },
  studentName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  studentRoll: { fontSize: 14, color: '#64748b', marginTop: 2 },
  studentBarcode: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  enrollButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  enrollButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
  },
});
