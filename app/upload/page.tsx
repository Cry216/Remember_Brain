import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Пока без RAG — просто заглушка, чтобы билд прошёл
    return NextResponse.json({
      success: true,
      message: "Upload API работает (RAG временно отключён)",
      filesProcessed: 0
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: "Upload endpoint ready" });
}