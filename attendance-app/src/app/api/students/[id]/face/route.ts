import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students } from '@/lib/db/schema';
import { verifyUser } from '@/lib/auth-utils';
import { eq, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { getAverageDescriptor } from '@/lib/face-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: studentIdStr } = await params;
    const studentId = parseInt(studentIdStr);
    
    if (isNaN(studentId)) {
        return NextResponse.json({ 
            error: `Invalid Student ID: "${studentIdStr}". Please select a valid student.` 
        }, { status: 400 });
    }

    const { images } = await request.json(); // Array of base64 strings

    if (!images || images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    // 1. Verify student belongs to user
    const [studentData] = await db.select()
      .from(students)
      .where(and(
        eq(students.id, studentId),
        eq(students.userId, user.userId)
      ));

    if (!studentData) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // 2. Save images to public/uploads/faces
    const uploadDir = path.join(process.cwd(), 'public/uploads/faces', studentId.toString());
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const imagePaths: string[] = [];
    for (let i = 0; i < images.length; i++) {
        const base64Data = images[i].replace(/^data:image\/\w+;base64,/, "");
        const fileName = `angle_${i}.jpg`;
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, base64Data, 'base64');
        imagePaths.push(filePath);
    }

    // 3. Compute the average face descriptor via Python API
    try {
        const pythonResponse = await fetch('http://127.0.0.1:8000/enroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(images),
        });

        if (!pythonResponse.ok) {
            const errorData = await pythonResponse.json();
            throw new Error(errorData.detail || 'Python API enrollment failed');
        }

        const { descriptor: avgDescriptor } = await pythonResponse.json();
        
        if (!avgDescriptor) {
            return NextResponse.json({ error: 'Could not detect face in provided images' }, { status: 400 });
        }

        // 4. Update the student in database with the new "trained" descriptor
        const photoUrls = imagePaths.map(p => `/uploads/faces/${studentId}/${path.basename(p)}`);
        
        await db.update(students)
          .set({ 
            faceDescriptor: JSON.stringify(avgDescriptor),
            photoUrls: JSON.stringify(photoUrls)
          })
          .where(and(
            eq(students.id, studentId),
            eq(students.userId, user.userId)
          ));

        return NextResponse.json({ 
            success: true, 
            message: 'Face profile trained and enrolled successfully',
            descriptor: avgDescriptor
        });
    } catch (pythonError: any) {
        console.error('Recognition service error:', pythonError);
        // Identify specifically if it's a "no face" error to return 400 instead of 500
        const isDetectionFailure = pythonError.message.includes('No face detected');
        return NextResponse.json(
            { error: pythonError.message }, 
            { status: isDetectionFailure ? 400 : 500 }
        );
    }

  } catch (error: any) {
    console.error('Global face enrollment error:', error);
    return NextResponse.json({ error: error.message || 'Face enrollment failed' }, { status: 500 });
  }
}
