// app/api/documents/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    count: 0,
    message: "Documents API is working (placeholder)"
  });
}