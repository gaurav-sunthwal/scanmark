import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { attendance } from '@/lib/db/schema';
import { verifyUser } from '@/lib/auth-utils';
import { eq, and, inArray, sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { student_ids, class_id, date, status = 'present' } = await request.json();
    
    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0 || !class_id || !date) {
      return NextResponse.json({ error: 'student_ids (array), class_id, and date are required' }, { status: 400 });
    }

    const numericClassId = parseInt(class_id);
    const numericStudentIds = student_ids.map(id => parseInt(id.toString()));

    // 1. Find existing records to avoid duplicates
    const existingRecords = await db.select()
      .from(attendance)
      .where(and(
        inArray(attendance.studentId, numericStudentIds),
        eq(attendance.classId, numericClassId),
        eq(attendance.date, date)
      ));

    const existingStudentIds = new Set(existingRecords.map(r => r.studentId));
    const newStudentIds = numericStudentIds.filter(id => !existingStudentIds.has(id));

    // 2. Perform updates for existing ones (optional, user said "add all", but upsert is safer)
    if (existingRecords.length > 0) {
      await db.update(attendance)
        .set({ status, createdAt: sql`CURRENT_TIMESTAMP` })
        .where(and(
          inArray(attendance.studentId, Array.from(existingStudentIds)),
          eq(attendance.classId, numericClassId),
          eq(attendance.date, date)
        ));
    }

    // 3. Perform inserts for new ones
    if (newStudentIds.length > 0) {
      const insertValues = newStudentIds.map(sid => ({
        userId: user.userId,
        classId: numericClassId,
        studentId: sid,
        date,
        status,
      }));
      await db.insert(attendance).values(insertValues);
    }

    return NextResponse.json({ 
      success: true, 
      count: numericStudentIds.length,
      inserted: newStudentIds.length,
      updated: existingRecords.length
    });

  } catch (error: any) {
    console.error('Bulk attendance error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to process bulk attendance' 
    }, { status: 500 });
  }
}
