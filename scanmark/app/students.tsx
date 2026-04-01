import { exportTemplateExcel, parseExcelFile, shareExcelFile } from '@/utils/excel';
import { Student, cacheExcelData, clearStudents, getCachedExcelData, getStudents, isOfflineMode, saveStudents } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StudentsScreen() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [hasCachedExcel, setHasCachedExcel] = useState(false);

  const loadStudents = useCallback(async () => {
    const data = await getStudents();
    setStudents(data);
    setFilteredStudents(data);
    
    // Check if user is in offline mode and has cached excel
    const offline = await isOfflineMode();
    setIsOffline(offline);
    
    const cachedExcel = await getCachedExcelData();
    setHasCachedExcel(!!cachedExcel);
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

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
    try {
      setImporting(true);
      
      // Accept broader file types - including xlsx, xls, and any spreadsheet
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
      console.log('Selected file:', file.name, file.uri, file.mimeType);
      
      // Check if file is an Excel file by extension
      const fileName = file.name?.toLowerCase() || '';
      if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
        Alert.alert('Warning', 'Please select an Excel file (.xlsx or .xls)');
        setImporting(false);
        return;
      }
      
      // Read file as base64 using fetch (works on both platforms)
      let base64Content: string | null = null;
      
      try {
        console.log('Reading file from URI:', file.uri);
        
        // Use fetch to read the file - works on both iOS and Android
        const response = await fetch(file.uri);
        const blob = await response.blob();
        
        // Convert blob to base64
        base64Content = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            // Extract base64 part after data:...;base64,
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = () => reject(new Error('Failed to read blob'));
          reader.readAsDataURL(blob);
        });
        
        console.log('Base64 content length:', base64Content?.length);
      } catch (fileError) {
        console.error('File read error:', fileError);
        throw new Error('Could not read file: ' + (fileError instanceof Error ? fileError.message : 'Unknown error'));
      }

      if (!base64Content) {
        throw new Error('Could not read file content');
      }

      const parsedStudents = await parseExcelFile(base64Content);
      
      if (parsedStudents.length === 0) {
        Alert.alert('Error', 'No valid student data found in the Excel file. Make sure columns have headers: Name, Roll Number, Barcode/PRN');
        setImporting(false);
        return;
      }

      await saveStudents(parsedStudents);
      
      // Cache the Excel file for offline users so they don't need to import again
      const offline = await isOfflineMode();
      if (offline) {
        await cacheExcelData(base64Content);
        setHasCachedExcel(true);
      }
      
      await loadStudents();
      
      Alert.alert(
        'Success',
        `Imported ${parsedStudents.length} students successfully!`
      );
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

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Students',
      'Are you sure you want to remove all students? This will also clear all attendance records.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: async () => {
            await clearStudents();
            await loadStudents();
          }
        },
      ]
    );
  };

  const renderStudent = ({ item, index }: { item: Student; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 50)} style={styles.studentCard}>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.name}</Text>
        <Text style={styles.studentRoll}>Roll: {item.rollNumber}</Text>
        <Text style={styles.studentBarcode}>Barcode: {item.barcode}</Text>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Students</Text>
        <TouchableOpacity onPress={handleClearAll} style={styles.clearButton}>
          <Ionicons name="trash-outline" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{students.length}</Text>
          <Text style={styles.statLabel}>Total Students</Text>
        </View>
      </View>

      {/* Search Bar */}
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
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Action Buttons */}
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
          <Text style={styles.templateButtonText}>Download Template</Text>
        </TouchableOpacity>
      </View>
      
      {/* Offline Mode Cached Excel Info */}
      {isOffline && hasCachedExcel && (
        <View style={styles.cachedInfo}>
          <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
          <Text style={styles.cachedInfoText}>
            Excel file cached for offline use. Your student data is saved locally.
          </Text>
        </View>
      )}

      {/* Students List */}
      {students.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No Students Yet</Text>
          <Text style={styles.emptySubtitle}>Import an Excel file to add students</Text>
        </View>
      ) : filteredStudents.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No Results Found</Text>
          <Text style={styles.emptySubtitle}>Try a different search term</Text>
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
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  clearButton: {
    padding: 8,
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  statBox: {
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  importButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  importingButton: {
    backgroundColor: '#86efac',
  },
  importButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  templateButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  studentRoll: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  studentBarcode: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#64748b',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
  },
  cachedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    gap: 10,
  },
  cachedInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#166534',
  },
});
