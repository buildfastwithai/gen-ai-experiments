"""
cli.py – Command-Line Interface
================================
Thin wrapper around logic.py.  Run with:
    python cli.py
    python cli.py --title "Quantum Computing" --context "An intro to qubits."
    python cli.py --no-pdf
"""

import sys
import argparse
import textwrap

from logic import (
    generate_prompts,
    generate_images,
    save_images,
    combine_to_pdf,
    SLIDES_DIR,
)


def get_user_input():
    parser = argparse.ArgumentParser(
        description="AI-Powered Presentation Generator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            Examples:
              python cli.py
              python cli.py --title "Machine Learning" --context "Supervised vs unsupervised."
        """),
    )
    parser.add_argument("--title",   type=str, help="Title of the presentation")
    parser.add_argument("--context", type=str, help="Topic description / context")
    parser.add_argument("--no-pdf",  action="store_true", help="Skip PDF assembly")
    args = parser.parse_args()

    title = args.title or input("📌  Enter the presentation title: ").strip()
    if not title:
        print("[ERROR] Title cannot be empty.")
        sys.exit(1)

    context = args.context or input("📝  Enter a brief description / context:\n> ").strip()
    if not context:
        print("[ERROR] Context cannot be empty.")
        sys.exit(1)

    return title, context, args.no_pdf


def _print_summary(title, image_results, saved_paths, pdf_path):
    total     = len(image_results)
    succeeded = sum(1 for r in image_results if r.get("url"))
    div       = "─" * 60
    print(div)
    print("  PRESENTATION GENERATOR – SUMMARY")
    print(div)
    print(f"  Title  : {title}")
    print(f"  Slides : {succeeded}/{total} generated successfully")
    if total - succeeded:
        print(f"  Failed : {total - succeeded} slide(s)")
    print(f"  Output : {SLIDES_DIR.resolve()}")
    if pdf_path:
        print(f"  PDF    : {pdf_path.resolve()}")
    print(div)
    for r in image_results:
        status = "✓" if r.get("url") else "✗"
        print(f"  [{status}] Slide {r['slide']:02d} – {r['prompt'][:55]}…")
    print(div)


def main():
    print("=" * 60)
    print("  AI PRESENTATION GENERATOR")
    print("  Powered by Gemini + Qwen-Image-2 Pro (fal.ai)")
    print("=" * 60 + "\n")

    title, context, skip_pdf = get_user_input()
    print(f"\n[INFO] Title  : {title}")
    print(f"[INFO] Context: {context[:120]}{'…' if len(context) > 120 else ''}\n")

    # ── Step 1: Generate prompts ──────────────────────────────────────────────
    try:
        prompts = generate_prompts(title, context)
    except RuntimeError as e:
        print(f"[ERROR] {e}")
        sys.exit(1)

    print("\nGenerated prompts:")
    for i, p in enumerate(prompts, 1):
        print(f"  [{i:02d}] {p[:100]}{'…' if len(p) > 100 else ''}")
    print()

    # ── Step 2: Generate images ───────────────────────────────────────────────
    try:
        image_results = generate_images(prompts)
    except RuntimeError as e:
        print(f"[ERROR] {e}")
        sys.exit(1)

    # ── Step 3: Save images ───────────────────────────────────────────────────
    saved_paths = save_images(image_results)

    # ── Step 4: Assemble PDF ──────────────────────────────────────────────────
    pdf_path = None
    if not skip_pdf and saved_paths:
        pdf_path = combine_to_pdf(saved_paths, title)
        if pdf_path:
            print(f"[PDF] Saved → {pdf_path}")

    _print_summary(title, image_results, saved_paths, pdf_path)


if __name__ == "__main__":
    main()
