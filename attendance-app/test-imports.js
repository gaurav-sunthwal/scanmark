
const faceapi = require('face-api.js');
const tf = require('@tensorflow/tfjs-node');
const { Canvas, Image, ImageData } = require('canvas');

console.log('Imports successful');
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });
console.log('MonkeyPatch successful');
