import { AttendanceRecord, getAttendanceStats, getStudents, getTodayAttendance, Student } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  const router = useRouter();
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0 });
  const [recentScans, setRecentScans] = useState<(AttendanceRecord & { student?: Student })[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [hasStudents, setHasStudents] = useState(false);

  const loadData = useCallback(async () => {
    const [attendanceStats, students, todayAttendance] = await Promise.all([
      getAttendanceStats(),
      getStudents(),
      getTodayAttendance(),
    ]);
    
    setStats(attendanceStats);
    setHasStudents(students.length > 0);
    
    // Get recent scans with student info
    const recent = todayAttendance
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5)
      .map(record => ({
        ...record,
        student: students.find(s => s.id === record.studentId),
      }));
    
    setRecentScans(recent);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const absentCount = stats.total - stats.present;
  const unmarkedCount = stats.total - stats.present - stats.absent;
  const progressPercentage = stats.total > 0 ? ((stats.present + stats.absent) / stats.total) * 100 : 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInUp} style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good Day!</Text>
            <Text style={styles.subtitle}>Ready to take attendance</Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/settings')}>
              <Ionicons name="settings-outline" size={24} color="#3b82f6" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/students')}>
              <Ionicons name="people" size={24} color="#3b82f6" />
            </TouchableOpacity>
          </View>
        </Animated.View>

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
          </Animated.View>
        )}

        {/* Quick Actions */}
        <Animated.View entering={FadeInUp.delay(400)} style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity 
            style={styles.primaryAction}
            onPress={() => router.push('/scanner')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#3b82f6' }]}>
              <Ionicons name="scan" size={32} color="#fff" />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Scan Barcode</Text>
              <Text style={styles.actionSubtitle}>Take attendance by scanning</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#94a3b8" />
          </TouchableOpacity>

          <View style={styles.secondaryActions}>
            <TouchableOpacity 
              style={styles.secondaryAction}
              onPress={() => router.push('/students')}
            >
              <View style={[styles.secondaryIcon, { backgroundColor: '#f3e8ff' }]}>
                <Ionicons name="cloud-upload" size={24} color="#a855f7" />
              </View>
              <Text style={styles.secondaryText}>Import Excel</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryAction}
              onPress={() => router.push('/attendance')}
            >
              <View style={[styles.secondaryIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="document-text" size={24} color="#f59e0b" />
              </View>
              <Text style={styles.secondaryText}>Records</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryAction}
              onPress={() => router.push('/export')}
            >
              <View style={[styles.secondaryIcon, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="download" size={24} color="#3b82f6" />
              </View>
              <Text style={styles.secondaryText}>Export</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryAction}
              onPress={() => router.push('/settings')}
            >
              <View style={[styles.secondaryIcon, { backgroundColor: '#f1f5f9' }]}>
                <Ionicons name="settings" size={24} color="#64748b" />
              </View>
              <Text style={styles.secondaryText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Recent Activity */}
        <Animated.View entering={FadeInUp.delay(500)} style={styles.recentContainer}>
          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/attendance')}>
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
              No students imported yet. Import an Excel file to get started.
            </Text>
          </Animated.View>
        )}
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
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
    width: 48,
    height: 48,
    borderRadius: 24,
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
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  secondaryAction: {
    flex: 1,
    minWidth: '30%',
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
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryText: {
    fontSize: 14,
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
    paddingVertical: 40,
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
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  recentInfo: {
    flex: 1,
  },
  recentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  recentRoll: {
    fontSize: 14,
    color: '#64748b',
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
});
