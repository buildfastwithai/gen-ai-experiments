# VibeVoice TTS Demo

A Python application that automatically sets up and runs Microsoft's VibeVoice text-to-speech model with a Gradio web interface, optimized for CPU execution.

## Overview

This application automates the entire setup process for Microsoft's VibeVoice TTS model:
- Clones the official VibeVoice repository
- Installs the package and dependencies
- Modifies the demo script for CPU compatibility
- Launches a Gradio web interface for easy interaction

## Features

- **Automated Setup**: One-click installation and configuration
- **CPU Optimized**: Modified to run on CPU without requiring GPU/CUDA
- **Web Interface**: User-friendly Gradio interface for text-to-speech conversion
- **Shareable**: Includes share option for public access to the demo

## Requirements

- Python 3.8+
- Git installed on your system
- Internet connection for cloning repository and downloading models

## Installation

1. Clone or download this project
2. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

Simply run the main application:

```bash
python app.py
```

The script will automatically:
1. Clone the Microsoft VibeVoice repository (if not already present)
2. Install the VibeVoice package
3. Modify the demo script for CPU execution
4. Launch the Gradio interface

Once running, you can access the web interface to convert text to speech using the VibeVoice model.

## Dependencies

- **torch**: PyTorch framework
- **accelerate**: Hugging Face acceleration library
- **transformers**: Hugging Face transformers library
- **diffusers**: Diffusion models library
- **gradio**: Web interface framework
- **soundfile & librosa**: Audio processing libraries
- **av & aiortc**: Audio/video processing
- **numpy, scipy**: Scientific computing libraries

## Model Information

- **Model**: microsoft/VibeVoice-1.5B
- **Execution**: CPU-optimized (torch.float32)
- **Interface**: Gradio web demo with sharing enabled

## Technical Details

The application performs the following modifications to ensure CPU compatibility:
- Changes `torch_dtype` from `torch.bfloat16` to `torch.float32`
- Sets `device_map` to "cpu"
- Removes GPU-specific attention implementation

## Notes

- First run will take longer due to model download
- The Gradio interface will be accessible via a local URL
- Share option is enabled for public access if needed
- Requires sufficient RAM for model loading (recommended: 8GB+)

## Troubleshooting

- Ensure Git is installed and accessible from command line
- Check internet connection for repository cloning and model download
- Verify Python version compatibility (3.8+)
- For memory issues, consider using a smaller model variant

## License

This project uses Microsoft's VibeVoice model. Please refer to the original repository for licensing terms.
