import * as faceapi from 'face-api.js';
import * as tf from '@tensorflow/tfjs-node';
import { Canvas, Image, ImageData, loadImage } from 'canvas';
import path from 'path';
import fs from 'fs';

let modelsLoaded = false;
let monkeyPatched = false;

const MODEL_PATH = path.join(process.cwd(), 'public/models');

export function initFaceApi() {
  if (monkeyPatched) return;
  // @ts-ignore
  faceapi.env.monkeyPatch({ Canvas, Image, ImageData });
  monkeyPatched = true;
  console.log('FaceAPI monkey-patched');
}

export async function loadModels() {
  initFaceApi();
  if (modelsLoaded) return;
  
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH);
  await faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_PATH);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH);
  
  modelsLoaded = true;
  console.log('Face models loaded successfully');
}

export async function getFaceDescriptor(imagePath: string) {
  try {
    await loadModels();
    
    const img = await loadImage(imagePath);
    const fileName = path.basename(imagePath);
    console.log(`Detecting face in: ${fileName} (${img.width}x${img.height})`);

    // Strategy 1: SSD Mobilenet v1 (More accurate)
    let detections = await faceapi.detectSingleFace(
      img as any, 
      new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 })
    ).withFaceLandmarks().withFaceDescriptor();
      
    // Strategy 2: Fallback to Tiny Face Detector (Faster, more robust for angles)
    if (!detections) {
      console.log(`SSD failed in ${fileName}. Trying Tiny Face Detector...`);
      detections = await faceapi.detectSingleFace(
        img as any,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.25 })
      ).withFaceLandmarks().withFaceDescriptor();
    }

    if (!detections) {
      console.warn(`All detection strategies failed in: ${fileName}`);
      return null;
    }

    console.log(`Face detected in ${fileName} with score: ${detections.detection.score.toFixed(4)}`);
    return Array.from(detections.descriptor);
  } catch (error) {
    console.error(`Serious error in getFaceDescriptor for ${imagePath}:`, error);
    return null;
  }
}

export async function getAverageDescriptor(imagePaths: string[]) {
  const descriptors: number[][] = [];
  
  for (const imgPath of imagePaths) {
    const desc = await getFaceDescriptor(imgPath);
    if (desc) descriptors.push(desc);
  }
  
  if (descriptors.length === 0) return null;
  
  // Average the descriptors
  const avgDesc = new Array(descriptors[0].length).fill(0);
  for (const d of descriptors) {
    for (let i = 0; i < d.length; i++) {
        avgDesc[i] += d[i];
    }
  }
  
  return avgDesc.map(v => v / descriptors.length);
}

export function euclideanDistance(d1: number[], d2: number[]) {
    return Math.sqrt(d1.reduce((acc, val, i) => acc + Math.pow(val - d2[i], 2), 0));
}

export function findBestMatch(queryDescriptor: number[], students: any[], threshold = 0.5) {
    let bestMatch = null;
    let minDistance = Infinity;
    
    for (const student of students) {
        if (!student.faceDescriptor) continue;
        
        try {
            const storedDesc = JSON.parse(student.faceDescriptor);
            const distance = euclideanDistance(queryDescriptor, storedDesc);
            
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = student;
            }
        } catch (e) {
            console.error('Error parsing face descriptor for student', student.id, e);
        }
    }
    
    if (minDistance < threshold) {
        return { student: bestMatch, distance: minDistance };
    }
    
    return null;
}
