import streamlit as st
import requests
import json
import os
from io import StringIO

# App title and description
st.set_page_config(page_title="AnyCrawl Web Scraper", page_icon="🕷️", layout="wide")
st.title("🕷️ AnyCrawl Web Scraper")
st.markdown("Transform any webpage into structured data optimized for Large Language Models (LLM)")

# Sidebar for API key input
    
with st.sidebar:
    # === BRANDING SECTION ===
    st.markdown(
        "<div style='text-align: center; margin: 2px 0;'>"
        "<a href='https://www.buildfastwithai.com/' target='_blank' style='text-decoration: none;'>"
        "<div style='border: 2px solid #e0e0e0; border-radius: 6px; padding: 4px; "
        "background: linear-gradient(145deg, #ffffff, #f5f5f5); "
        "box-shadow: 0 2px 6px rgba(0,0,0,0.1); "
        "transition: all 0.3s ease; display: inline-block; width: 100%;'>"
        "<img src='https://github.com/Shubhwithai/chat-with-qwen/blob/main/company_logo.png?raw=true' "
        "style='width: 100%; max-width: 100%; height: auto; border-radius: 8px; display: block;' "
        "alt='Build Fast with AI Logo'>"
        "</div>"
        "</a>"
    "</div>",
    unsafe_allow_html=True
    )

    st.header("API Configuration")
    api_key = st.text_input("Enter AnyCrawl API Key:", type="password")
    
    st.markdown("---")
    st.header("About")
    st.markdown("""
    This app uses AnyCrawl to scrape webpages and convert them into structured data optimized for LLMs.
    
    **Features:**
    - Extract clean content from any webpage
    - Get content in multiple formats (Markdown, HTML, etc.)
    - Perfect for LLM processing
    """)
    
    st.markdown("---")
    st.markdown(
        "**❤️ Built by** [Build Fast with AI](https://buildfastwithai.com/genai-course)",
        unsafe_allow_html=True
    )

# Main content area
if not api_key:
    st.warning("Please enter your AnyCrawl API Key in the sidebar to get started.")
    st.stop()

# URL input
url = st.text_input("Enter URL to scrape:", placeholder="https://example.com")

if not url:
    st.info("Please enter a URL to scrape.")
    st.stop()

# Scrape options
with st.expander("Scraping Options", expanded=True):
    engine = st.selectbox("Scraping Engine", ["cheerio", "playwright", "puppeteer"], 
                         help="cheerio for static pages, playwright/puppeteer for dynamic pages")
    
    formats = st.multiselect("Output Formats", ["markdown", "html", "rawHtml", "screenshot@fullPage", "links", "json"],
                            default=["markdown"],
                            help="Select the formats you want to receive")
    
    timeout = st.slider("Timeout (ms)", min_value=5000, max_value=120000, value=30000, step=5000)
    
    wait_for = st.slider("Wait for (ms) - for dynamic pages", min_value=0, max_value=10000, value=0, step=500,
                        help="Time to wait after page load for dynamic content")

# Function to call AnyCrawl API
def call_anycrawl(payload, api_key):
    ANYCRAWL_API = "https://api.anycrawl.dev/v1/scrape"
    HEADERS = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    try:
        with st.spinner("Scraping webpage..."):
            resp = requests.post(ANYCRAWL_API, headers=HEADERS, json=payload, timeout=120)
            try:
                data = resp.json()
            except Exception as e:
                st.error(f"Non-JSON response: {resp.status_code}\n{resp.text}")
                return None
                
            if not data.get("success", False):
                st.error(f"AnyCrawl error: {data.get('error')} - {data.get('message')}")
                return None
                
            return data
    except Exception as e:
        st.error(f"Request failed: {str(e)}")
        return None

# Scrape button
if st.button("Scrape Webpage", type="primary"):
    # Prepare payload
    payload = {
        "url": url,
        "engine": engine,
        "formats": formats,
        "timeout": timeout
    }
    
    if wait_for > 0 and engine in ["playwright", "puppeteer"]:
        payload["wait_for"] = wait_for
        
    # Call API
    result = call_anycrawl(payload, api_key)
    
    if result:
        data = result['data']
        st.success("Scraping completed successfully!")
        
        # Display results
        col1, col2 = st.columns(2)
        
        with col1:
            st.subheader("Page Information")
            st.write(f"**URL:** {data.get('url', 'N/A')}")
            st.write(f"**Title:** {data.get('title', 'N/A')}")
            st.write(f"**Status:** {data.get('status', 'N/A')}")
            
        with col2:
            st.subheader("Available Formats")
            for fmt in formats:
                if fmt in data:
                    st.write(f"✓ {fmt}")
        
        # Display content based on selected formats
        st.markdown("---")
        st.subheader("Scraped Content")
        
        # Show markdown content
        if "markdown" in data and data["markdown"]:
            st.markdown("### Markdown Content")
            with st.expander("View Markdown Content", expanded=True):
                st.markdown(data["markdown"])
                
            # Download markdown
            st.download_button(
                label="Download Markdown",
                data=data["markdown"],
                file_name=f"scraped_content_{url.replace('https://', '').replace('http://', '').replace('/', '_')}.md",
                mime="text/markdown"
            )
            
        # Show raw HTML
        if "rawHtml" in data and data["rawHtml"]:
            st.markdown("### Raw HTML")
            with st.expander("View Raw HTML"):
                st.code(data["rawHtml"], language="html")
                
            # Download HTML
            st.download_button(
                label="Download HTML",
                data=data["rawHtml"],
                file_name=f"scraped_content_{url.replace('https://', '').replace('http://', '').replace('/', '_')}.html",
                mime="text/html"
            )
            
        # Show links
        if "links" in data and data["links"]:
            st.markdown("### Extracted Links")
            with st.expander("View Extracted Links"):
                for link in data["links"]:
                    st.markdown(f"- [{link.get('text', 'Link')}]({link.get('url', '#')})")
        
        # Show screenshot
        if "screenshot" in data and data["screenshot"]:
            st.markdown("### Screenshot")
            st.image(data["screenshot"], caption="Full Page Screenshot", use_column_width=True)
            
            # Download screenshot
            st.download_button(
                label="Download Screenshot",
                data=requests.get(data["screenshot"]).content,
                file_name=f"screenshot_{url.replace('https://', '').replace('http://', '').replace('/', '_')}.jpeg",
                mime="image/jpeg"
            )
            
        # Show JSON
        if "json" in data and data["json"]:
            st.markdown("### JSON Data")
            with st.expander("View JSON Data"):
                st.json(data["json"])
                
            # Download JSON
            json_str = json.dumps(data["json"], indent=2)
            st.download_button(
                label="Download JSON",
                data=json_str,
                file_name=f"scraped_data_{url.replace('https://', '').replace('http://', '').replace('/', '_')}.json",
                mime="application/json"
            )

# Footer
st.markdown("---")
st.markdown("Made with ❤️ using AnyCrawl and Streamlit")