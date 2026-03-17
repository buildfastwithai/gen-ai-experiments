"""
logic.py – Core Engine
======================
All Gemini and fal.ai functions live here.
Raises RuntimeError on failure instead of calling sys.exit so that both
cli.py and app.py can handle errors in their own way.
"""

import os
import re
import time
import requests
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ── Constants ──────────────────────────────────────────────────────────────────
FAL_MODEL_ID   = "fal-ai/qwen-image-2/pro/text-to-image"
GEMINI_MODELS  = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
]
SLIDES_DIR     = Path("slides")
NUM_SLIDES_MIN = 7
NUM_SLIDES_MAX = 8
IMAGE_SIZE     = "landscape_16_9"
OUTPUT_FORMAT  = "png"


# ── Prompt Generation (Gemini) ─────────────────────────────────────────────────
def generate_prompts(title: str, context: str, log=print) -> list[str]:
    """
    Try each model in GEMINI_MODELS in order.
    Raises RuntimeError if all models fail.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY environment variable is not set.")

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise RuntimeError("google-genai is not installed. Run: pip install google-genai")

    client = genai.Client(api_key=api_key)

    system_instruction = (
        "You are a professional presentation designer. "
        "Create detailed, vivid image-generation prompts suitable for a "
        "text-to-image AI. Each prompt must describe one slide visually, "
        "including composition, style, color palette, and mood. English only."
    )

    user_message = (
        f"Create exactly {NUM_SLIDES_MAX} image-generation prompts for a "
        f"presentation titled '{title}'.\n\n"
        f"Topic context: {context}\n\n"
        "- Each prompt should be 2–4 sentences long.\n"
        "- Include: title slide, intro, 3–4 content slides, conclusion.\n"
        "- Professional presentation aesthetics.\n"
        "- Output ONLY a numbered list: '1. <prompt>\\n2. <prompt>…'"
    )

    last_exc = None

    for model in GEMINI_MODELS:
        log(f"[INFO] Trying Gemini model: {model}…")

        try:
            response = client.models.generate_content(
                model=model,
                contents=user_message,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.8,
                ),
            )

            raw_text = str(getattr(response, "text", "") or "").strip()

            lines = re.findall(r"^\d+\.\s+(.+)", raw_text, flags=re.MULTILINE)
            prompts = [line.strip() for line in lines if line.strip()]

            if len(prompts) < NUM_SLIDES_MIN:
                log(f"[WARN] Only {len(prompts)} prompts returned; padding to {NUM_SLIDES_MAX}.")
                while len(prompts) < NUM_SLIDES_MAX:
                    prompts.append(prompts[-1])

            log(f"[INFO] {len(prompts)} slide prompts generated.")
            return prompts

        except Exception as exc:
            err = str(exc).lower()

            if "resource_exhausted" in err or "429" in err or "quota" in err:
                log(f"[WARN] '{model}' quota exhausted – trying next model…")
            else:
                log(f"[WARN] '{model}' failed: {exc} – trying next model…")

            last_exc = exc

    raise RuntimeError(
        f"All Gemini models are quota-exhausted or unavailable. Last error: {last_exc}"
    )


# ── Image Generation (fal.ai) ──────────────────────────────────────────────────
def generate_images(prompts: list[str], log=print) -> list[dict]:
    """
    Send each prompt to fal.ai Qwen-Image-2 Pro.
    Raises RuntimeError if FAL_KEY is missing or fal-client is not installed.
    Per-image failures are recorded in the result dict (url=None) and do not
    raise – the caller decides what to do with partial results.
    """

    fal_key = os.environ.get("FAL_KEY", "")
    if not fal_key:
        raise RuntimeError(
            "FAL_KEY environment variable is not set. "
            "Get your key at https://fal.ai/dashboard/keys"
        )

    try:
        import fal_client
    except ImportError:
        raise RuntimeError("fal-client is not installed. Run: pip install fal-client")

    results = []
    total = len(prompts)

    for idx, prompt in enumerate(prompts, start=1):

        log(f"[Slide {idx}/{total}] Generating image…")

        try:

            def _on_queue_update(update):

                if isinstance(update, fal_client.InProgress):

                    logs = getattr(update, "logs", None) or []

                    for entry in logs:
                        msg = (entry.get("message") or "").strip()
                        if msg:
                            log(f"  [fal] {msg}")

            english_prompt = (
                "English language only. All text, labels, and captions must be "
                "written in English. Do not use Chinese characters. " + prompt
            )

            result = fal_client.subscribe(
                FAL_MODEL_ID,
                arguments={
                    "prompt": english_prompt,
                    "negative_prompt": (
                        "blurry, low quality, distorted, watermark, "
                        "Chinese characters, Chinese text, Chinese script, "
                        "non-English text, text error"
                    ),
                    "image_size": IMAGE_SIZE,
                    "output_format": OUTPUT_FORMAT,
                    "num_images": 1,
                    "enable_safety_checker": True,
                    "enable_prompt_expansion": True,
                },
                with_logs=True,
                on_queue_update=_on_queue_update,
            )

            images = result.get("images", [])

            if not images:
                raise ValueError("API returned no images.")

            image_url = images[0].get("url")

            log(f"  ✓ Slide {idx} ready.")

            results.append({
                "slide": idx,
                "prompt": prompt,
                "url": image_url
            })

        except Exception as exc:

            log(f"  ✗ Slide {idx} failed: {exc}")

            results.append({
                "slide": idx,
                "prompt": prompt,
                "url": None,
                "error": str(exc)
            })

        if idx < total:
            time.sleep(1)

    return results


# ── Save Images ────────────────────────────────────────────────────────────────
def save_images(image_results: list[dict], output_dir: Path = SLIDES_DIR) -> list[Path]:

    """Download and save each generated image. Returns paths of saved files."""

    output_dir.mkdir(parents=True, exist_ok=True)

    saved_paths: list[Path] = []

    for item in image_results:

        url = item.get("url")

        if url is None:
            continue

        filename = output_dir / f"slide_{item['slide']:02d}.{OUTPUT_FORMAT}"

        try:

            resp = requests.get(url, timeout=60)
            resp.raise_for_status()

            filename.write_bytes(resp.content)

            saved_paths.append(filename)

        except Exception:
            pass

    return saved_paths


# ── Combine to PDF ─────────────────────────────────────────────────────────────
def combine_to_pdf(
    image_paths: list[Path], title: str, output_dir: Path = SLIDES_DIR
) -> Path | None:

    """Assemble slide images into a single A4-landscape PDF. Returns path or None."""

    if not image_paths:
        return None

    try:
        from fpdf import FPDF
        from PIL import Image
    except ImportError:
        return None

    safe_title = re.sub(r"[^\w\s-]", "", title).strip().replace(" ", "_")

    pdf_path = output_dir / f"{safe_title}_presentation.pdf"

    PAGE_W = 297
    PAGE_H = 210
    MARGIN = 10

    try:

        pdf = FPDF(orientation="L", unit="mm", format="A4")
        pdf.set_auto_page_break(auto=False)

        for img_path in image_paths:

            pdf.add_page()

            with Image.open(img_path) as img:
                img_w, img_h = img.size

            scale = min(
                (PAGE_W - 2 * MARGIN) / img_w,
                (PAGE_H - 2 * MARGIN) / img_h
            )

            draw_w = img_w * scale
            draw_h = img_h * scale

            pdf.image(
                str(img_path),
                x=(PAGE_W - draw_w) / 2,
                y=(PAGE_H - draw_h) / 2,
                w=draw_w,
                h=draw_h,
            )

        pdf.output(str(pdf_path))

        return pdf_path

    except Exception:
        return None
