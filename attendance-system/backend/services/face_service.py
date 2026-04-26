import face_recognition
import numpy as np
import base64
import io
from PIL import Image
from typing import List, Tuple, Optional, Any
import json

class FaceService:
    def get_encoding(self, image_bytes: bytes) -> Optional[List[float]]:
        # Load image from bytes
        try:
            image = face_recognition.load_image_file(io.BytesIO(image_bytes))
            encodings = face_recognition.face_encodings(image)
            
            if encodings:
                # Return the first face found as a list of floats
                return encodings[0].tolist()
        except Exception as e:
            print(f"Error in get_encoding: {e}")
        return None

    def get_all_encodings(self, image_bytes: bytes) -> List[np.ndarray]:
        try:
            image = face_recognition.load_image_file(io.BytesIO(image_bytes))
            face_locations = face_recognition.face_locations(image)
            encodings = face_recognition.face_encodings(image, face_locations)
            return encodings
        except Exception as e:
            print(f"Error in get_all_encodings: {e}")
            return []

    def compare_faces(self, known_encodings: List[Any], unknown_encoding: np.ndarray, tolerance: float = 0.5) -> List[bool]:
        processed_known = []
        for e in known_encodings:
            try:
                if isinstance(e, str):
                    # Handle stringified list like "[1.2, 3.4]"
                    e = json.loads(e)
                
                # Convert to numpy array of floats
                arr = np.array(e, dtype=float)
                
                # Ensure it's the correct dimension (128 for face_recognition)
                if arr.shape == (128,):
                    processed_known.append(arr)
                else:
                    print(f"Skipping encoding with wrong shape: {arr.shape}")
                    processed_known.append(np.zeros((128,)))
            except Exception as ex:
                print(f"Error processing encoding: {ex}")
                processed_known.append(np.zeros((128,)))
        
        if not processed_known:
            return []
            
        try:
            return face_recognition.compare_faces(processed_known, unknown_encoding, tolerance=tolerance)
        except Exception as e:
            print(f"Error in face_recognition.compare_faces: {e}")
            return [False] * len(processed_known)

    def decode_base64_image(self, base64_str: str) -> bytes:
        try:
            if "," in base64_str:
                base64_str = base64_str.split(",")[1]
            return base64.b64decode(base64_str)
        except Exception as e:
            print(f"Error decoding base64 image: {e}")
            return b""

face_service = FaceService()
