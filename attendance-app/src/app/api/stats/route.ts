import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students, attendance } from '@/lib/db/schema';
import { verifyUser } from '@/lib/auth-utils';
import { eq, and, sql, count } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('class_id');

    const today = new Date().toISOString().split('T')[0];

    // 1. Total students count for user/class
    const studentConditions = [eq(students.userId, user.userId)];
    if (classId) {
      studentConditions.push(eq(students.classId, parseInt(classId)));
    }

    const results = await db.select({ count: count() })
      .from(students)
      .where(and(...studentConditions));
    
    const totalStudents = Number(results[0]?.count) || 0;

    // 2. Attendance breakdown for today for user/class
    const attendanceConditions = [
      eq(attendance.userId, user.userId), 
      eq(attendance.date, today)
    ];
    if (classId) {
      attendanceConditions.push(eq(attendance.classId, parseInt(classId)));
    }

    const attendanceStats = await db.select({
      status: attendance.status,
      count: count(),
    })
    .from(attendance)
    .where(and(...attendanceConditions))
    .groupBy(attendance.status);

    let present = 0;
    let absent = 0;

    attendanceStats.forEach(row => {
      if (row.status === 'present') present = Number(row.count);
      if (row.status === 'absent') absent = Number(row.count);
    });

    return NextResponse.json({
      totalStudents,
      present,
      absent,
      unmarked: Math.max(0, totalStudents - present - absent),
      date: today,
    });
  } catch (error: any) {
    console.error('Stats fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
