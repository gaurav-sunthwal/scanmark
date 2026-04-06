import DateSelector from '@/components/date-selector';
import { attendanceApi, studentsApi } from '@/utils/api';
import { clearAttendance, clearAttendanceForDate } from '@/utils/storage';
import { AttendanceRecord, Student } from '@/utils/types';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal, RefreshControl, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AttendanceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const classId = params.classId as string;

  const [attendance, setAttendance] = useState<(AttendanceRecord & { student?: Student })[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'today' | 'date'>('today');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadAttendance = useCallback(async () => {
    if (!classId) return;
    try {
      setLoading(true);
      const records = await attendanceApi.getAll(classId);

      const enrichedRecords = records
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(record => ({
          ...record,
          student: {
            id: record.studentId,
            name: record.name || 'Unknown',
            rollNumber: record.roll_number || '',
            barcode: '',
            classId: record.classId || '',
          },
        }));

      setAttendance(enrichedRecords);
    } catch (error) {
      console.error('Failed to load attendance from API:', error);
      Alert.alert('Connection Error', 'Failed to fetch latest records from database.');
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
    loadAttendance();
  }, [loadAttendance, classId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAttendance();
    setRefreshing(false);
  }, [loadAttendance]);

  const filteredAttendance = 
    filter === 'today' 
      ? attendance.filter(r => r.date === new Date().toISOString().split('T')[0])
      : filter === 'date'
      ? attendance.filter(r => r.date === selectedDate)
      : attendance;

  const presentCount = filteredAttendance.filter(r => r.status === 'present').length;
  const absentCount = filteredAttendance.filter(r => r.status === 'absent').length;

  const handleClearAttendance = () => {
    const dateToShow = filter === 'today' ? 'today' : filter === 'date' ? selectedDate : 'all dates';
    
    Alert.alert(
      'Clear Attendance',
      `Are you sure you want to clear attendance records for ${dateToShow} in this class?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              if (filter === 'today') {
                await attendanceApi.deleteAll(classId, new Date().toISOString().split('T')[0]);
              } else if (filter === 'date') {
                await attendanceApi.deleteAll(classId, selectedDate);
              } else {
                // Clear all for this class
                Alert.alert(
                  'Clear All Records',
                  'Delete ALL attendance records for THIS class?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete All',
                      style: 'destructive',
                      onPress: async () => {
                        await attendanceApi.deleteAll(classId);
                        await loadAttendance();
                      }
                    }
                  ]
                );
                return;
              }
              await loadAttendance();
            } catch (error) {
              Alert.alert('Error', 'Failed to clear attendance');
            }
          }
        }
      ]
    );
  };

  const renderAttendanceItem = ({ item, index }: { item: AttendanceRecord & { student?: Student }; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 30)} style={styles.attendanceCard}>
      <View style={[styles.statusIndicator, { backgroundColor: item.status === 'present' ? '#22c55e' : '#ef4444' }]} />
      <View style={styles.attendanceInfo}>
        <Text style={styles.studentName}>{item.student?.name || 'Unknown'}</Text>
        <Text style={styles.studentRoll}>{item.student?.rollNumber || ''}</Text>
        <Text style={styles.attendanceDate}>{item.date}</Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: item.status === 'present' ? '#dcfce7' : '#fee2e2' }]}>
        <Text style={[styles.statusText, { color: item.status === 'present' ? '#22c55e' : '#ef4444' }]}>
          {item.status === 'present' ? 'Present' : 'Absent'}
        </Text>
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
        <Text style={styles.headerTitle}>Attendance Records</Text>
        <TouchableOpacity 
          onPress={handleClearAttendance} 
          style={styles.clearButton}
          disabled={filteredAttendance.length === 0}
        >
          <Ionicons name="trash-outline" size={24} color={filteredAttendance.length === 0 ? '#cbd5e1' : '#ef4444'} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={[styles.filterTab, filter === 'today' && styles.filterTabActive]}
          onPress={() => setFilter('today')}
        >
          <Text style={[styles.filterText, filter === 'today' && styles.filterTextActive]}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterTab, filter === 'date' && styles.filterTabActive]}
          onPress={() => {
            setFilter('date');
            setShowDatePicker(true);
          }}
        >
          <Ionicons 
            name="calendar-outline" 
            size={16} 
            color={filter === 'date' ? '#fff' : '#64748b'} 
          />
          <Text style={[styles.filterText, filter === 'date' && styles.filterTextActive]}>
            {filter === 'date' ? selectedDate : 'Date'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
      </View>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
        >
          <View style={styles.datePickerContainer}>
            <Text style={styles.datePickerTitle}>Select Date</Text>
            <DateSelector
              selectedDate={selectedDate}
              onDateSelect={(date) => {
                setSelectedDate(date);
                setShowDatePicker(false);
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading Records...</Text>
        </View>
      ) : (
        <>
      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#dcfce7' }]}>
          <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
          <Text style={[styles.statNumber, { color: '#22c55e' }]}>{presentCount}</Text>
          <Text style={styles.statLabel}>Present</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fee2e2' }]}>
          <Ionicons name="close-circle" size={24} color="#ef4444" />
          <Text style={[styles.statNumber, { color: '#ef4444' }]}>{absentCount}</Text>
          <Text style={styles.statLabel}>Absent</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
          <Ionicons name="people" size={24} color="#3b82f6" />
          <Text style={[styles.statNumber, { color: '#3b82f6' }]}>{filteredAttendance.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {/* Attendance List */}
      {filteredAttendance.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No Records</Text>
          <Text style={styles.emptySubtitle}>
            {filter === 'today' ? 'No attendance taken today' : 'No attendance records yet'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredAttendance}
          renderItem={renderAttendanceItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        />
      )}
      </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
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
    padding: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    gap: 4,
  },
  filterTabActive: {
    backgroundColor: '#3b82f6',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  filterTextActive: {
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  attendanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
  statusIndicator: {
    width: 4,
    height: 50,
    borderRadius: 2,
    marginRight: 12,
  },
  attendanceInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  studentRoll: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  attendanceDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  datePickerContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  datePickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
});