import asyncio
import logging
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, cast
import base64

import streamlit as st
import aiofiles
from google import genai
from PIL import Image

from browser_use import Agent, BrowserSession
from browser_use.llm.google import ChatGoogle

# Page configuration
st.set_page_config(
    page_title="AI Ad Generator",
    page_icon="🎨",
    layout="wide",
    initial_sidebar_state="expanded"
)

def setup_environment(debug: bool):
    if not debug:
        os.environ['BROWSER_USE_SETUP_LOGGING'] = 'false'
        os.environ['BROWSER_USE_LOGGING_LEVEL'] = 'critical'
        logging.getLogger().setLevel(logging.CRITICAL)
    else:
        os.environ['BROWSER_USE_SETUP_LOGGING'] = 'true'
        os.environ['BROWSER_USE_LOGGING_LEVEL'] = 'info'

# Initialize session state
if 'generated_ads' not in st.session_state:
    st.session_state.generated_ads = []
if 'analysis_data' not in st.session_state:
    st.session_state.analysis_data = None
if 'api_key' not in st.session_state:
    st.session_state.api_key = os.getenv('GOOGLE_API_KEY', '')

class LandingPageAnalyzer:
    def __init__(self, debug: bool = False, api_key: str = None):
        self.debug = debug
        if not api_key:
            api_key = st.session_state.get('api_key') or os.getenv('GOOGLE_API_KEY')
        if not api_key:
            st.error("Google API Key is required!")
            st.stop()
        self.llm = ChatGoogle(model='gemini-2.0-flash-exp', api_key=api_key)
        self.output_dir = Path('output')
        self.output_dir.mkdir(exist_ok=True)

    async def analyze_landing_page(self, url: str, mode: str = 'instagram') -> dict:
        browser_session = BrowserSession(
            headless=not self.debug,
        )

        agent = Agent(
            task=f"""Go to {url} and quickly extract key brand information for Instagram ad creation.

Steps:
1. Navigate to the website
2. From the initial view, extract ONLY these essentials:
   - Brand/Product name
   - Main tagline or value proposition (one sentence)
   - Primary call-to-action text
   - Any visible pricing or special offer
3. Scroll down half a page, twice (0.5 pages each) to check for any key info
4. Done - keep it simple and focused on the brand

Return ONLY the key brand info, not page structure details.""",
            llm=self.llm,
            browser_session=browser_session,
            max_actions_per_step=2,
            step_timeout=30,
            use_thinking=False,
            vision_detail_level='high',
        )

        screenshot_path = None
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        async def screenshot_callback(agent_instance):
            nonlocal screenshot_path
            await asyncio.sleep(4)
            screenshot_path = self.output_dir / f'landing_page_{timestamp}.png'
            await agent_instance.browser_session.take_screenshot(path=str(screenshot_path), full_page=False)

        screenshot_task = asyncio.create_task(screenshot_callback(agent))
        history = await agent.run()
        try:
            await screenshot_task
        except Exception as e:
            st.warning(f'Screenshot task failed: {e}')

        analysis = history.final_result() or 'No analysis content extracted'
        return {'url': url, 'analysis': analysis, 'screenshot_path': screenshot_path, 'timestamp': timestamp}


class AdGenerator:
    def __init__(self, api_key: str | None = None, mode: str = 'instagram'):
        if not api_key:
            api_key = st.session_state.get('api_key') or os.getenv('GOOGLE_API_KEY')
        if not api_key:
            raise ValueError('Google API Key is required')

        self.client = genai.Client(api_key=api_key)
        self.output_dir = Path('output')
        self.output_dir.mkdir(exist_ok=True)
        self.mode = mode

    async def create_video_concept(self, browser_analysis: str, ad_id: int) -> str:
        """Generate a unique creative concept for each video ad"""
        if self.mode != 'tiktok':
            return ''

        concept_prompt = f"""Based on this brand analysis:
{browser_analysis}

Create a UNIQUE and SPECIFIC TikTok video concept #{ad_id}.

Be creative and different! Consider various approaches like:
- Different visual metaphors and storytelling angles
- Various trending TikTok formats (transitions, reveals, transformations)
- Different emotional appeals (funny, inspiring, surprising, relatable)
- Unique visual styles (neon, retro, minimalist, maximalist, surreal)
- Different perspectives (first-person, aerial, macro, time-lapse)

Return a 2-3 sentence description of a specific, unique video concept that would work for this brand.
Make it visually interesting and different from typical ads. Be specific about visual elements, transitions, and mood."""

        response = self.client.models.generate_content(model='gemini-2.0-flash-exp', contents=concept_prompt)
        return response.text if response and response.text else ''

    def create_ad_prompt(self, browser_analysis: str, video_concept: str = '') -> str:
        if self.mode == 'instagram':
            prompt = f"""Create an Instagram ad for this brand:

{browser_analysis}

Create a vibrant, eye-catching Instagram ad image with:
- Try to use the colors and style of the logo or brand, else:
- Bold, modern gradient background with bright colors
- Large, playful sans-serif text with the product/service name from the analysis
- Trendy design elements: geometric shapes, sparkles, emojis
- Fun bubbles or badges for any pricing or special offers mentioned
- Call-to-action button with text from the analysis
- Emphasizes the key value proposition from the analysis
- Uses visual elements that match the brand personality
- Square format (1:1 ratio)
- Use color psychology to drive action

Style: Modern Instagram advertisement, (1:1), scroll-stopping, professional but playful, conversion-focused"""
        else:  # tiktok
            if video_concept:
                prompt = f"""Create a TikTok video ad based on this specific concept:

{video_concept}

Brand context: {browser_analysis}

Requirements:
- Vertical 9:16 format
- High quality, professional execution
- Bring the concept to life exactly as described
- No text overlays, pure visual storytelling"""
            else:
                prompt = f"""Create a viral TikTok video ad for this brand:

{browser_analysis}

Create a dynamic, engaging vertical video with:
- Quick hook opening that grabs attention immediately
- Minimal text overlays (focus on visual storytelling)
- Fast-paced but not overwhelming editing
- Authentic, relatable energy that appeals to Gen Z
- Vertical 9:16 format optimized for mobile
- High energy but professional execution

Style: Modern TikTok advertisement, viral potential, authentic energy, minimal text, maximum visual impact"""
        return prompt

    async def generate_ad_image(self, prompt: str, screenshot_path: Path | None = None) -> bytes | None:
        """Generate ad image bytes using Gemini. Returns None on failure."""
        try:
            contents: list[Any] = [prompt]

            if screenshot_path and screenshot_path.exists():
                img = Image.open(screenshot_path)
                w, h = img.size
                side = min(w, h)
                img = img.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))
                contents = [prompt + '\n\nHere is the actual landing page screenshot to reference for design inspiration:', img]

            response = await self.client.aio.models.generate_content(
                model='gemini-2.5-flash-image-preview',
                contents=contents,
            )

            cand = getattr(response, 'candidates', None)
            if cand:
                for part in getattr(cand[0].content, 'parts', []):
                    inline = getattr(part, 'inline_data', None)
                    if inline:
                        return inline.data
        except Exception as e:
            st.error(f'Image generation failed: {e}')
        return None

    async def generate_ad_video(self, prompt: str, screenshot_path: Path | None = None, ad_id: int = 1) -> bytes:
        """Generate ad video using Veo3."""
        api_key = st.session_state.get('api_key') or os.getenv('GOOGLE_API_KEY')
        sync_client = genai.Client(api_key=api_key)

        operation = sync_client.models.generate_videos(
            model='veo-3.0-generate-001',
            prompt=prompt,
            config=cast(Any, {'aspectRatio': '9:16', 'resolution': '720p'}),
        )

        progress_bar = st.progress(0)
        status_text = st.empty()
        
        iteration = 0
        while not operation.done:
            await asyncio.sleep(10)
            operation = sync_client.operations.get(operation)
            iteration += 1
            progress = min(iteration * 10, 90)  # Max 90% until done
            progress_bar.progress(progress)
            status_text.text(f"Generating video... {progress}%")

        progress_bar.progress(100)
        status_text.text("Video generation complete!")

        if not operation.response or not operation.response.generated_videos:
            raise RuntimeError('No videos generated')
        videos = operation.response.generated_videos
        video = videos[0]
        video_file = getattr(video, 'video', None)
        if not video_file:
            raise RuntimeError('No video file in response')
        sync_client.files.download(file=video_file)
        video_bytes = getattr(video_file, 'video_bytes', None)
        if not video_bytes:
            raise RuntimeError('No video bytes in response')
        return video_bytes

    async def save_results(self, ad_content: bytes, prompt: str, analysis: str, url: str, timestamp: str) -> str:
        if self.mode == 'instagram':
            content_path = self.output_dir / f'ad_{timestamp}.png'
        else:  # tiktok
            content_path = self.output_dir / f'ad_{timestamp}.mp4'

        async with aiofiles.open(content_path, 'wb') as f:
            await f.write(ad_content)

        analysis_path = self.output_dir / f'analysis_{timestamp}.txt'
        async with aiofiles.open(analysis_path, 'w', encoding='utf-8') as f:
            await f.write(f'URL: {url}\n\n')
            await f.write('BROWSER-USE ANALYSIS:\n')
            await f.write(analysis)
            await f.write('\n\nGENERATED PROMPT:\n')
            await f.write(prompt)

        return str(content_path)


async def generate_single_ad(page_data: dict, mode: str, ad_id: int):
    """Generate a single ad using pre-analyzed page data"""
    generator = AdGenerator(mode=mode)

    try:
        if mode == 'instagram':
            prompt = generator.create_ad_prompt(page_data['analysis'])
            ad_content = await generator.generate_ad_image(prompt, page_data.get('screenshot_path'))
            if ad_content is None:
                raise RuntimeError(f'Ad image generation failed for ad #{ad_id}')
        else:  # tiktok
            video_concept = await generator.create_video_concept(page_data['analysis'], ad_id)
            prompt = generator.create_ad_prompt(page_data['analysis'], video_concept)
            ad_content = await generator.generate_ad_video(prompt, page_data.get('screenshot_path'), ad_id)

        # Create unique timestamp for each ad
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S') + f'_{ad_id}'
        result_path = await generator.save_results(ad_content, prompt, page_data['analysis'], page_data['url'], timestamp)

        return {'path': result_path, 'content': ad_content, 'mode': mode, 'ad_id': ad_id}

    except Exception as e:
        st.error(f'Error for ad #{ad_id}: {e}')
        raise


async def create_multiple_ads(url: str, debug: bool = False, mode: str = 'instagram', count: int = 1, api_key: str = None):
    """Generate multiple ads in parallel using asyncio concurrency"""
    
    # Analyze the landing page first
    with st.spinner('🚀 Analyzing landing page...'):
        analyzer = LandingPageAnalyzer(debug=debug, api_key=api_key)
        page_data = await analyzer.analyze_landing_page(url, mode=mode)
        st.session_state.analysis_data = page_data

    # Display analysis results
    st.success('✅ Landing page analysis complete!')
    
    with st.expander("📊 Analysis Results", expanded=True):
        st.write("**URL:**", page_data['url'])
        st.write("**Analysis:**")
        st.text(page_data['analysis'])
        
        if page_data.get('screenshot_path') and Path(page_data['screenshot_path']).exists():
            st.write("**Landing Page Screenshot:**")
            st.image(str(page_data['screenshot_path']), caption="Landing Page Screenshot", width=400)

    # Generate ads
    st.write(f'🎯 Generating {count} {mode} ad(s)...')
    
    progress_bar = st.progress(0)
    status_text = st.empty()
    
    results = []
    successful = []
    failed = []

    for i in range(count):
        try:
            status_text.text(f'Generating ad {i+1}/{count}...')
            result = await generate_single_ad(page_data, mode, i + 1)
            results.append(result)
            successful.append(result)
            progress_bar.progress((i + 1) / count)
        except Exception as e:
            failed.append(i + 1)
            st.error(f'Failed to generate ad {i+1}: {e}')

    status_text.text('Generation complete!')
    
    st.success(f'✅ Successfully generated {len(successful)}/{count} ads')
    if failed:
        st.warning(f'❌ Failed ads: {failed}')

    # Store results in session state
    st.session_state.generated_ads.extend(successful)
    
    return successful


def display_generated_ads():
    """Display all generated ads in the session"""
    if not st.session_state.generated_ads:
        st.info("No ads generated yet. Use the form above to create some!")
        return
    
    st.header("🎨 Generated Ads")
    
    # Create columns for better layout
    cols = st.columns(2)
    
    for i, ad_data in enumerate(st.session_state.generated_ads):
        col = cols[i % 2]
        
        with col:
            st.subheader(f"Ad #{ad_data['ad_id']} ({ad_data['mode'].title()})")
            
            if ad_data['mode'] == 'instagram':
                # Display image
                if Path(ad_data['path']).exists():
                    st.image(ad_data['path'], caption=f"Instagram Ad #{ad_data['ad_id']}")
                else:
                    # Display from bytes if file doesn't exist
                    st.image(ad_data['content'], caption=f"Instagram Ad #{ad_data['ad_id']}")
            else:
                # Display video
                if Path(ad_data['path']).exists():
                    st.video(ad_data['path'])
                else:
                    st.video(ad_data['content'])
            
            # Download button
            if Path(ad_data['path']).exists():
                with open(ad_data['path'], 'rb') as f:
                    file_data = f.read()
                    file_ext = 'png' if ad_data['mode'] == 'instagram' else 'mp4'
                    st.download_button(
                        label=f"Download Ad #{ad_data['ad_id']}",
                        data=file_data,
                        file_name=f"ad_{ad_data['ad_id']}.{file_ext}",
                        mime=f"image/{file_ext}" if ad_data['mode'] == 'instagram' else f"video/{file_ext}"
                    )


def main():
    st.title("🎨 AI Ad Generator")
    st.markdown("Generate Instagram images or TikTok videos from any landing page using AI")
    
    # Sidebar for configuration
    with st.sidebar:
        st.header("⚙️ Configuration")
        
        # API Key input
        st.subheader("🔑 Google API Key")
        
        # Check if API key exists in environment
        env_api_key = os.getenv('GOOGLE_API_KEY')
        
        if env_api_key:
            st.success("✅ API Key found in environment")
            use_env_key = st.checkbox("Use environment API key", value=True)
            if use_env_key:
                st.session_state.api_key = env_api_key
            else:
                user_api_key = st.text_input(
                    "Enter your Google API Key:",
                    type="password",
                    value="",
                    help="Enter your Google Generative AI API key"
                )
                if user_api_key:
                    st.session_state.api_key = user_api_key
        else:
            st.info("💡 Enter your Google API Key below")
            user_api_key = st.text_input(
                "Google API Key:",
                type="password",
                value=st.session_state.get('api_key', ''),
                help="Get your API key from https://makersuite.google.com/app/apikey"
            )
            if user_api_key:
                st.session_state.api_key = user_api_key
                st.success("✅ API Key configured")
            else:
                st.warning("⚠️ API Key required to generate ads")
        
        st.divider()
        
        # Debug mode
        debug_mode = st.checkbox("🐛 Debug Mode", help="Show browser and verbose logs")
        setup_environment(debug_mode)
        
        st.divider()
        
        # Clear results button
        if st.button("🗑️ Clear All Results"):
            st.session_state.generated_ads = []
            st.session_state.analysis_data = None
            st.success("Results cleared!")
            st.rerun()
            
        # API Key status
        st.subheader("📊 Status")
        current_api_key = st.session_state.get('api_key')
        if current_api_key:
            st.success(f"✅ API Key: {current_api_key[:8]}...{current_api_key[-4:]}")
        else:
            st.error("❌ No API Key configured")

    # Main form
    with st.form("ad_generator_form"):
        st.subheader("📝 Ad Generation Settings")
        
        # URL input
        url = st.text_input(
            "🔗 Landing Page URL",
            placeholder="https://www.example.com",
            help="Enter the URL of the landing page you want to analyze"
        )
        
        # Mode selection
        col1, col2 = st.columns(2)
        with col1:
            mode = st.selectbox(
                "📱 Ad Type",
                options=["instagram", "tiktok"],
                format_func=lambda x: "Instagram Image" if x == "instagram" else "TikTok Video"
            )
        
        with col2:
            count = st.number_input(
                "🔢 Number of Ads",
                min_value=1,
                max_value=5,
                value=1,
                help="Number of ads to generate in parallel"
            )
        
        # Submit button
        submitted = st.form_submit_button("🚀 Generate Ads", type="primary")
        
        if submitted:
            current_api_key = st.session_state.get('api_key')
            if not url:
                st.error("Please enter a URL")
            elif not current_api_key:
                st.error("Please configure your Google API key in the sidebar")
            else:
                try:
                    # Run the async function
                    results = asyncio.run(create_multiple_ads(url, debug_mode, mode, count, current_api_key))
                    if results:
                        st.success(f"🎉 Successfully generated {len(results)} ad(s)!")
                except Exception as e:
                    st.error(f"An error occurred: {e}")

    # Display generated ads
    display_generated_ads()


if __name__ == "__main__":
    main()
