import { mockStudents } from '@/lib/mock-db';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { barcode: string } }
) {
  try {
    const { barcode } = params;
    const student = mockStudents.getByBarcode(barcode);
    
    if (!student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(student);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch student' },
      { status: 500 }
    );
  }
}
