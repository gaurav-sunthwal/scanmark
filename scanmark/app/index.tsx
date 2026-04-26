import { AttendanceRecord, Student } from '@/utils/types';
import { statsApi, studentsApi, attendanceApi, authApi, classesApi } from '@/utils/api';
import { globalState } from '@/utils/state';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState, useRef } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0 });
  const [recentScans, setRecentScans] = useState<(AttendanceRecord & { student?: Student })[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [hasStudents, setHasStudents] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [isClassModalVisible, setIsClassModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const lastLoadedClassId = useRef<string | null>(null);
  const dataLoaded = useRef(false);

  const loadData = useCallback(async (classId?: string, force = false) => {
    try {
      setLoading(true);
      const isLoggedIn = await authApi.isLoggedIn();
      if (!isLoggedIn) {
        router.replace('/login');
        return;
      }

      const allClasses = await classesApi.getAll();
      setClasses(allClasses);

      let activeClass = null;
      const targetId = classId || params.classId as string;
      const lastSelectedId = await classesApi.getSelectedClassId();
      
      if (targetId) {
        activeClass = allClasses.find(c => c.id.toString() === targetId);
      } else if (lastSelectedId) {
        activeClass = allClasses.find(c => c.id.toString() === lastSelectedId);
      }
      
      if (!activeClass && selectedClass) {
        activeClass = allClasses.find(c => c.id === selectedClass.id);
      }
      
      if (!activeClass && allClasses.length > 0) {
        activeClass = allClasses[0];
      }
      
      if (activeClass) {
        setSelectedClass(activeClass);
        await classesApi.setSelectedClassId(activeClass.id.toString());
      }

      if (activeClass) {
        const idStr = activeClass.id.toString();
        
        // Cache: skip loading if we have data for this class and not forcing
        if (idStr === lastLoadedClassId.current && dataLoaded.current && !force) {
          console.log('Using cached dashboard data');
          return;
        }

        setLoading(true);
        // Optimize: Fetch only necessary stats and recent scans
        const [statsData, recentAttendance] = await Promise.all([
          statsApi.get(idStr),
          attendanceApi.getAll(idStr, 5), // Fetch only 5 most recent scans
        ]);
        
        setStats({
          total: statsData.totalStudents,
          present: statsData.present,
          absent: statsData.absent
        });
        setHasStudents(statsData.totalStudents > 0);
        
        const recent = recentAttendance.map(record => ({
          ...record,
          student: {
            id: record.studentId,
            name: record.name || 'Unknown',
            rollNumber: record.roll_number || '',
            barcode: '', 
            classId: record.classId || '',
          }
        }));
        
        setRecentScans(recent);
        lastLoadedClassId.current = idStr;
        dataLoaded.current = true;
      } else {
        setStats({ total: 0, present: 0, absent: 0 });
        setRecentScans([]);
        setHasStudents(false);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [params.classId, router]);

  useFocusEffect(
    useCallback(() => {
      const forceRefresh = globalState.needsDashboardRefresh;
      loadData(undefined, forceRefresh);
      if (forceRefresh) {
        globalState.needsDashboardRefresh = false;
      }
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(undefined, true);
    setRefreshing(false);
  }, [loadData]);

  const selectClass = async (cls: any) => {
    setIsClassModalVisible(false);
    await loadData(cls.id.toString(), true);
  };

  const progressPercentage = stats.total > 0 ? ((stats.present + stats.absent) / stats.total) * 100 : 0;
  const unmarkedCount = stats.total - stats.present - stats.absent;

  const handleEndSession = async () => {
    if (!selectedClass) return;
    try {
      setLoading(true);
      const result = await attendanceApi.endToday(selectedClass.id.toString());
      alert(`Session ended. ${result.markedAbsent} students marked absent.`);
      await loadData(undefined, true);
    } catch (error) {
      console.error('Failed to end session:', error);
      alert('Failed to end session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderSkeleton = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.skeletonClassSelector} />
        <View style={styles.headerButtons}>
          <View style={[styles.headerButton, { backgroundColor: '#f1f5f9' }]} />
          <View style={[styles.headerButton, { backgroundColor: '#f1f5f9' }]} />
        </View>
      </View>
      
      <View style={styles.statsContainer}>
        {[1, 2, 3].map(i => (
          <View key={i} style={[styles.statCard, { backgroundColor: '#f1f5f9', borderTopWidth: 0 }]}>
            <View style={[styles.iconContainer, { backgroundColor: '#e2e8f0' }]} />
            <View style={styles.skeletonTextSmall} />
            <View style={styles.skeletonTextMedium} />
          </View>
        ))}
      </View>

      <View style={styles.progressContainer}>
        <View style={[styles.skeletonTextMedium, { width: '40%' }]} />
        <View style={[styles.progressBar, { backgroundColor: '#e2e8f0', marginTop: 12 }]} />
        <View style={[styles.skeletonTextSmall, { width: '60%', alignSelf: 'center' }]} />
        <View style={[styles.endSessionButton, { backgroundColor: '#f1f5f9', borderStyle: 'dashed', borderWidth: 1, borderColor: '#e2e8f0', marginTop: 12 }]} />
      </View>

      <View style={styles.actionsContainer}>
        <View style={[styles.skeletonTextSmall, { width: 100, marginBottom: 12 }]} />
        <View style={[styles.primaryAction, { backgroundColor: '#f1f5f9', height: 80 }]} />
      </View>

      <View style={styles.recentContainer}>
        <View style={[styles.skeletonTextSmall, { width: 120, marginBottom: 12 }]} />
        {[1, 2, 3].map(i => (
          <View key={i} style={[styles.recentItem, { backgroundColor: '#f1f5f9' }]}>
            <View style={[styles.statusDot, { backgroundColor: '#e2e8f0' }]} />
            <View style={styles.recentInfo}>
              <View style={[styles.skeletonTextMedium, { marginTop: 0 }]} />
              <View style={styles.skeletonTextSmall} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {loading && !refreshing ? (
        renderSkeleton()
      ) : (
        <ScrollView 
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
        {/* Header */}
        <Animated.View entering={FadeInUp} style={styles.header}>
          <TouchableOpacity 
            style={styles.classSelector} 
            onPress={() => setIsClassModalVisible(true)}
          >
            <View>
              <Text style={styles.greeting}>
                {selectedClass ? selectedClass.name : 'Select Class'}
              </Text>
              <Text style={styles.subtitle}>
                {selectedClass ? 'Ready to take attendance' : 'Choose a class to start'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#64748b" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
          
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/classes')}>
              <Ionicons name="school-outline" size={24} color="#3b82f6" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerButton} 
              onPress={() => router.push({
                pathname: '/settings',
                params: { 
                  classId: selectedClass?.id?.toString(), 
                  className: selectedClass?.name 
                }
              })}
            >
              <Ionicons name="settings-outline" size={24} color="#3b82f6" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {classes.length === 0 ? (
          <View style={styles.emptyClassesContainer}>
            <Ionicons name="school" size={80} color="#cbd5e1" />
            <Text style={styles.emptyClassesTitle}>No Classes Yet</Text>
            <Text style={styles.emptyClassesSubtitle}>Create a class to start managing your students and attendance</Text>
            <TouchableOpacity 
              style={styles.createClassButton}
              onPress={() => router.push('/classes')}
            >
              <Text style={styles.createClassButtonText}>Setup Classes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <Animated.View entering={FadeInUp.delay(100)} style={[styles.statCard, styles.totalCard]}>
            <View style={[styles.iconContainer, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="people" size={24} color="#3b82f6" />
            </View>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Students</Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(200)} style={[styles.statCard, styles.presentCard]}>
            <View style={[styles.iconContainer, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
            </View>
            <Text style={[styles.statNumber, { color: '#22c55e' }]}>{stats.present}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(300)} style={[styles.statCard, styles.absentCard]}>
            <View style={[styles.iconContainer, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="close-circle" size={24} color="#ef4444" />
            </View>
            <Text style={[styles.statNumber, { color: '#ef4444' }]}>{stats.absent}</Text>
            <Text style={styles.statLabel}>Marked Absent</Text>
          </Animated.View>
        </View>

        {/* Progress Bar */}
        {stats.total > 0 && (
          <Animated.View entering={FadeInUp.delay(350)} style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Today's Progress</Text>
              <Text style={styles.progressPercentage}>{Math.round(progressPercentage)}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {unmarkedCount > 0 
                ? `${unmarkedCount} student${unmarkedCount !== 1 ? 's' : ''} not yet marked`
                : 'All students marked!'}
            </Text>
            
            {unmarkedCount > 0 && (
              <TouchableOpacity 
                style={styles.endSessionButton}
                onPress={handleEndSession}
              >
                <Ionicons name="stop-circle-outline" size={20} color="#64748b" />
                <Text style={styles.endSessionText}>End Session (Mark Absent)</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {/* Quick Actions */}
        <Animated.View entering={FadeInUp.delay(400)} style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>{hasStudents ? 'Quick Actions' : 'Getting Started'}</Text>
          
          {!hasStudents ? (
            <TouchableOpacity 
              style={[styles.primaryAction, { backgroundColor: '#3b82f6' }]}
              onPress={() => router.push({
                pathname: '/students',
                params: { classId: selectedClass?.id?.toString(), className: selectedClass?.name }
              })}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="cloud-upload" size={32} color="#fff" />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={[styles.actionTitle, { color: '#fff' }]}>Import Student Data</Text>
                <Text style={[styles.actionSubtitle, { color: 'rgba(255,255,255,0.8)' }]}>Upload an Excel or CSV file to start taking attendance</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          ) : (
            <View style={styles.actionRowGrid}>
              <TouchableOpacity 
                style={styles.gridAction}
                onPress={() => router.push({
                  pathname: '/scanner',
                  params: { classId: selectedClass?.id?.toString(), className: selectedClass?.name }
                })}
              >
                <View style={[styles.gridActionIcon, { backgroundColor: '#3b82f6' }]}>
                  <Ionicons name="barcode-outline" size={28} color="#fff" />
                </View>
                <Text style={styles.gridActionTitle}>Scanner</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.gridAction}
                onPress={() => router.push({
                  pathname: '/face-recognition',
                  params: { classId: selectedClass?.id?.toString(), className: selectedClass?.name }
                })}
              >
                <View style={[styles.gridActionIcon, { backgroundColor: '#8b5cf6' }]}>
                  <Ionicons name="person-outline" size={28} color="#fff" />
                </View>
                <Text style={styles.gridActionTitle}>Face Rec</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.gridAction}
                onPress={() => router.push({
                  pathname: '/face-group',
                  params: { classId: selectedClass?.id?.toString(), className: selectedClass?.name }
                })}
              >
                <View style={[styles.gridActionIcon, { backgroundColor: '#f59e0b' }]}>
                  <Ionicons name="people-outline" size={28} color="#fff" />
                </View>
                <Text style={styles.gridActionTitle}>Bulk Scan</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {hasStudents && (
            <TouchableOpacity 
              style={styles.studentListAction}
              onPress={() => router.push({
                pathname: '/students',
                params: { classId: selectedClass?.id?.toString(), className: selectedClass?.name }
              })}
            >
              <Ionicons name="list" size={20} color="#64748b" />
              <Text style={styles.studentListActionText}>View & Manage Students</Text>
              <Ionicons name="chevron-forward" size={16} color="#cbd5e1" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Recent Activity */}
        <Animated.View entering={FadeInUp.delay(500)} style={styles.recentContainer}>
          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push({
              pathname: '/attendance',
              params: { classId: selectedClass?.id?.toString(), className: selectedClass?.name }
            })}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {recentScans.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>No scans yet today</Text>
              <Text style={styles.emptySubtext}>Start by scanning a barcode</Text>
            </View>
          ) : (
            recentScans.map((scan, index) => (
              <View key={scan.id} style={styles.recentItem}>
                <View style={[styles.statusDot, { backgroundColor: scan.status === 'present' ? '#22c55e' : '#ef4444' }]} />
                <View style={styles.recentInfo}>
                  <Text style={styles.recentName}>{scan.student?.name || 'Unknown'}</Text>
                  <Text style={styles.recentRoll}>{scan.student?.rollNumber || ''}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: scan.status === 'present' ? '#dcfce7' : '#fee2e2' }]}>
                  <Text style={[styles.statusText, { color: scan.status === 'present' ? '#22c55e' : '#ef4444' }]}>
                    {scan.status === 'present' ? 'Present' : 'Absent'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Animated.View>

        {/* Setup Warning */}
        {!hasStudents && (
          <Animated.View entering={FadeIn} style={styles.warningContainer}>
            <Ionicons name="information-circle" size={24} color="#f59e0b" />
            <Text style={styles.warningText}>
              No students imported yet. Import an Excel or CSV file to get started.
            </Text>
          </Animated.View>
        )}
      </>
      )}
    </ScrollView>
    )}

      {/* Class Selector Modal */}
      <Modal
        visible={isClassModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsClassModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsClassModalVisible(false)}
        >
          <View style={styles.classModalContent}>
            <Text style={styles.modalHeaderTitle}>Switch Class</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {classes.map((cls) => (
                <TouchableOpacity 
                  key={cls.id} 
                  style={[
                    styles.classModalItem,
                    selectedClass?.id === cls.id && styles.selectedClassItem
                  ]}
                  onPress={() => selectClass(cls)}
                >
                  <View style={[
                    styles.classModalIcon, 
                    { backgroundColor: selectedClass?.id === cls.id ? '#3b82f6' : '#f1f5f9' }
                  ]}>
                    <Ionicons 
                      name="school" 
                      size={20} 
                      color={selectedClass?.id === cls.id ? '#fff' : '#64748b'} 
                    />
                  </View>
                  <Text style={[
                    styles.classModalText,
                    selectedClass?.id === cls.id && styles.selectedClassText
                  ]}>
                    {cls.name}
                  </Text>
                  {selectedClass?.id === cls.id && (
                    <Ionicons name="checkmark" size={20} color="#3b82f6" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity 
              style={styles.manageClassesButton}
              onPress={() => {
                setIsClassModalVisible(false);
                router.push('/classes');
              }}
            >
              <Ionicons name="settings-outline" size={18} color="#3b82f6" />
              <Text style={styles.manageClassesText}>Manage Classes</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  classSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  totalCard: {
    borderTopWidth: 3,
    borderTopColor: '#3b82f6',
  },
  presentCard: {
    borderTopWidth: 3,
    borderTopColor: '#22c55e',
  },
  absentCard: {
    borderTopWidth: 3,
    borderTopColor: '#ef4444',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  progressContainer: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  actionsContainer: {
    paddingHorizontal: 20,
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionRowGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  gridAction: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  gridActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  gridActionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  studentListAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 12,
  },
  studentListActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  actionTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  recentContainer: {
    paddingHorizontal: 20,
    marginTop: 28,
    paddingBottom: 40,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seeAll: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  recentInfo: {
    flex: 1,
  },
  recentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  recentRoll: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyClassesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyClassesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 20,
  },
  emptyClassesSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  createClassButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createClassButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  classModalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '100%',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  classModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  selectedClassItem: {
    backgroundColor: '#f8fafc',
  },
  classModalIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  classModalText: {
    fontSize: 16,
    color: '#475569',
    flex: 1,
  },
  selectedClassText: {
    color: '#1e293b',
    fontWeight: 'bold',
  },
  manageClassesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
  },
  manageClassesText: {
    color: '#3b82f6',
    fontSize: 15,
    fontWeight: '600',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
  },
  endSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  endSessionText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  // Skeleton Styles
  skeletonClassSelector: {
    width: 150,
    height: 40,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  skeletonTextSmall: {
    width: 80,
    height: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginTop: 8,
  },
  skeletonTextMedium: {
    width: '60%',
    height: 16,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginTop: 8,
  },
});
