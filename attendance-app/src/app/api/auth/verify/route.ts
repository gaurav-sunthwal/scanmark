import { NextRequest, NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }
    
    return NextResponse.json({ valid: true, user });
  } catch (error) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}
