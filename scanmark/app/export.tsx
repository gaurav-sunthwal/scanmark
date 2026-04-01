import { exportAttendanceToExcel, exportTemplateExcel, shareExcelFile } from '@/utils/excel';
import { clearAttendance, clearStudents } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ExportScreen() {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);

  const handleExportAttendance = async () => {
    try {
      setExporting(true);
      const filePath = await exportAttendanceToExcel();
      await shareExcelFile(filePath);
    } catch (error) {
      Alert.alert('Error', 'Failed to export attendance');
    } finally {
      setExporting(false);
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

  const handleClearAttendance = () => {
    Alert.alert(
      'Clear Attendance',
      'Are you sure you want to clear all attendance records?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            await clearAttendance();
            Alert.alert('Success', 'All attendance records cleared');
          }
        },
      ]
    );
  };

  const handleResetAll = () => {
    Alert.alert(
      'Reset All Data',
      'This will delete ALL students and attendance records. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset Everything', 
          style: 'destructive',
          onPress: async () => {
            await Promise.all([clearStudents(), clearAttendance()]);
            Alert.alert('Success', 'All data has been reset');
          }
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
        <Text style={styles.headerTitle}>Export & Manage</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {/* Export Section */}
        <Animated.View entering={FadeInUp} style={styles.section}>
          <Text style={styles.sectionTitle}>Export Data</Text>
          
          <TouchableOpacity 
            style={styles.exportCard}
            onPress={handleExportAttendance}
            disabled={exporting}
          >
            <View style={[styles.exportIcon, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="download" size={28} color="#3b82f6" />
            </View>
            <View style={styles.exportInfo}>
              <Text style={styles.exportTitle}>
                {exporting ? 'Exporting...' : 'Export Attendance'}
              </Text>
              <Text style={styles.exportSubtitle}>Download as Excel file</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#94a3b8" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.exportCard}
            onPress={handleDownloadTemplate}
          >
            <View style={[styles.exportIcon, { backgroundColor: '#f3e8ff' }]}>
              <Ionicons name="document-text" size={28} color="#a855f7" />
            </View>
            <View style={styles.exportInfo}>
              <Text style={styles.exportTitle}>Download Template</Text>
              <Text style={styles.exportSubtitle}>Get Excel template for students</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#94a3b8" />
          </TouchableOpacity>
        </Animated.View>

        {/* Manage Section */}
        <Animated.View entering={FadeInUp.delay(100)} style={styles.section}>
          <Text style={styles.sectionTitle}>Manage Data</Text>
          
          <TouchableOpacity 
            style={styles.manageCard}
            onPress={handleClearAttendance}
          >
            <View style={[styles.manageIcon, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="trash" size={24} color="#f59e0b" />
            </View>
            <View style={styles.manageInfo}>
              <Text style={styles.manageTitle}>Clear Attendance</Text>
              <Text style={styles.manageSubtitle}>Remove all attendance records</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.manageCard, styles.dangerCard]}
            onPress={handleResetAll}
          >
            <View style={[styles.manageIcon, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="warning" size={24} color="#ef4444" />
            </View>
            <View style={styles.manageInfo}>
              <Text style={[styles.manageTitle, styles.dangerText]}>Reset All Data</Text>
              <Text style={styles.manageSubtitle}>Delete everything (cannot be undone)</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Info Section */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.infoSection}>
          <Ionicons name="information-circle" size={24} color="#64748b" />
          <Text style={styles.infoText}>
            Exported files can be shared via email, messaging apps, or saved to cloud storage.
          </Text>
        </Animated.View>
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  exportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  exportIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportInfo: {
    flex: 1,
    marginLeft: 16,
  },
  exportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  exportSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  manageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dangerCard: {
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  manageIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manageInfo: {
    marginLeft: 16,
  },
  manageTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  dangerText: {
    color: '#ef4444',
  },
  manageSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
});
