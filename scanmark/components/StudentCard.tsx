import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

interface StudentCardProps {
  name: string;
  prn: string;
  present: boolean;
  onPress?: () => void;
}

export default function StudentCard({ name, prn, present, onPress }: StudentCardProps) {
  return (
    <TouchableOpacity 
      style={[styles.card, present ? styles.presentCard : styles.absentCard]} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.prn}>{prn}</Text>
      </View>
      <View style={[styles.statusBadge, present ? styles.presentBadge : styles.absentBadge]}>
        <Text style={styles.statusText}>{present ? 'P' : 'A'}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  presentCard: { borderLeftWidth: 5, borderLeftColor: '#4CAF50' },
  absentCard: { borderLeftWidth: 5, borderLeftColor: '#F44336' },
  name: { fontSize: 18, fontWeight: '600', color: '#333' },
  prn: { fontSize: 14, color: '#666', marginTop: 2 },
  statusBadge: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  presentBadge: { backgroundColor: '#E8F5E9' },
  absentBadge: { backgroundColor: '#FFEBEE' },
  statusText: { fontWeight: 'bold', color: '#333' },
});
