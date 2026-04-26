import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { students } from '@/lib/db/schema';
import { verifyUser } from '@/lib/auth-utils';
import { eq, and, asc } from 'drizzle-orm';

// GET students for the current user and optional class
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('class_id');

    const conditions = [eq(students.userId, user.userId)];
    if (classId) {
      conditions.push(eq(students.classId, parseInt(classId)));
    }

    const rows = await db.select({
      id: students.id,
      class_id: students.classId,
      name: students.name,
      roll_number: students.rollNumber,
      barcode: students.barcode,

      created_at: students.createdAt,
    })
      .from(students)
      .where(and(...conditions))
      .orderBy(asc(students.rollNumber));
    
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Fetch students error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch students' 
    }, { status: 500 });
  }
}

// POST new student for the current user in a class
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, roll_number, barcode, class_id } = await request.json();
    
    if (!name || !roll_number || !barcode || !class_id) {
      return NextResponse.json({ error: 'Name, roll_number, barcode, and class_id are required' }, { status: 400 });
    }

    const [result] = await db.insert(students).values({
      userId: user.userId,
      classId: parseInt(class_id),
      name,
      rollNumber: roll_number,
      barcode,
    }).returning();
    
    return NextResponse.json({
      id: result.id,
      class_id: result.classId,
      name: result.name,
      roll_number: result.rollNumber,
      barcode: result.barcode,
      created_at: result.createdAt,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create student error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to create student' 
    }, { status: 500 });
  }
}

// DELETE students for the current user/class
export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('class_id');

    if (classId) {
      await db.delete(students)
        .where(and(
          eq(students.userId, user.userId),
          eq(students.classId, parseInt(classId))
        ));
    } else {
      await db.delete(students)
        .where(eq(students.userId, user.userId));
    }
    
    return NextResponse.json({ message: 'Students cleared' });
  } catch (error: any) {
    console.error('Clear students error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to clear students' 
    }, { status: 500 });
  }
}
