import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students, attendance } from '@/lib/db/schema';
import { verifyUser } from '@/lib/auth-utils';
import { eq, and, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { getFaceDescriptor, findBestMatch } from '@/lib/face-utils';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { class_id, image, date } = await request.json();
    const today = date || new Date().toISOString().split('T')[0];

    if (!class_id || !image) {
      return NextResponse.json({ error: 'class_id and image are required' }, { status: 400 });
    }

    // 1. Save temp image for processing
    const tempDir = path.join(process.cwd(), 'public/uploads/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempPath = path.join(tempDir, `recognize_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`);
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFileSync(tempPath, base64Data, 'base64');

    // 2. Compute descriptor for query image
    const queryDescriptor = await getFaceDescriptor(tempPath);
    // Cleanup temp file
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

    if (!queryDescriptor) {
      return NextResponse.json({ error: 'No face detected in recognition image' }, { status: 400 });
    }

    // 3. Fetch all students for this class with face descriptors
    const classStudents = await db.select()
      .from(students)
      .where(and(
        eq(students.classId, parseInt(class_id)),
        eq(students.userId, user.userId),
        sql`${students.faceDescriptor} IS NOT NULL`
      ));

    if (classStudents.length === 0) {
      return NextResponse.json({ error: 'No students enrolled for face recognition in this class' }, { status: 404 });
    }

    // 4. Find best match Student
    const match = findBestMatch(queryDescriptor, classStudents, 0.45); // threshold 0.45

    if (!match) {
      return NextResponse.json({ error: 'Student face recognized but not matched with any known student' }, { status: 404 });
    }

    const matchedStudent = match.student;

    // 5. Mark attendance for today
    const [existingRecord] = await db.select()
      .from(attendance)
      .where(and(
        eq(attendance.studentId, matchedStudent.id),
        eq(attendance.date, today)
      ));

    if (existingRecord) {
      return NextResponse.json({ 
        success: true, 
        message: 'Already marked present', 
        student: matchedStudent, 
        alreadyMarked: true,
        distance: match.distance
      });
    }

    await db.insert(attendance).values({
      userId: user.userId,
      classId: parseInt(class_id),
      studentId: matchedStudent.id,
      date: today,
      status: 'present'
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Face recognized and marked present', 
      student: matchedStudent,
      distance: match.distance
    });

  } catch (error: any) {
    console.error('Face recognition error:', error);
    return NextResponse.json({ error: error.message || 'Face recognition failed' }, { status: 500 });
  }
}
