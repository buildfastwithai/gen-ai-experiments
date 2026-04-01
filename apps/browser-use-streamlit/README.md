# 🤖 Browser Use Agent - Streamlit App 🚀

This Streamlit application allows you to leverage AI agents to perform tasks in a web browser. It supports both OpenAI and Google Gemini LLMs. The agent navigates websites, extracts information, and follows instructions based on the given task.

## ✨ Features

*   **Task Execution in a Browser:** The agent uses a web browser to complete tasks, interacting with web pages like a human.
*   **LLM Powered:**  Utilizes either OpenAI's GPT models or Google's Gemini models to interpret tasks and plan actions.
*   **Step-by-Step History:** Provides a detailed history of the agent's actions, including goals, extracted content, and screenshots.
*   **Screenshot Support:** Displays screenshots of the browser at each step of the process, allowing you to visualize the agent's progress.


## 🚀 Getting Started

1.  **Clone the GitHub Repository:** 
    ```bash
    git clone https://github.com/gen-ai-experiments/Browser-use-streamlit.git
    cd Browser-use-streamlit
    ```

2.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```



## 🛠️ Usage

1.  **Run the Streamlit App:**
    ```bash
    streamlit run app.py
    ```

2.  **Enter API Keys:**  In the sidebar, enter your OpenAI API key or your Google API key. You only need to enter one of these.

3.  **Enter Task:** In the main panel, enter the task you want the agent to perform.  Be as specific as possible for best results.

4.  **Observe Results:** The app will display the agent's steps, extracted content, and screenshots  as it progresses through the task.


## 🧠 Built With

*   Python
*   Playwright
*   browser-use
*   Streamlit
*   langchain
*   openai
  



## 📄 License

This project is licensed under the MIT License.

## 🙌 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

## 📩 Contact

For questions or suggestions, reach out via email or open an issue on GitHub.
