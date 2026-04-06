import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { attendance, students } from '@/lib/db/schema';
import { verifyUser } from '@/lib/auth-utils';
import { eq, and, sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { barcode, class_id, date, status = 'present' } = await request.json();
    
    if (!barcode || !class_id || !date) {
      return NextResponse.json({ error: 'barcode, class_id, and date are required' }, { status: 400 });
    }

    // 1. Find the student by barcode and class in ONE query
    const [student] = await db.select()
      .from(students)
      .where(and(
        eq(students.barcode, barcode),
        eq(students.classId, parseInt(class_id)),
        eq(students.userId, user.userId)
      ));

    if (!student) {
      return NextResponse.json({ error: 'Student not found with this barcode' }, { status: 404 });
    }

    // 2. Mark attendance (Upsert)
    const [existingRecord] = await db.select()
      .from(attendance)
      .where(and(
        eq(attendance.studentId, student.id),
        eq(attendance.classId, parseInt(class_id)),
        eq(attendance.date, date)
      ));

    let recordResult;
    if (existingRecord) {
      const [updated] = await db.update(attendance)
        .set({ status, createdAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(attendance.id, existingRecord.id))
        .returning();
      recordResult = updated;
    } else {
      const [inserted] = await db.insert(attendance)
        .values({
          userId: user.userId,
          classId: parseInt(class_id),
          studentId: student.id,
          date,
          status,
        })
        .returning();
      recordResult = inserted;
    }

    // 3. Get updated stats for the class in the same response to avoid another API call!
    const statsData = await db.select({
      totalStudents: sql<number>`count(distinct ${students.id})`,
      present: sql<number>`count(distinct case when ${attendance.status} = 'present' and ${attendance.date} = ${date} then ${attendance.id} end)`,
      absent: sql<number>`count(distinct case when ${attendance.status} = 'absent' and ${attendance.date} = ${date} then ${attendance.id} end)`,
    })
    .from(students)
    .leftJoin(attendance, and(
      eq(students.id, attendance.studentId),
      eq(attendance.date, date)
    ))
    .where(eq(students.classId, parseInt(class_id)));

    return NextResponse.json({
      student: {
        id: student.id,
        name: student.name,
        roll_number: student.rollNumber,
        barcode: student.barcode,
      },
      record: {
        id: recordResult.id,
        status: recordResult.status,
        date: recordResult.date,
      },
      stats: statsData[0] || { totalStudents: 0, present: 0, absent: 0 }
    });

  } catch (error: any) {
    console.error('Scan API error:', error);
    return NextResponse.json({ error: error.message || 'Scan failed' }, { status: 500 });
  }
}
