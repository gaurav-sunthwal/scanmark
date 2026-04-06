import face_recognition
import numpy as np
import os
import json
import psycopg2
from dotenv import load_dotenv

# Load env from sibling directory
load_dotenv(dotenv_path="../attendance-app/.env")

DATABASE_URL = os.getenv("DATABASE_URL")
IMG_DIR = "/Users/gaurav-sunthwal/Desktop/college/scanmark/faceimg"
STUDENT_ID = 459 # Gaurav Sunthwal

def enroll_from_folder():
    print(f"Starting enrollment for Student ID {STUDENT_ID} from {IMG_DIR}...")
    
    descriptors = []
    
    # 1. Process all images in directory
    files = [f for f in os.listdir(IMG_DIR) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    print(f"Found {len(files)} images.")
    
    for filename in sorted(files):
        filepath = os.path.join(IMG_DIR, filename)
        try:
            print(f"Processing {filename}...")
            # Load the image file
            image = face_recognition.load_image_file(filepath)
            
            # Find face encodings
            encodings = face_recognition.face_encodings(image)
            
            if len(encodings) > 0:
                descriptors.append(encodings[0])
                print(f"  ✓ Face detected in {filename}")
            else:
                print(f"  ✗ No face detected in {filename}")
        except Exception as e:
            print(f"  ! Error processing {filename}: {e}")
            
    if not descriptors:
        print("No faces detected in any of the images. Enrollment failed.")
        return
        
    print(f"Successfully extracted {len(descriptors)} face descriptors.")
    
    # 2. Average the descriptors for the "trained" model profile
    avg_descriptor = np.mean(descriptors, axis=0).tolist()
    json_descriptor = json.dumps(avg_descriptor)
    
    # 3. Update the database (Supabase)
    try:
        print("Connecting to Supabase...")
        conn = psycopg2.connect(DATABASE_URL, sslmode="require")
        cur = conn.cursor()
        
        cur.execute(
            "UPDATE students SET face_descriptor = %s WHERE id = %s",
            (json_descriptor, STUDENT_ID)
        )
        
        if cur.rowcount > 0:
            print(f"✓ STUDENT ENROLLED SUCCESSFULLY: Updated Student ID {STUDENT_ID}")
            conn.commit()
        else:
            print(f"✗ FAILED: Student ID {STUDENT_ID} not found in database.")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Database error: {e}")

if __name__ == "__main__":
    enroll_from_folder()
