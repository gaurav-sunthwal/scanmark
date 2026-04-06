import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { attendance, students } from '@/lib/db/schema';
import { verifyUser } from '@/lib/auth-utils';
import { eq, and, desc, sql } from 'drizzle-orm';

// GET attendance records for the current user and optional class
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('class_id');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const conditions = [eq(attendance.userId, user.userId)];
    if (classId) {
      conditions.push(eq(attendance.classId, parseInt(classId)));
    }

    let query = db.select({
      id: attendance.id,
      student_id: attendance.studentId,
      class_id: attendance.classId,
      date: attendance.date,
      status: attendance.status,
      created_at: attendance.createdAt,
      name: students.name,
      roll_number: students.rollNumber,
    })
    .from(attendance)
    .innerJoin(students, eq(attendance.studentId, students.id))
    .where(and(...conditions))
    .orderBy(desc(attendance.createdAt))
    .$dynamic();

    if (limit) {
      query = query.limit(parseInt(limit));
    }
    if (offset) {
      query = query.offset(parseInt(offset));
    }
    
    const rows = await query;
    
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Fetch attendance error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch attendance' 
    }, { status: 500 });
  }
}

// POST attendance record for the current user in a class
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { student_id, date, status, class_id } = await request.json();
    
    if (!student_id || !date || !status || !class_id) {
      return NextResponse.json({ error: 'student_id, date, status, and class_id are required' }, { status: 400 });
    }

    console.log('Marking attendance:', { student_id, date, status, class_id, userId: user.userId });
    
    // Check if record exists for this student, class, and date
    const [existingRecord] = await db.select()
      .from(attendance)
      .where(and(
        eq(attendance.studentId, student_id),
        eq(attendance.classId, parseInt(class_id)),
        eq(attendance.date, date)
      ));

    let recordResult;
    if (existingRecord) {
      console.log('Updating existing record:', existingRecord.id);
      const [updated] = await db.update(attendance)
        .set({ status, createdAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(attendance.id, existingRecord.id))
        .returning();
      recordResult = updated;
    } else {
      console.log('Inserting new record');
      const [inserted] = await db.insert(attendance)
        .values({
          userId: user.userId,
          classId: parseInt(class_id),
          studentId: student_id,
          date,
          status,
        })
        .returning();
      recordResult = inserted;
    }

    if (!recordResult) {
      console.error('Failed to get result from attendance operation');
      return NextResponse.json({ error: 'Failed to record attendance' }, { status: 500 });
    }

    // Get student details
    const [student] = await db.select({
      name: students.name,
      roll_number: students.rollNumber,
    })
    .from(students)
    .where(eq(students.id, student_id));
    
    const responseData = {
      id: recordResult.id,
      student_id: recordResult.studentId,
      class_id: recordResult.classId,
      date: recordResult.date,
      status: recordResult.status,
      created_at: recordResult.createdAt,
      name: student?.name,
      roll_number: student?.roll_number,
    };
    
    return NextResponse.json(responseData, { status: 201 });
  } catch (error: any) {
    console.error('Record attendance error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to record attendance' 
    }, { status: 500 });
  }
}

// DELETE attendance records
export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('class_id');

    let date = null;
    try {
      const body = await request.json();
      date = body.date;
    } catch (e) {
      // Body is empty or not JSON
    }

    const conditions = [eq(attendance.userId, user.userId)];
    if (classId) {
      conditions.push(eq(attendance.classId, parseInt(classId)));
    }
    if (date) {
      conditions.push(eq(attendance.date, date));
    }

    await db.delete(attendance)
      .where(and(...conditions));
    
    return NextResponse.json({ message: 'Attendance records cleared' });
  } catch (error: any) {
    console.error('Clear attendance error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to clear attendance' 
    }, { status: 500 });
  }
}
