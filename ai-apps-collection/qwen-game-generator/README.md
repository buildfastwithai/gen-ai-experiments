# 🎮 Qwen Game Generator

Generate playable HTML5 games from your ideas using the Qwen3-Coder model via OpenRouter!

Qwen3-Coder is a powerful, open-source AI model designed specifically for code generation and other software development tasks, released by Alibaba's Qwen team. It is their most advanced code model to date.

**🕹️ Play your generated game right inside the app and ask for improvements or changes in the chat!**

---

## 🖼️ Screenshot

made a snake game in the interface just by prompting a single line
![App Screenshot](snake.png)

also tried with flappy bird game, results were amazing
![App Screenshot](image.png)

---

## 🚀 Features
- Generate complete HTML5 games from text prompts
- **Play the game instantly in the app UI**
- **Request improvements or modifications directly in the chat**
- Improve or modify existing games with follow-up requests
- Download the generated game as a standalone HTML file
- Powered by Alibaba's Qwen3-Coder model via OpenRouter

---

## 🛠️ How to Use
1. **Install requirements:**
   ```bash
   pip install -r requirements.txt
   ```
2. **Run the app:**
   ```bash
   streamlit run app.py
   ```
3. **Enter your OpenRouter API key** in the sidebar.
4. **Describe your game idea** or suggest improvements in the chat.
   - 🕹️ **Play the generated game right below the chat!**
   - 💡 **Ask for changes or enhancements directly in the chat interface.**
5. **Download** your generated game!

---

## ⚙️ Configuration
- **API Key:** Get your [OpenRouter API key](https://openrouter.ai/)
- **Model:** Uses `qwen/qwen3-coder` by default

---

## 🙏 Credits
- Built with [Streamlit](https://streamlit.io/)
- Powered by [LangChain](https://python.langchain.com/) and [Qwen3-Coder](https://github.com/QwenLM/Qwen)
- Created by [Build Fast with AI](https://buildfastwithai.com/genai-course)

---

## 📄 License
MIT License

Copyright (c) 2024 buildfastwithai

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE. 