# Educhain Multilingual Quiz Generator

🌍 **Generate quizzes in multiple languages using Mistral Saba, powered by Educhain!**

## 📘 Overview
This app is a Streamlit-powered tool that lets you generate multiple-choice quizzes in English, Hindi, Tamil, and Malayalam. It uses the Mistral Saba model via OpenRouter API to create quizzes dynamically based on your chosen topic.

---

## 🚀 Features
- **Multilingual Support:** Generate quizzes in English, Hindi, Tamil, and Malayalam.
- **Customizable Topics:** Choose a language and enter your desired quiz topic.
- **Flexible Question Count:** Select the number of questions (1–10).
- **AI-Powered Questions:** Uses Mistral Saba for intelligent, beginner-friendly quiz generation.
- **Instant Feedback:** View correct answers for each question.

---

## 🛠️ Installation & Setup

1. **Clone the repository:**
```bash
git clone https://github.com/gen-ai-experiments/educhain-multilingual-quiz
cd educhain-multilingual-quiz
```

2. **Install dependencies:**
```bash
pip install -r requirements.txt
```

3. **Run the app:**
```bash
streamlit run app.py
```

---

## 🔑 API Key Configuration
The app requires an OpenRouter API key to access the Mistral Saba model.

1. Get your API key from [OpenRouter](https://openrouter.ai).
2. Enter the API key in the sidebar when prompted.

> 🔒 *Your key is stored only during the session and never shared.*

---

## 🧠 How It Works
1. **Select a language:** Choose from English, Hindi, Tamil, or Malayalam.
2. **Enter a topic:** Specify a quiz topic or use the suggested default.
3. **Set the number of questions:** Pick how many questions you want (up to 10).
4. **Generate the quiz:** Click the button, and the AI will generate questions, options, and answers!

Example output:
```
Question 1: What is the speed of light?
  A. 3,00,000 km/s
  B. 1,50,000 km/s
  C. 299,792 km/s
  D. 100,000 km/s

  *(Correct Answer: C)*
```

---

## 🚩 Error Handling
- **API Key Missing:** The app warns if no API key is provided.
- **Quiz Generation Failures:** Displays detailed error messages and troubleshooting steps.
- **Input Validation:** Ensures valid language, topic, and question count selections.

---

## 🎯 Future Improvements
- Add more languages (e.g., Spanish, French, German).
- Support different difficulty levels (Beginner, Intermediate, Advanced).
- Enable quiz export (PDF, CSV).
- Include detailed explanations for correct answers.

---

## 🤝 Contributing
Contributions are welcome! Feel free to fork the repo, create a feature branch, and submit a pull request.

---

## 📄 License
MIT License. See `LICENSE` for details.

---

## 📬 Contact
For questions, reach out to [Build Fast with AI](https://buildfastwithai.com/genai-course) or visit the [Educhain GitHub](https://github.com/satvik314/educhain).

---

Happy quiz-making! 🚀

