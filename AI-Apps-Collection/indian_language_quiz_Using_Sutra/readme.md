# 🗣️ Multilingual Quiz Generator using Sutra & Educhain

This Streamlit app allows users to generate multiple-choice quiz questions in various Indian languages using the **Sutra-v2** model via the **Educhain** framework.

## 🌟 Features

- 🔤 **Multilingual Support**: Generate quiz questions in **Telugu, Hindi, Tamil, Kannada, Malayalam, Bengali, and Gujarati**.
- 🧠 **Custom Topics**: Input your own topic or choose from suggested topics based on the selected language.
- 🔐 **API Integration**: Powered by `Sutra-v2` model from [TwoAI](https://docs.two.ai).
- 📑 **Formatted Output**: Clean tab-based interface to view questions and answer keys with explanations.
- ⚡ Built using **Streamlit**, **Educhain**, and **LangChain**.

## 🛠️ How It Works

1. Enter your **Sutra API Key** (get one from [TwoAI Docs](https://docs.two.ai)).
2. Choose your **preferred language** and **topic**.
3. Select how many questions you want to generate (5–20).
4. Click **"Generate Quiz"** and get instant questions with multiple options and explanations!

## 📦 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/multilingual-quiz-generator.git
cd multilingual-quiz-generator

### 2. Create a Virtual Environment (Optional but Recommended)
```bash
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows


###3. Install Dependencies
```bash
pip install -r requirements.txt


### 4. 🚀 Run the App
```bash
streamlit run app.py


📚 Technologies Used
- Streamlit
- Educhain
- LangChain

###Sutra Model (TwoAI)

###🤝 Contributing
Contributions, issues, and feature requests are welcome!

###📄 License
This project is licensed under the MIT License.

Made with ❤️ using Educhain and the Sutra model