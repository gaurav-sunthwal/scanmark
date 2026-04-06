import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { classes } from '@/lib/db/schema';
import { verifyUser } from '@/lib/auth-utils';
import { eq, and } from 'drizzle-orm';

// DELETE a specific class
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const classId = parseInt(id);

    await db.delete(classes)
      .where(and(
        eq(classes.id, classId),
        eq(classes.userId, user.userId)
      ));
    
    return NextResponse.json({ message: 'Class deleted successfully' });
  } catch (error: any) {
    console.error('Delete class error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to delete class' 
    }, { status: 500 });
  }
}
