import { NextResponse } from "next/server"

export async function GET() {
  try {
    
    // Try importing the new package
    await import("@google/genai")
    
    
    return NextResponse.json({
      success: true,
      message: "Test API working",
      hasApiKey: !!process.env.GOOGLE_API_KEY,
      packageImported: true
    })
  } catch (error) {
    return NextResponse.json({ 
      error: "Test failed", 
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}