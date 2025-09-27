import { AssemblyAI } from 'assemblyai';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const client = new AssemblyAI({
      apiKey: process.env.ASSEMBLYAI_API_KEY!
    });

    const token = await client.streaming.createTemporaryToken({
      expires_in_seconds: 480 // 8 minutes
    });
    console.log('Generated temporary token:', token);
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error creating temporary token:', error);
    return NextResponse.json(
      { error: 'Failed to create token' },
      { status: 500 }
    );
  }
}