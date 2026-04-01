import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

export async function POST(request: NextRequest) {
  try {
    const { prompt, inputImage, inputImages, apiKey } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    // Use API key from request body if provided, otherwise fall back to environment variable
    const googleApiKey = apiKey || process.env.GOOGLE_API_KEY
    
    if (!googleApiKey) {
      return NextResponse.json({ error: "Google API key not configured. Please provide an API key in settings or set GOOGLE_API_KEY environment variable." }, { status: 500 })
    }

    const ai = new GoogleGenAI({ apiKey: googleApiKey })


    // Prepare content array for the model
    const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: prompt }]

    // Handle multiple images (inputImages array) or single image (inputImage)
    const imagesToProcess = inputImages || (inputImage ? [inputImage] : [])
    
    // Supported MIME types for Gemini models
    const supportedMimeTypes = [
      'image/png',
      'image/jpeg', 
      'image/jpg',
      'image/webp',
      'image/heic',
      'image/heif'
    ]
    
    if (imagesToProcess.length > 0) {
      
      for (let i = 0; i < imagesToProcess.length; i++) {
        const image = imagesToProcess[i]
        if (image && image.startsWith('data:')) {
          try {
            const [header, base64Data] = image.split(',')
            const mimeType = header.split(':')[1].split(';')[0]
            
            // Check if MIME type is supported
            if (!supportedMimeTypes.includes(mimeType)) {
              continue
            }
            
            contentParts.push({
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            })
          } catch {
          }
        }
      }
    }


    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: contentParts
    })


    // Extract image from response
    let imageData = null
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0]
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            imageData = part.inlineData.data
            break
          }
        }
      }
    }

    if (!imageData) {
      return NextResponse.json({ 
        error: "No image generated", 
        debug: {
          hasCandidates: !!response.candidates,
          candidateCount: response.candidates?.length || 0,
          firstCandidateContent: response.candidates?.[0]?.content
        }
      }, { status: 500 })
    }

    // Convert to data URL
    const imageUrl = `data:image/png;base64,${imageData}`


    return NextResponse.json({
      success: true,
      imageUrl: imageUrl,
      prompt: prompt,
      description: prompt,
      hasInputImage: imagesToProcess.length > 0,
      inputImageCount: imagesToProcess.length
    })
  } catch (error) {
    return NextResponse.json({ 
      error: "Failed to generate image", 
      details: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
