# 🎮 World's Fastest Game Generator

An AI-powered game generator that creates playable HTML5 games using Qwen-3 Series models via Baseten's infrastructure. Simply describe your game idea and watch as AI generates a complete, playable game in seconds!

## ✨ Features

- **Instant Game Creation**: Generate complete HTML5 games from text descriptions
- **Interactive Chat Interface**: Iteratively improve your games through conversation
- **Multiple AI Models**: Choose between Qwen3-Coder models for optimal performance
- **Canvas-Based Games**: All games are built using HTML5 Canvas for smooth gameplay
- **Download Games**: Export your generated games as standalone HTML files
- **Professional UI**: Clean, modern interface with branding

## 🚀 Quick Start

### Prerequisites

- Python 3.8 or higher
- Baseten API Key ([Get one here](https://baseten.co))

### Installation

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd qwen-game-gen
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the application**
   ```bash
   streamlit run app.py
   ```

4. **Open your browser** and navigate to `http://localhost:8501`

## 🔧 Configuration

1. **Get your Baseten API Key**:
   - Sign up at [Baseten](https://baseten.co)
   - Navigate to your API settings
   - Copy your API key

2. **Enter your API key** in the sidebar when running the app

3. **Select your preferred model**:
   - `Qwen/Qwen3-Coder-480B-A35B-Instruct` (Recommended for complex games)
   - `Qwen/Qwen3-235B-A22B-Instruct-25077` (Faster generation)

## 🎯 How to Use

### Creating Your First Game

1. **Enter your Baseten API key** in the sidebar
2. **Describe your game idea** in the chat input, for example:
   - "Create a snake game with colorful graphics"
   - "Make a space invaders game with power-ups"
   - "Build a puzzle game where you match colors"
3. **Wait for generation** (usually 10-30 seconds)
4. **Play your game** directly in the browser
5. **Download the HTML file** to share or host elsewhere

### Improving Your Game

Once you have a game, you can improve it by chatting with the AI:
- "Add sound effects"
- "Make it more challenging"
- "Change the colors to blue and green"
- "Add a scoring system"

## 🛠️ Technical Details

### Architecture
- **Frontend**: Streamlit for the web interface
- **AI Backend**: Qwen-3 Series models via Baseten API
- **Game Engine**: HTML5 Canvas with JavaScript
- **State Management**: Streamlit session state for chat history

### Supported Game Types
- Arcade games (Snake, Pac-Man style)
- Puzzle games (Tetris, Match-3)
- Action games (Space shooters, platformers)
- Simple RPG elements
- Educational games

### Generated Game Features
- ✅ Canvas-based rendering
- ✅ Keyboard/mouse controls
- ✅ Game over detection
- ✅ Retry functionality
- ✅ Responsive design
- ✅ Standalone HTML files

## 📁 Project Structure

```
qwen-game-gen/
├── app.py              # Main Streamlit application
├── requirements.txt    # Python dependencies
└── README.md          # This file
```

## 🔍 Troubleshooting

### Common Issues

**"Invalid HTML received" error**:
- Try rephrasing your game description
- Be more specific about the type of game you want
- Check your API key is valid

**App won't start**:
- Ensure all dependencies are installed: `pip install -r requirements.txt`
- Check Python version is 3.8+
- Verify Streamlit is properly installed

**Games not displaying**:
- Check browser console for JavaScript errors
- Try refreshing the page
- Ensure the generated HTML is complete

### API Issues

**Authentication errors**:
- Verify your Baseten API key is correct
- Check your Baseten account has sufficient credits
- Ensure API key has proper permissions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- **Baseten** for providing AI infrastructure
- **Qwen Team (Alibaba)** for the powerful code generation models
- **Build Fast with AI** for the educational content and inspiration
- **Streamlit** for the amazing web framework

## 📞 Support

For questions or issues:
1. Check the troubleshooting section above
2. Review Baseten's documentation
3. Create an issue in this repository

---

**Built with ❤️ using Qwen-3 Series models and Baseten infrastructure**
