import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    // Basic connectivity check
    await db.execute(sql`SELECT 1`);
    
    return NextResponse.json({ 
      status: 'connected', 
      database: 'PostgreSQL (Neon via Drizzle)',
      message: 'System is ready and connected to the database.'
    });
  } catch (error: any) {
    return NextResponse.json({ 
      status: 'error', 
      message: error.message || 'Database connection failed'
    }, { status: 500 });
  }
}
