import { mockAttendance } from '@/lib/mock-db';
import { NextResponse } from 'next/server';

// GET attendance records
export async function GET() {
  try {
    const records = mockAttendance.getAll();
    return NextResponse.json(records);
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch attendance' 
    }, { status: 500 });
  }
}

// POST attendance record
export async function POST(request: Request) {
  try {
    const { student_id, date, status } = await request.json();
    const record = mockAttendance.mark(student_id, date, status);
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to record attendance' 
    }, { status: 500 });
  }
}
