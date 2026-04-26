import { authApi } from '@/utils/api';
import { exportTemplateExcel, shareExcelFile } from '@/utils/excel';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Info */}
        {user && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.settingCard}>
              <View style={styles.userInfo}>
                <View style={styles.avatar}>
                   <Ionicons name="person" size={32} color="#3b82f6" />
                </View>
                <View style={styles.userDetails}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                </View>
              </View>
            </View>
          </View>
        )}
        
        {/* Management Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Management</Text>
          
          <TouchableOpacity style={styles.settingCard} onPress={() => navigateTo('/students')}>
            <View style={styles.settingRow}>
              <View style={[styles.iconContainer, { backgroundColor: '#f3e8ff' }]}>
                <Ionicons name="people" size={22} color="#a855f7" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Manage Students</Text>
                <Text style={styles.settingDescription}>Import students, edit data, or view list</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingCard} onPress={() => navigateTo('/attendance')}>
            <View style={styles.settingRow}>
              <View style={[styles.iconContainer, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="document-text" size={22} color="#f59e0b" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Attendance Records</Text>
                <Text style={styles.settingDescription}>View and manage history</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingCard} onPress={() => navigateTo('/export')}>
            <View style={styles.settingRow}>
              <View style={[styles.iconContainer, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="download" size={22} color="#3b82f6" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Export Data</Text>
                <Text style={styles.settingDescription}>Download attendance reports</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingCard} onPress={handleDownloadTemplate}>
            <View style={styles.settingRow}>
              <View style={[styles.iconContainer, { backgroundColor: '#ecfdf5' }]}>
                <Ionicons name="document" size={22} color="#10b981" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Excel Template</Text>
                <Text style={styles.settingDescription}>Download student import format</Text>
              </View>
              <Ionicons name="download-outline" size={20} color="#cbd5e1" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Classes Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <TouchableOpacity style={styles.settingCard} onPress={() => router.push('/classes')}>
            <View style={styles.settingRow}>
              <View style={[styles.iconContainer, { backgroundColor: '#f1f5f9' }]}>
                <Ionicons name="school" size={22} color="#64748b" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Manage Classes</Text>
                <Text style={styles.settingDescription}>Create or switch current class</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </View>
          </TouchableOpacity>
        </View>
        
        {/* Logout Button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
          <Text style={styles.versionText}>ScanMark v1.0.0</Text>
        </View>
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
  placeholder: {
    width: 36,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  settingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  settingDescription: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  userEmail: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#cbd5e1',
    marginTop: 16,
    marginBottom: 40,
  }
});
