import base64
from typing import List, Optional
from services.aws_service import aws_service

class FaceService:
    def get_encoding(self, image_bytes: bytes) -> Optional[str]:
        """
        In Rekognition version, 'encoding' is a FaceId string from AWS.
        This matches the enrollment flow.
        """
        # For enrollment, we index the face and get a FaceId
        # We use a temporary ID or just return the bytes for the route to handle
        # Actually, let's keep it simple: return None here and let route call index_face
        return "REKOGNITION_MANAGED"

    def decode_base64_image(self, base64_str: str) -> bytes:
        try:
            if "," in base64_str:
                base64_str = base64_str.split(",")[1]
            return base64.b64decode(base64_str)
        except Exception as e:
            print(f"Error decoding base64 image: {e}")
            return b""

face_service = FaceService()
