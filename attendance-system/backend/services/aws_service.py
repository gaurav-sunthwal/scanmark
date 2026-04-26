import boto3
import os
from botocore.exceptions import ClientError
from typing import List, Dict, Any

class AWSService:
    def __init__(self):
        self.s3 = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('S3_REGION', os.getenv('AWS_REGION')),
            config=boto3.session.Config(signature_version='s3v4')
        )
        self.dynamodb = boto3.resource(
            'dynamodb',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_REGION')
        )
        self.students_table = self.dynamodb.Table(os.getenv('DYNAMODB_STUDENTS_TABLE'))
        self.attendance_table = self.dynamodb.Table(os.getenv('DYNAMODB_ATTENDANCE_TABLE'))
        self.bucket_name = os.getenv('S3_BUCKET_NAME')

    def upload_photo(self, file_content: bytes, file_name: str) -> str:
        try:
            print(f"DEBUG: Uploading to S3: bucket={self.bucket_name}, key={file_name}")
            self.s3.put_object(Bucket=self.bucket_name, Key=file_name, Body=file_content)
            print(f"DEBUG: Successfully uploaded to S3: {file_name}")
            return file_name
        except ClientError as e:
            print(f"Error uploading to S3: {e}")
            raise e

    def save_student(self, student_data: Dict[str, Any]):
        try:
            print(f"DEBUG: Putting item into DynamoDB table {os.getenv('DYNAMODB_STUDENTS_TABLE')}")
            self.students_table.put_item(Item=student_data)
            print(f"DEBUG: Successfully saved item to DynamoDB")
        except ClientError as e:
            print(f"Error saving to DynamoDB: {e}")
            raise e

    def get_students_by_class(self, class_name: str) -> List[Dict[str, Any]]:
        try:
            # Note: In production, use an Index (GSI) for 'class' attribute
            # For now, we'll scan (inefficient) or assume we query by class if it's a PK/SK
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

    def get_student_photo_url(self, prn: str) -> str:
        try:
            # First try to find student to get the key
            response = self.students_table.scan(
                FilterExpression=boto3.dynamodb.conditions.Attr('prn').eq(prn)
            )
            items = response.get('Items', [])
            if not items:
                # Try by studentId
                response = self.students_table.get_item(Key={'studentId': prn})
                if 'Item' not in response:
                    return None
                student = response['Item']
            else:
                student = items[0]
            
            photo_key = student.get('photoS3Key')
            if not photo_key:
                return None
            
            # Generate presigned URL
            url = self.s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': photo_key},
                ExpiresIn=3600
            )
            return url
        except Exception as e:
            print(f"Error generating presigned URL: {e}")
            return None

    def delete_student_enrollment(self, prn: str):
        try:
            # 1. Find the student to get the photo key
            response = self.students_table.scan(
                FilterExpression=boto3.dynamodb.conditions.Attr('prn').eq(prn)
            )
            items = response.get('Items', [])
            
            for item in items:
                student_id = item.get('studentId')
                photo_key = item.get('photoS3Key')
                
                # 2. Delete from S3
                if photo_key:
                    try:
                        self.s3.delete_object(Bucket=self.bucket_name, Key=photo_key)
                        print(f"DEBUG: Deleted photo from S3: {photo_key}")
                    except Exception as e:
                        print(f"WARNING: Could not delete photo from S3: {e}")
                
                # 3. Delete from DynamoDB
                if student_id:
                    try:
                        self.students_table.delete_item(Key={'studentId': student_id})
                        print(f"DEBUG: Deleted student from DynamoDB: {student_id}")
                    except Exception as e:
                        print(f"WARNING: Could not delete student from DynamoDB: {e}")
            
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
            print(f"Error checking student existence: {e}")
            return False

    def get_enrolled_prns(self, prns: List[str]) -> List[str]:
        try:
            # For simplicity, we scan for matching PRNs
            # In a large DB, we'd use BatchGetItem with studentId if PRNs map 1:1
            # Or use a FilterExpression with many OR conditions (limited to 100)
            enrolled = []
            
            # DynamoDB scan with IN operator
            # Note: Max 100 items per filter expression usually
            for i in range(0, len(prns), 100):
                chunk = prns[i:i+100]
                response = self.students_table.scan(
                    FilterExpression=boto3.dynamodb.conditions.Attr('prn').is_in(chunk),
                    ProjectionExpression='prn'
                )
                items = response.get('Items', [])
                enrolled.extend([item['prn'] for item in items])
            
            return list(set(enrolled)) # Unique PRNs
        except Exception as e:
            print(f"Error fetching enrolled PRNs: {e}")
            return []

aws_service = AWSService()
