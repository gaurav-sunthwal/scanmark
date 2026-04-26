import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

interface CameraProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
  hideControls?: boolean;
}

export default function CustomCamera({ onCapture, onClose, hideControls }: CameraProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [type, setType] = useState<'back' | 'front'>('back');
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  if (!permission) return <View />;
  if (!permission.granted) return <Text style={{ color: 'white', marginTop: 50, textAlign: 'center' }}>No access to camera</Text>;

  const toggleCamera = () => {
    const newType = type === 'back' ? 'front' : 'back';
    console.log('DEBUG: Switching camera to:', newType);
    setType(newType);
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          base64: true,
        });
        if (photo?.base64) {
          onCapture(photo.base64);
        }
      } catch (error) {
        console.error('Failed to take picture:', error);
      }
    }
  };

  const pickImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets[0].base64) {
        onCapture(result.assets[0].base64);
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
    }
  };


  return (
    <View style={styles.container}>
      <CameraView 
        key={type}
        style={styles.camera} 
        facing={type} 
        ref={cameraRef}
      >
        {!hideControls && (
          <>
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.button} onPress={onClose}>
                <Text style={styles.text}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                <View style={styles.captureInner} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={pickImage}>
                <Text style={styles.text}>Gallery</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.flipButton} 
              onPress={toggleCamera}
              activeOpacity={0.7}
            >
              <Ionicons name="camera-reverse" size={32} color="white" />
            </TouchableOpacity>
          </>
        )}
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    marginBottom: 40,
  },
  button: { padding: 15, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10 },
  captureButton: {
    width: 70, height: 70, borderRadius: 35, borderWidth: 4, borderColor: 'white',
    justifyContent: 'center', alignItems: 'center',
  },
  captureInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'white' },
  text: { fontSize: 16, color: 'white' },
  flipButton: {
    position: 'absolute',
    top: 140,
    right: 20,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 30,
    zIndex: 99,
  },
});
