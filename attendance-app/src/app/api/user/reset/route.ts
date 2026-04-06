import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { attendance, students } from '@/lib/db/schema';
import { verifyUser } from '@/lib/auth-utils';
import { eq } from 'drizzle-orm';

// DELETE everything for the current user
export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`Starting full data reset for user: ${user.email} (${user.userId})`);

    // We can use a transaction, but simple sequential deletes follow cascade
    // Delete attendance first (child)
    await db.delete(attendance)
      .where(eq(attendance.userId, user.userId));
      
    // Then delete students (parent)
    await db.delete(students)
      .where(eq(students.userId, user.userId));
    
    console.log(`Reset completed for user: ${user.userId}`);
    
    return NextResponse.json({ 
      success: true,
      message: 'All of your students and attendance records have been deleted from the database' 
    });
  } catch (error: any) {
    console.error('Reset all data error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to reset all data' 
    }, { status: 500 });
  }
}
