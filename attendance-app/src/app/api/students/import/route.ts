import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students } from '@/lib/db/schema';
import { verifyUser } from '@/lib/auth-utils';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { students: studentData, class_id } = await request.json();
    if (!Array.isArray(studentData)) {
      return NextResponse.json({ error: 'Invalid students list' }, { status: 400 });
    }

    if (!class_id) {
      return NextResponse.json({ error: 'class_id is required' }, { status: 400 });
    }

    // Upsert students for this user and class using Drizzle
    const results = await db.insert(students).values(
      studentData.map(s => ({
        userId: user.userId,
        classId: parseInt(class_id),
        name: s.name,
        rollNumber: s.roll_number,
        barcode: s.barcode,
      }))
    ).onConflictDoUpdate({
      target: [students.classId, students.rollNumber],
      set: {
        name: sql`EXCLUDED.name`,
        barcode: sql`EXCLUDED.barcode`,
      },
    }).returning({
      id: students.id,
      name: students.name,
      roll_number: students.rollNumber,
      barcode: students.barcode,
      class_id: students.classId,
    });

    return NextResponse.json({
      message: `Successfully imported ${results.length} students`,
      students: results
    });
    
  } catch (error: any) {
    console.error('Import API error:', error);
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: 500 });
  }
}
