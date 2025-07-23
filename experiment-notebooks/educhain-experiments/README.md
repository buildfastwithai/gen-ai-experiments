# Educhain Experiments

This directory contains experiments and demonstrations using the [Educhain](https://pypi.org/project/educhain/) library for automated question generation, management, and database integration.

## 📄 Contents

- `Question_generation_using_educhain.ipynb`: Jupyter notebook demonstrating how to generate, display, and manage multiple-choice questions (MCQs) using Educhain, with custom schemas and Supabase integration.

## 🚀 Overview

The main notebook in this directory walks through:
- Installing and setting up the Educhain library
- Defining custom Pydantic models for MCQs and options, matching a Supabase table schema
- Creating a custom prompt template for diverse and fun question generation
- Generating MCQs using Educhain's `qna_engine`
- Displaying and optionally deleting generated questions interactively
- Shuffling answer options for each question
- Pushing generated questions to a Supabase database table

## 🛠️ Technologies Used
- Python
- Jupyter Notebook
- [Educhain](https://pypi.org/project/educhain/)
- [Supabase](https://supabase.com/) (for database integration)
- Pydantic (for schema validation)

## ▶️ How to Use
1. Open `Question_generation_using_educhain.ipynb` in Jupyter or Google Colab.
2. Follow the cells to install dependencies and set up API keys.
3. Customize the prompt template and parameters as needed.
4. Run the notebook to generate, review, and manage MCQs.
5. (Optional) Connect to your Supabase instance to store generated questions in a database table.

## 📦 Example Features
- Customizable MCQ schema (question, options, explanation, Bloom's level, difficulty, metadata, etc.)
- Interactive question review and deletion
- Option shuffling for fairness
- Database push for persistent storage

## 📄 License
This directory follows the main repository's MIT License. See the root `LICENSE` file for details. 