import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    status: 'connected', 
    database: 'Mock Database (In-Memory)',
    message: 'Using mock data - 46 students loaded from Excel'
  });
}
