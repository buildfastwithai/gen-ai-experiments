"""
app.py – Streamlit Web App
===========================
Run with:
    streamlit run app.py
"""

import streamlit as st
from pathlib import Path

from logic import (
    generate_prompts,
    generate_images,
    save_images,
    combine_to_pdf,
)

st.set_page_config(page_title="AI Presentation Generator", layout="wide")
st.title("🎨 AI Presentation Generator")
st.caption("Powered by Gemini + Qwen-Image-2 Pro (fal.ai)")

title   = st.text_input("Presentation Title", placeholder="e.g. Machine Learning 101")
context = st.text_area(
    "Topic Context",
    placeholder="Brief description of what the presentation covers…",
    height=100,
)
skip_pdf = st.checkbox("Skip PDF assembly", value=False)

if st.button("🚀 Generate Presentation", disabled=not (title and context)):

    # ── Step 1: Prompts ───────────────────────────────────────────────────────
    with st.status("Generating slide prompts with Gemini…", expanded=True) as status:
        log_lines: list[str] = []
        try:
            prompts = generate_prompts(title, context, log=log_lines.append)
            for line in log_lines:
                st.write(line)
            status.update(label=f"✅ {len(prompts)} prompts generated", state="complete")
        except RuntimeError as e:
            status.update(label="❌ Gemini failed", state="error")
            st.error(str(e))
            st.stop()

    # ── Step 2: Images ────────────────────────────────────────────────────────
    with st.status("Generating images with fal.ai…", expanded=True) as status:
        log_lines.clear()
        try:
            image_results = generate_images(prompts, log=log_lines.append)
            for line in log_lines:
                st.write(line)
            succeeded = sum(1 for r in image_results if r.get("url"))
            status.update(
                label=f"✅ {succeeded}/{len(prompts)} images generated",
                state="complete",
            )
        except RuntimeError as e:
            status.update(label="❌ Image generation failed", state="error")
            st.error(str(e))
            st.stop()

    # ── Step 3: Save ──────────────────────────────────────────────────────────
    saved_paths = save_images(image_results)

    # ── Step 4: Gallery ───────────────────────────────────────────────────────
    st.subheader("🖼️ Generated Slides")
    cols = st.columns(3)
    for i, path in enumerate(saved_paths):
        with cols[i % 3]:
            st.image(str(path), caption=f"Slide {i + 1}", use_container_width=True)

    # ── Step 5: PDF download ──────────────────────────────────────────────────
    if not skip_pdf and saved_paths:
        pdf_path = combine_to_pdf(saved_paths, title)
        if pdf_path:
            st.download_button(
                label="📄 Download PDF",
                data=Path(pdf_path).read_bytes(),
                file_name=pdf_path.name,
                mime="application/pdf",
            )
