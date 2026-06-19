import { authApi, attendanceApi } from '@/utils/api';
import { exportTemplateExcel, shareExcelFile } from '@/utils/excel';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Updates from 'expo-updates';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'downloading' | 'ready' | 'up-to-date'>('idle');

  const classId = params.classId as string;
  const className = params.className as string;

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await authApi.getCurrentUser();
    setUser(currentUser);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await authApi.logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const handleResetAttendance = () => {
    if (!classId) {
      Alert.alert('No Class Selected', 'Please select a class from the home screen first.');
      return;
    }
    Alert.alert(
      'Reset Today\'s Attendance',
      `This will delete all attendance records for today in "${className || 'this class'}". This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              const today = new Date().toISOString().split('T')[0];
              await attendanceApi.deleteAll(classId, today);
              Alert.alert('Done', "Today's attendance has been reset successfully.");
            } catch (error) {
              console.error('Failed to reset attendance:', error);
              Alert.alert('Error', 'Failed to reset attendance. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDownloadTemplate = async () => {
    try {
      const filePath = await exportTemplateExcel();
      await shareExcelFile(filePath);
    } catch (error) {
      Alert.alert('Error', 'Failed to download template');
    }
  };

  const navigateTo = (path: any) => {
    router.push({
      pathname: path,
      params: { classId, className }
    });
  };

  const handleCheckForUpdates = async () => {
    // expo-updates only works in production builds, not in dev mode
    if (!Updates.isEnabled) {
      Alert.alert(
        'Dev Mode',
        'OTA updates are only available in production builds. Run "eas build" and install that build to use this feature.'
      );
      return;
    }

    try {
      setUpdateStatus('checking');
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setUpdateStatus('downloading');
        await Updates.fetchUpdateAsync();
        setUpdateStatus('ready');

        Alert.alert(
          'Update Ready',
          'A new update has been downloaded. Restart the app to apply it?',
          [
            { text: 'Later', style: 'cancel', onPress: () => setUpdateStatus('idle') },
            {
              text: 'Restart Now',
              onPress: async () => {
                await Updates.reloadAsync();
              },
            },
          ]
        );
      } else {
        setUpdateStatus('up-to-date');
        setTimeout(() => setUpdateStatus('idle'), 3000);
      }
    } catch (e) {
      console.error('Update check failed:', e);
      setUpdateStatus('idle');
      Alert.alert('Update Check Failed', 'Make sure you are running a production build (not Expo Go). OTA updates require a standalone build via "eas build".');
    }
  };

  const getUpdateIcon = () => {
    if (updateStatus === 'checking' || updateStatus === 'downloading') {
      return <ActivityIndicator size="small" color="#7c3aed" />;
    }
    if (updateStatus === 'up-to-date') {
      return <Ionicons name="checkmark-circle" size={20} color="#22c55e" />;
    }
    return <Ionicons name="cloud-download-outline" size={20} color="#7c3aed" />;
  };

  const getUpdateLabel = () => {
    switch (updateStatus) {
      case 'checking': return 'Checking...';
      case 'downloading': return 'Downloading...';
      case 'ready': return 'Restart to apply';
      case 'up-to-date': return 'Up to date ✓';
      default: return 'Check for Updates';
    }
  };

  // Reusable row component
  const SettingRow = ({ 
    icon, iconColor, iconBg, label, subtitle, onPress, rightElement, isFirst, isLast, disabled 
  }: {
    icon: string; iconColor: string; iconBg: string; label: string; subtitle?: string;
    onPress?: () => void; rightElement?: React.ReactNode; isFirst?: boolean; isLast?: boolean; disabled?: boolean;
  }) => (
    <TouchableOpacity
      style={[
        styles.row,
        isFirst && styles.rowFirst,
        isLast && styles.rowLast,
        !isLast && styles.rowBorder,
      ]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, disabled && { opacity: 0.5 }]}>{label}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (onPress && <Ionicons name="chevron-forward" size={18} color="#c7c7cc" />)}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Profile Card */}
        {user && (
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user.name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        <View style={styles.card}>
          <SettingRow
            icon="people"
            iconColor="#8b5cf6"
            iconBg="#f3e8ff"
            label="Manage Students"
            subtitle="Import, edit, or view students"
            onPress={() => navigateTo('/students')}
            isFirst
          />
          <SettingRow
            icon="school"
            iconColor="#3b82f6"
            iconBg="#dbeafe"
            label="Manage Classes"
            subtitle="Create or switch classes"
            onPress={() => router.push('/classes')}
          />
          <SettingRow
            icon="document-text"
            iconColor="#f59e0b"
            iconBg="#fef3c7"
            label="Attendance Records"
            subtitle="View and manage history"
            onPress={() => navigateTo('/attendance')}
            isLast
          />
        </View>

        {/* Data & Export */}
        <Text style={styles.sectionLabel}>DATA & EXPORT</Text>
        <View style={styles.card}>
          <SettingRow
            icon="download"
            iconColor="#3b82f6"
            iconBg="#dbeafe"
            label="Export Attendance"
            subtitle="Download reports as Excel"
            onPress={() => navigateTo('/export')}
            isFirst
          />
          <SettingRow
            icon="document"
            iconColor="#10b981"
            iconBg="#ecfdf5"
            label="Excel Template"
            subtitle="Download student import format"
            onPress={handleDownloadTemplate}
          />
          <SettingRow
            icon="refresh-circle"
            iconColor="#ef4444"
            iconBg="#fef2f2"
            label="Reset Today's Attendance"
            subtitle={className ? `For "${className}"` : 'Select a class first'}
            onPress={handleResetAttendance}
            isLast
          />
        </View>

        {/* App */}
        <Text style={styles.sectionLabel}>APP</Text>
        <View style={styles.card}>
          <SettingRow
            icon="cloud-download"
            iconColor="#7c3aed"
            iconBg="#ede9fe"
            label={getUpdateLabel()}
            subtitle={
              updateStatus === 'idle' ? 'Tap to check for new features' :
              updateStatus === 'up-to-date' ? 'No pending updates' :
              updateStatus === 'checking' ? 'Looking for updates...' :
              updateStatus === 'downloading' ? 'Please wait...' :
              'Restart from the dialog'
            }
            onPress={handleCheckForUpdates}
            disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
            rightElement={getUpdateIcon()}
            isFirst
            isLast
          />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>ScanMark v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  placeholder: {
    width: 36,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },

  // Profile Card
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  userEmail: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },

  // Section Label
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.5,
  },

  // Grouped Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
    overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  rowFirst: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  rowLast: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5ea',
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 1,
  },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#c7c7cc',
    marginTop: 12,
    marginBottom: 40,
  },
});
