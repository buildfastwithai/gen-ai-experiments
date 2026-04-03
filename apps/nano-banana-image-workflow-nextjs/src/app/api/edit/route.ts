import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

export async function POST(request: NextRequest) {
  try {
    const { images, prompt, apiKey } = await request.json()

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "At least one image is required" }, { status: 400 })
    }

    if (!prompt) {
      return NextResponse.json({ error: "Edit prompt is required" }, { status: 400 })
    }

    // Use API key from request body if provided, otherwise fall back to environment variable
    const googleApiKey = apiKey || process.env.GOOGLE_API_KEY
    
    if (!googleApiKey) {
      return NextResponse.json({ error: "Google API key not configured. Please provide an API key in settings or set GOOGLE_API_KEY environment variable." }, { status: 500 })
    }

    const ai = new GoogleGenAI({ apiKey: googleApiKey })

    // Prepare the prompt parts array
    const promptParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: prompt }
    ]

    // Supported MIME types for Gemini models
    const supportedMimeTypes = [
      'image/png',
      'image/jpeg', 
      'image/jpg',
      'image/webp',
      'image/heic',
      'image/heif'
    ]

    // Add all images directly to the prompt
    for (const image of images) {
      if (image && image.startsWith('data:')) {
        const [header, base64Data] = image.split(',')
        const mimeType = header.split(':')[1].split(';')[0]
        
        // Check if MIME type is supported
        if (supportedMimeTypes.includes(mimeType)) {
          promptParts.push({
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          })
        }
      }
    }

    // Generate content using gemini-2.5-flash-image-preview
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: promptParts
    })

    // Extract the generated image
    let imageData = null
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageData = part.inlineData.data
        break
      }
    }

    if (imageData) {
      const editedImageUrl = `data:image/png;base64,${imageData}`
      
      return NextResponse.json({
        success: true,
        imageUrl: editedImageUrl,
        originalImages: images,
        editPrompt: prompt,
        numberOfImagesProcessed: images.length,
        description: `Edited ${images.length} image${images.length > 1 ? 's' : ''} with prompt: ${prompt}`
      })
    } else {
      throw new Error("No image data received from generation")
    }

  } catch (error) {
    console.error('Edit API Error:', error)
    return NextResponse.json({ 
      error: "Failed to edit image", 
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}