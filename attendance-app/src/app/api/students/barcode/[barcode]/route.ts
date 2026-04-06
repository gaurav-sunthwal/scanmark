import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students } from '@/lib/db/schema';
import { verifyUser } from '@/lib/auth-utils';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ barcode: string }> }
) {
  const { barcode: barcodeParam } = await params;
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get('class_id');
  
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const barcode = barcodeParam.trim();
    
    let query: any = and(
      eq(students.barcode, barcode), 
      eq(students.userId, user.userId)
    );

    if (classId) {
      query = and(query, eq(students.classId, parseInt(classId)));
    }

    const [student] = await db.select({
      id: students.id,
      name: students.name,
      roll_number: students.rollNumber,
      barcode: students.barcode,
      class_id: students.classId,
    })
    .from(students)
    .where(query);
    
    if (!student) {
      return NextResponse.json(
        { error: 'Student not found in this class' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(student);
  } catch (error: any) {
    console.error('Fetch student by barcode error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch student' },
      { status: 500 }
    );
  }
}
