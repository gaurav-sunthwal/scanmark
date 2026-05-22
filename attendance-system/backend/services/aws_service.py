import boto3
import os
from botocore.exceptions import ClientError
from typing import List, Dict, Any, Optional

class AWSService:
    def __init__(self):
        self.region = os.getenv('AWS_REGION', 'us-east-1')
        self.s3 = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('S3_REGION', self.region),
            config=boto3.session.Config(signature_version='s3v4')
        )
        self.dynamodb = boto3.resource(
            'dynamodb',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=self.region
        )
        self.rekognition = boto3.client(
            'rekognition',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=self.region
        )
        
        self.students_table = self.dynamodb.Table(os.getenv('DYNAMODB_STUDENTS_TABLE', 'students'))
        self.attendance_table = self.dynamodb.Table(os.getenv('DYNAMODB_ATTENDANCE_TABLE', 'attendance'))
        self.bucket_name = os.getenv('S3_BUCKET_NAME', 'scanmark-face-photos')
        self.collection_id = os.getenv('REKOGNITION_COLLECTION_ID', 'scanmark-faces')
        
        # Ensure collection exists on startup
        try: self.ensure_collection_exists()
        except: pass

    def ensure_collection_exists(self):
        """Create Rekognition collection if it doesn't exist"""
        try:
            self.rekognition.create_collection(CollectionId=self.collection_id)
            print(f"DEBUG: Created Rekognition collection: {self.collection_id}")
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceAlreadyExistsException':
                print(f"DEBUG: Rekognition collection already exists: {self.collection_id}")
            else:
                print(f"ERROR creating collection: {e}")

    def upload_photo(self, file_content: bytes, file_name: str) -> str:
        try:
            self.s3.put_object(Bucket=self.bucket_name, Key=file_name, Body=file_content)
            return file_name
        except ClientError as e:
            print(f"Error uploading to S3: {e}")
            raise e

    def index_face(self, photo_bytes: bytes, external_id: str) -> Optional[str]:
        """Index a face in Rekognition and return FaceId"""
        try:
            self.ensure_collection_exists()
            response = self.rekognition.index_faces(
                CollectionId=self.collection_id,
                Image={'Bytes': photo_bytes},
                ExternalImageId=external_id.replace('-', '_'), # Rekognition IDs are strict
                MaxFaces=1,
                DetectionAttributes=['DEFAULT']
            )
            
            if response['FaceRecords']:
                return response['FaceRecords'][0]['Face']['FaceId']
            return None
        except Exception as e:
            print(f"Error indexing face: {e}")
            return None

    def search_face(self, photo_bytes: bytes) -> Optional[str]:
        """Search for a face in the collection and return the ExternalImageId (PRN)"""
        try:
            self.ensure_collection_exists() # Ensure it exists before searching
            response = self.rekognition.search_faces_by_image(
                CollectionId=self.collection_id,
                Image={'Bytes': photo_bytes},
                MaxFaces=1,
                FaceMatchThreshold=80.0
            )
            
            if response['FaceMatches']:
                match = response['FaceMatches'][0]
                return match['Face']['ExternalImageId'].replace('_', '-')
            return None
        except Exception as e:
            print(f"Error searching face: {e}")
            return None

    def save_student(self, student_data: Dict[str, Any]):
        try:
            self.students_table.put_item(Item=student_data)
        except ClientError as e:
            print(f"Error saving to DynamoDB: {e}")
            raise e

    def get_students_by_class(self, class_name: str) -> List[Dict[str, Any]]:
        try:
            response = self.students_table.scan(
                FilterExpression=boto3.dynamodb.conditions.Attr('class').eq(class_name)
            )
            return response.get('Items', [])
        except ClientError as e:
            print(f"Error fetching students: {e}")
            return []

    def mark_attendance(self, date: str, student_id: str, present: bool, marked_at: str, method: str):
        try:
            self.attendance_table.put_item(Item={
                'date': date,
                'studentId': student_id,
                'present': present,
                'markedAt': marked_at,
                'method': method
            })
        except ClientError as e:
            print(f"Error marking attendance: {e}")
            raise e

    def get_attendance(self, date: str) -> List[Dict[str, Any]]:
        try:
            response = self.attendance_table.query(
                KeyConditionExpression=boto3.dynamodb.conditions.Key('date').eq(date)
            )
            return response.get('Items', [])
        except ClientError as e:
            print(f"Error fetching attendance: {e}")
            return []

    def delete_student_enrollment(self, prn: str):
        try:
            # 1. Find the student to get FaceId
            response = self.students_table.scan(
                FilterExpression=boto3.dynamodb.conditions.Attr('prn').eq(prn)
            )
            items = response.get('Items', [])
            
            for item in items:
                face_id = item.get('faceId')
                photo_key = item.get('photoS3Key')
                
                # 2. Delete from Rekognition
                if face_id:
                    try:
                        self.rekognition.delete_faces(CollectionId=self.collection_id, FaceIds=[face_id])
                    except: pass
                
                # 3. Delete from S3
                if photo_key:
                    try: self.s3.delete_object(Bucket=self.bucket_name, Key=photo_key)
                    except: pass
                
                # 4. Delete from DynamoDB
                self.students_table.delete_item(Key={'studentId': item['studentId']})
            
            return True
        except Exception as e:
            print(f"Error deleting enrollment: {e}")
            return False

    def student_exists(self, prn: str) -> bool:
        try:
            response = self.students_table.scan(
                FilterExpression=boto3.dynamodb.conditions.Attr('prn').eq(prn),
                ProjectionExpression='prn'
            )
            return len(response.get('Items', [])) > 0
        except Exception as e:
            return False

    def get_student_photo_url(self, prn: str) -> Optional[str]:
        try:
            # 1. Find the student in DynamoDB
            response = self.students_table.scan(
                FilterExpression=boto3.dynamodb.conditions.Attr('prn').eq(prn),
                ProjectionExpression='photoS3Key'
            )
            items = response.get('Items', [])
            if not items or 'photoS3Key' not in items[0]:
                return None
            
            photo_key = items[0]['photoS3Key']
            
            # 2. Generate a pre-signed URL (valid for 1 hour)
            url = self.s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': photo_key},
                ExpiresIn=3600
            )
            return url
        except Exception as e:
            print(f"Error generating pre-signed URL: {e}")
            return None

aws_service = AWSService()
