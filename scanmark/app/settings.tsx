import { authApi } from '@/utils/api';
import { checkBackendConnection, isApiMode, isOfflineMode, setApiMode } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const router = useRouter();
  const [apiEnabled, setApiEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [user, setUser] = useState<any>(null);
  const [offlineMode, setOfflineModeState] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const enabled = await isApiMode();
    setApiEnabled(enabled);
    const offline = await isOfflineMode();
    setOfflineModeState(offline);
    await checkConnection();
    
    const currentUser = await authApi.getCurrentUser();
    setUser(currentUser);
  };

  const checkConnection = async () => {
    setConnectionStatus('checking');
    const isConnected = await checkBackendConnection();
    setConnectionStatus(isConnected ? 'connected' : 'disconnected');
  };

  const toggleApiMode = async (value: boolean) => {
    setApiEnabled(value);
    await setApiMode(value);
    
    if (value) {
      await checkConnection();
    }
    
    Alert.alert(
      'Mode Changed',
      value 
        ? 'App will now sync with backend server' 
        : 'App will use local storage only',
      [{ text: 'OK' }]
    );
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

      <View style={styles.content}>
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
        
        {/* Offline Mode Banner */}
        {offlineMode && !user && (
          <View style={styles.section}>
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline" size={24} color="#f59e0b" />
              <View style={styles.offlineBannerText}>
                <Text style={styles.offlineBannerTitle}>Offline Mode</Text>
                <Text style={styles.offlineBannerDesc}>
                  You're using the app offline. Login to sync your data across devices.
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.loginButton}
              onPress={() => router.push('/login')}
            >
              <Ionicons name="log-in-outline" size={20} color="#fff" />
              <Text style={styles.loginButtonText}>Login to Sync</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* API Mode Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backend Integration</Text>
          
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Use Backend API</Text>
                <Text style={styles.settingDescription}>
                  Sync data with attendance-app server
                </Text>
              </View>
              <Switch
                value={apiEnabled}
                onValueChange={toggleApiMode}
                trackColor={{ false: '#cbd5e1', true: '#3b82f6' }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {apiEnabled && (
            <View style={styles.settingCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Connection Status</Text>
                  <Text style={styles.settingDescription}>
                    {connectionStatus === 'checking' && 'Checking connection...'}
                    {connectionStatus === 'connected' && 'Connected to backend'}
                    {connectionStatus === 'disconnected' && 'Cannot reach backend'}
                  </Text>
                </View>
                <View style={[
                  styles.statusIndicator,
                  connectionStatus === 'connected' && styles.statusConnected,
                  connectionStatus === 'disconnected' && styles.statusDisconnected,
                  connectionStatus === 'checking' && styles.statusChecking,
                ]}>
                  <Ionicons 
                    name={
                      connectionStatus === 'connected' ? 'checkmark-circle' :
                      connectionStatus === 'disconnected' ? 'close-circle' :
                      'time'
                    }
                    size={24}
                    color="#fff"
                  />
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.testButton}
                onPress={checkConnection}
              >
                <Ionicons name="refresh" size={18} color="#3b82f6" />
                <Text style={styles.testButtonText}>Test Connection</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>
          
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color="#3b82f6" />
            <Text style={styles.infoText}>
              {apiEnabled 
                ? 'All attendance and student data will be synced with the backend server. Local storage is used as a backup when offline.'
                : 'Data is stored locally on this device only. Enable backend API to sync across devices.'}
            </Text>
          </View>
        </View>

        {/* Backend URL Info */}
        {apiEnabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Backend Configuration</Text>
            
            <View style={styles.settingCard}>
              <Text style={styles.urlLabel}>API Endpoint</Text>
              <Text style={styles.urlText}>http://localhost:3000/api</Text>
              <Text style={styles.urlHint}>
                Update in scanmark/utils/api.ts for production
              </Text>
            </View>
          </View>
        )}
        
        {/* Logout Button */}
        {user && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingCard: {
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
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#64748b',
  },
  statusIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusConnected: {
    backgroundColor: '#22c55e',
  },
  statusDisconnected: {
    backgroundColor: '#ef4444',
  },
  statusChecking: {
    backgroundColor: '#f59e0b',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    gap: 6,
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  urlLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  urlText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#1e293b',
    backgroundColor: '#f1f5f9',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  urlHint: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  offlineBannerText: {
    flex: 1,
  },
  offlineBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  offlineBannerDesc: {
    fontSize: 13,
    color: '#b45309',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#64748b',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
});


// Add logout button
function LogoutButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={logoutStyles.button} onPress={onPress}>
      <Ionicons name="log-out-outline" size={20} color="#ef4444" />
      <Text style={logoutStyles.text}>Logout</Text>
    </TouchableOpacity>
  );
}

const logoutStyles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginTop: 24,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#64748b',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
});
