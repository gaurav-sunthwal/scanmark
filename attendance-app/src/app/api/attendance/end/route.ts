import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students, attendance } from '@/lib/db/schema';
import { verifyUser } from '@/lib/auth-utils';
import { eq, and, sql, notInArray, inArray } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { class_id } = await request.json();
    if (!class_id) {
      return NextResponse.json({ error: 'class_id is required' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];

    // 1. Get all students for this user and class
    const classStudents = await db.select({ id: students.id })
      .from(students)
      .where(and(
        eq(students.userId, user.userId),
        eq(students.classId, parseInt(class_id))
      ));
    
    if (classStudents.length === 0) {
      return NextResponse.json({ markedAbsent: 0, alreadyMarked: 0 });
    }

    // 2. Get students already marked for today in this class
    const markedStudents = await db.select({ studentId: attendance.studentId })
      .from(attendance)
      .where(and(
        eq(attendance.userId, user.userId), 
        eq(attendance.classId, parseInt(class_id)),
        eq(attendance.date, today)
      ));
    
    const markedIds = markedStudents.map(m => m.studentId);
    
    // 3. Find students not yet marked
    const unmarkedIds = classStudents
      .map(s => s.id)
      .filter(id => !markedIds.includes(id));
    
    if (unmarkedIds.length === 0) {
      return NextResponse.json({ markedAbsent: 0, alreadyMarked: markedIds.length });
    }

    // 4. Mark them as absent in bulk
    await db.insert(attendance).values(
      unmarkedIds.map(id => ({
        userId: user.userId,
        classId: parseInt(class_id),
        studentId: id,
        date: today,
        status: 'absent' as const,
      }))
    );

    return NextResponse.json({
      markedAbsent: unmarkedIds.length,
      alreadyMarked: markedIds.length
    });
    
  } catch (error: any) {
    console.error('End attendance error:', error);
    return NextResponse.json({ error: error.message || 'Failed to end attendance' }, { status: 500 });
  }
}
