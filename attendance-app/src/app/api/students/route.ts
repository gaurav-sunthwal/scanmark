import { mockStudents } from '@/lib/mock-db';
import { NextResponse } from 'next/server';

// GET all students
export async function GET() {
  try {
    const students = mockStudents.getAll();
    return NextResponse.json(students);
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch students' 
    }, { status: 500 });
  }
}

// POST new student
export async function POST(request: Request) {
  try {
    const { name, roll_number, barcode } = await request.json();
    const student = mockStudents.create(name, roll_number, barcode);
    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to create student' 
    }, { status: 500 });
  }
}
