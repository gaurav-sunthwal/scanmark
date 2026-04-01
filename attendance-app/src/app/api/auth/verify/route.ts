import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: number;
      email: string;
      name: string;
    };

    return NextResponse.json({
      valid: true,
      user: {
        id: decoded.userId,
        email: decoded.email,
        name: decoded.name,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: 'Invalid or expired token' },
      { status: 401 }
    );
  }
}
