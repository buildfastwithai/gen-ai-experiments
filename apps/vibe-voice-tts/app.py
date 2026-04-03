import os
import subprocess
import sys
from pathlib import Path

# --- 1. Clone the VibeVoice Repository ---
repo_dir = "VibeVoice"
if not os.path.exists(repo_dir):
    print("Cloning the VibeVoice repository...")
    try:
        subprocess.run(
            ["git", "clone", "https://github.com/microsoft/VibeVoice.git"],
            check=True,
            capture_output=True,
            text=True
        )
        print("Repository cloned successfully.")
    except subprocess.CalledProcessError as e:
        print(f"Error cloning repository: {e.stderr}")
        sys.exit(1)
else:
    print("Repository already exists. Skipping clone.")

# --- 2. Install the Package ---
os.chdir(repo_dir)
print(f"Changed directory to: {os.getcwd()}")

print("Installing the VibeVoice package...")
try:
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "-e", "."],
        check=True,
        capture_output=True,
        text=True
    )
    print("Package installed successfully.")
except subprocess.CalledProcessError as e:
    print(f"Error installing package: {e.stderr}")
    sys.exit(1)

# --- 3. Modify the demo script for CPU execution (Robust Method) ---
demo_script_path = Path("demo/gradio_demo.py")
print(f"Modifying {demo_script_path} for CPU execution...")

try:
    # Read the entire file content
    file_content = demo_script_path.read_text()

    # Define the original GPU-specific model loading block
    original_block = """        self.model = VibeVoiceForConditionalGenerationInference.from_pretrained(
            self.model_path,
            torch_dtype=torch.bfloat16,
            device_map='cuda',
            attn_implementation="flash_attention_2",
        )"""

    # Define the new CPU-compatible block
    replacement_block = """        self.model = VibeVoiceForConditionalGenerationInference.from_pretrained(
            self.model_path,
            torch_dtype=torch.float32,  # Use float32 for CPU
            device_map="cpu",
        )"""

    # Replace the entire block
    if original_block in file_content:
        modified_content = file_content.replace(original_block, replacement_block)
        
        # Write the modified content back to the file
        demo_script_path.write_text(modified_content)
        print("Script modified successfully.")
    else:
        print("Warning: GPU-specific model loading block not found. The script might have been updated. Proceeding without modification.")

except Exception as e:
    print(f"An error occurred while modifying the script: {e}")
    sys.exit(1)


# --- 4. Launch the Gradio Demo ---
model_id = "microsoft/VibeVoice-1.5B"

# Construct the command as specified in the README
command = [
    "python",
    str(demo_script_path),
    "--model_path",
    model_id,
    "--share"
]

print(f"Launching Gradio demo with command: {' '.join(command)}")
# This command will start the Gradio server
subprocess.run(command)