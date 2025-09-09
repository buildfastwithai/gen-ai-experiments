# Nano Banana Image Workflow 🍌

A powerful visual workflow builder for AI-powered image generation and editing. Create complex image processing pipelines using Google's Gemini AI with an intuitive drag-and-drop interface.

## ✨ Features

### 🎨 Image Processing Nodes

- **Image Upload** - Upload and import images to start your workflow
- **Generate Image** - Create new images from text prompts using Gemini AI
- **Edit Image** - Modify and combine multiple images with AI assistance
- **Image Result** - Display and download processed images

### 🔧 Workflow Builder

- **Visual Canvas** - Drag-and-drop interface for building image workflows
- **Node Connections** - Connect nodes to create complex processing pipelines
- **Real-time Processing** - Execute workflows and see results instantly
- **Mobile Optimized** - Touch-friendly interface for mobile devices

### ⚙️ Smart Features

- **API Key Management** - Secure storage of your Gemini API key
- **Responsive Design** - Works seamlessly on desktop, tablet, and mobile
- **Clear Workflow** - Reset and start fresh with one click
- **Settings Panel** - Configure your workflow preferences

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- [Google Gemini API key](https://aistudio.google.com/apikey)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd ai-apps-collection/nano-banana-image-workflow-nextjs
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   # or
   bun install
   ```

3. **Start the development server**

   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   # or
   bun dev
   ```

4. **Open the app**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

### Setup Your API Key

1. Get your free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Click the **Settings** button in the app
3. Enter your API key and save

## 🎯 How to Use

1. **Enter API Key** - Add your Gemini API key in settings
2. **Drag Components** - Drag node types from sidebar to canvas
3. **Connect Nodes** - Connect output ports (right) to input ports (left)
4. **Process Workflow** - Click process buttons to generate/edit images
5. **Download Results** - Save your processed images

### Example Workflows

**Text-to-Image Generation**

1. Drag "Generate Image" node to canvas
2. Enter your text prompt
3. Click "Generate Image" to create

**Image Editing**

1. Drag "Image Upload" node and upload an image
2. Drag "Edit Image" node
3. Connect the uploaded image to edit node
4. Enter editing instructions
5. Click "Edit Image" to process

## 🛠️ Technology Stack

- **Framework**: Next.js 15 with App Router
- **UI Components**: Radix UI + Custom components
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand
- **Workflow Canvas**: React Flow (@xyflow/react)
- **AI Integration**: Google Gemini API
- **TypeScript**: Full type safety
- **Icons**: Lucide React

## 📱 Mobile Support

- Touch-optimized interface
- Mobile-friendly node tabs
- Responsive design
- Gesture support for workflow navigation

## 🔧 Development

### Build for Production

```bash
npm run build
npm run start
```

### Linting

```bash
npm run lint
```

### Project Structure

```
src/
├── app/                 # Next.js app directory
├── components/          # React components
│   ├── ui/             # Base UI components
│   ├── workflow-*.tsx  # Workflow-related components
│   └── *-node.tsx      # Individual node components
├── stores/             # Zustand state stores
└── lib/                # Utility functions
```

## 🤝 Contributing

This project is part of the **Build Fast with AI** ecosystem. Want to build apps like this? Check out the [Gen AI Launchpad Course](https://buildfastwithai.com/genai-course?ref=nano-image-app).

## 📄 License

This project is open source and available under the MIT License.

---

**Powered by [Build Fast with AI](https://buildfastwithai.com/genai-course?ref=nano-image-app) 🚀**
