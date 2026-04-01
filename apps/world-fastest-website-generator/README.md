# 🌐 World Fastest Website Generator using Cerebras

A powerful Streamlit application that generates complete, responsive websites in seconds using Cerebras AI models. Simply describe your website idea, and watch as AI creates a fully functional, modern website with HTML, CSS, and JavaScript - all in a single file.

## ✨ Features

- **Lightning Fast Generation**: Powered by Cerebras AI for ultra-fast website creation
- **Multiple AI Models**: Choose from various Cerebras models including GPT-OSS-120B, Qwen-3-32B, Llama-3.3-70B, and Qwen-3-Coder-480B
- **Preset Templates**: Quick-start with predefined website types and styles
- **Responsive Design**: All generated websites are mobile-first and fully responsive
- **Complete Single File**: Generates standalone HTML with embedded CSS and JavaScript
- **Interactive Chat Interface**: Iteratively improve your website through conversational AI
- **Instant Preview**: See your website rendered in real-time within the app
- **One-Click Download**: Export your generated website as an HTML file

## 🚀 Website Types Supported

- **Landing Pages**: Marketing and promotional sites
- **Personal Portfolios**: Showcase your work and skills
- **Startup Product Pages**: Present your product or service
- **Restaurant Pages**: Menu, location, and contact information
- **Event/Conference Pages**: Event details and registration
- **Simple Blog Homes**: Blog landing pages
- **SaaS Marketing Pages**: Software-as-a-Service promotion

## 🎨 Style Options

- **Modern & Minimal**: Clean, contemporary design
- **Playful & Colorful**: Vibrant and engaging layouts
- **Professional & Corporate**: Business-focused aesthetics
- **Dark Theme**: Sleek dark mode designs
- **Neumorphic**: Soft, tactile UI elements
- **Glassmorphism**: Translucent, layered effects

## 📋 Requirements

- Python 3.8+
- Streamlit
- LangChain OpenAI
- Cerebras AI API Key

## 🛠️ Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd world-fastest-website-generator
   ```

2. **Install dependencies**:
   ```bash
   pip install streamlit langchain-openai
   ```

3. **Get your Cerebras API Key**:
   - Sign up at [Cerebras AI](https://cerebras.ai)
   - Generate your API key from the dashboard

4. **Run the application**:
   ```bash
   streamlit run app.py
   ```

## 🎯 Usage

### Quick Start

1. **Launch the app** and enter your Cerebras API key in the sidebar
2. **Select your preferred model** from the dropdown (default: gpt-oss-120b)
3. **Choose a website type** and style preset (optional)
4. **Describe your website** in the chat input
5. **Watch the magic happen** as your website is generated instantly
6. **Preview your site** in the embedded viewer
7. **Download the HTML file** when satisfied

### Example Prompts

- *"Create a landing page for a fitness app with a dark theme and call-to-action buttons"*
- *"Build a restaurant website for an Italian bistro with menu sections and contact info"*
- *"Generate a personal portfolio for a graphic designer with project showcases"*
- *"Make a SaaS landing page for a project management tool with pricing tiers"*

### Iterative Improvements

After generating your initial website, you can continue chatting to make improvements:

- *"Make the header more prominent"*
- *"Add a testimonials section"*
- *"Change the color scheme to blue and white"*
- *"Add a contact form"*

## 🏗️ Generated Website Features

Every generated website includes:

- **Semantic HTML Structure**: Proper use of header, nav, main, section, footer tags
- **Responsive Design**: Mobile-first approach with flexbox/grid layouts
- **Accessibility**: Good color contrast and semantic markup
- **Modern Animations**: CSS transitions and hover effects
- **Navigation**: Responsive navbar with anchor links
- **Hero Section**: Eye-catching headline and call-to-action
- **Feature Cards**: Organized content presentation
- **Social Proof**: Testimonials or reviews section
- **Contact Information**: Footer with links and contact details

## 🔧 Configuration

### API Models Available

- **gpt-oss-120b**: Balanced performance and quality
- **qwen-3-32b**: Fast generation with good results
- **llama-3.3-70b**: High-quality output for complex sites
- **qwen-3-coder-480b**: Specialized for technical/coding sites

### Customization Options

The app supports various customization through the sidebar:
- Model selection for different performance/quality trade-offs
- Website type presets for quick starting points
- Style presets for consistent design themes

## 📁 Project Structure

```
world-fastest-website-generator/
├── app.py              # Main Streamlit application
├── README.md           # This file
└── requirements.txt    # Python dependencies (if created)
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- **Cerebras AI** for providing ultra-fast AI inference
- **Streamlit** for the amazing web app framework
- **LangChain** for AI integration capabilities
- **Build Fast with AI** for the original concept and branding

## 🐛 Troubleshooting

### Common Issues

1. **API Key Error**: Ensure your Cerebras API key is valid and has sufficient credits
2. **Invalid HTML**: If generation fails, try rephrasing your prompt or selecting a different model
3. **Slow Loading**: Check your internet connection and Cerebras API status

### Support

For support and questions:
- Visit [Build Fast with AI](https://buildfastwithai.com/genai-course)
- Check the Cerebras AI documentation
- Open an issue in this repository

---

**Built with ❤️ by [Build Fast with AI](https://buildfastwithai.com/genai-course)**
