# 🎨 AI Ad Generator

Generate stunning Instagram images and TikTok videos from any landing page using AI-powered browser automation and Google's Generative AI models.

![AI Ad Generator](https://img.shields.io/badge/Streamlit-FF4B4B?style=for-the-badge&logo=streamlit&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Google AI](https://img.shields.io/badge/Google%20AI-4285F4?style=for-the-badge&logo=google&logoColor=white)

## ✨ Features

- 🚀 **Automated Landing Page Analysis**: Uses browser automation to extract key brand information
- 🎨 **Instagram Ad Generation**: Creates eye-catching square format images optimized for Instagram
- 🎬 **TikTok Video Generation**: Generates vertical videos using Google's Veo3 model
- 🔄 **Parallel Processing**: Generate multiple ads simultaneously for efficiency
- 🔑 **Flexible API Key Management**: Use environment variables or enter API key directly in the UI
- 📊 **Real-time Progress Tracking**: Visual progress indicators for all operations
- 💾 **Download & Save**: Automatically saves generated content with analysis reports
- 🐛 **Debug Mode**: Optional browser visibility for troubleshooting

## 🛠️ Installation

### Prerequisites

- Python 3.8 or higher
- Google Generative AI API key ([Get one here](https://makersuite.google.com/app/apikey))

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/gen-ai-experiments/ai-apps-collection/AI-Ad-Generator.git
   cd AI-Ad-Generator
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up your API key** (Optional - you can also enter it in the app)
   ```bash
   # Create a .env file
   echo "GOOGLE_API_KEY=your_api_key_here" > .env
   ```

4. **Run the application**
   ```bash
   streamlit run streamlit_app.py
   ```

## 🚀 Usage

### Quick Start

1. **Launch the app**: Run `streamlit run streamlit_app.py`
2. **Configure API Key**: Enter your Google API key in the sidebar
3. **Enter URL**: Input the landing page URL you want to analyze
4. **Choose Format**: Select Instagram (image) or TikTok (video)
5. **Generate**: Click "Generate Ads" and watch the magic happen!

### API Key Configuration

The app supports two ways to provide your Google API key:

#### Option 1: Environment Variable (Recommended)
```bash
export GOOGLE_API_KEY="your_api_key_here"
```

#### Option 2: Direct Input
- Enter your API key directly in the sidebar
- The key is securely masked and stored in session state

### Advanced Options

- **Debug Mode**: Enable to see the browser in action during analysis
- **Multiple Ads**: Generate up to 5 ads in parallel
- **Clear Results**: Reset all generated content and start fresh

## 📁 Project Structure

```
ai-ad-generator/
├── streamlit_app.py      # Main Streamlit application
├── requirements.txt      # Python dependencies
├── README.md            # This file
├── .env.example         # Example environment file
└── output/              # Generated ads and analysis (created automatically)
    ├── ad_*.png         # Generated Instagram images
    ├── ad_*.mp4         # Generated TikTok videos
    └── analysis_*.txt   # Landing page analysis reports
```

## 🎯 How It Works

1. **Landing Page Analysis**
   - Browser automation navigates to the provided URL
   - AI extracts key brand information (name, tagline, CTA, pricing)
   - Screenshots are captured for design inspiration

2. **Content Generation**
   - **Instagram**: Uses Gemini 2.5 Flash Image Preview for image generation
   - **TikTok**: Uses Veo3 for high-quality vertical video creation
   - Custom prompts ensure brand-appropriate, platform-optimized content

3. **Results & Download**
   - Generated content is displayed in the app
   - Files are automatically saved to the `output/` directory
   - Analysis reports include prompts and extracted information

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_API_KEY` | Your Google Generative AI API key | Yes |
| `BROWSER_USE_SETUP_LOGGING` | Enable browser-use logging | No |
| `BROWSER_USE_LOGGING_LEVEL` | Set logging level | No |

### Supported Models

- **Image Generation**: `gemini-2.5-flash-image-preview`
- **Video Generation**: `veo-3.0-generate-001`
- **Text Analysis**: `gemini-2.0-flash-exp`

## 📋 Requirements

```
streamlit>=1.28.0
browser-use>=1.0.0
google-generativeai>=0.3.0
aiofiles>=23.0.0
Pillow>=10.0.0
asyncio-compat>=0.1.0
```

## 🐛 Troubleshooting

### Common Issues

**"Google API Key is required" Error**
- Ensure your API key is correctly set in environment variables or entered in the sidebar
- Verify the API key has the necessary permissions for Generative AI

**Browser Automation Fails**
- Enable debug mode to see what's happening
- Check if the target website blocks automation
- Ensure stable internet connection

**Video Generation Takes Too Long**
- Video generation can take 2-5 minutes depending on complexity
- Progress bars show the current status
- Consider generating fewer videos at once

**Import Errors**
- Ensure all dependencies are installed: `pip install -r requirements.txt`
- Check Python version compatibility (3.8+)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit your changes: `git commit -am 'Add some feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Browser-Use](https://github.com/browser-use/browser-use) for web automation capabilities
- [Google Generative AI](https://ai.google.dev/) for powerful AI models
- [Streamlit](https://streamlit.io/) for the amazing web app framework

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Open an issue on GitHub
3. Make sure to include:
   - Error messages
   - Steps to reproduce
   - Your environment details (OS, Python version)

---

**Made with ❤️ buildfatwithai**
