import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { classes } from '@/lib/db/schema';
import { verifyUser } from '@/lib/auth-utils';
import { eq, asc } from 'drizzle-orm';

// GET all classes for the current user
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await db.select({
      id: classes.id,
      name: classes.name,
      description: classes.description,
      created_at: classes.createdAt,
    })
      .from(classes)
      .where(eq(classes.userId, user.userId))
      .orderBy(asc(classes.name));
    
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Fetch classes error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch classes' 
    }, { status: 500 });
  }
}

// POST new class for the current user
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { name, description } = await request.json();
    
    if (!name) {
      return NextResponse.json({ error: 'Class name is required' }, { status: 400 });
    }

    console.log(`Creating class for user ${user.userId}: ${name}`);
    const values = {
      userId: user.userId,
      name,
      description,
    };
    
    const [result] = await db.insert(classes).values(values).returning();
    
    if (!result) {
      throw new Error('Insert failed - no result returned');
    }

    console.log('Class created successfully:', result.id);
    return NextResponse.json({
      id: result.id,
      name: result.name,
      description: result.description,
      created_at: result.createdAt,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create class exception:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to create class' 
    }, { status: 500 });
  }
}
