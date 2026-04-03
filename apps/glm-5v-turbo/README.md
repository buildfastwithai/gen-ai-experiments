# GLM-5V-Turbo UI Use Cases (Python Only)

This workspace contains 4 separate, UI-focused Python apps (Streamlit) for GLM-5V-Turbo:

- `website_url_to_code`
- `wireframe_to_code`
- `image_to_code`
- `video_to_code`

## 1) Setup

```bash
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and set your API key:

```bash
ZAI_API_KEY=your_real_key
ZAI_BASE_URL=https://api.z.ai/api/paas/v4/chat/completions
```

## 2) Run Any Use Case

```bash
streamlit run website_url_to_code/app.py
streamlit run wireframe_to_code/app.py
streamlit run image_to_code/app.py
streamlit run video_to_code/app.py
```

## Notes

- Model used: `glm-5v-turbo`
- Endpoint: `POST https://api.z.ai/api/paas/v4/chat/completions`
- These demos return generated code as text for you to copy into your project.
